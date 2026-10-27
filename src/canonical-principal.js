/**
 * Canonical opaque principal shared by the protected MCP verifier and the
 * standalone player session.
 *
 * Neither path may accept a caller-supplied principal. Both derive the exact
 * same value from the trusted issuer and the verified Auth0 `sub`; tests bind a
 * signed MCP token and a player userinfo response to the same principal.
 */
import { createHash } from "node:crypto";

export const CANONICAL_PRINCIPAL_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function trustedText(value, maxBytes) {
  return typeof value === "string" &&
    value.length > 0 &&
    Buffer.byteLength(value, "utf8") <= maxBytes &&
    !/[\x00-\x1f\x7f]/.test(value);
}

export function deriveCanonicalPrincipal({ issuer, subject } = {}) {
  if (!trustedText(issuer, 2048) || !trustedText(subject, 512)) {
    throw new Error("invalid_principal_input");
  }
  return createHash("sha256")
    .update(issuer + "\0" + subject, "utf8")
    .digest("base64url")
    .slice(0, 43);
}

export function requireCanonicalPrincipal(value) {
  if (typeof value !== "string" || !CANONICAL_PRINCIPAL_PATTERN.test(value)) {
    throw new Error("invalid_principal");
  }
  return value;
}

export function requireSameCanonicalPrincipal(expected, actual) {
  const left = requireCanonicalPrincipal(expected);
  const right = requireCanonicalPrincipal(actual);
  if (left !== right) throw new Error("principal_mismatch");
  return right;
}
