/**
 * Offline transactional operation store for the additive 003 schema.
 *
 * The injected client MUST provide an all-or-nothing batch() implementation
 * and explicitly advertise atomicBatch=true. This module does not infer D1
 * REST atomicity, and it is not wired to a paid route.
 */
import { randomUUID } from "node:crypto";
import { D1_OPERATION_SQL } from "./d1-operation-sql.js";
import { D1_PAID_SQL } from "./d1-paid-store.js";
import {
  V1_OPERATION_ACTION,
  V1_OPERATION_MAX_TTL_MS,
} from "./v1-transport-idempotency.js";

const IDENT = /^[A-Za-z0-9_-]{8,128}$/;
const DIGEST = /^[A-Za-z0-9_-]{43}$/;
const RESULT_REF = /^[A-Za-z0-9_-]{8,128}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const STATES = new Set(["admitted", "provider_pending", "completed", "unknown"]);

function fail(code) {
  throw new Error(code);
}

function safeTime(clock) {
  const value = clock();
  if (!Number.isSafeInteger(value) || value < 0) fail("operation_clock_error");
  return value;
}

function utcDay(nowMs) {
  const day = new Date(nowMs).toISOString().slice(0, 10);
  if (!DAY.test(day)) fail("operation_clock_error");
  return day;
}

function validBinding(binding) {
  return binding && typeof binding === "object" && !Array.isArray(binding) &&
    binding.version === 1 &&
    binding.action === V1_OPERATION_ACTION &&
    IDENT.test(binding.principal ?? "") &&
    IDENT.test(binding.operationId ?? "") &&
    Number.isSafeInteger(binding.textBytes) &&
    binding.textBytes >= 1 && binding.textBytes <= 800 &&
    DIGEST.test(binding.textDigest ?? "") &&
    Number.isSafeInteger(binding.issuedAt) && binding.issuedAt >= 0 &&
    Number.isSafeInteger(binding.expiresAt) &&
    binding.expiresAt > binding.issuedAt &&
    binding.expiresAt - binding.issuedAt <= V1_OPERATION_MAX_TTL_MS;
}

function normalizeRow(row, principal, operationId) {
  if (!row || typeof row !== "object" || Array.isArray(row)) fail("operation_store_invalid");
  if (row.principal !== principal || row.operation_id !== operationId ||
      !IDENT.test(row.request_id ?? "") || !IDENT.test(row.grant_id ?? "") ||
      row.action !== V1_OPERATION_ACTION ||
      !DIGEST.test(row.text_digest ?? "") ||
      !Number.isSafeInteger(row.text_bytes) || row.text_bytes < 1 || row.text_bytes > 800 ||
      !STATES.has(row.state) ||
      !Number.isSafeInteger(row.issued_at) || row.issued_at < 0 ||
      !Number.isSafeInteger(row.expires_at) || row.expires_at <= row.issued_at ||
      row.expires_at - row.issued_at > V1_OPERATION_MAX_TTL_MS ||
      row.reservation_principal !== principal ||
      !DAY.test(row.day_utc ?? "") ||
      !Number.isSafeInteger(row.slot) || row.slot < 1 || row.slot > 20 ||
      row.grant_principal !== principal ||
      row.grant_request_id !== row.request_id ||
      row.grant_state !== "consumed" ||
      (row.state === "completed"
        ? !RESULT_REF.test(row.result_ref ?? "")
        : row.result_ref !== null && row.result_ref !== undefined)) {
    fail("operation_store_invalid");
  }
  return Object.freeze({
    principal: row.principal,
    operationId: row.operation_id,
    requestId: row.request_id,
    grantId: row.grant_id,
    action: row.action,
    textDigest: row.text_digest,
    textBytes: row.text_bytes,
    state: row.state,
    resultRef: row.result_ref ?? null,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    day: row.day_utc,
    slot: row.slot,
  });
}

function replayFromExisting(existing, binding, nowMs) {
  if (!existing) return null;
  if (existing.action !== binding.action ||
      existing.textBytes !== binding.textBytes ||
      existing.textDigest !== binding.textDigest) {
    return Object.freeze({ status: "conflict" });
  }
  if (existing.expiresAt <= nowMs) return Object.freeze({ status: "expired" });
  return Object.freeze({
    status: "replay",
    state: existing.state,
    resultRef: existing.resultRef,
    record: existing,
  });
}

export function createD1TransactionalOperationStore({
  client,
  clock = () => Date.now(),
  maximumDailyCalls = 3,
  makeRequestId = randomUUID,
  makeGrantId = () => "grant_" + randomUUID().replaceAll("-", ""),
} = {}) {
  if (!client || typeof client.query !== "function" ||
      typeof client.batch !== "function" || client.atomicBatch !== true ||
      typeof clock !== "function" ||
      !Number.isSafeInteger(maximumDailyCalls) ||
      maximumDailyCalls < 1 || maximumDailyCalls > 20 ||
      typeof makeRequestId !== "function" || typeof makeGrantId !== "function") {
    fail("atomic_batch_contract_unavailable");
  }

  async function readOperation(principal, operationId) {
    let rows;
    try {
      rows = await client.query(D1_OPERATION_SQL.selectByKey, [principal, operationId]);
    } catch {
      fail("operation_store_unavailable");
    }
    if (!Array.isArray(rows) || rows.length > 1) fail("operation_store_invalid");
    if (rows.length === 0) return null;
    return normalizeRow(rows[0], principal, operationId);
  }

  function validateAdmissionResults(results, {
    binding,
    requestId,
    grantId,
    reservationDay,
  }) {
    if (!Array.isArray(results) || results.length !== 4 ||
        !results.every(Array.isArray)) {
      fail("operation_store_invalid");
    }
    const [reservationRows, grantRows, operationRows, consumeRows] = results;
    if (reservationRows.length === 0) {
      if (grantRows.length !== 0 || operationRows.length !== 0 || consumeRows.length !== 0) {
        fail("operation_store_invalid");
      }
      return Object.freeze({ status: "daily_limit" });
    }
    if (reservationRows.length !== 1) fail("operation_store_invalid");
    const reservation = reservationRows[0];
    if (!reservation || reservation.request_id !== requestId ||
        !Number.isSafeInteger(reservation.slot) ||
        reservation.slot < 1 || reservation.slot > maximumDailyCalls) {
      fail("operation_store_invalid");
    }
    if (grantRows.length !== 1 || grantRows[0]?.grant_id !== grantId) {
      fail("operation_store_invalid");
    }
    if (operationRows.length !== 1) fail("operation_store_invalid");
    const operation = operationRows[0];
    if (!operation ||
        operation.principal !== binding.principal ||
        operation.operation_id !== binding.operationId ||
        operation.request_id !== requestId ||
        operation.grant_id !== grantId ||
        operation.state !== "admitted") {
      fail("operation_store_invalid");
    }
    if (consumeRows.length !== 1 || consumeRows[0]?.grant_id !== grantId) {
      fail("operation_store_invalid");
    }
    return Object.freeze({
      status: "admitted",
      record: Object.freeze({
        principal: binding.principal,
        operationId: binding.operationId,
        requestId,
        grantId,
        action: binding.action,
        textDigest: binding.textDigest,
        textBytes: binding.textBytes,
        state: "admitted",
        resultRef: null,
        issuedAt: binding.issuedAt,
        expiresAt: binding.expiresAt,
        day: reservationDay,
        slot: reservation.slot,
      }),
    });
  }

  async function admit(binding) {
    if (!validBinding(binding)) fail("operation_invalid");
    const now = safeTime(clock);
    const existing = await readOperation(binding.principal, binding.operationId);
    if (existing) return replayFromExisting(existing, binding, now);
    if (binding.expiresAt <= now) return Object.freeze({ status: "expired" });

    const reservationDay = utcDay(now);
    const requestId = makeRequestId();
    const grantId = makeGrantId();
    if (!IDENT.test(requestId ?? "") || !IDENT.test(grantId ?? "")) {
      fail("operation_store_invalid");
    }

    const statements = Object.freeze([
      { sql: D1_OPERATION_SQL.reserveStrict, params: [requestId, binding.principal, reservationDay, maximumDailyCalls] },
      { sql: D1_OPERATION_SQL.issueStrict, params: [grantId, requestId, binding.principal] },
      {
        sql: D1_OPERATION_SQL.insert,
        params: [
          binding.principal,
          binding.operationId,
          requestId,
          grantId,
          binding.action,
          binding.textDigest,
          binding.textBytes,
          binding.issuedAt,
          binding.expiresAt,
        ],
      },
      { sql: D1_PAID_SQL.consume, params: [grantId, requestId, binding.principal] },
    ]);

    let results;
    try {
      results = await client.batch(statements);
    } catch (error) {
      if (error?.rolledBack === true) {
        const afterRollback = await readOperation(binding.principal, binding.operationId);
        const replay = replayFromExisting(afterRollback, binding, now);
        if (replay) return replay;
      }
      fail("operation_store_unavailable");
    }
    return validateAdmissionResults(results, {
      binding,
      requestId,
      grantId,
      reservationDay,
    });
  }

  function transition(sql, params, expectedState) {
    return (async () => {
      let results;
      try {
        results = await client.batch([{ sql, params }]);
      } catch {
        fail("operation_store_unavailable");
      }
      if (!Array.isArray(results) || results.length !== 1 || !Array.isArray(results[0])) {
        fail("operation_store_invalid");
      }
      if (results[0].length === 0) fail("operation_state_invalid");
      if (results[0].length !== 1) fail("operation_store_invalid");
      const row = results[0][0];
      if (!row || row.principal !== params[0] || row.operation_id !== params[1] ||
          row.request_id !== params[2] || row.state !== expectedState) {
        fail("operation_store_invalid");
      }
      return true;
    })();
  }

  function updateKeys(args) {
    if (!args || typeof args !== "object" || Array.isArray(args) ||
        !IDENT.test(args.principal ?? "") ||
        !IDENT.test(args.operationId ?? "") ||
        !IDENT.test(args.requestId ?? "")) {
      fail("operation_state_invalid");
    }
    return [args.principal, args.operationId, args.requestId];
  }

  return Object.freeze({
    admit,
    markProviderPending(args) {
      const keys = updateKeys(args);
      return transition(D1_OPERATION_SQL.markProviderPending,
        [...keys, safeTime(clock)], "provider_pending");
    },
    markCompleted(args) {
      const keys = updateKeys(args);
      if (!RESULT_REF.test(args.resultRef ?? "")) fail("operation_state_invalid");
      return transition(D1_OPERATION_SQL.markCompleted,
        [...keys, safeTime(clock), args.resultRef], "completed");
    },
    markUnknown(args) {
      const keys = updateKeys(args);
      return transition(D1_OPERATION_SQL.markUnknown,
        [...keys, safeTime(clock)], "unknown");
    },
    async get({ principal, operationId } = {}) {
      if (!IDENT.test(principal ?? "") || !IDENT.test(operationId ?? "")) return null;
      return readOperation(principal, operationId);
    },
  });
}
