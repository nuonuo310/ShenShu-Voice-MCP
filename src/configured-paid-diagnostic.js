/**
 * P2L: independently configured resource-token diagnostic.
 * No OAuth login, grant, budget debit, MCP paid tool or MiniMax synthesis.
 * Fail CLOSED unless explicitly enabled with a trusted operator-provisioned
 * Auth0 public JWK set. Even successfully verified tokens return 403.
 */
import {createVerifiedIdentityResolver} from "./verified-identity.js";
import {createPaidAuthProbe} from "./paid-auth-probe.js";

export function createConfiguredPaidDiagnostic(env = {}, {issuer,audience} = {}) {
  if (env.SHENSHU_AUTH_DIAGNOSTIC_ENABLED !== "1") return null;
  let jwks;
  try {
    if (typeof env.SHENSHU_AUTH_PUBLIC_JWKS_JSON !== "string" ||
        Buffer.byteLength(env.SHENSHU_AUTH_PUBLIC_JWKS_JSON, "utf8") > 65536)
      return null;
    jwks=JSON.parse(env.SHENSHU_AUTH_PUBLIC_JWKS_JSON);
    if (!jwks || !Array.isArray(jwks.keys) || jwks.keys.length < 1 ||
        jwks.keys.length > 10) return null;
    // Never take issuer/audience/scope from client input or JWT claims.
    const resolveVerifiedPrincipal=createVerifiedIdentityResolver({
      issuer,
      audience,
      publicJwks:jwks.keys,
      requiredScopes:["voice:speak"],
    });
    return createPaidAuthProbe({resolveVerifiedPrincipal,enabled:true});
  } catch {
    return null;
  }
}

/** Pure, non-billable result selector. Never exposes token or user identity. */
export async function evaluatePaidDiagnostic(req, diagnostic) {
  if (typeof diagnostic !== "function")
    return Object.freeze({status:401,code:"unauthorized"});
  const authorization=req?.headers?.authorization;
  return diagnostic({headers:{authorization}});
}
