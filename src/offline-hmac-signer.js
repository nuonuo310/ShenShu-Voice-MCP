/**
 * Synthetic-only, offline preparation of qualification Worker requests.
 *
 * This module reuses the existing canonical signer. It never sends, retries or
 * reads a credential source. The CLI wrapper exposes only a synthetic-test mode
 * until a separately reviewed secure secret-injection design exists.
 */
import {
  QUALIFICATION_D1_DATABASE_ID,
  QUALIFICATION_D1_DATABASE_NAME,
  QUALIFICATION_ROUTES,
  QUALIFICATION_WORKER_NAME,
} from "../worker/qualification-entry.js";
import { signWorkerOperationRequest } from "../worker/signed-d1-worker-bridge.js";

export const OFFLINE_SIGNER_MODE = "synthetic_test_only";
export const OFFLINE_SIGNER_BUDGET_CAPS = Object.freeze({
  workerHttpRequests: 24,
  d1TouchingRequests: 18,
  admissionRequests: 10,
  acceptedAdmissions: 4,
  rowWriteUnits: 32,
  rowsRead: 512,
  statements: 64,
  storageDeltaBytes: 256 * 1024,
  durationMs: 20 * 60 * 1000,
  providerCalls: 0,
});
export const OFFLINE_SIGNER_IDENTITY = Object.freeze({
  workerName: QUALIFICATION_WORKER_NAME,
  d1Name: QUALIFICATION_D1_DATABASE_NAME,
  d1Uuid: QUALIFICATION_D1_DATABASE_ID,
});
export const OFFLINE_SIGNER_FIXED_PATHS = Object.freeze([...QUALIFICATION_ROUTES]);

const ROUTE_PATHS = Object.freeze({
  admit: "/internal/v1/paid-operations/admit",
  status: "/internal/v1/paid-operations/status",
  "provider-pending": "/internal/v1/paid-operations/provider-pending",
  completed: "/internal/v1/paid-operations/completed",
  unknown: "/internal/v1/paid-operations/unknown",
});
const SLOT_ID = /^[A-Za-z0-9_-]{8,128}$/;
const KEY_ID = /^offline_synth_[A-Za-z0-9_-]{8,50}$/;
const PRINCIPAL = /^dryrun_[A-Za-z0-9_-]{8,121}$/;
const IDENT = /^[A-Za-z0-9_-]{8,128}$/;
const DIGEST = /^[A-Za-z0-9_-]{43}$/;
const NONCE = /^[A-Za-z0-9_-]{22,86}$/;
const SECRET = /^[A-Za-z0-9_-]{43,86}$/;
const PLAN_ID = /^[A-Za-z0-9_-]{8,128}$/;
const EXPECTED_HOST = new RegExp(
  "^" + QUALIFICATION_WORKER_NAME.replaceAll("-", "\\-") +
  "\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.workers\\.dev$",
);
const BUDGET_KEYS = Object.keys(OFFLINE_SIGNER_BUDGET_CAPS);
const IDENTITY_KEYS = ["d1Name", "d1Uuid", "workerName"];
const USAGE_KEYS = [
  "acceptedAdmission",
  "rowWriteUnits",
  "rowsRead",
  "statements",
  "storageDeltaBytes",
];
const BASE_OPERATION_KEYS = [
  "kind",
  "nonce",
  "operationId",
  "plannedUsage",
  "principal",
  "slotId",
  "timestamp",
];
const PLAN_INPUT_KEYS = [
  "expectedHost",
  "identity",
  "keyId",
  "mode",
  "operations",
  "planId",
  "priorUsage",
  "secret",
];

function code(value) {
  return new Error(value);
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return keys.length === wanted.length && keys.every((key, index) => key === wanted[index]);
}

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function sameKeys(value, expected) {
  return exactKeys(value, Object.keys(expected)) &&
    Object.entries(expected).every(([key, wanted]) => value[key] === wanted);
}

function validUsage(usage) {
  if (!exactKeys(usage, BUDGET_KEYS)) return false;
  for (const [name, cap] of Object.entries(OFFLINE_SIGNER_BUDGET_CAPS)) {
    if (!nonNegativeInteger(usage[name]) || usage[name] > cap) return false;
  }
  return usage.providerCalls === 0;
}

function assertConfig({ identity, expectedHost, keyId, secret, initialUsage, now, signRequest }) {
  if (!sameKeys(identity, OFFLINE_SIGNER_IDENTITY) ||
      typeof expectedHost !== "string" || expectedHost !== expectedHost.toLowerCase() ||
      !EXPECTED_HOST.test(expectedHost) ||
      typeof keyId !== "string" || !KEY_ID.test(keyId) ||
      typeof secret !== "string" || !SECRET.test(secret) ||
      !validUsage(initialUsage) ||
      typeof now !== "function" || typeof signRequest !== "function") {
    throw code("offline_signer_config_invalid");
  }
}

function validatePlannedUsage(usage, kind) {
  if (!exactKeys(usage, USAGE_KEYS) ||
      typeof usage.acceptedAdmission !== "boolean" ||
      !nonNegativeInteger(usage.rowWriteUnits) ||
      !nonNegativeInteger(usage.rowsRead) ||
      !nonNegativeInteger(usage.statements) ||
      !nonNegativeInteger(usage.storageDeltaBytes) ||
      usage.rowsRead < 1 || usage.statements < 1) {
    throw code("offline_signer_request_invalid");
  }
  if (kind === "admit") {
    if (usage.acceptedAdmission &&
        (usage.statements < 5 || usage.rowWriteUnits < 4)) {
      throw code("offline_signer_request_invalid");
    }
  } else if (usage.acceptedAdmission) {
    throw code("offline_signer_request_invalid");
  } else if (kind === "status") {
    if (usage.rowWriteUnits !== 0) throw code("offline_signer_request_invalid");
  } else if (usage.rowWriteUnits < 1) {
    throw code("offline_signer_request_invalid");
  }
  return Object.freeze({ ...usage });
}

function validateOperation(operation) {
  if (!operation || typeof operation !== "object" || Array.isArray(operation) ||
      typeof operation.kind !== "string" || !Object.hasOwn(ROUTE_PATHS, operation.kind)) {
    throw code("offline_signer_request_invalid");
  }
  const expected = [...BASE_OPERATION_KEYS];
  if (operation.kind === "admit") {
    expected.push("textDigest", "textBytes", "ttlMs");
  } else if (operation.kind === "completed") {
    expected.push("requestId", "resultRef");
  } else if (operation.kind !== "status") {
    expected.push("requestId");
  }
  if (!exactKeys(operation, expected) ||
      !SLOT_ID.test(operation.slotId ?? "") ||
      !PRINCIPAL.test(operation.principal ?? "") ||
      !IDENT.test(operation.operationId ?? "") ||
      !Number.isSafeInteger(operation.timestamp) || operation.timestamp < 0 ||
      !NONCE.test(operation.nonce ?? "")) {
    throw code("offline_signer_request_invalid");
  }
  if (operation.kind === "admit" &&
      (!DIGEST.test(operation.textDigest ?? "") ||
       !Number.isSafeInteger(operation.textBytes) ||
       operation.textBytes < 1 || operation.textBytes > 800 ||
       !Number.isSafeInteger(operation.ttlMs) ||
       operation.ttlMs < 1_000 || operation.ttlMs > 15 * 60 * 1000)) {
    throw code("offline_signer_request_invalid");
  }
  if (Object.hasOwn(operation, "requestId") && !IDENT.test(operation.requestId ?? "")) {
    throw code("offline_signer_request_invalid");
  }
  if (Object.hasOwn(operation, "resultRef") && !IDENT.test(operation.resultRef ?? "")) {
    throw code("offline_signer_request_invalid");
  }
  return Object.freeze({
    ...operation,
    plannedUsage: validatePlannedUsage(operation.plannedUsage, operation.kind),
  });
}

function requestDelta(operation) {
  return Object.freeze({
    workerHttpRequests: 1,
    d1TouchingRequests: 1,
    admissionRequests: operation.kind === "admit" ? 1 : 0,
    acceptedAdmissions: operation.plannedUsage.acceptedAdmission ? 1 : 0,
    rowWriteUnits: operation.plannedUsage.rowWriteUnits,
    rowsRead: operation.plannedUsage.rowsRead,
    statements: operation.plannedUsage.statements,
    storageDeltaBytes: operation.plannedUsage.storageDeltaBytes,
    durationMs: 0,
    providerCalls: 0,
  });
}

function withDelta(usage, delta) {
  const next = {};
  for (const key of BUDGET_KEYS) next[key] = usage[key] + delta[key];
  return next;
}

function validateSignedRequest(request, operation, expectedHost, secret) {
  if (!request || typeof request !== "object" || typeof request.url !== "string" ||
      request.method !== "POST" || typeof request.body !== "string" ||
      !request.headers || typeof request.headers !== "object") {
    throw code("offline_signer_internal_error");
  }
  let url;
  try {
    url = new URL(request.url);
  } catch {
    throw code("offline_signer_internal_error");
  }
  const expectedPath = ROUTE_PATHS[operation.kind];
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "" ||
      url.host !== expectedHost || url.pathname !== expectedPath ||
      url.search !== "" || url.hash !== "" ||
      request.headers["content-type"] !== "application/json" ||
      request.body.length < 1 || request.body.length > 2048 ||
      request.body.includes(secret) ||
      Object.values(request.headers).some(value => String(value).includes(secret))) {
    throw code("offline_signer_internal_error");
  }
}

export function inspectOfflineSignerUsage(usage) {
  if (!validUsage(usage)) throw code("offline_signer_config_invalid");
  return Object.freeze({ ...usage });
}

export function createOfflineSigner({
  identity,
  expectedHost,
  keyId,
  secret,
  initialUsage,
  now = () => Date.now(),
  signRequest = signWorkerOperationRequest,
} = {}) {
  assertConfig({ identity, expectedHost, keyId, secret, initialUsage, now, signRequest });
  const startedAt = now();
  if (!Number.isSafeInteger(startedAt) || startedAt < 0) {
    throw code("offline_signer_config_invalid");
  }
  let usage = inspectOfflineSignerUsage(initialUsage);
  let preparedCount = 0;
  const usedNonces = new Set();

  function projectedUsage(operation) {
    const current = now();
    if (!Number.isSafeInteger(current) || current < startedAt) {
      throw code("offline_signer_internal_error");
    }
    const delta = { ...requestDelta(operation), durationMs: current - startedAt };
    const next = withDelta(usage, delta);
    next.durationMs = Math.max(usage.durationMs, current - startedAt);
    return Object.freeze(next);
  }

  function reserve(operation) {
    const next = projectedUsage(operation);
    if (!validUsage(next)) throw code("offline_signer_budget_exhausted");
    usage = next;
  }

  return Object.freeze({
    async prepare(operation) {
      const normalized = validateOperation(operation);
      if (usedNonces.has(normalized.nonce)) {
        throw code("offline_signer_replay_rejected");
      }
      if (!validUsage(projectedUsage(normalized))) {
        throw code("offline_signer_budget_exhausted");
      }
      let request;
      try {
        request = await signRequest({
          workerOrigin: "https://" + expectedHost,
          kind: normalized.kind,
          keyId,
          secret,
          principal: normalized.principal,
          operationId: normalized.operationId,
          textDigest: normalized.textDigest,
          textBytes: normalized.textBytes,
          ttlMs: normalized.ttlMs,
          requestId: normalized.requestId,
          resultRef: normalized.resultRef,
          timestamp: normalized.timestamp,
          nonce: normalized.nonce,
        });
      } catch (error) {
        if (error?.message === "signed_request_config_invalid") {
          throw code("offline_signer_config_invalid");
        }
        throw code("offline_signer_request_invalid");
      }
      validateSignedRequest(request, normalized, expectedHost, secret);
      reserve(normalized);
      usedNonces.add(normalized.nonce);
      preparedCount += 1;
      return Object.freeze({
        slotId: normalized.slotId,
        url: request.url,
        method: request.method,
        headers: request.headers,
        body: request.body,
        budget: Object.freeze({ ...usage }),
      });
    },
    snapshot() {
      return Object.freeze({ preparedCount, usage: Object.freeze({ ...usage }) });
    },
  });
}

export async function prepareOfflineSignerPlan({
  mode,
  planId,
  keyId,
  secret,
  expectedHost,
  identity,
  priorUsage,
  operations,
  now = () => Date.now(),
  signRequest = signWorkerOperationRequest,
} = {}) {
  if (!exactKeys({
    mode, planId, keyId, secret, expectedHost, identity, priorUsage, operations,
  }, PLAN_INPUT_KEYS) ||
      mode !== OFFLINE_SIGNER_MODE || !PLAN_ID.test(planId ?? "") ||
      !Array.isArray(operations) || operations.length < 1 ||
      operations.length > OFFLINE_SIGNER_BUDGET_CAPS.workerHttpRequests) {
    throw code("offline_signer_input_invalid");
  }

  const normalized = operations.map(validateOperation);
  const nonces = new Set();
  let projected = inspectOfflineSignerUsage(priorUsage);
  for (const operation of normalized) {
    if (nonces.has(operation.nonce)) throw code("offline_signer_replay_rejected");
    nonces.add(operation.nonce);
    projected = withDelta(projected, requestDelta(operation));
  }
  if (!validUsage(projected)) throw code("offline_signer_budget_exhausted");

  const signer = createOfflineSigner({
    identity,
    expectedHost,
    keyId,
    secret,
    initialUsage: priorUsage,
    now,
    signRequest,
  });
  for (const operation of normalized) {
    await signer.prepare(operation);
  }
  const snapshot = signer.snapshot();
  return Object.freeze({
    status: "prepared",
    mode: OFFLINE_SIGNER_MODE,
    planId,
    preparedCount: snapshot.preparedCount,
    usage: snapshot.usage,
    providerCalls: 0,
  });
}
