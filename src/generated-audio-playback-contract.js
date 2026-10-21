/**
 * Offline-only transport contract for generated ShenShu WAV records.
 *
 * This module never fetches, synthesizes or exposes a public URL. It validates
 * a bounded inline record and can use an injected host decoder to model the
 * browser playback step. The deployed UI remains a separate manual gate.
 */
import { validateWav, MAX_WAV_BYTES } from "./contract.js";

export const GENERATED_AUDIO_SOURCE = "minimax";
export const MAX_GENERATED_AUDIO_BASE64_LENGTH = 3_000_000;

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function validateGeneratedRecord(record) {
  if (!record || record.source !== GENERATED_AUDIO_SOURCE || record.generated !== true) {
    throw new Error("unsupported_audio_result");
  }
  if (record.audioUrl !== undefined) throw new Error("invalid_generated_audio");
  if (record.audioMimeType !== "audio/wav") throw new Error("invalid_generated_audio");
  const audioBase64 = record.audioBase64;
  if (typeof audioBase64 !== "string" ||
      audioBase64.length < 100 ||
      audioBase64.length > MAX_GENERATED_AUDIO_BASE64_LENGTH ||
      audioBase64.length % 4 !== 0 ||
      !BASE64.test(audioBase64)) {
    throw new Error("invalid_generated_audio");
  }

  let audio;
  try { audio = Buffer.from(audioBase64, "base64"); }
  catch { throw new Error("invalid_generated_audio"); }
  if (audio.length < 44 || audio.length > MAX_WAV_BYTES ||
      audio.toString("base64") !== audioBase64) {
    throw new Error("invalid_generated_audio");
  }

  let metadata;
  try { metadata = validateWav(audio); }
  catch { throw new Error("invalid_generated_audio"); }

  return { audio, audioBase64, metadata };
}

export function prepareGeneratedAudioPlayback(record) {
  const { audio, audioBase64, metadata } = validateGeneratedRecord(record);

  return Object.freeze({
    source: GENERATED_AUDIO_SOURCE,
    generated: true,
    audioMimeType: "audio/wav",
    audioBase64,
    dataUrl: "data:audio/wav;base64," + audioBase64,
    byteLength: audio.length,
    durationSeconds: metadata.durationSeconds,
  });
}

/**
 * Host-delivered generated audio prepared for an explicit user-gesture Web
 * Audio path. It deliberately exposes no data URL or remote URL.
 */
export function prepareGeneratedWebAudioBridge(record) {
  const { audio, audioBase64, metadata } = validateGeneratedRecord(record);
  return Object.freeze({
    source: GENERATED_AUDIO_SOURCE,
    generated: true,
    audioMimeType: "audio/wav",
    audioBase64,
    audioBytes: Uint8Array.from(audio),
    byteLength: audio.length,
    durationSeconds: metadata.durationSeconds,
  });
}

export async function decodeGeneratedAudioForPlayback({
  record,
  decodeAudioData,
  generation = "current",
  isCurrent = () => true,
}) {
  const prepared = prepareGeneratedAudioPlayback(record);
  if (typeof decodeAudioData !== "function") throw new Error("audio_decode_unavailable");
  if (typeof isCurrent !== "function") throw new Error("invalid_playback_generation");

  const bytes = Uint8Array.from(Buffer.from(prepared.audioBase64, "base64"));
  let decoded;
  try { decoded = await decodeAudioData(bytes.buffer); }
  catch { throw new Error("audio_decode_failed"); }

  if (!isCurrent(generation)) throw new Error("stale_audio_result");
  if (!decoded ||
      !Number.isFinite(decoded.duration) ||
      decoded.duration < 0.2 ||
      decoded.duration > 60) {
    throw new Error("invalid_decoded_audio");
  }
  return Object.freeze({ prepared, decoded });
}
