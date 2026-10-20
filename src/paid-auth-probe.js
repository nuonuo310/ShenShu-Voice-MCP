/**
 * P2K isolated paid-route authorization diagnostics.
 * An authenticated request is NEVER permission to run paid synthesis.
 * Intentionally not wired to the public server until real Auth0 integration
 * and deployment security review. No secrets, quota writes or MiniMax calls.
 */
export function createPaidAuthProbe({resolveVerifiedPrincipal, enabled=false}) {
  if (typeof resolveVerifiedPrincipal !== "function" || typeof enabled !== "boolean")
    throw new Error("invalid_auth_probe_configuration");
  return async function evaluateRequest(request) {
    if (!enabled) return Object.freeze({status:401,code:"unauthorized"});
    try {
      const principal=await resolveVerifiedPrincipal(request);
      if (!principal || principal.verified!==true ||
          typeof principal.subject!=="string" ||
          !/^[A-Za-z0-9_-]{8,128}$/.test(principal.subject))
        return Object.freeze({status:401,code:"unauthorized"});
      // Deliberately no trusted principal or token in any client-visible output.
      // Later: a separately reviewed MCP tool can use authenticated context
      // and a durable budget gate; this probe must NEVER authorize payment.
      return Object.freeze({status:403,code:"paid_voice_disabled"});
    } catch (error) {
      return Object.freeze({
        status: error?.message==="insufficient_scope" ? 403 : 401,
        code: error?.message==="insufficient_scope" ? "insufficient_scope" : "unauthorized"
      });
    }
  };
}
