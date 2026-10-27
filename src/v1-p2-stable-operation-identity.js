/**
 * Offline-only Voice V1 P2 stable operation identity contract.
 *
 * This module models a two-stage MCP flow:
 *   initiate -> non-billable, principal/text-bound pending operation
 *   status   -> owner-only recovery of the operation state
 *   confirm  -> atomic claim, then one paid pipeline/provider attempt
 *
 * The opaque handle is a correlation value, not an authorization token. It is
 * accepted only after fresh Auth0 principal verification and must match the
 * exact text digest recorded at initiation. A caller cannot supply a principal,
 * operation ID, text digest, grant or billing authority.
 *
 * The guarantee is conditional on a retry presenting the same handle. This
 * module does not prove that a client retrying the whole initiate/confirm
 * sequence reuses it, and model-only confirmation is not proof of an explicit
 * user gesture. It must remain unmounted until that transport/user boundary is
 * separately qualified.
 *
 * The module is deliberately not mounted by server.js and performs no network
 * I/O. The in-memory store is an executable test fixture, not production
 * durability. A production adapter must implement the same compare-and-set
 * transitions atomically in a durable store.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { checkText, MAX_WAV_BYTES } from "./contract.js";
import {
  requireCanonicalPrincipal,
  requireSameCanonicalPrincipal,
} from "./canonical-principal.js";
import {
  createV1OfflinePaidPipeline,
  V1_OFFLINE_MAX_DAILY_CALLS,
} from "./v1-offline-paid-pipeline.js";
import { STAGING_RESOURCE_ORIGIN } from "./protected-resource-identity.js";

export const P2_OPERATION_ACTION = "generate_shenshu_voice";
export const P2_OPERATION_DEFAULT_TTL_MS = 5 * 60 * 1000;
export const P2_OPERATION_MAX_TTL_MS = 15 * 60 * 1000;
export const P2_OPERATION_STATES = Object.freeze({
  PENDING_CONFIRMATION: "pending_confirmation",
  CONFIRMING: "confirming",
  PROVIDER_PENDING: "provider_pending",
  COMPLETED: "completed",
  UNKNOWN: "unknown",
});

const HANDLE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const OPERATION_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const DIGEST_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const FIXED_VOICE = /^[\x21-\x7e]{1,128}$/;
const INITIATE_KEYS = Object.freeze(["trustedRequest", "text"]);
const STATUS_KEYS = Object.freeze(["trustedRequest", "handle"]);
const CONFIRM_KEYS = Object.freeze(["trustedRequest", "handle", "text"]);
const STATES = new Set(Object.values(P2_OPERATION_STATES));

function hasExactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every(key => keys.includes(key));
}

function nowMs(clock) {
  let value;
  try {
    value = clock();
  } catch {
    throw new Error("operation_clock_error");
  }
  const ms = value instanceof Date ? value.valueOf() : value;
  if (!Number.isSafeInteger(ms) || ms < 0) throw new Error("operation_clock_error");
  return ms;
}

function textDigest(text) {
  return createHash("sha256").update(text, "utf8").digest("base64url");
}

function defaultHandle() {
  return randomBytes(32).toString("base64url");
}

function defaultOperationId() {
  return "op_" + randomUUID().replaceAll("-", "");
}

function validRecord(record) {
  let safeText = null;
  try {
    safeText = checkText(record?.text);
  } catch {}
  return record && typeof record === "object" && !Array.isArray(record) &&
    record.version === 1 &&
    record.action === P2_OPERATION_ACTION &&
    HANDLE_PATTERN.test(record.handle ?? "") &&
    OPERATION_ID_PATTERN.test(record.operationId ?? "") &&
    typeof record.principal === "string" &&
    safeText === record.text &&
    DIGEST_PATTERN.test(record.textDigest ?? "") &&
    Number.isSafeInteger(record.textBytes) &&
    record.textBytes >= 1 && record.textBytes <= 800 &&
    Buffer.byteLength(record.text, "utf8") === record.textBytes &&
    createHash("sha256").update(record.text, "utf8").digest("base64url") ===
      record.textDigest &&
    record.origin === STAGING_RESOURCE_ORIGIN &&
    Number.isSafeInteger(record.issuedAt) && record.issuedAt >= 0 &&
    Number.isSafeInteger(record.expiresAt) &&
    record.expiresAt > record.issuedAt &&
    record.expiresAt - record.issuedAt <= P2_OPERATION_MAX_TTL_MS &&
    STATES.has(record.state);
}

function validDependencies({
  resolveVerifiedPrincipal,
  operationStore,
  paidStore,
  synthesize,
  privateResultStore,
  voiceId,
  maximumDailyCalls,
  clock,
  makeHandle,
  makeOperationId,
  operationTtlMs,
}) {
  return typeof resolveVerifiedPrincipal === "function" &&
    operationStore &&
    ["createPending", "get", "claim", "markProviderPending", "markCompleted", "markUnknown"]
      .every(name => typeof operationStore[name] === "function") &&
    paidStore &&
    typeof paidStore.reserveAtomic === "function" &&
    typeof paidStore.issue === "function" &&
    typeof paidStore.consume === "function" &&
    typeof synthesize === "function" &&
    privateResultStore &&
    typeof privateResultStore.save === "function" &&
    typeof voiceId === "string" &&
    FIXED_VOICE.test(voiceId.trim()) &&
    Number.isSafeInteger(maximumDailyCalls) &&
    maximumDailyCalls >= 1 &&
    maximumDailyCalls <= V1_OFFLINE_MAX_DAILY_CALLS &&
    typeof clock === "function" &&
    typeof makeHandle === "function" &&
    typeof makeOperationId === "function" &&
    Number.isSafeInteger(operationTtlMs) &&
    operationTtlMs >= 1_000 &&
    operationTtlMs <= P2_OPERATION_MAX_TTL_MS;
}

function isoTime(ms) {
  return new Date(ms).toISOString();
}

function validClaim(result) {
  return result && typeof result === "object" &&
    result.claimed === true &&
    OPERATION_ID_PATTERN.test(result.operationId ?? "");
}

function validAudioResult(result) {
  if (result?.providerAttempts !== 1 ||
      result?.delivery !== "inline-base64-experimental" ||
      result?.record?.generated !== true ||
      result?.record?.source !== "minimax" ||
      result?.record?.audioMimeType !== "audio/wav" ||
      typeof result?.record?.audioBase64 !== "string") {
    return null;
  }
  const audio = Buffer.from(result.record.audioBase64, "base64");
  if (audio.length < 44 ||
      audio.length > MAX_WAV_BYTES ||
      audio.toString("base64") !== result.record.audioBase64) {
    return null;
  }
  return audio;
}

export function createV1P2StableOperationBroker(options = {}) {
  const {
    resolveVerifiedPrincipal,
    operationStore,
    paidStore,
    synthesize,
    privateResultStore,
    voiceId,
    maximumDailyCalls = V1_OFFLINE_MAX_DAILY_CALLS,
    clock = () => new Date(),
    makeHandle = defaultHandle,
    makeOperationId = defaultOperationId,
    operationTtlMs = P2_OPERATION_DEFAULT_TTL_MS,
  } = options;

  if (!validDependencies({
    resolveVerifiedPrincipal,
    operationStore,
    paidStore,
    synthesize,
    privateResultStore,
    voiceId,
    maximumDailyCalls,
    clock,
    makeHandle,
    makeOperationId,
    operationTtlMs,
  })) {
    throw new Error("operation_broker_unavailable");
  }

  const fixedVoiceId = voiceId.trim();

  async function verifiedPrincipal(trustedRequest) {
    let identity;
    try {
      identity = await resolveVerifiedPrincipal(trustedRequest);
    } catch {
      throw new Error("not_authorized");
    }
    if (!identity || identity.verified !== true) throw new Error("not_authorized");
    try {
      return requireCanonicalPrincipal(identity.subject);
    } catch {
      throw new Error("not_authorized");
    }
  }

  async function readOwnedRecord({ principal, handle }) {
    let record;
    try {
      record = await operationStore.get({ principal, handle });
    } catch {
      throw new Error("operation_store_unavailable");
    }
    if (!record) throw new Error("operation_not_found");
    if (!validRecord(record) || record.principal !== principal || record.handle !== handle) {
      throw new Error("operation_store_invalid");
    }
    return record;
  }

  async function closeAsUnknown({ principal, handle, operationId }) {
    try {
      const result = await operationStore.markUnknown({
        principal,
        handle,
        operationId,
        now: nowMs(clock),
      });
      return result?.updated === true;
    } catch {
      return false;
    }
  }

  return Object.freeze({
    async initiate(input = {}) {
      if (!hasExactKeys(input, INITIATE_KEYS) ||
          !input.trustedRequest ||
          typeof input.trustedRequest !== "object" ||
          Array.isArray(input.trustedRequest)) {
        throw new Error("invalid_input");
      }

      let safeText;
      try {
        safeText = checkText(input.text);
      } catch {
        throw new Error("invalid_input");
      }
      const principal = await verifiedPrincipal(input.trustedRequest);
      const issuedAt = nowMs(clock);
      const handle = makeHandle();
      const operationId = makeOperationId();
      if (!HANDLE_PATTERN.test(handle ?? "") ||
          !OPERATION_ID_PATTERN.test(operationId ?? "")) {
        throw new Error("operation_generator_invalid");
      }

      const record = Object.freeze({
        version: 1,
        action: P2_OPERATION_ACTION,
        handle,
        operationId,
        principal,
        // The standalone player must show the exact proposal before consent.
        // MCP responses never include this field. A durable adapter must define
        // its private-at-rest representation before live enablement.
        text: safeText,
        textDigest: textDigest(safeText),
        textBytes: Buffer.byteLength(safeText, "utf8"),
        origin: STAGING_RESOURCE_ORIGIN,
        state: P2_OPERATION_STATES.PENDING_CONFIRMATION,
        issuedAt,
        expiresAt: issuedAt + operationTtlMs,
      });

      let created;
      try {
        created = await operationStore.createPending(record);
      } catch {
        throw new Error("operation_store_unavailable");
      }
      if (!created || created.created !== true) throw new Error("operation_collision");
      return Object.freeze({
        status: P2_OPERATION_STATES.PENDING_CONFIRMATION,
        handle,
        expiresAt: isoTime(record.expiresAt),
        billable: false,
      });
    },

    async status(input = {}) {
      if (!hasExactKeys(input, STATUS_KEYS) ||
          !input.trustedRequest ||
          typeof input.trustedRequest !== "object" ||
          Array.isArray(input.trustedRequest) ||
          !HANDLE_PATTERN.test(input.handle ?? "")) {
        throw new Error("invalid_input");
      }
      const principal = await verifiedPrincipal(input.trustedRequest);
      const record = await readOwnedRecord({ principal, handle: input.handle });
      // Completed and unknown are terminal receipts and remain recoverable
      // after the confirmation window. Expiry only closes unclaimed work.
      if (record.state === P2_OPERATION_STATES.COMPLETED) {
        return Object.freeze({ status: "completed", ready: true, retryable: false });
      }
      if (record.state === P2_OPERATION_STATES.UNKNOWN) {
        return Object.freeze({ status: "unknown", retryable: false });
      }
      if (record.expiresAt <= nowMs(clock)) return Object.freeze({ status: "expired", retryable: false });
      switch (record.state) {
        case P2_OPERATION_STATES.PENDING_CONFIRMATION:
          return Object.freeze({
            status: P2_OPERATION_STATES.PENDING_CONFIRMATION,
            expiresAt: isoTime(record.expiresAt),
            billable: false,
            retryable: false,
          });
        case P2_OPERATION_STATES.CONFIRMING:
          return Object.freeze({ status: "confirmation_in_progress", retryable: false });
        case P2_OPERATION_STATES.PROVIDER_PENDING:
          return Object.freeze({ status: "outcome_pending", retryable: false });
        default:
          throw new Error("operation_store_invalid");
      }
    },

    async confirm(input = {}) {
      if (!hasExactKeys(input, CONFIRM_KEYS) ||
          !input.trustedRequest ||
          typeof input.trustedRequest !== "object" ||
          Array.isArray(input.trustedRequest) ||
          !HANDLE_PATTERN.test(input.handle ?? "")) {
        throw new Error("invalid_input");
      }
      let safeText;
      try {
        safeText = checkText(input.text);
      } catch {
        throw new Error("invalid_input");
      }

      const principal = await verifiedPrincipal(input.trustedRequest);
      const digest = textDigest(safeText);
      const textBytes = Buffer.byteLength(safeText, "utf8");
      let claim;
      try {
        claim = await operationStore.claim({
          principal,
          handle: input.handle,
          textDigest: digest,
          textBytes,
          now: nowMs(clock),
        });
      } catch {
        throw new Error("operation_store_unavailable");
      }

      if (!validClaim(claim)) {
        const existing = await readOwnedRecord({ principal, handle: input.handle });
        if (existing.textDigest !== digest || existing.textBytes !== textBytes) {
          throw new Error("operation_binding_mismatch");
        }
        switch (existing.state) {
          case P2_OPERATION_STATES.COMPLETED:
            return Object.freeze({
              status: "completed",
              replayed: true,
              providerAttempts: 0,
            });
          case P2_OPERATION_STATES.UNKNOWN:
            throw new Error("operation_outcome_unknown");
          case P2_OPERATION_STATES.PENDING_CONFIRMATION:
          case P2_OPERATION_STATES.CONFIRMING:
          case P2_OPERATION_STATES.PROVIDER_PENDING:
            if (existing.expiresAt <= nowMs(clock)) throw new Error("operation_expired");
            throw new Error("operation_pending");
          default:
            throw new Error("operation_store_invalid");
        }
      }

      const operationId = claim.operationId;
      try {
        const marked = await operationStore.markProviderPending({
          principal,
          handle: input.handle,
          operationId,
          now: nowMs(clock),
        });
        if (marked?.updated !== true) throw new Error("operation_state_invalid");
      } catch {
        await closeAsUnknown({ principal, handle: input.handle, operationId });
        throw new Error("operation_outcome_unknown");
      }

      let pipelineResult;
      try {
        let observedPrincipal = null;
        const runPaidPipeline = createV1OfflinePaidPipeline({
          resolveVerifiedPrincipal: async trustedRequest => {
            const actual = await verifiedPrincipal(trustedRequest);
            requireSameCanonicalPrincipal(principal, actual);
            observedPrincipal = actual;
            return Object.freeze({ verified: true, subject: actual });
          },
          store: paidStore,
          synthesize,
          voiceId: fixedVoiceId,
          maximumDailyCalls,
          clock,
          makeRequestId: () => operationId,
        });
        pipelineResult = await runPaidPipeline({
          trustedRequest: input.trustedRequest,
          text: safeText,
        });
        requireSameCanonicalPrincipal(principal, observedPrincipal);
      } catch {
        await closeAsUnknown({ principal, handle: input.handle, operationId });
        throw new Error("operation_outcome_unknown");
      }

      const audio = validAudioResult(pipelineResult);
      if (!audio) {
        await closeAsUnknown({ principal, handle: input.handle, operationId });
        throw new Error("operation_outcome_unknown");
      }

      try {
        const saved = await privateResultStore.save({ principal, audio });
        if (!Number.isFinite(saved?.durationSeconds) ||
            typeof saved?.expiresAt !== "string") {
          throw new Error("result_store_invalid");
        }
        const completed = await operationStore.markCompleted({
          principal,
          handle: input.handle,
          operationId,
          now: nowMs(clock),
        });
        if (completed?.updated !== true) throw new Error("operation_state_invalid");
      } catch {
        await closeAsUnknown({ principal, handle: input.handle, operationId });
        throw new Error("operation_outcome_unknown");
      }

      return Object.freeze({
        status: "completed",
        replayed: false,
        providerAttempts: 1,
      });
    },
  });
}

/**
 * Executable in-memory model of the required durable CAS contract.
 * Export is explicitly test-only; it does not survive a process restart by
 * itself, but a new broker may share the same instance to model one.
 */
export function createInMemoryStableOperationStoreForTest() {
  const records = new Map();
  const operationIds = new Set();

  function key(principal, handle) {
    return principal + "\0" + handle;
  }

  function copy(record) {
    return record ? Object.freeze({ ...record }) : null;
  }

  return Object.freeze({
    async createPending(record) {
      if (!validRecord(record) ||
          record.state !== P2_OPERATION_STATES.PENDING_CONFIRMATION) {
        return { created: false, reason: "invalid" };
      }
      const storageKey = key(record.principal, record.handle);
      if (records.has(storageKey) || operationIds.has(record.operationId)) {
        return { created: false, reason: "collision" };
      }
      records.set(storageKey, { ...record });
      operationIds.add(record.operationId);
      return { created: true };
    },

    async get({ principal, handle } = {}) {
      if (typeof principal !== "string" || !HANDLE_PATTERN.test(handle ?? "")) return null;
      return copy(records.get(key(principal, handle)));
    },

    async listPending({ principal, now, limit = 10 } = {}) {
      if (typeof principal !== "string" ||
          !Number.isSafeInteger(now) || now < 0 ||
          !Number.isSafeInteger(limit) || limit < 1 || limit > 20) {
        return [];
      }
      return [...records.values()]
        .filter(record => record.principal === principal &&
          record.state === P2_OPERATION_STATES.PENDING_CONFIRMATION &&
          record.expiresAt > now)
        .sort((left, right) => right.issuedAt - left.issuedAt ||
          left.handle.localeCompare(right.handle))
        .slice(0, limit)
        .map(copy);
    },

    async claim({ principal, handle, textDigest: digest, textBytes, now } = {}) {
      const record = records.get(key(principal, handle));
      if (!record) return { claimed: false, reason: "not_found" };
      if (!Number.isSafeInteger(now) || now < 0) return { claimed: false, reason: "clock" };
      if (record.expiresAt <= now) return { claimed: false, reason: "expired" };
      if (record.textDigest !== digest || record.textBytes !== textBytes) {
        return { claimed: false, reason: "binding_mismatch" };
      }
      if (record.state !== P2_OPERATION_STATES.PENDING_CONFIRMATION) {
        return { claimed: false, reason: "state", state: record.state };
      }
      record.state = P2_OPERATION_STATES.CONFIRMING;
      record.updatedAt = now;
      return { claimed: true, operationId: record.operationId };
    },

    async markProviderPending({ principal, handle, operationId, now } = {}) {
      const record = records.get(key(principal, handle));
      if (!record ||
          record.operationId !== operationId ||
          record.state !== P2_OPERATION_STATES.CONFIRMING) {
        return { updated: false };
      }
      record.state = P2_OPERATION_STATES.PROVIDER_PENDING;
      record.updatedAt = now;
      return { updated: true };
    },

    async markCompleted({ principal, handle, operationId, now } = {}) {
      const record = records.get(key(principal, handle));
      if (!record ||
          record.operationId !== operationId ||
          record.state !== P2_OPERATION_STATES.PROVIDER_PENDING) {
        return { updated: false };
      }
      record.state = P2_OPERATION_STATES.COMPLETED;
      record.updatedAt = now;
      return { updated: true };
    },

    async markUnknown({ principal, handle, operationId, now } = {}) {
      const record = records.get(key(principal, handle));
      if (!record || record.operationId !== operationId) return { updated: false };
      if (record.state === P2_OPERATION_STATES.UNKNOWN) return { updated: true };
      if (record.state !== P2_OPERATION_STATES.CONFIRMING &&
          record.state !== P2_OPERATION_STATES.PROVIDER_PENDING) {
        return { updated: false };
      }
      record.state = P2_OPERATION_STATES.UNKNOWN;
      record.updatedAt = now;
      return { updated: true };
    },
  });
}
