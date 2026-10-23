/**
 * Dormant offline candidate for the private Cloudflare Worker D1 adapter.
 *
 * This module is intentionally unreferenced by the production server. It
 * accepts already-verified internal requests from Render, uses only its native
 * D1 binding and submits the four fixed admission statements in one batch.
 *
 * Outer Cloudflare Access is a deployment prerequisite. The injected
 * authorize() hook represents that deployment gate; this module does not treat
 * any request header as authentication and must not be exposed directly.
 */
import { D1_OPERATION_SQL } from "../src/d1-operation-sql.js";
import { D1_PAID_SQL } from "../src/d1-paid-store.js";

const ACTION = "generate_shenshu_voice";
const MAX_BODY_BYTES = 2048;
const MIN_TTL_MS = 1_000;
const MAX_TTL_MS = 15 * 60 * 1000;
const IDENT = /^[A-Za-z0-9_-]{8,128}$/;
const DIGEST = /^[A-Za-z0-9_-]{43}$/;
const RESULT_REF = /^[A-Za-z0-9_-]{8,128}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const STATES = new Set(["admitted", "provider_pending", "completed", "unknown"]);
const ROUTES = Object.freeze({
  "/internal/v1/paid-operations/admit": "admit",
  "/internal/v1/paid-operations/status": "status",
  "/internal/v1/paid-operations/provider-pending": "provider-pending",
  "/internal/v1/paid-operations/completed": "completed",
  "/internal/v1/paid-operations/unknown": "unknown",
});
const encoder = new TextEncoder();

function fail(code) {
  throw new Error(code);
}

function httpError(status, code) {
  const error = new Error(code);
  error.status = status;
  return error;
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return keys.length === wanted.length && wanted.every((key, index) => keys[index] === key);
}

function validVersion(value) {
  return value === 1;
}

function validTTL(value) {
  return Number.isSafeInteger(value) && value >= MIN_TTL_MS && value <= MAX_TTL_MS;
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
    binding.action === ACTION &&
    IDENT.test(binding.principal ?? "") &&
    IDENT.test(binding.operationId ?? "") &&
    Number.isSafeInteger(binding.textBytes) &&
    binding.textBytes >= 1 && binding.textBytes <= 800 &&
    DIGEST.test(binding.textDigest ?? "") &&
    Number.isSafeInteger(binding.issuedAt) && binding.issuedAt >= 0 &&
    Number.isSafeInteger(binding.expiresAt) &&
    binding.expiresAt > binding.issuedAt &&
    binding.expiresAt - binding.issuedAt <= MAX_TTL_MS;
}

function normalizeRow(row, principal, operationId) {
  if (!row || typeof row !== "object" || Array.isArray(row)) fail("operation_store_invalid");
  if (row.principal !== principal || row.operation_id !== operationId ||
      !IDENT.test(row.request_id ?? "") || !IDENT.test(row.grant_id ?? "") ||
      row.action !== ACTION ||
      !DIGEST.test(row.text_digest ?? "") ||
      !Number.isSafeInteger(row.text_bytes) || row.text_bytes < 1 || row.text_bytes > 800 ||
      !STATES.has(row.state) ||
      !Number.isSafeInteger(row.issued_at) || row.issued_at < 0 ||
      !Number.isSafeInteger(row.expires_at) || row.expires_at <= row.issued_at ||
      row.expires_at - row.issued_at > MAX_TTL_MS ||
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

function unwrapD1Result(result) {
  if (!result || typeof result !== "object" || Array.isArray(result) ||
      result.success !== true || !Array.isArray(result.results)) {
    fail("operation_store_invalid");
  }
  return result.results;
}

function createNativeBindingClient(db) {
  if (!db || typeof db.prepare !== "function" || typeof db.batch !== "function") {
    fail("d1_unavailable");
  }
  function prepare(sql, params) {
    if (typeof sql !== "string" || sql.length < 1 || sql.length > 100_000 ||
        !Array.isArray(params) || params.length > 100) {
      fail("operation_store_invalid");
    }
    const statement = db.prepare(sql);
    if (!statement || typeof statement.bind !== "function") {
      fail("operation_store_invalid");
    }
    const bound = statement.bind(...params);
    if (!bound || typeof bound.all !== "function") fail("operation_store_invalid");
    return bound;
  }
  return Object.freeze({
    atomicBatch: true,
    async query(sql, params = []) {
      return unwrapD1Result(await prepare(sql, params).all());
    },
    async batch(statements) {
      if (!Array.isArray(statements) || statements.length < 1 || statements.length > 4) {
        fail("operation_store_invalid");
      }
      const prepared = statements.map(entry => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          fail("operation_store_invalid");
        }
        return prepare(entry.sql, entry.params);
      });
      const results = await db.batch(prepared);
      if (!Array.isArray(results) || results.length !== prepared.length) {
        fail("operation_store_invalid");
      }
      return results.map(unwrapD1Result);
    },
  });
}

function createOperationStore({
  client,
  clock,
  maximumDailyCalls,
  makeRequestId,
  makeGrantId,
}) {
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

  function validateAdmissionResults(results, { binding, requestId, grantId, reservationDay }) {
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
    if (!operation || operation.principal !== binding.principal ||
        operation.operation_id !== binding.operationId ||
        operation.request_id !== requestId || operation.grant_id !== grantId ||
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
      {
        sql: D1_OPERATION_SQL.reserveStrict,
        params: [requestId, binding.principal, reservationDay, maximumDailyCalls],
      },
      {
        sql: D1_OPERATION_SQL.issueStrict,
        params: [grantId, requestId, binding.principal],
      },
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
      {
        sql: D1_PAID_SQL.consume,
        params: [grantId, requestId, binding.principal],
      },
    ]);

    let results;
    try {
      results = await client.batch(statements);
    } catch {
      fail("operation_store_unavailable");
    }
    return validateAdmissionResults(results, {
      binding,
      requestId,
      grantId,
      reservationDay,
    });
  }

  async function transition(sql, params, expectedState) {
    let results;
    try {
      results = await client.batch([{ sql, params }]);
    } catch {
      fail("operation_store_unavailable");
    }
    if (!Array.isArray(results) || results.length !== 1 ||
        !Array.isArray(results[0]) || results[0].length !== 1) {
      fail(results?.[0]?.length === 0 ? "operation_state_invalid" : "operation_store_invalid");
    }
    const row = results[0][0];
    if (!row || row.principal !== params[0] || row.operation_id !== params[1] ||
        row.request_id !== params[2] || row.state !== expectedState) {
      fail("operation_store_invalid");
    }
    return true;
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
    async get({ principal, operationId } = {}) {
      if (!IDENT.test(principal ?? "") || !IDENT.test(operationId ?? "")) return null;
      return readOperation(principal, operationId);
    },
    markProviderPending(args) {
      const keys = updateKeys(args);
      return transition(
        D1_OPERATION_SQL.markProviderPending,
        [...keys, safeTime(clock)],
        "provider_pending",
      );
    },
    markCompleted(args) {
      const keys = updateKeys(args);
      if (!RESULT_REF.test(args.resultRef ?? "")) fail("operation_state_invalid");
      return transition(
        D1_OPERATION_SQL.markCompleted,
        [...keys, safeTime(clock), args.resultRef],
        "completed",
      );
    },
    markUnknown(args) {
      const keys = updateKeys(args);
      return transition(
        D1_OPERATION_SQL.markUnknown,
        [...keys, safeTime(clock)],
        "unknown",
      );
    },
  });
}

function validateRequest(kind, value) {
  if (kind === "admit") {
    if (!exactKeys(value, [
      "version", "principal", "operation_id", "action",
      "text_digest", "text_bytes", "ttl_ms",
    ]) || !validVersion(value.version) ||
        !IDENT.test(value.principal ?? "") ||
        !IDENT.test(value.operation_id ?? "") ||
        value.action !== ACTION ||
        !DIGEST.test(value.text_digest ?? "") ||
        !Number.isSafeInteger(value.text_bytes) ||
        value.text_bytes < 1 || value.text_bytes > 800 ||
        !validTTL(value.ttl_ms)) {
      fail("invalid_request");
    }
    return Object.freeze({
      kind,
      principal: value.principal,
      operationId: value.operation_id,
      textDigest: value.text_digest,
      textBytes: value.text_bytes,
      ttlMs: value.ttl_ms,
    });
  }
  if (kind === "status") {
    if (!exactKeys(value, ["version", "principal", "operation_id"]) ||
        !validVersion(value.version) ||
        !IDENT.test(value.principal ?? "") ||
        !IDENT.test(value.operation_id ?? "")) {
      fail("invalid_request");
    }
    return Object.freeze({
      kind,
      principal: value.principal,
      operationId: value.operation_id,
    });
  }
  const keys = kind === "completed"
    ? ["version", "principal", "operation_id", "request_id", "result_ref"]
    : ["version", "principal", "operation_id", "request_id"];
  if (!exactKeys(value, keys) || !validVersion(value.version) ||
      !IDENT.test(value.principal ?? "") ||
      !IDENT.test(value.operation_id ?? "") ||
      !IDENT.test(value.request_id ?? "") ||
      (kind === "completed" && !RESULT_REF.test(value.result_ref ?? ""))) {
    fail("invalid_request");
  }
  return Object.freeze({
    kind,
    principal: value.principal,
    operationId: value.operation_id,
    requestId: value.request_id,
    ...(kind === "completed" ? { resultRef: value.result_ref } : {}),
  });
}

async function readBoundedJson(request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw httpError(413, "request_too_large");
  }
  let text;
  try {
    text = await request.text();
  } catch {
    throw httpError(400, "invalid_request");
  }
  if (encoder.encode(text).byteLength > MAX_BODY_BYTES) {
    throw httpError(413, "request_too_large");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw httpError(400, "invalid_request");
  }
}

function recordResponse(status, record) {
  const payload = {
    status,
    state: record.state,
    operation_id: record.operationId,
    request_id: record.requestId,
    slot: record.slot,
    expires_at: record.expiresAt,
  };
  if (record.state === "completed") payload.result_ref = record.resultRef;
  return payload;
}

function uuidHex() {
  const cryptoObject = globalThis.crypto;
  if (!cryptoObject || typeof cryptoObject.randomUUID !== "function") {
    fail("random_source_unavailable");
  }
  return cryptoObject.randomUUID().replaceAll("-", "");
}

/**
 * @param {object} options
 * @param {{DB?: object}} options.env
 * @param {(request: Request) => boolean|Promise<boolean>} options.authorize
 */
export function createPrivateWorkerCandidate({
  env,
  authorize,
  clock = () => Date.now(),
  maximumDailyCalls = 3,
  makeRequestId = () => "request_" + uuidHex(),
  makeGrantId = () => "grant_" + uuidHex(),
} = {}) {
  if (typeof authorize !== "function" ||
      typeof clock !== "function" ||
      !Number.isSafeInteger(maximumDailyCalls) ||
      maximumDailyCalls < 1 || maximumDailyCalls > 20 ||
      typeof makeRequestId !== "function" ||
      typeof makeGrantId !== "function") {
    throw new Error("private_worker_config_invalid");
  }

  function store() {
    const client = createNativeBindingClient(env?.DB);
    return createOperationStore({
      client,
      clock,
      maximumDailyCalls,
      makeRequestId,
      makeGrantId,
    });
  }

  async function handle(kind, request) {
    const body = await readBoundedJson(request);
    const input = validateRequest(kind, body);
    const operations = store();

    if (kind === "admit") {
      const now = safeTime(clock);
      const binding = Object.freeze({
        version: 1,
        action: ACTION,
        principal: input.principal,
        operationId: input.operationId,
        textBytes: input.textBytes,
        textDigest: input.textDigest,
        issuedAt: now,
        expiresAt: now + input.ttlMs,
      });
      const disposition = await operations.admit(binding);
      if (disposition.status === "admitted" || disposition.status === "replay") {
        return jsonResponse(200, {
          ...recordResponse(disposition.status, disposition.record),
        });
      }
      if (disposition.status === "conflict") return jsonResponse(409, { status: "conflict" });
      if (disposition.status === "expired") return jsonResponse(410, { status: "expired" });
      if (disposition.status === "daily_limit") {
        return jsonResponse(429, { status: "daily_limit" });
      }
      fail("operation_store_invalid");
    }

    if (kind === "status") {
      const record = await operations.get({
        principal: input.principal,
        operationId: input.operationId,
      });
      if (!record) return jsonResponse(404, { status: "not_found" });
      if (record.expiresAt <= safeTime(clock)) {
        return jsonResponse(410, { status: "expired" });
      }
      return jsonResponse(200, recordResponse("found", record));
    }

    const keys = {
      principal: input.principal,
      operationId: input.operationId,
      requestId: input.requestId,
    };
    if (kind === "provider-pending") {
      await operations.markProviderPending(keys);
      return jsonResponse(200, { status: "state_updated", state: "provider_pending" });
    }
    if (kind === "completed") {
      await operations.markCompleted({ ...keys, resultRef: input.resultRef });
      return jsonResponse(200, { status: "state_updated", state: "completed" });
    }
    if (kind === "unknown") {
      await operations.markUnknown(keys);
      return jsonResponse(200, { status: "state_updated", state: "unknown" });
    }
    fail("invalid_request");
  }

  return Object.freeze({
    async fetch(request) {
      try {
        if (!request || typeof request !== "object" ||
            typeof request.method !== "string" ||
            typeof request.url !== "string" ||
            !request.headers || typeof request.headers.get !== "function") {
          return jsonResponse(400, { error: "invalid_request" });
        }
        let url;
        try {
          url = new URL(request.url);
        } catch {
          return jsonResponse(400, { error: "invalid_request" });
        }
        const kind = ROUTES[url.pathname];
        if (!kind) return jsonResponse(404, { error: "not_found" });
        if (url.search !== "") return jsonResponse(400, { error: "invalid_request" });
        if (request.method !== "POST") {
          const response = jsonResponse(405, { error: "method_not_allowed" });
          response.headers.set("allow", "POST");
          return response;
        }
        const contentType = (request.headers.get("content-type") ?? "")
          .trim().toLowerCase();
        if (contentType !== "application/json") {
          return jsonResponse(415, { error: "unsupported_media_type" });
        }
        let authorized = false;
        try {
          authorized = await authorize(request) === true;
        } catch {}
        if (!authorized) return jsonResponse(403, { error: "not_authorized" });
        return await handle(kind, request);
      } catch (error) {
        if (error?.status === 413) return jsonResponse(413, { error: "request_too_large" });
        if (error?.message === "invalid_request") {
          return jsonResponse(400, { error: "invalid_request" });
        }
        if (error?.message === "operation_state_invalid") {
          return jsonResponse(409, { error: "operation_state_invalid" });
        }
        if (error?.message === "operation_invalid") {
          return jsonResponse(400, { error: "invalid_request" });
        }
        return jsonResponse(503, { error: "operation_store_unavailable" });
      }
    },
  });
}
