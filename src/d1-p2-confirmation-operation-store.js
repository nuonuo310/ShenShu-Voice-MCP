/**
 * Offline-only D1 operation store for the Voice V1 P2 explicit-confirmation
 * path. The injected client MUST already expose a single-statement `query`
 * (the existing Cloudflare D1 REST client does).
 *
 * Admission is deliberately ONE SQL statement:
 *
 *   pending_confirmation --UPDATE--> provider_pending
 *     + AFTER UPDATE trigger reserves one free daily slot
 *     + trigger issues and consumes the one-use grant
 *     + any missing row raises ABORT, rolling back the whole statement
 *
 * There is no batch() call and no sequence of separate writes that could
 * commit halfway. A local node:sqlite test proves the SQL/trigger semantics,
 * not Cloudflare D1 behavior; real D1 remains a separately authorized
 * qualification gate. This module is not mounted by server.js.
 */
import {
  P2_OPERATION_STATES,
  validRecord as isValidP2OperationRecord,
} from "./v1-p2-operation-contract.js";
import {
  PRIVATE_TEXT_SEALED_MARKER,
} from "./v1-p2-private-text-sealer.js";
import { V1_OFFLINE_MAX_DAILY_CALLS } from "./v1-offline-paid-pipeline.js";

const HANDLE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const OPERATION_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const DIGEST_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT_BYTES = 800;

const COLUMNS = `
  principal, handle, operation_id, action, text, text_digest, text_bytes,
  origin, state, max_daily_calls, day_utc, request_id, grant_id,
  issued_at, expires_at, updated_at`;

const SEALED_COLUMNS = `${COLUMNS}, sealed_text`;

const INSERT_PENDING = `
INSERT INTO paid_voice_confirmation_operations
  (principal, handle, operation_id, action, text, text_digest, text_bytes,
   origin, max_daily_calls, state, issued_at, expires_at, updated_at)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'pending_confirmation', ?10, ?11, ?10)
RETURNING operation_id`.trim();

const INSERT_PENDING_SEALED = `
INSERT INTO paid_voice_confirmation_operations
  (principal, handle, operation_id, action, text, text_digest, text_bytes,
   origin, max_daily_calls, state, issued_at, expires_at, updated_at,
   sealed_text)
VALUES (?1, ?2, ?3, ?4, '${PRIVATE_TEXT_SEALED_MARKER}', ?5, ?6, ?7, ?8,
        'pending_confirmation', ?9, ?10, ?9, ?11)
RETURNING operation_id`.trim();

const SELECT_BY_HANDLE = `
SELECT ${COLUMNS}
FROM paid_voice_confirmation_operations
WHERE principal = ?1 AND handle = ?2`.trim();

const SELECT_BY_HANDLE_SEALED = `
SELECT ${SEALED_COLUMNS}
FROM paid_voice_confirmation_operations
WHERE principal = ?1 AND handle = ?2`.trim();

const SELECT_PENDING = `
SELECT ${COLUMNS}
FROM paid_voice_confirmation_operations
WHERE principal = ?1
  AND state = 'pending_confirmation'
  AND expires_at > ?2
ORDER BY issued_at DESC, handle ASC
LIMIT ?3`.trim();

const SELECT_PENDING_SEALED = `
SELECT ${SEALED_COLUMNS}
FROM paid_voice_confirmation_operations
WHERE principal = ?1
  AND state = 'pending_confirmation'
  AND expires_at > ?2
ORDER BY issued_at DESC, handle ASC
LIMIT ?3`.trim();

const SELECT_STATE_BY_HANDLE = `
SELECT operation_id, state
FROM paid_voice_confirmation_operations
WHERE principal = ?1 AND handle = ?2`.trim();

const SELECT_STATE_BY_OPERATION = `
SELECT state
FROM paid_voice_confirmation_operations
WHERE principal = ?1 AND operation_id = ?2`.trim();

// Exactly one statement. The trigger does the reservation, grant issue,
// grant consume and rollback-on-failure work inside this statement.
const CLAIM = `
UPDATE paid_voice_confirmation_operations
SET state = 'provider_pending',
    day_utc = ?1,
    request_id = operation_id,
    grant_id = 'grant_' || operation_id,
    updated_at = ?2
WHERE principal = ?3
  AND handle = ?4
  AND state = 'pending_confirmation'
  AND expires_at > ?2
  AND text_digest = ?5
  AND text_bytes = ?6
RETURNING operation_id, request_id, grant_id`.trim();

const CLAIM_SEALED = `
UPDATE paid_voice_confirmation_operations
SET state = 'provider_pending',
    day_utc = ?1,
    request_id = operation_id,
    grant_id = 'grant_' || operation_id,
    updated_at = ?2
WHERE principal = ?3
  AND handle = ?4
  AND state = 'pending_confirmation'
  AND expires_at > ?2
  AND text_digest = ?5
  AND text_bytes = ?6
  AND text = '${PRIVATE_TEXT_SEALED_MARKER}'
  AND sealed_text IS NOT NULL
RETURNING operation_id, request_id, grant_id`.trim();

const MARK_COMPLETED = `
UPDATE paid_voice_confirmation_operations
SET state = 'completed', updated_at = ?1
WHERE principal = ?2
  AND operation_id = ?3
  AND handle = ?4
  AND state = 'provider_pending'
RETURNING operation_id`.trim();

const MARK_UNKNOWN = `
UPDATE paid_voice_confirmation_operations
SET state = 'unknown', updated_at = ?1
WHERE principal = ?2
  AND operation_id = ?3
  AND handle = ?4
  AND state IN ('confirming', 'provider_pending')
RETURNING operation_id`.trim();

const ATTEST_ADMISSION = `
SELECT o.state, o.request_id, o.grant_id, o.day_utc, o.max_daily_calls,
       r.principal AS reservation_principal, r.slot,
       g.principal AS grant_principal, g.request_id AS grant_request_id,
       g.state AS grant_state
FROM paid_voice_confirmation_operations o
JOIN paid_voice_reservations r ON r.request_id = o.request_id
JOIN paid_voice_grants g ON g.grant_id = o.grant_id
WHERE o.principal = ?1 AND o.operation_id = ?2`.trim();

const SCHEMA_OBJECTS = `
SELECT type, name
FROM sqlite_master
WHERE name IN (
  'paid_voice_confirmation_operations',
  'paid_voice_confirmation_admit',
  'paid_voice_confirmation_operations_pending',
  'paid_voice_confirmation_operations_day'
)
ORDER BY name`.trim();

const FOREIGN_KEYS = "PRAGMA foreign_keys";

const TABLE_INFO = "PRAGMA table_info(paid_voice_confirmation_operations)";

function utcDay(now) {
  let day;
  try {
    day = new Date(now).toISOString().slice(0, 10);
  } catch {
    return null;
  }
  if (!DAY_PATTERN.test(day)) return null;
  const parsed = new Date(day + "T00:00:00.000Z");
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === day
    ? day
    : null;
}

function bindingFromRow(row) {
  return Object.freeze({
    principal: row.principal,
    handle: row.handle,
    operationId: row.operation_id,
    action: row.action,
    origin: row.origin,
    textBytes: row.text_bytes,
    expiresAt: row.expires_at,
  });
}

function bindingFromRecord(record) {
  return Object.freeze({
    principal: record.principal,
    handle: record.handle,
    operationId: record.operationId,
    action: record.action,
    origin: record.origin,
    textBytes: record.textBytes,
    expiresAt: record.expiresAt,
  });
}

function toRecord(row, { sealed = false, textSealer = null } = {}) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new Error("operation_store_invalid");
  }
  let text;
  let digest;
  if (sealed) {
    if (row.text !== PRIVATE_TEXT_SEALED_MARKER ||
        typeof row.sealed_text !== "string" || !textSealer) {
      throw new Error("operation_store_invalid");
    }
    let opened;
    try {
      opened = textSealer.open({
        sealedText: row.sealed_text,
        ...bindingFromRow(row),
        digestBinding: row.text_digest,
      });
    } catch {
      throw new Error("operation_store_invalid");
    }
    text = opened.text;
    digest = opened.textDigest;
  } else {
    text = row.text;
    digest = row.text_digest;
  }
  const record = {
    version: 1,
    action: row.action,
    handle: row.handle,
    operationId: row.operation_id,
    principal: row.principal,
    text,
    textDigest: digest,
    textBytes: row.text_bytes,
    origin: row.origin,
    state: row.state,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
  };
  if (!isValidP2OperationRecord(record)) throw new Error("operation_store_invalid");
  if (record.state === P2_OPERATION_STATES.PENDING_CONFIRMATION ||
      record.state === P2_OPERATION_STATES.CONFIRMING) {
    if (row.request_id !== null || row.grant_id !== null || row.day_utc !== null) {
      throw new Error("operation_store_invalid");
    }
  } else if (row.request_id !== record.operationId ||
      row.grant_id !== "grant_" + record.operationId ||
      !DAY_PATTERN.test(row.day_utc ?? "")) {
    throw new Error("operation_store_invalid");
  }
  return Object.freeze(record);
}

function validTransitionArgs({ principal, handle, operationId, now } = {}) {
  return typeof principal === "string" &&
    HANDLE_PATTERN.test(handle ?? "") &&
    OPERATION_ID_PATTERN.test(operationId ?? "") &&
    Number.isSafeInteger(now) && now >= 0;
}

export function createD1P2ConfirmationOperationStore({
  client,
  maximumDailyCalls = V1_OFFLINE_MAX_DAILY_CALLS,
  textSealer = null,
} = {}) {
  if (!client || typeof client.query !== "function" ||
      !Number.isSafeInteger(maximumDailyCalls) ||
      maximumDailyCalls < 1 ||
      maximumDailyCalls > V1_OFFLINE_MAX_DAILY_CALLS ||
      (textSealer !== null &&
        (typeof textSealer?.seal !== "function" ||
         typeof textSealer?.open !== "function" ||
         typeof textSealer?.digestBinding !== "function"))) {
    throw new Error("operation_store_unavailable");
  }
  const sealed = textSealer !== null;

  async function query(sql, params) {
    try {
      const rows = await client.query(sql, params);
      if (!Array.isArray(rows)) throw new Error("operation_store_invalid");
      return rows;
    } catch (error) {
      if (error?.message === "operation_store_invalid") throw error;
      throw new Error("operation_store_unavailable");
    }
  }

  return Object.freeze({
    async createPending(record) {
      if (!isValidP2OperationRecord(record) ||
          record.state !== P2_OPERATION_STATES.PENDING_CONFIRMATION) {
        return { created: false, reason: "invalid" };
      }
      let sealedValues = null;
      if (sealed) {
        try {
          sealedValues = textSealer.seal({
            text: record.text,
            ...bindingFromRecord(record),
          });
          if (sealedValues?.textDigest !== record.textDigest ||
              sealedValues?.textBytes !== record.textBytes) {
            throw new Error("sealed_text_invalid");
          }
        } catch {
          throw new Error("operation_store_unavailable");
        }
      }
      let rows;
      try {
        rows = sealed
          ? await client.query(INSERT_PENDING_SEALED, [
            record.principal,
            record.handle,
            record.operationId,
            record.action,
            sealedValues.digestBinding,
            record.textBytes,
            record.origin,
            maximumDailyCalls,
            record.issuedAt,
            record.expiresAt,
            sealedValues.sealedText,
          ])
          : await client.query(INSERT_PENDING, [
            record.principal,
            record.handle,
            record.operationId,
            record.action,
            record.text,
            record.textDigest,
            record.textBytes,
            record.origin,
            maximumDailyCalls,
            record.issuedAt,
            record.expiresAt,
          ]);
      } catch (error) {
        if (/UNIQUE constraint failed/i.test(String(error?.message ?? ""))) {
          return { created: false, reason: "collision" };
        }
        throw new Error("operation_store_unavailable");
      }
      if (!Array.isArray(rows) || rows.length !== 1 ||
          rows[0]?.operation_id !== record.operationId) {
        throw new Error("operation_store_invalid");
      }
      return { created: true };
    },

    async get({ principal, handle } = {}) {
      if (typeof principal !== "string" || !HANDLE_PATTERN.test(handle ?? "")) return null;
      const rows = await query(
        sealed ? SELECT_BY_HANDLE_SEALED : SELECT_BY_HANDLE,
        [principal, handle],
      );
      if (rows.length > 1) throw new Error("operation_store_invalid");
      return rows.length === 1
        ? toRecord(rows[0], { sealed, textSealer })
        : null;
    },

    async listPending({ principal, now, limit = 10 } = {}) {
      if (typeof principal !== "string" ||
          !Number.isSafeInteger(now) || now < 0 ||
          !Number.isSafeInteger(limit) || limit < 1 || limit > 20) {
        return [];
      }
      const rows = await query(
        sealed ? SELECT_PENDING_SEALED : SELECT_PENDING,
        [principal, now, limit],
      );
      if (rows.length > limit) throw new Error("operation_store_invalid");
      return rows.map(row => toRecord(row, { sealed, textSealer }));
    },

    async claim({ principal, handle, textDigest: digest, textBytes, now } = {}) {
      if (typeof principal !== "string" ||
          !HANDLE_PATTERN.test(handle ?? "") ||
          !DIGEST_PATTERN.test(digest ?? "") ||
          !Number.isSafeInteger(textBytes) ||
          textBytes < 1 || textBytes > MAX_TEXT_BYTES ||
          !Number.isSafeInteger(now) || now < 0) {
        return { claimed: false, reason: "invalid" };
      }
      const day = utcDay(now);
      if (!day) return { claimed: false, reason: "clock" };

      let digestBinding = digest;
      if (sealed) {
        const current = await query(
          SELECT_BY_HANDLE_SEALED,
          [principal, handle],
        );
        if (current.length > 1) throw new Error("operation_store_invalid");
        if (current.length === 0) return { claimed: false, reason: "state" };
        const record = toRecord(current[0], { sealed: true, textSealer });
        if (record.textDigest !== digest || record.textBytes !== textBytes) {
          return { claimed: false, reason: "binding_mismatch" };
        }
        try {
          digestBinding = textSealer.digestBinding(
            bindingFromRecord(record),
            digest,
          );
        } catch {
          throw new Error("operation_store_unavailable");
        }
      }

      let rows;
      try {
        rows = await client.query(
          sealed ? CLAIM_SEALED : CLAIM,
          [day, now, principal, handle, digestBinding, textBytes],
        );
      } catch (error) {
        if (String(error?.message ?? "").includes("quota_denied")) {
          return { claimed: false, reason: "quota" };
        }
        throw new Error("operation_store_unavailable");
      }
      if (!Array.isArray(rows)) throw new Error("operation_store_invalid");
      if (rows.length === 0) return { claimed: false, reason: "state" };
      if (rows.length !== 1) throw new Error("operation_store_invalid");
      const row = rows[0];
      if (!OPERATION_ID_PATTERN.test(row?.operation_id ?? "") ||
          row.request_id !== row.operation_id ||
          row.grant_id !== "grant_" + row.operation_id) {
        throw new Error("operation_store_invalid");
      }
      return Object.freeze({
        claimed: true,
        operationId: row.operation_id,
        requestId: row.request_id,
        grantId: row.grant_id,
      });
    },

    async markProviderPending({ principal, handle, operationId } = {}) {
      if (typeof principal !== "string" ||
          !HANDLE_PATTERN.test(handle ?? "") ||
          !OPERATION_ID_PATTERN.test(operationId ?? "")) {
        return { updated: false };
      }
      const rows = await query(SELECT_STATE_BY_HANDLE, [principal, handle]);
      if (rows.length > 1) throw new Error("operation_store_invalid");
      return {
        updated: rows.length === 1 &&
          rows[0].operation_id === operationId &&
          rows[0].state === P2_OPERATION_STATES.PROVIDER_PENDING,
      };
    },

    async markCompleted({ principal, handle, operationId, now } = {}) {
      if (!validTransitionArgs({ principal, handle, operationId, now })) {
        return { updated: false };
      }
      const rows = await query(MARK_COMPLETED, [now, principal, operationId, handle]);
      if (rows.length > 1) throw new Error("operation_store_invalid");
      return {
        updated: rows.length === 1 && rows[0].operation_id === operationId,
      };
    },

    async markUnknown({ principal, handle, operationId, now } = {}) {
      if (!validTransitionArgs({ principal, handle, operationId, now })) {
        return { updated: false };
      }
      const rows = await query(MARK_UNKNOWN, [now, principal, operationId, handle]);
      if (rows.length > 1) throw new Error("operation_store_invalid");
      if (rows.length === 1 && rows[0].operation_id === operationId) {
        return { updated: true };
      }
      const current = await query(SELECT_STATE_BY_OPERATION, [principal, operationId]);
      if (current.length > 1) throw new Error("operation_store_invalid");
      return {
        updated: current.length === 1 &&
          current[0].state === P2_OPERATION_STATES.UNKNOWN,
      };
    },

    async attestAdmission({ principal, operationId } = {}) {
      if (typeof principal !== "string" ||
          !OPERATION_ID_PATTERN.test(operationId ?? "")) {
        return { admitted: false };
      }
      const rows = await query(ATTEST_ADMISSION, [principal, operationId]);
      if (rows.length > 1) throw new Error("operation_store_invalid");
      if (rows.length !== 1) return { admitted: false };
      const row = rows[0];
      if (row.state !== P2_OPERATION_STATES.PROVIDER_PENDING ||
          row.request_id !== operationId ||
          row.grant_id !== "grant_" + operationId ||
          row.reservation_principal !== principal ||
          row.grant_principal !== principal ||
          row.grant_request_id !== operationId ||
          row.grant_state !== "consumed" ||
          !Number.isSafeInteger(row.slot) ||
          row.slot < 1 ||
          row.slot > row.max_daily_calls) {
        return { admitted: false };
      }
      return Object.freeze({ admitted: true, slot: row.slot });
    },

    async verifySchema() {
      const objects = await query(SCHEMA_OBJECTS, []);
      const foreignKeys = await query(FOREIGN_KEYS, []);
      if (foreignKeys.length !== 1 || foreignKeys[0]?.foreign_keys !== 1) {
        throw new Error("schema_unqualified");
      }
      const names = new Set(objects.map(row => row?.name));
      for (const required of [
        "paid_voice_confirmation_operations",
        "paid_voice_confirmation_admit",
        "paid_voice_confirmation_operations_pending",
        "paid_voice_confirmation_operations_day",
      ]) {
        if (!names.has(required)) throw new Error("schema_unqualified");
      }
      if (sealed) {
        const tableInfo = await query(TABLE_INFO, []);
        const column = tableInfo.find(row => row?.name === "sealed_text");
        if (tableInfo.length === 0 || !column ||
            String(column.type ?? "").toUpperCase() !== "TEXT" ||
            Number(column.notnull) !== 0 || column.dflt_value !== null) {
          throw new Error("schema_unqualified");
        }
      }
      return Object.freeze({
        ok: true,
        singleStatementAdmission: true,
        foreignKeys: true,
        ...(sealed ? { sealedText: true } : {}),
      });
    },
  });
}

export const D1_P2_CONFIRMATION_SQL = Object.freeze({
  insertPending: INSERT_PENDING,
  insertPendingSealed: INSERT_PENDING_SEALED,
  selectByHandle: SELECT_BY_HANDLE,
  selectByHandleSealed: SELECT_BY_HANDLE_SEALED,
  selectPending: SELECT_PENDING,
  selectPendingSealed: SELECT_PENDING_SEALED,
  claim: CLAIM,
  claimSealed: CLAIM_SEALED,
  markCompleted: MARK_COMPLETED,
  markUnknown: MARK_UNKNOWN,
  attestAdmission: ATTEST_ADMISSION,
});
