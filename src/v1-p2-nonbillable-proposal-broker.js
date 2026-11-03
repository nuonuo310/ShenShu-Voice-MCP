/**
 * Nonbillable P2 proposal broker.
 *
 * This is a deliberately narrow facade over the shared operation contract.
 * It can create a pending, owner-scoped proposal and read its state. It has no
 * confirm method, no paid-store dependency, no provider import and no audio
 * path. A caller cannot supply a principal, operation ID, digest, grant or
 * billing authority.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { checkText } from "./contract.js";
import { requireCanonicalPrincipal } from "./canonical-principal.js";
import { STAGING_RESOURCE_ORIGIN } from "./protected-resource-identity.js";
import {
  HANDLE_PATTERN,
  OPERATION_ID_PATTERN,
  P2_OPERATION_ACTION,
  P2_OPERATION_DEFAULT_TTL_MS,
  P2_OPERATION_MAX_TTL_MS,
  P2_OPERATION_STATES,
  textDigest,
  validRecord,
} from "./v1-p2-operation-contract.js";

const INITIATE_KEYS = Object.freeze(["trustedRequest", "text"]);
const STATUS_KEYS = Object.freeze(["trustedRequest", "handle"]);

function exactKeys(input, keys) {
  return input && typeof input === "object" && !Array.isArray(input) &&
    Object.keys(input).length === keys.length &&
    keys.every(key => Object.hasOwn(input, key));
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

function defaultHandle() {
  return randomBytes(32).toString("base64url");
}

function defaultOperationId() {
  return "op_" + randomUUID().replaceAll("-", "");
}

function isoTime(ms) {
  return new Date(ms).toISOString();
}

export function createV1P2NonbillableProposalBroker({
  resolveVerifiedPrincipal,
  operationStore,
  clock = () => new Date(),
  makeHandle = defaultHandle,
  makeOperationId = defaultOperationId,
  operationTtlMs = P2_OPERATION_DEFAULT_TTL_MS,
} = {}) {
  if (typeof resolveVerifiedPrincipal !== "function" ||
      !operationStore ||
      typeof operationStore.createPending !== "function" ||
      typeof operationStore.get !== "function" ||
      typeof clock !== "function" ||
      typeof makeHandle !== "function" ||
      typeof makeOperationId !== "function" ||
      !Number.isSafeInteger(operationTtlMs) ||
      operationTtlMs < 1_000 ||
      operationTtlMs > P2_OPERATION_MAX_TTL_MS) {
    throw new Error("nonbillable_broker_unavailable");
  }

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

  return Object.freeze({
    async initiate(input = {}) {
      if (!exactKeys(input, INITIATE_KEYS) ||
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
      if (!exactKeys(input, STATUS_KEYS) ||
          !input.trustedRequest ||
          typeof input.trustedRequest !== "object" ||
          Array.isArray(input.trustedRequest) ||
          !HANDLE_PATTERN.test(input.handle ?? "")) {
        throw new Error("invalid_input");
      }
      const principal = await verifiedPrincipal(input.trustedRequest);
      const record = await readOwnedRecord({ principal, handle: input.handle });
      if (record.state === P2_OPERATION_STATES.COMPLETED) {
        return Object.freeze({ status: "completed", ready: true, retryable: false });
      }
      if (record.state === P2_OPERATION_STATES.UNKNOWN) {
        return Object.freeze({ status: "unknown", retryable: false });
      }
      if (record.expiresAt <= nowMs(clock)) {
        return Object.freeze({ status: "expired", retryable: false });
      }
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
  });
}
