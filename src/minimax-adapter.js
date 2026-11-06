import { checkText, MAX_WAV_BYTES, validateWav } from "./contract.js";

export const MINIMAX_ENDPOINT = "https://api.minimaxi.com/v1/t2a_v2";
export const DEFAULT_MODEL_ID = "speech-2.8-hd";
export const UPSTREAM_TIMEOUT_MS = 60_000;
export const VOICE_PRESETS = Object.freeze({
  natural: Object.freeze({ speed: 1, vol: 1, pitch: 0 }),
  gentle: Object.freeze({ speed: 0.93, vol: 0.95, pitch: -1 }),
});

function configured(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hexToBuffer(value) {
  if (typeof value !== "string" || value.length === 0 ||
      value.length > MAX_WAV_BYTES * 2 || value.length % 2 !== 0) {
    throw new Error("invalid_upstream");
  }
  if (!/^[0-9a-fA-F]+$/.test(value)) throw new Error("invalid_upstream");
  return Buffer.from(value, "hex");
}

/**
 * Repair only a non-seekable PCM WAV with BOTH 0xffffffff RIFF and data sizes.
 * FFmpeg's WAV muxer uses these placeholders when its destination is a pipe.
 * No re-encoding, guessing an unrelated size field, or relaxing validateWav.
 * This is a prospective compatibility fix, NOT attribution for a paid incident.
 */
function canonicalizeNonseekableWav(audio) {
  if (!Buffer.isBuffer(audio) || audio.length < 44 ||
      audio.length > MAX_WAV_BYTES ||
      audio.toString("ascii", 0, 4) !== "RIFF" ||
      audio.toString("ascii", 8, 12) !== "WAVE" ||
      audio.readUInt32LE(4) !== 0xffffffff) return audio;

  let position = 12;
  let foundFmt = false;
  while (position + 8 <= audio.length) {
    const kind = audio.toString("ascii", position, position + 4);
    const size = audio.readUInt32LE(position + 4);
    const dataStart = position + 8;
    if (kind === "fmt ") {
      if (foundFmt || size < 16 || dataStart + size > audio.length) return audio;
      foundFmt = true;
    }
    if (kind === "data") {
      // Only an EOF-terminated data payload is unambiguous. The copied WAV
      // is still subjected to the exact existing 16 kHz mono PCM16 contract.
      if (!foundFmt || size !== 0xffffffff) return audio;
      const actualDataBytes = audio.length - dataStart;
      if (actualDataBytes < 6400 || actualDataBytes % 2 !== 0) return audio;
      const canonical = Buffer.from(audio);
      canonical.writeUInt32LE(canonical.length - 8, 4);
      canonical.writeUInt32LE(actualDataBytes, position + 4);
      return canonical;
    }
    if (size === 0xffffffff) return audio;
    const next = dataStart + size + (size % 2);
    if (next > audio.length) return audio;
    position = next;
  }
  return audio;
}

export function buildMiniMaxRequest({
  text,
  voiceId,
  modelId = DEFAULT_MODEL_ID,
  voicePreset = "natural",
}) {
  const safeText = checkText(text);
  if (!configured(voiceId)) throw new Error("not_configured");
  if (!configured(modelId)) throw new Error("not_configured");
  const voiceSettings = VOICE_PRESETS[voicePreset];
  if (!voiceSettings) throw new Error("invalid_voice_preset");
  return Object.freeze({
    model: modelId.trim(),
    text: safeText,
    stream: false,
    voice_setting: Object.freeze({
      voice_id: voiceId.trim(),
      ...voiceSettings,
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
  voicePreset = "natural",
  fetchImpl = fetch,
  timeoutMs = UPSTREAM_TIMEOUT_MS,
}) {
  if (!configured(apiKey) || !configured(voiceId)) throw new Error("not_configured");
  const body = buildMiniMaxRequest({ text, voiceId, modelId, voicePreset });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(MINIMAX_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
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
    const audio = canonicalizeNonseekableWav(hexToBuffer(payload?.data?.audio));
    const metadata = validateWav(audio);
    return Object.freeze({ audio, ...metadata });
  } catch (error) {
    if (error?.message === "not_configured") throw error;
    throw new Error("upstream_error");
  } finally {
    clearTimeout(timer);
  }
}
