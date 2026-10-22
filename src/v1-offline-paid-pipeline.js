/**
 * Voice V1 S2 offline-only paid composition.
 *
 * Trusted OAuth principal -> durable atomic reservation -> server-consumed
 * one-use grant -> exactly one injected fake provider attempt -> validated
 * private WAV record. This module is deliberately not mounted on an MCP route.
 *
 * The caller cannot supply identity, approval, a grant, request ID, model or
 * voice. The fixed model and configured voice come only from server wiring.
 */
import { createHash, randomUUID } from "node:crypto";
import { checkText, MAX_WAV_BYTES, validateWav } from "./contract.js";
import { createDurablePaidAuthorizer } from "./durable-paid-admission.js";
import { DEFAULT_MODEL_ID } from "./minimax-adapter.js";

export const V1_FIXED_MODEL_ID = DEFAULT_MODEL_ID;
export const V1_OFFLINE_MAX_DAILY_CALLS = 3;

const IDENT = /^[A-Za-z0-9_-]{8,128}$/;
const INPUT_KEYS = Object.freeze(["trustedRequest", "text"]);
const FIXED_VOICE = /^[\x21-\x7e]{1,128}$/;

function textDigest(text) {
  return createHash("sha256").update(text, "utf8").digest("base64url");
}

function defaultGrantId() {
  return "grant_" + randomUUID().replaceAll("-", "");
}

export function createV1OfflinePaidPipeline({
  resolveVerifiedPrincipal,
  store,
  synthesize,
  voiceId,
  maximumDailyCalls = V1_OFFLINE_MAX_DAILY_CALLS,
  clock = () => new Date(),
  makeRequestId = randomUUID,
  makeGrantId = defaultGrantId,
} = {}) {
  if (typeof resolveVerifiedPrincipal !== "function" ||
      !store ||
      typeof store.reserveAtomic !== "function" ||
      typeof store.issue !== "function" ||
      typeof store.consume !== "function" ||
      typeof synthesize !== "function" ||
      typeof voiceId !== "string" ||
      !FIXED_VOICE.test(voiceId.trim()) ||
      !Number.isSafeInteger(maximumDailyCalls) ||
      maximumDailyCalls < 1 || maximumDailyCalls > V1_OFFLINE_MAX_DAILY_CALLS ||
      typeof clock !== "function" ||
      typeof makeRequestId !== "function" ||
      typeof makeGrantId !== "function") {
    throw new Error("pipeline_unavailable");
  }

  const fixedVoiceId = voiceId.trim();
  const reserveAtomic = args => store.reserveAtomic(args);
  const grantStore = Object.freeze({
    issue: args => store.issue(args),
    consume: args => store.consume(args),
  });

  return async function invoke(input = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error("invalid_input");
    }
    const keys = Object.keys(input);
    if (keys.length !== INPUT_KEYS.length ||
        !INPUT_KEYS.every(key => keys.includes(key)) ||
        !input.trustedRequest || typeof input.trustedRequest !== "object") {
      throw new Error("invalid_input");
    }

    const safeText = checkText(input.text);
    const textBytes = Buffer.byteLength(safeText, "utf8");
    const expectedDigest = textDigest(safeText);
    const requestId = makeRequestId();
    if (!IDENT.test(requestId ?? "")) throw new Error("invalid_request_id");

    const authorize = createDurablePaidAuthorizer({
      resolveVerifiedPrincipal,
      reserveAtomic,
      grantStore,
      maximumDailyCalls,
      clock,
      makeRequestId: () => requestId,
      makeGrantId,
    });

    // Admission consumes the server-only grant before this function can reach
    // the provider. There is no refund path and no caller-visible grant.
    const admission = await authorize({
      trustedRequest: input.trustedRequest,
      textBytes,
    });
    if (admission?.allowed !== true ||
        admission?.oneTime !== true ||
        admission?.requestId !== requestId ||
        !IDENT.test(admission?.principal ?? "")) {
      throw new Error("admission_invalid");
    }

    const boundText = safeText;
    if (textDigest(boundText) !== expectedDigest) {
      throw new Error("text_binding_mismatch");
    }

    // Exactly one provider attempt. An uncertain outcome propagates as a
    // fail-closed error; the reservation/grant is never refunded or retried.
    let providerAttempts = 0;
    let providerResult;
    try {
      providerAttempts++;
      providerResult = await synthesize({
        text: boundText,
        modelId: V1_FIXED_MODEL_ID,
        voiceId: fixedVoiceId,
      });
    } catch {
      throw new Error("provider_outcome_unknown");
    }

    if (!Buffer.isBuffer(providerResult?.audio) ||
        providerResult.audio.length < 44 ||
        providerResult.audio.length > MAX_WAV_BYTES) {
      throw new Error("invalid_audio");
    }
    const metadata = validateWav(providerResult.audio);
    const record = Object.freeze({
      id: "voice_" + randomUUID().replaceAll("-", ""),
      title: "沈述 · 语音留言",
      text: boundText,
      durationSeconds: metadata.durationSeconds,
      voiceLabel: "沈述",
      generated: true,
      source: "minimax",
      audioMimeType: metadata.mimeType,
      audioBase64: providerResult.audio.toString("base64"),
    });

    return Object.freeze({
      record,
      delivery: "inline-base64-experimental",
      offlineFakeProvider: true,
      providerAttempts,
    });
  };
}
