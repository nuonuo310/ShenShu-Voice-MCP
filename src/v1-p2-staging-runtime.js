/**
 * Staging-only runtime composition for the sealed nonbillable closure.
 *
 * The process startup path calls this exactly once. It builds at most one
 * trusted identity verifier and one rotating JWKS cache, then passes the same
 * instances to the protected MCP route and the sealed proposal broker. It
 * returns a disabled composition (no closure, no D1 client, no in-memory or
 * plaintext fallback) unless every staging gate passes. Failure codes are
 * nonsecret and safe to log.
 */
import { createAuth0JwksCache } from "./auth0-jwks-cache.js";
import { createCloudflareD1Http } from "./cloudflare-d1-http.js";
import { resolveProtectedResourceIdentity } from "./protected-resource-identity.js";
import { createStagingIdentityVerifier } from "./staging-authenticated-mcp.js";
import {
  assessV1P2StagingSealedConfig,
  createV1P2StagingSealedClosureCandidate,
} from "./v1-p2-staging-sealed-closure.js";

function disabled(code, { jwksCache, staticTestJwks = false } = {}) {
  return Object.freeze({
    code,
    nonbillableClosure: null,
    identityVerifier: null,
    jwksCache,
    sealedProposalEnabled: false,
    staticTestJwks,
  });
}

export async function composeV1P2StagingRuntime({
  env = process.env,
  fetchImpl = globalThis.fetch,
  createD1Client = createCloudflareD1Http,
} = {}) {
  try {
    // Static JWKS is an explicit test-only surface. It stays null so the
    // protected route can never fall back to a live cache while the sealed
    // composition uses static keys.
    const staticTestJwks =
      env?.SHENSHU_AUTH_STATIC_JWKS_TEST_ONLY === "1" &&
      typeof env?.SHENSHU_AUTH_PUBLIC_JWKS_JSON === "string" &&
      env.SHENSHU_AUTH_PUBLIC_JWKS_JSON.length > 0;
    let jwksCache = null;
    if (!staticTestJwks) {
      try {
        jwksCache = createAuth0JwksCache({ fetchImpl });
      } catch {
        // No cache means every protected request fails closed.
        return disabled("jwks_cache_invalid", { jwksCache: null });
      }
    }

    const identity = resolveProtectedResourceIdentity(env);
    if (identity.ok !== true) {
      return disabled("staging_identity_invalid", { jwksCache });
    }
    if (identity.staging !== true) {
      return disabled("not_staging", { jwksCache });
    }

    const configCode = assessV1P2StagingSealedConfig(env);
    if (configCode !== "sealed_config_ready") {
      return disabled(configCode, { jwksCache, staticTestJwks });
    }
    if (typeof createD1Client !== "function") {
      return disabled("d1_client_unavailable", { jwksCache, staticTestJwks });
    }

    let identityVerifier = null;
    try {
      identityVerifier = createStagingIdentityVerifier(env, {
        issuer: identity.issuer,
        audience: identity.paidResource,
        jwksCache,
      });
    } catch {
      identityVerifier = null;
    }
    if (typeof identityVerifier !== "function") {
      return disabled("identity_verifier_unavailable", {
        jwksCache,
        staticTestJwks,
      });
    }

    let nonbillableClosure = null;
    try {
      nonbillableClosure = await createV1P2StagingSealedClosureCandidate({
        env,
        createD1Client,
        mcpResolveVerifiedPrincipal: identityVerifier,
      });
    } catch {
      nonbillableClosure = null;
    }
    if (!nonbillableClosure) {
      return disabled("sealed_runtime_unavailable", {
        jwksCache,
        staticTestJwks,
      });
    }

    return Object.freeze({
      code: "sealed_ready",
      nonbillableClosure,
      identityVerifier,
      jwksCache,
      sealedProposalEnabled: true,
      staticTestJwks,
    });
  } catch {
    return disabled("startup_error");
  }
}
