/**
 * Shared, nonbillable operation contract for Voice V1 P2.
 *
 * The protected MCP proposal, the authenticated player's read-only pending
 * view, and the durable operation store must agree on the same opaque handle,
 * canonical principal, text binding, expiry and state names. This module has
 * no network, provider, D1 client or paid-pipeline dependency.
 */
import { createHash } from "node:crypto";
import { checkText } from "./contract.js";
import { STAGING_RESOURCE_ORIGIN } from "./protected-resource-identity.js";

export const P2_OPERATION_ACTION = "generate_shenshu_voice";
export const P2_OPERATION_DEFAULT_TTL_MS = 5 * 60 * 1000;
export const P2_OPERATION_MAX_TTL_MS = 15 * 60 * 1000;
export const P2_OPERATION_STATES = Object.freeze({
  PENDING_CONFIRMATION: "pending_confirmation",
  CONFIRMING: "confirming",
  PROVIDER_PENDING: "provider_pending",
  COMPLETED: "completed",
  UNKNOWN: "unknown",
});

export const HANDLE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const OPERATION_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
export const DIGEST_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const STATES = new Set(Object.values(P2_OPERATION_STATES));

export function textDigest(text) {
  return createHash("sha256").update(text, "utf8").digest("base64url");
}

export function validRecord(record) {
  let safeText = null;
  try {
    safeText = checkText(record?.text);
  } catch {}
  return record && typeof record === "object" && !Array.isArray(record) &&
    record.version === 1 &&
    record.action === P2_OPERATION_ACTION &&
    HANDLE_PATTERN.test(record.handle ?? "") &&
    OPERATION_ID_PATTERN.test(record.operationId ?? "") &&
    typeof record.principal === "string" &&
    safeText === record.text &&
    DIGEST_PATTERN.test(record.textDigest ?? "") &&
    Number.isSafeInteger(record.textBytes) &&
    record.textBytes >= 1 && record.textBytes <= 800 &&
    Buffer.byteLength(record.text, "utf8") === record.textBytes &&
    createHash("sha256").update(record.text, "utf8").digest("base64url") ===
      record.textDigest &&
    record.origin === STAGING_RESOURCE_ORIGIN &&
    Number.isSafeInteger(record.issuedAt) && record.issuedAt >= 0 &&
    Number.isSafeInteger(record.expiresAt) &&
    record.expiresAt > record.issuedAt &&
    record.expiresAt - record.issuedAt <= P2_OPERATION_MAX_TTL_MS &&
    STATES.has(record.state);
}
