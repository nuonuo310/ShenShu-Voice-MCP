/**
 * Offline-only P2 composition between one trusted one-shot request and the
 * existing authenticated standalone player.
 *
 * This module is deliberately not mounted by server.js. It reuses the reviewed
 * paid pipeline and fixes model/voice on the server, but it never calls a real
 * provider or D1. A server-owned operation resolver must bind the verified MCP
 * principal to a stable operation ID before admission; caller arguments cannot
 * supply either value.
 */
import { checkText, MAX_WAV_BYTES } from "./contract.js";
import {
  requireCanonicalPrincipal,
  requireSameCanonicalPrincipal,
} from "./canonical-principal.js";
import {
  createV1OfflinePaidPipeline,
  V1_OFFLINE_MAX_DAILY_CALLS,
} from "./v1-offline-paid-pipeline.js";

const OPERATION_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const INPUT_KEYS = Object.freeze(["trustedRequest", "text"]);
const FIXED_VOICE = /^[\x21-\x7e]{1,128}$/;

function validDependencies({
  resolveVerifiedPrincipal,
  resolveServerOperation,
  paidStore,
  synthesize,
  privateResultStore,
  voiceId,
  maximumDailyCalls,
  clock,
}) {
  return typeof resolveVerifiedPrincipal === "function" &&
    typeof resolveServerOperation === "function" &&
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
    typeof clock === "function";
}

export function createP2OneShotPlayerConnection(options = {}) {
  const {
    resolveVerifiedPrincipal,
    resolveServerOperation,
    paidStore,
    synthesize,
    privateResultStore,
    voiceId,
    maximumDailyCalls = V1_OFFLINE_MAX_DAILY_CALLS,
    clock = () => new Date(),
    makeGrantId,
  } = options;
  if (!validDependencies({
    resolveVerifiedPrincipal,
    resolveServerOperation,
    paidStore,
    synthesize,
    privateResultStore,
    voiceId,
    maximumDailyCalls,
    clock,
  }) || (makeGrantId !== undefined && typeof makeGrantId !== "function")) {
    throw new Error("connection_unavailable");
  }

  return async function initiate(input = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error("invalid_input");
    }
    const keys = Object.keys(input);
    if (keys.length !== INPUT_KEYS.length ||
        !INPUT_KEYS.every(key => keys.includes(key)) ||
        !input.trustedRequest ||
        typeof input.trustedRequest !== "object") {
      throw new Error("invalid_input");
    }
    const safeText = checkText(input.text);

    let operation;
    try {
      operation = await resolveServerOperation(input.trustedRequest);
    } catch {
      throw new Error("operation_unavailable");
    }
    if (!operation ||
        !OPERATION_ID_PATTERN.test(operation.operationId ?? "") ||
        typeof operation.principal !== "string") {
      throw new Error("operation_unavailable");
    }
    const expectedPrincipal = requireCanonicalPrincipal(operation.principal);
    let observedPrincipal = null;

    const boundResolver = async trustedRequest => {
      const identity = await resolveVerifiedPrincipal(trustedRequest);
      if (!identity || identity.verified !== true) {
        throw new Error("not_authorized");
      }
      const actualPrincipal = requireCanonicalPrincipal(identity.subject);
      requireSameCanonicalPrincipal(expectedPrincipal, actualPrincipal);
      observedPrincipal = actualPrincipal;
      return Object.freeze({ verified: true, subject: actualPrincipal });
    };

    const runPaidPipeline = createV1OfflinePaidPipeline({
      resolveVerifiedPrincipal: boundResolver,
      store: paidStore,
      synthesize,
      voiceId,
      maximumDailyCalls,
      clock,
      makeRequestId: () => operation.operationId,
      ...(makeGrantId ? { makeGrantId } : {}),
    });

    const result = await runPaidPipeline({
      trustedRequest: input.trustedRequest,
      text: safeText,
    });
    requireSameCanonicalPrincipal(expectedPrincipal, observedPrincipal);
    if (result?.providerAttempts !== 1 ||
        result?.delivery !== "inline-base64-experimental" ||
        result?.record?.generated !== true ||
        result?.record?.source !== "minimax" ||
        result?.record?.audioMimeType !== "audio/wav" ||
        typeof result?.record?.audioBase64 !== "string") {
      throw new Error("pipeline_result_invalid");
    }

    const audio = Buffer.from(result.record.audioBase64, "base64");
    if (audio.length < 44 ||
        audio.length > MAX_WAV_BYTES ||
        audio.toString("base64") !== result.record.audioBase64) {
      throw new Error("invalid_audio");
    }

    // The provider outcome is already billable. Store failure fails closed and
    // is never retried or refunded.
    const saved = await privateResultStore.save({
      principal: expectedPrincipal,
      audio,
    });
    return Object.freeze({
      ready: true,
      durationSeconds: saved.durationSeconds,
      expiresAt: saved.expiresAt,
    });
  };
}
