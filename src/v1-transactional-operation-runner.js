/**
 * Offline server-owned operation runner for the transactional store candidate.
 * Not mounted on any MCP route and never imports a provider implementation.
 */
import { checkText } from "./contract.js";
import {
  buildOperationBinding,
  V1_OPERATION_STATES,
} from "./v1-transport-idempotency.js";

const IDENT = /^[A-Za-z0-9_-]{8,128}$/;
const RESULT_REF = /^[A-Za-z0-9_-]{8,128}$/;
const INPUT_KEYS = Object.freeze(["trustedRequest", "operationId", "text"]);

function safeTime(clock) {
  const value = clock();
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("operation_clock_error");
  return value;
}

export function createV1TransactionalOperationRunner({
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
    if (keys.length !== INPUT_KEYS.length ||
        !INPUT_KEYS.every(key => keys.includes(key)) ||
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

    let disposition;
    try {
      disposition = await operationStore.admit(binding);
    } catch (error) {
      if (error?.message === "operation_store_invalid") throw error;
      throw new Error("operation_store_unavailable");
    }
    if (!disposition || typeof disposition !== "object") {
      throw new Error("operation_store_invalid");
    }

    if (disposition.status === "conflict") throw new Error("operation_conflict");
    if (disposition.status === "expired") throw new Error("operation_expired");
    if (disposition.status === "daily_limit") throw new Error("budget_denied");
    if (disposition.status === "replay") {
      if (!disposition.record ||
          disposition.record.principal !== identity.subject ||
          disposition.record.operationId !== input.operationId ||
          disposition.record.textDigest !== binding.textDigest) {
        throw new Error("operation_store_invalid");
      }
      if (disposition.state === V1_OPERATION_STATES.COMPLETED) {
        if (!RESULT_REF.test(disposition.resultRef ?? "")) {
          throw new Error("operation_store_invalid");
        }
        return Object.freeze({
          status: "completed",
          replayed: true,
          providerAttempts: 0,
          resultRef: disposition.resultRef,
        });
      }
      if (disposition.state === V1_OPERATION_STATES.ADMITTED) {
        throw new Error("operation_in_progress");
      }
      if (disposition.state === V1_OPERATION_STATES.PROVIDER_PENDING ||
          disposition.state === V1_OPERATION_STATES.UNKNOWN) {
        throw new Error("operation_outcome_unknown");
      }
      throw new Error("operation_store_invalid");
    }
    if (disposition.status !== "admitted" ||
        !disposition.record ||
        !IDENT.test(disposition.record.requestId ?? "") ||
        disposition.record.principal !== identity.subject ||
        disposition.record.operationId !== input.operationId ||
        disposition.record.textDigest !== binding.textDigest ||
        disposition.record.state !== V1_OPERATION_STATES.ADMITTED) {
      throw new Error("operation_store_invalid");
    }

    const updateKeys = {
      principal: identity.subject,
      operationId: input.operationId,
      requestId: disposition.record.requestId,
    };
    try {
      await operationStore.markProviderPending(updateKeys);
    } catch (error) {
      if (error?.message === "operation_state_invalid" ||
          error?.message === "operation_store_invalid") {
        throw Error(error.message);
      }
      throw new Error("operation_store_unavailable");
    }

    let providerResult;
    try {
      providerResult = await synthesize({ text: safeText });
    } catch {
      try { await operationStore.markUnknown(updateKeys); } catch {}
      throw new Error("provider_outcome_unknown");
    }
    if (!providerResult || !RESULT_REF.test(providerResult.resultRef ?? "")) {
      try { await operationStore.markUnknown(updateKeys); } catch {}
      throw new Error("provider_outcome_unknown");
    }
    try {
      await operationStore.markCompleted({ ...updateKeys, resultRef: providerResult.resultRef });
    } catch {
      try { await operationStore.markUnknown(updateKeys); } catch {}
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
