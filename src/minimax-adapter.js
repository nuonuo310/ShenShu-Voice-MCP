import { checkText, validateWav } from "./contract.js";

export const MINIMAX_ENDPOINT = "https://api.minimaxi.com/v1/t2a_v2";
export const DEFAULT_MODEL_ID = "speech-2.8-hd";
export const UPSTREAM_TIMEOUT_MS = 60_000;

function configured(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hexToBuffer(value) {
  if (typeof value !== "string" || value.length === 0 || value.length % 2 !== 0) {
    throw new Error("invalid_upstream");
  }
  if (!/^[0-9a-fA-F]+$/.test(value)) throw new Error("invalid_upstream");
  return Buffer.from(value, "hex");
}

export function buildMiniMaxRequest({ text, voiceId, modelId = DEFAULT_MODEL_ID }) {
  const safeText = checkText(text);
  if (!configured(voiceId)) throw new Error("not_configured");
  if (!configured(modelId)) throw new Error("not_configured");
  return Object.freeze({
    model: modelId.trim(),
    text: safeText,
    stream: false,
    voice_setting: Object.freeze({
      voice_id: voiceId.trim(),
      speed: 1.0,
      vol: 1,
      pitch: 0,
    }),
    audio_setting: Object.freeze({
      sample_rate: 16000,
      format: "wav",
      channel: 1,
    }),
    output_format: "hex",
  });
}

/**
 * One paid upstream attempt at most. Caller owns authorization/quota gates.
 * This function never retries and never logs text, keys, voice IDs or upstream bodies.
 */
export async function synthesizeMiniMax({
  text,
  apiKey,
  voiceId,
  modelId = DEFAULT_MODEL_ID,
  fetchImpl = fetch,
  timeoutMs = UPSTREAM_TIMEOUT_MS,
}) {
  if (!configured(apiKey) || !configured(voiceId)) throw new Error("not_configured");
  const body = buildMiniMaxRequest({ text, voiceId, modelId });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(MINIMAX_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: \`Bearer \${apiKey.trim()}\`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response?.ok) throw new Error("upstream_error");
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error("upstream_error");
    }
    if (payload?.base_resp?.status_code !== 0) throw new Error("upstream_error");
    const audio = hexToBuffer(payload?.data?.audio);
    const metadata = validateWav(audio);
    return Object.freeze({ audio, ...metadata });
  } catch (error) {
    if (error?.message === "not_configured") throw error;
    throw new Error("upstream_error");
  } finally {
    clearTimeout(timer);
  }
}
