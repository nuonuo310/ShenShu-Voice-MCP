/**
 * Offline-only private result store contract for Voice V1 P2.
 *
 * The durable backend is injected and MUST atomically keep at most the latest
 * one record per canonical principal. No backend is configured here: real D1
 * atomicity, private object storage and cloud qualification remain BLOCKED
 * until separately authorized live proof.
 */
import { randomUUID } from "node:crypto";
import { MAX_WAV_BYTES, validateWav } from "./contract.js";
import {
  requireCanonicalPrincipal,
} from "./canonical-principal.js";

export const DEFAULT_PRIVATE_RESULT_TTL_SECONDS = 300;
export const MIN_PRIVATE_RESULT_TTL_SECONDS = 30;
export const MAX_PRIVATE_RESULT_TTL_SECONDS = 900;

function nowDate(clock) {
  const value = clock();
  if (!(value instanceof Date) || Number.isNaN(value.valueOf())) {
    throw new Error("invalid_clock");
  }
  return new Date(value.valueOf());
}

function validBackend(backend) {
  return backend &&
    typeof backend.putLatest === "function" &&
    typeof backend.getLatest === "function" &&
    typeof backend.deleteExpired === "function";
}

function validTimestamp(value) {
  return typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

export function createP2PrivateResultStore({
  backend,
  ttlSeconds = DEFAULT_PRIVATE_RESULT_TTL_SECONDS,
  clock = () => new Date(),
} = {}) {
  if (!validBackend(backend) ||
      !Number.isSafeInteger(ttlSeconds) ||
      ttlSeconds < MIN_PRIVATE_RESULT_TTL_SECONDS ||
      ttlSeconds > MAX_PRIVATE_RESULT_TTL_SECONDS ||
      typeof clock !== "function") {
    throw new Error("result_store_unavailable");
  }

  return Object.freeze({
    async save({ principal, audio } = {}) {
      const subject = requireCanonicalPrincipal(principal);
      if (!Buffer.isBuffer(audio) ||
          audio.length < 44 ||
          audio.length > MAX_WAV_BYTES) {
        throw new Error("invalid_audio");
      }
      const metadata = validateWav(audio);
      const now = nowDate(clock);
      const expiresAt = new Date(now.valueOf() + ttlSeconds * 1000).toISOString();
      let saved;
      try {
        saved = await backend.putLatest({
          principal: subject,
          recordId: "voice_" + randomUUID().replaceAll("-", ""),
          audio: Buffer.from(audio),
          mimeType: metadata.mimeType,
          durationSeconds: metadata.durationSeconds,
          createdAt: now.toISOString(),
          expiresAt,
        });
      } catch {
        throw new Error("result_store_unavailable");
      }
      if (saved?.stored !== true) throw new Error("result_store_unavailable");
      return Object.freeze({
        durationSeconds: metadata.durationSeconds,
        expiresAt,
      });
    },

    async getLatest({ principal } = {}) {
      const subject = requireCanonicalPrincipal(principal);
      const now = nowDate(clock);
      let row;
      try {
        await backend.deleteExpired({ before: now.toISOString() });
        row = await backend.getLatest({
          principal: subject,
          now: now.toISOString(),
        });
      } catch {
        throw new Error("result_store_unavailable");
      }
      if (!row) return null;
      if (row.principal !== subject ||
          !validTimestamp(row.expiresAt) ||
          Date.parse(row.expiresAt) <= now.valueOf()) {
        return null;
      }
      if (!Buffer.isBuffer(row.audio) ||
          row.audio.length < 44 ||
          row.audio.length > MAX_WAV_BYTES) {
        throw new Error("invalid_audio");
      }
      const metadata = validateWav(row.audio);
      return Object.freeze({
        audio: Buffer.from(row.audio),
        durationSeconds: metadata.durationSeconds,
        expiresAt: row.expiresAt,
      });
    },

    async deleteExpired() {
      const now = nowDate(clock);
      try {
        const deleted = await backend.deleteExpired({ before: now.toISOString() });
        if (!Number.isSafeInteger(deleted?.deleted ?? 0) || (deleted?.deleted ?? 0) < 0) {
          throw new Error("invalid_delete_result");
        }
        return Object.freeze({ deleted: deleted?.deleted ?? 0 });
      } catch {
        throw new Error("result_store_unavailable");
      }
    },
  });
}

export function createP2PlayerAudioLoader({ privateResultStore } = {}) {
  if (!privateResultStore ||
      typeof privateResultStore.getLatest !== "function") {
    throw new Error("result_store_unavailable");
  }
  return async function loadAudio({ verifiedSubject } = {}) {
    const subject = requireCanonicalPrincipal(verifiedSubject);
    let result;
    try {
      result = await privateResultStore.getLatest({ principal: subject });
    } catch {
      throw new Error("audio_unavailable");
    }
    if (!result?.audio) throw new Error("audio_unavailable");
    return Buffer.from(result.audio);
  };
}
