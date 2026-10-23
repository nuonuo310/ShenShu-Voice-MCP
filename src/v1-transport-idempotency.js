/**
 * Offline V1 transport-idempotency contract.
 *
 * One logical operation is bound to a verified principal, a narrowly validated
 * operation ID, the exact text digest and a bounded lifetime. The in-memory
 * store below is an executable fixture, NOT production truth. Production must
 * persist the same binding atomically with the reservation/grant in D1.
 *
 * This module is not mounted on an MCP route and performs no network I/O.
 */
import { createHash, randomUUID } from "node:crypto";
import { checkText } from "./contract.js";

export const V1_OPERATION_ACTION = "generate_shenshu_voice";
export const V1_OPERATION_DEFAULT_TTL_MS = 5 * 60 * 1000;
export const V1_OPERATION_MAX_TTL_MS = 15 * 60 * 1000;
export const V1_OPERATION_STATES = Object.freeze({
  ADMITTED: "admitted",
  PROVIDER_PENDING: "provider_pending",
  COMPLETED: "completed",
  UNKNOWN: "unknown",
});

const IDENT = /^[A-Za-z0-9_-]{8,128}$/;
const DIGEST = /^[A-Za-z0-9_-]{43}$/;
const RESULT_REF = /^[A-Za-z0-9_-]{8,128}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function safeTime(clock) {
  const value = clock();
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("operation_clock_error");
  return value;
}

function utcDay(nowMs) {
  const day = new Date(nowMs).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("operation_clock_error");
  return day;
}

export function operationTextDigest(text) {
  const safeText = checkText(text);
  return createHash("sha256").update(safeText, "utf8").digest("base64url");
}

export function buildOperationBinding({
  principal,
  operationId,
  text,
  issuedAt,
  ttlMs = V1_OPERATION_DEFAULT_TTL_MS,
} = {}) {
  if (!IDENT.test(principal ?? "") || !IDENT.test(operationId ?? "") ||
      !Number.isSafeInteger(issuedAt) || issuedAt < 0 ||
      !Number.isSafeInteger(ttlMs) || ttlMs < 1_000 || ttlMs > V1_OPERATION_MAX_TTL_MS) {
    throw new Error("operation_invalid");
  }
  const safeText = checkText(text);
  const textBytes = Buffer.byteLength(safeText, "utf8");
  const textDigest = operationTextDigest(safeText);
  return Object.freeze({
    version: 1,
    action: V1_OPERATION_ACTION,
    principal,
    operationId,
    textBytes,
    textDigest,
    issuedAt,
    expiresAt: issuedAt + ttlMs,
  });
}

function validBinding(binding) {
  return binding && typeof binding === "object" &&
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

function validRecord(record) {
  return record && typeof record === "object" &&
    record.action === V1_OPERATION_ACTION &&
    IDENT.test(record.principal ?? "") &&
    IDENT.test(record.operationId ?? "") &&
    IDENT.test(record.requestId ?? "") &&
    IDENT.test(record.grantId ?? "") &&
    DIGEST.test(record.textDigest ?? "") &&
    Number.isSafeInteger(record.textBytes) && record.textBytes >= 1 && record.textBytes <= 800 &&
    Number.isSafeInteger(record.issuedAt) && record.issuedAt >= 0 &&
    Number.isSafeInteger(record.expiresAt) && record.expiresAt > record.issuedAt &&
    record.expiresAt - record.issuedAt <= V1_OPERATION_MAX_TTL_MS &&
    DAY.test(record.day ?? "") &&
    Number.isSafeInteger(record.createdAt) && record.createdAt >= 0 &&
    Number.isSafeInteger(record.updatedAt) && record.updatedAt >= 0 &&
    Object.values(V1_OPERATION_STATES).includes(record.state) &&
    (record.state === V1_OPERATION_STATES.COMPLETED
      ? RESULT_REF.test(record.resultRef ?? "")
      : record.resultRef === null || record.resultRef === undefined);
}

function copyRecord(record) {
  return Object.freeze({ ...record });
}

export function classifyOperationReplay(record, {
  nowMs,
  principal,
  operationId,
} = {}) {
  if (!validRecord(record) || !Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new Error("operation_store_invalid");
  }
  if ((principal !== undefined && record.principal !== principal) ||
      (operationId !== undefined && record.operationId !== operationId)) {
    throw new Error("operation_store_invalid");
  }
  if (record.expiresAt <= nowMs) throw new Error("operation_expired");
  switch (record.state) {
    case V1_OPERATION_STATES.COMPLETED:
      if (!RESULT_REF.test(record.resultRef ?? "")) throw new Error("operation_store_invalid");
      return Object.freeze({ action: "return_completed", resultRef: record.resultRef });
    case V1_OPERATION_STATES.PROVIDER_PENDING:
    case V1_OPERATION_STATES.UNKNOWN:
      return Object.freeze({ action: "unknown_no_retry" });
    case V1_OPERATION_STATES.ADMITTED:
      return Object.freeze({ action: "in_progress_no_retry" });
    default:
      throw new Error("operation_store_invalid");
  }
}

export function createOperationBackend() {
  return {
    operations: new Map(),
    reservations: new Map(),
    grants: new Map(),
    slots: new Set(),
    queue: Promise.resolve(),
  };
}

function operationKey(principal, operationId) {
  return principal + "\u0000" + operationId;
}

function slotKey(principal, day, slot) {
  return principal + "\u0000" + day + "\u0000" + String(slot);
}

export function createInMemoryDurableOperationStore({
  backend = createOperationBackend(),
  clock = () => Date.now(),
  maximumDailyCalls = 3,
  makeRequestId = randomUUID,
  makeGrantId = () => "grant_" + randomUUID().replaceAll("-", ""),
} = {}) {
  if (!backend || !(backend.operations instanceof Map) ||
      !(backend.reservations instanceof Map) || !(backend.grants instanceof Map) ||
      !(backend.slots instanceof Set) || typeof backend.queue?.then !== "function" ||
      typeof clock !== "function" || !Number.isSafeInteger(maximumDailyCalls) ||
      maximumDailyCalls < 1 || maximumDailyCalls > 20 ||
      typeof makeRequestId !== "function" || typeof makeGrantId !== "function") {
    throw new Error("operation_store_configuration_invalid");
  }

  function serialized(task) {
    const result = backend.queue.then(task);
    backend.queue = result.then(() => undefined, () => undefined);
    return result;
  }

  function findOperation(principal, operationId) {
    return backend.operations.get(operationKey(principal, operationId)) ?? null;
  }

  function requireOperation({ principal, operationId, requestId }) {
    if (!IDENT.test(principal ?? "") || !IDENT.test(operationId ?? "") || !IDENT.test(requestId ?? "")) {
      throw new Error("operation_store_invalid");
    }
    const record = findOperation(principal, operationId);
    if (!validRecord(record) || record.requestId !== requestId) throw new Error("operation_store_invalid");
    return record;
  }

  async function admit(binding) {
    if (!validBinding(binding)) throw new Error("operation_invalid");
    return serialized(() => {
      const now = safeTime(clock);
      const existing = findOperation(binding.principal, binding.operationId);
      if (existing) {
        if (!validRecord(existing)) throw new Error("operation_store_invalid");
        const reservation = backend.reservations.get(existing.requestId);
        const grant = backend.grants.get(existing.grantId);
        if (!reservation ||
            reservation.requestId !== existing.requestId ||
            reservation.principal !== existing.principal ||
            reservation.day !== existing.day ||
            !Number.isSafeInteger(reservation.slot) ||
            reservation.slot < 1 || reservation.slot > 20 ||
            !backend.slots.has(slotKey(existing.principal, existing.day, reservation.slot)) ||
            !grant ||
            grant.grantId !== existing.grantId ||
            grant.requestId !== existing.requestId ||
            grant.principal !== existing.principal ||
            grant.state !== "consumed") {
          throw new Error("operation_store_invalid");
        }
        if (existing.textBytes !== binding.textBytes ||
            existing.textDigest !== binding.textDigest ||
            existing.action !== binding.action) return Object.freeze({ status: "conflict" });
        if (existing.expiresAt <= now) return Object.freeze({ status: "expired" });
        return Object.freeze({ status: "replay", record: copyRecord(existing) });
      }
      if (binding.expiresAt <= now) return Object.freeze({ status: "expired" });

      const day = utcDay(now);
      let slot = 0;
      for (let candidate = 1; candidate <= maximumDailyCalls; candidate++) {
        if (!backend.slots.has(slotKey(binding.principal, day, candidate))) {
          slot = candidate;
          break;
        }
      }
      if (slot === 0) return Object.freeze({ status: "daily_limit" });

      const requestId = makeRequestId();
      const grantId = makeGrantId();
      if (!IDENT.test(requestId ?? "") || !IDENT.test(grantId ?? "")) {
        throw new Error("operation_store_invalid");
      }
      if (backend.reservations.has(requestId) || backend.grants.has(grantId)) {
        throw new Error("operation_store_invalid");
      }
      const record = Object.freeze({
        principal: binding.principal,
        operationId: binding.operationId,
        action: binding.action,
        textBytes: binding.textBytes,
        textDigest: binding.textDigest,
        issuedAt: binding.issuedAt,
        expiresAt: binding.expiresAt,
        requestId,
        grantId,
        day,
        state: V1_OPERATION_STATES.ADMITTED,
        resultRef: null,
        createdAt: now,
        updatedAt: now,
      });
      backend.operations.set(operationKey(binding.principal, binding.operationId), record);
      backend.reservations.set(requestId, { requestId, principal: binding.principal, day, slot });
      backend.grants.set(grantId, { grantId, requestId, principal: binding.principal, state: "consumed" });
      backend.slots.add(slotKey(binding.principal, day, slot));
      return Object.freeze({ status: "admitted", record: copyRecord(record) });
    });
  }

  async function update({ principal, operationId, requestId }, state, resultRef = null) {
    return serialized(() => {
      const record = requireOperation({ principal, operationId, requestId });
      const now = safeTime(clock);
      if (record.expiresAt <= now) throw new Error("operation_expired");
      if (record.state !== V1_OPERATION_STATES.ADMITTED &&
          record.state !== V1_OPERATION_STATES.PROVIDER_PENDING) {
        throw new Error("operation_state_invalid");
      }
      if (state === V1_OPERATION_STATES.PROVIDER_PENDING &&
          record.state !== V1_OPERATION_STATES.ADMITTED) {
        throw new Error("operation_state_invalid");
      }
      if (state === V1_OPERATION_STATES.COMPLETED) {
        if (record.state !== V1_OPERATION_STATES.PROVIDER_PENDING ||
            !RESULT_REF.test(resultRef ?? "")) {
          throw new Error("operation_state_invalid");
        }
      }
      const next = Object.freeze({
        ...record,
        state,
        resultRef: state === V1_OPERATION_STATES.COMPLETED ? resultRef : null,
        updatedAt: now,
      });
      backend.operations.set(operationKey(principal, operationId), next);
      return copyRecord(next);
    });
  }

  return Object.freeze({
    admit,
    markProviderPending: args => update(args, V1_OPERATION_STATES.PROVIDER_PENDING),
    markCompleted: args => update(args, V1_OPERATION_STATES.COMPLETED, args.resultRef),
    markUnknown: args => update(args, V1_OPERATION_STATES.UNKNOWN),
    get: ({ principal, operationId } = {}) => {
      if (!IDENT.test(principal ?? "") || !IDENT.test(operationId ?? "")) return null;
      const record = findOperation(principal, operationId);
      return validRecord(record) ? copyRecord(record) : null;
    },
  });
}

export function createV1IdempotentOperationRunner({
  resolveVerifiedPrincipal,
  operationStore,
  synthesize,
  clock = () => Date.now(),
} = {}) {
  if (typeof resolveVerifiedPrincipal !== "function" ||
      !operationStore ||
      typeof operationStore.admit !== "function" ||
      typeof operationStore.markProviderPending !== "function" ||
      typeof operationStore.markCompleted !== "function" ||
      typeof operationStore.markUnknown !== "function" ||
      typeof synthesize !== "function" ||
      typeof clock !== "function") {
    throw new Error("operation_runner_unavailable");
  }

  return async function invoke(input = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error("invalid_input");
    }
    const keys = Object.keys(input);
    if (keys.length !== 3 || !["trustedRequest", "operationId", "text"].every(key => keys.includes(key)) ||
        !input.trustedRequest || typeof input.trustedRequest !== "object" ||
        Array.isArray(input.trustedRequest) ||
        !IDENT.test(input.operationId ?? "")) {
      throw new Error("invalid_input");
    }
    let safeText;
    try {
      safeText = checkText(input.text);
    } catch {
      throw new Error("invalid_input");
    }
    let identity;
    try {
      identity = await resolveVerifiedPrincipal(input.trustedRequest);
    } catch (error) {
      if (error?.message === "insufficient_scope") throw error;
      throw new Error("not_authorized");
    }
    if (!identity || identity.verified !== true || !IDENT.test(identity.subject ?? "")) {
      throw new Error("not_authorized");
    }

    const binding = buildOperationBinding({
      principal: identity.subject,
      operationId: input.operationId,
      text: safeText,
      issuedAt: safeTime(clock),
    });

    let result;
    try {
      result = await operationStore.admit(binding);
    } catch (error) {
      if (error?.message === "operation_store_invalid") throw error;
      throw new Error("operation_store_unavailable");
    }
    if (!result || typeof result !== "object") throw new Error("operation_store_invalid");

    if (result.status === "conflict") throw new Error("operation_conflict");
    if (result.status === "expired") throw new Error("operation_expired");
    if (result.status === "daily_limit") throw new Error("budget_denied");
    if (result.status === "replay") {
      let replay;
      try {
        replay = classifyOperationReplay(result.record, {
          nowMs: safeTime(clock),
          principal: identity.subject,
          operationId: input.operationId,
        });
      } catch (error) {
        if (error?.message === "operation_expired") throw error;
        throw new Error("operation_store_invalid");
      }
      if (replay.action === "return_completed") {
        return Object.freeze({
          status: "completed",
          replayed: true,
          providerAttempts: 0,
          resultRef: replay.resultRef,
        });
      }
      if (replay.action === "unknown_no_retry") throw new Error("operation_outcome_unknown");
      if (replay.action === "in_progress_no_retry") throw new Error("operation_in_progress");
      throw new Error("operation_store_invalid");
    }
    if (result.status !== "admitted" || !result.record ||
        !IDENT.test(result.record.requestId ?? "") ||
        result.record.principal !== identity.subject ||
        result.record.operationId !== input.operationId ||
        result.record.textDigest !== binding.textDigest) {
      throw new Error("operation_store_invalid");
    }

    const keysForUpdate = {
      principal: identity.subject,
      operationId: input.operationId,
      requestId: result.record.requestId,
    };
    try {
      await operationStore.markProviderPending(keysForUpdate);
    } catch {
      throw new Error("operation_store_invalid");
    }

    let providerResult;
    try {
      providerResult = await synthesize({ text: safeText });
    } catch {
      try { await operationStore.markUnknown(keysForUpdate); } catch {}
      throw new Error("provider_outcome_unknown");
    }
    if (!providerResult || !RESULT_REF.test(providerResult.resultRef ?? "")) {
      try { await operationStore.markUnknown(keysForUpdate); } catch {}
      throw new Error("provider_outcome_unknown");
    }
    try {
      await operationStore.markCompleted({ ...keysForUpdate, resultRef: providerResult.resultRef });
    } catch {
      try { await operationStore.markUnknown(keysForUpdate); } catch {}
      throw new Error("provider_outcome_unknown");
    }
    return Object.freeze({
      status: "completed",
      replayed: false,
      providerAttempts: 1,
      resultRef: providerResult.resultRef,
    });
  };
}
