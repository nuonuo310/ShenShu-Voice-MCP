/**
 * Paid voice core; NOT registered on the unauthenticated public MCP endpoint.
 *
 * A trusted authenticated MCP transport must authorize a user BEFORE invoking
 * this function. This module never reads environment variables, uses no
 * persistent storage, does not expose credentials or upload generated audio.
 */
import { randomUUID } from "node:crypto";
import { checkText, MAX_WAV_BYTES } from "./contract.js";
import { synthesizeMiniMax } from "./minimax-adapter.js";

export const LIVE_TEXT_MAX_BYTES = 800;
export const LIVE_AUDIO_MAX_BYTES = MAX_WAV_BYTES;

/**
 * Caller's authorizer is mandatory and must have already verified identity,
 * budget and per-request explicit consent. A boolean is deliberately not an
 * authorization substitute: the gate returns an opaque authorization result.
 */
export async function createLiveVoice({
  text,
  authorize,
  synthesize = synthesizeMiniMax,
  apiKey,
  voiceId,
  modelId = "speech-2.8-hd",
  requestId = randomUUID(),
}) {
  const validatedText = checkText(text);
  if (typeof authorize !== "function") throw new Error("authorization_unavailable");
  const authorization = await authorize({
    action: "generate_shenshu_voice",
    textBytes: Buffer.byteLength(validatedText, "utf8"),
    requestId,
  });
  if (authorization?.allowed !== true || typeof authorization?.principal !== "string" ||
      authorization.principal.length === 0 || authorization?.oneTime !== true) {
    throw new Error("not_authorized");
  }
  // Exactly one upstream attempt; never retry after uncertain billing.
  const result = await synthesize({ text: validatedText, apiKey, voiceId, modelId });
  if (!Buffer.isBuffer(result?.audio) || result.audio.length > LIVE_AUDIO_MAX_BYTES ||
      !Number.isFinite(result.durationSeconds) || result.durationSeconds <= 0 ||
      result.durationSeconds > 60) throw new Error("invalid_audio");
  const audioBytes = result.audio.toString("base64");
  // Returning data instead of a public URL avoids leaking a bearer token into
  // browser history or logs. Host payload-size/CSP support must be proven before
  // attaching the result to a live ChatGPT tool.
  return Object.freeze({
    record: Object.freeze({
      id: "voice_" + randomUUID().replaceAll("-", ""),
      title: "沈述 · 语音留言",
      text: validatedText,
      durationSeconds: result.durationSeconds,
      voiceLabel: "沈述",
      generated: true,
      source: "minimax",
      audioMimeType: "audio/wav",
      audioBase64: audioBytes,
    }),
    delivery: "inline-base64-experimental",
  });
}
