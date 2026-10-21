/**
 * Offline, server-issued one-use audition consent capability.
 *
 * The issuer is not an MCP tool and is not wired to any route. In production,
 * an operator-only approval path would issue a short-lived capability after an
 * explicit human decision. The execution path may consume, but never issue,
 * that capability. A caller-supplied boolean or principal is not authority.
 *
 * This module is an offline model only. A durable production ledger requires a
 * separately reviewed schema and is described in the readiness report, not
 * implemented here.
 */
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { checkText, MAX_TEXT_BYTES } from "./contract.js";

export const AUDITION_CONSENT_ACTION = "generate_shenshu_voice";
export const DEFAULT_AUDITION_CONSENT_TTL_MS = 5 * 60 * 1000;
export const MAX_AUDITION_CONSENT_TTL_MS = 15 * 60 * 1000;

const IDENT = /^[A-Za-z0-9_-]{8,128}$/;
const DIGEST = /^[A-Za-z0-9_-]{43}$/;
const B64URL = /^[A-Za-z0-9_-]+$/;
const MAX_CAPABILITY_LENGTH = 4096;
const MAX_PAYLOAD_BYTES = 2048;
const MIN_SECRET_BYTES = 32;
const MAX_SECRET_BYTES = 256;

function secretBytes(value) {
  const bytes = Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(value ?? "", "utf8");
  if (bytes.length < MIN_SECRET_BYTES || bytes.length > MAX_SECRET_BYTES) {
    throw new Error("invalid_consent_configuration");
  }
  return bytes;
}

function nowMs(clock) {
  const value = clock();
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("consent_clock_error");
  return value;
}

function validBinding({ principal, action, requestId, textBytes, textDigest }) {
  return IDENT.test(principal ?? "") &&
    action === AUDITION_CONSENT_ACTION &&
    IDENT.test(requestId ?? "") &&
    Number.isSafeInteger(textBytes) &&
    textBytes >= 1 &&
    textBytes <= MAX_TEXT_BYTES &&
    DIGEST.test(textDigest ?? "");
}

function decodePart(value) {
  if (typeof value !== "string" || value.length === 0 || !B64URL.test(value)) {
    throw new Error("consent_invalid");
  }
  const bytes = Buffer.from(value, "base64url");
  if (bytes.toString("base64url") !== value) throw new Error("consent_invalid");
  return bytes;
}

export function auditionTextDigest(text) {
  const safeText = checkText(text);
  return createHash("sha256").update(safeText, "utf8").digest("base64url");
}

export function createAuditionConsentCapabilityStore({
  secret,
  clock = () => Date.now(),
  maxTtlMs = DEFAULT_AUDITION_CONSENT_TTL_MS,
  auditSink = null,
} = {}) {
  const key = secretBytes(secret);
  if (!Number.isSafeInteger(maxTtlMs) || maxTtlMs < 1000 ||
      maxTtlMs > MAX_AUDITION_CONSENT_TTL_MS) {
    throw new Error("invalid_consent_configuration");
  }
  if (auditSink !== null && typeof auditSink !== "function") {
    throw new Error("invalid_consent_configuration");
  }

  const used = new Map();
  const events = [];

  function audit(type, payload) {
    const event = Object.freeze({
      type,
      consentId: payload.consentId,
      principal: payload.principal,
      action: payload.action,
      requestId: payload.requestId,
      textBytes: payload.textBytes,
      textDigest: payload.textDigest,
      at: payload.at,
      expiresAt: payload.expiresAt,
    });
    events.push(event);
    if (auditSink) {
      try { auditSink(event); } catch {}
    }
  }

  function prune(now) {
    for (const [consentId, expiresAt] of used) {
      if (expiresAt <= now) used.delete(consentId);
    }
  }

  function issue(binding = {}) {
    if (!validBinding(binding)) throw new Error("consent_invalid_binding");
    const at = nowMs(clock);
    prune(at);
    const expiresAt = at + maxTtlMs;
    const consentId = randomUUID().replaceAll("-", "");
    const payload = {
      v: 1,
      consentId,
      principal: binding.principal,
      action: binding.action,
      requestId: binding.requestId,
      textBytes: binding.textBytes,
      textDigest: binding.textDigest,
      issuedAt: at,
      expiresAt,
    };
    const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const signature = createHmac("sha256", key).update(body).digest("base64url");
    const capability = body + "." + signature;
    audit("issued", { ...payload, at });
    return Object.freeze({ capability, consentId, expiresAt });
  }

  function consume(binding = {}) {
    if (typeof binding.capability !== "string" ||
        binding.capability.length > MAX_CAPABILITY_LENGTH) {
      throw new Error("consent_missing");
    }
    const parts = binding.capability.split(".");
    if (parts.length !== 2) throw new Error("consent_invalid");
    const bodyBytes = decodePart(parts[0]);
    const suppliedSignature = decodePart(parts[1]);
    if (bodyBytes.length > MAX_PAYLOAD_BYTES || suppliedSignature.length !== 32) {
      throw new Error("consent_invalid");
    }
    const expectedSignature = createHmac("sha256", key).update(parts[0]).digest();
    if (!timingSafeEqual(suppliedSignature, expectedSignature)) throw new Error("consent_invalid");

    let payload;
    try { payload = JSON.parse(bodyBytes.toString("utf8")); }
    catch { throw new Error("consent_invalid"); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || payload.v !== 1 ||
        !IDENT.test(payload.consentId ?? "") || !validBinding(payload) ||
        !Number.isSafeInteger(payload.issuedAt) || payload.issuedAt < 0 ||
        !Number.isSafeInteger(payload.expiresAt) ||
        payload.expiresAt <= payload.issuedAt ||
        payload.expiresAt - payload.issuedAt > maxTtlMs) {
      throw new Error("consent_invalid");
    }

    const at = nowMs(clock);
    if (payload.issuedAt > at + 30_000) throw new Error("consent_not_yet_valid");
    if (payload.expiresAt <= at) throw new Error("consent_expired");
    if (payload.principal !== binding.principal ||
        payload.action !== binding.action ||
        payload.requestId !== binding.requestId ||
        payload.textBytes !== binding.textBytes ||
        payload.textDigest !== binding.textDigest) {
      throw new Error("consent_binding_mismatch");
    }

    prune(at);
    if (used.has(payload.consentId)) throw new Error("consent_replay");
    used.set(payload.consentId, payload.expiresAt);
    audit("consumed", { ...payload, at });
    return Object.freeze({
      consumed: true,
      consentId: payload.consentId,
      principal: payload.principal,
      action: payload.action,
      expiresAt: payload.expiresAt,
    });
  }

  return Object.freeze({
    issue,
    consume,
    audit: () => Object.freeze(events.slice()),
  });
}
