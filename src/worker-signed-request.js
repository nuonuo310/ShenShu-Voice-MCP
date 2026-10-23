/**
 * Pure offline HMAC contract for a possible Render -> Worker request path.
 *
 * This module is not wired to Render, the Worker candidate or any route. It
 * deliberately has no Node built-in, network, provider or secret-source import.
 * The operation state machine, not a separate nonce table, is the durable
 * replay anchor for state-changing requests.
 */
export const WORKER_SIGNED_REQUEST_VERSION = "SHENSHU-WORKER-SIGNED-REQUEST-V1";
export const WORKER_SIGNED_REQUEST_HEADERS = Object.freeze({
  keyId: "x-shenshu-key-id",
  timestamp: "x-shenshu-timestamp",
  nonce: "x-shenshu-nonce",
  signature: "x-shenshu-signature",
});
export const WORKER_SIGNED_REQUEST_MAX_BODY_BYTES = 2048;
export const WORKER_SIGNED_REQUEST_MAX_SKEW_SECONDS = 30;

const KEY_ID = /^[A-Za-z0-9_-]{8,64}$/;
const NONCE = /^[A-Za-z0-9_-]{22,86}$/;
const SIGNATURE = /^[A-Za-z0-9_-]{43}$/;
const TIMESTAMP = /^(0|[1-9][0-9]{0,11})$/;
const PATH = /^\/internal\/v1\/paid-operations\/[a-z-]{3,32}$/;
const HOST = /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?(?::[0-9]{1,5})?$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const encoder = new TextEncoder();
const BASE64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function invalid() {
  throw new Error("signed_request_invalid");
}

function configInvalid() {
  throw new Error("signed_request_config_invalid");
}

function encodeBase64url(bytes) {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const third = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const combined = (first << 16) | (second << 8) | third;
    output += BASE64URL_ALPHABET[(combined >>> 18) & 63];
    output += BASE64URL_ALPHABET[(combined >>> 12) & 63];
    if (index + 1 < bytes.length) output += BASE64URL_ALPHABET[(combined >>> 6) & 63];
    if (index + 2 < bytes.length) output += BASE64URL_ALPHABET[combined & 63];
  }
  return output;
}

function decodeBase64url(value) {
  if (typeof value !== "string" || !BASE64URL.test(value) ||
      value.length % 4 === 1) {
    configInvalid();
  }
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const standard = value.replaceAll("-", "+").replaceAll("_", "/") + padding;
  let binary;
  try {
    binary = globalThis.atob(standard);
  } catch {
    configInvalid();
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function secretBytes(value) {
  const bytes = value instanceof Uint8Array ? new Uint8Array(value) : decodeBase64url(value);
  if (bytes.length < 32 || bytes.length > 64) configInvalid();
  return bytes;
}

function bodyBytes(value, allowString) {
  if (allowString && typeof value === "string") {
    return encoder.encode(value);
  }
  if (!(value instanceof Uint8Array)) invalid();
  return new Uint8Array(value);
}

function canonicalHost(value) {
  if (typeof value !== "string") invalid();
  const host = value.toLowerCase();
  if (!HOST.test(host)) invalid();
  return host;
}

function validateCommon({ method, host, path, contentType, bytes, maxBodyBytes }) {
  if (method !== "POST" ||
      typeof path !== "string" || !PATH.test(path) ||
      contentType !== "application/json" ||
      !Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1 || maxBodyBytes > 8192 ||
      bytes.length < 1 || bytes.length > maxBodyBytes) {
    invalid();
  }
  return canonicalHost(host);
}

function timestampString(value) {
  if (!Number.isSafeInteger(value) || value < 0) invalid();
  const text = String(value);
  if (!TIMESTAMP.test(text)) invalid();
  return text;
}

function nonceString(value) {
  if (typeof value !== "string" || !NONCE.test(value)) invalid();
  return value;
}

function keyIdString(value) {
  if (typeof value !== "string" || !KEY_ID.test(value)) invalid();
  return value;
}

function canonicalRequest({ host, path, contentType, timestamp, nonce, keyId, bodyDigest }) {
  return [
    WORKER_SIGNED_REQUEST_VERSION,
    "POST",
    host,
    path,
    contentType,
    timestamp,
    nonce,
    keyId,
    bodyDigest,
  ].join("\n");
}

async function digestBody(bytes) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return encodeBase64url(new Uint8Array(digest));
}

async function importHmac(bytes, usages) {
  return globalThis.crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

function newNonce() {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    throw new Error("signed_request_config_invalid");
  }
  globalThis.crypto.getRandomValues(bytes);
  return encodeBase64url(bytes);
}

function headerValue(headers, name) {
  if (headers && typeof headers.get === "function") {
    const value = headers.get(name);
    return typeof value === "string" ? value : null;
  }
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) return null;
  const matches = Object.keys(headers).filter(key => key.toLowerCase() === name);
  if (matches.length !== 1) return null;
  const value = headers[matches[0]];
  return typeof value === "string" ? value : null;
}

function currentSeconds(clock) {
  let value;
  try {
    value = clock();
  } catch {
    invalid();
  }
  if (!Number.isSafeInteger(value) || value < 0) invalid();
  return value;
}

/**
 * Sign an exact raw body for the future Render-side caller.
 * The returned headers contain no secret. The body is not returned or logged.
 */
export async function signWorkerRequest({
  method = "POST",
  host,
  path,
  contentType = "application/json",
  body,
  keyId,
  secret,
  timestamp,
  nonce,
} = {}) {
  try {
    const bytes = bodyBytes(body, true);
    const normalizedHost = validateCommon({
      method,
      host,
      path,
      contentType,
      bytes,
      maxBodyBytes: WORKER_SIGNED_REQUEST_MAX_BODY_BYTES,
    });
    const normalizedKeyId = keyIdString(keyId);
    const normalizedTimestamp = timestampString(timestamp ?? currentSeconds(() => Math.floor(Date.now() / 1000)));
    const normalizedNonce = nonceString(nonce ?? newNonce());
    const bodyDigest = await digestBody(bytes);
    const signingInput = encoder.encode(canonicalRequest({
      host: normalizedHost,
      path,
      contentType,
      timestamp: normalizedTimestamp,
      nonce: normalizedNonce,
      keyId: normalizedKeyId,
      bodyDigest,
    }));
    const key = await importHmac(secretBytes(secret), ["sign"]);
    const signature = new Uint8Array(await globalThis.crypto.subtle.sign("HMAC", key, signingInput));
    return Object.freeze({
      "content-type": "application/json",
      [WORKER_SIGNED_REQUEST_HEADERS.keyId]: normalizedKeyId,
      [WORKER_SIGNED_REQUEST_HEADERS.timestamp]: normalizedTimestamp,
      [WORKER_SIGNED_REQUEST_HEADERS.nonce]: normalizedNonce,
      [WORKER_SIGNED_REQUEST_HEADERS.signature]: encodeBase64url(signature),
    });
  } catch (error) {
    if (error?.message === "signed_request_config_invalid") throw error;
    invalid();
  }
}

/**
 * Verify an already-bounded request. All failures are intentionally collapsed
 * to one code so callers cannot build a signature/timestamp/key oracle.
 */
export function createWorkerRequestVerifier({
  keyring,
  clock = () => Math.floor(Date.now() / 1000),
  maxSkewSeconds = WORKER_SIGNED_REQUEST_MAX_SKEW_SECONDS,
  maxBodyBytes = WORKER_SIGNED_REQUEST_MAX_BODY_BYTES,
} = {}) {
  if (!keyring || typeof keyring !== "object" || Array.isArray(keyring) ||
      typeof clock !== "function" ||
      !Number.isSafeInteger(maxSkewSeconds) || maxSkewSeconds < 1 || maxSkewSeconds > 300 ||
      !Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1 || maxBodyBytes > 8192) {
    configInvalid();
  }
  const entries = Object.entries(keyring);
  if (entries.length < 1 || entries.length > 2) configInvalid();
  const keys = new Map(entries.map(([keyId, secret]) => {
    keyIdString(keyId);
    return [keyId, secretBytes(secret)];
  }));

  return async function verifyWorkerRequest({
    method,
    host,
    path,
    contentType,
    body,
    headers,
  } = {}) {
    try {
      const bytes = bodyBytes(body, false);
      const normalizedHost = validateCommon({
        method,
        host,
        path,
        contentType,
        bytes,
        maxBodyBytes,
      });
      const keyId = headerValue(headers, WORKER_SIGNED_REQUEST_HEADERS.keyId);
      const timestampText = headerValue(headers, WORKER_SIGNED_REQUEST_HEADERS.timestamp);
      const nonce = headerValue(headers, WORKER_SIGNED_REQUEST_HEADERS.nonce);
      const signatureText = headerValue(headers, WORKER_SIGNED_REQUEST_HEADERS.signature);
      if (!keyIdString(keyId) || !TIMESTAMP.test(timestampText ?? "") ||
          !NONCE.test(nonce ?? "") || !SIGNATURE.test(signatureText ?? "")) {
        invalid();
      }
      const timestamp = Number(timestampText);
      if (!Number.isSafeInteger(timestamp) ||
          Math.abs(currentSeconds(clock) - timestamp) > maxSkewSeconds) {
        invalid();
      }
      const secret = keys.get(keyId);
      if (!secret) invalid();
      const bodyDigest = await digestBody(bytes);
      const signingInput = encoder.encode(canonicalRequest({
        host: normalizedHost,
        path,
        contentType,
        timestamp: timestampText,
        nonce,
        keyId,
        bodyDigest,
      }));
      const key = await importHmac(secret, ["verify"]);
      const signature = decodeBase64url(signatureText);
      if (!await globalThis.crypto.subtle.verify("HMAC", key, signature, signingInput)) {
        invalid();
      }
      return Object.freeze({
        ok: true,
        bodyBytes: bytes,
        bodyDigest,
        keyId,
        timestamp,
        nonce,
      });
    } catch (error) {
      if (error?.message === "signed_request_config_invalid") throw error;
      invalid();
    }
  };
}
