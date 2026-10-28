/**
 * P2J staging-only paid resource shell.
 *
 * NO live OAuth verification yet: every request to /paid-mcp is rejected,
 * including those presenting bearer tokens. NEVER call MiniMax here.
 * This endpoint's metadata allows OAuth discovery research without enabling
 * any paid tools. Do not turn on real calls until separate security gates pass.
 */
import {createConfiguredPaidDiagnostic, evaluatePaidDiagnostic} from "./configured-paid-diagnostic.js";
import {handleStagingAuthenticatedMcp} from "./staging-authenticated-mcp.js";
import {createAuth0JwksCache} from "./auth0-jwks-cache.js";
import {
  AUTH0_ISSUER,
  PAID_PATH,
  PRODUCTION_PAID_RESOURCE,
  PRODUCTION_RESOURCE_METADATA_URL,
  RESOURCE_METADATA_PATH,
  resolveProtectedResourceIdentity,
} from "./protected-resource-identity.js";

export {AUTH0_ISSUER,PAID_PATH,RESOURCE_METADATA_PATH};
export const PAID_RESOURCE = PRODUCTION_PAID_RESOURCE;
export const RESOURCE_METADATA_URL = PRODUCTION_RESOURCE_METADATA_URL;
const runtimeJwksCache=createAuth0JwksCache();

function reply(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

/** Returns true only if a route was handled. No secrets or request body read. */
export async function handleProtectedResourceShell(req, res, pathname, {
  env = process.env,
  proposalBroker = null,
} = {}) {
  const isMetadataRoute=pathname === RESOURCE_METADATA_PATH;
  const isPaidRoute=pathname === PAID_PATH;
  if (!isMetadataRoute && !isPaidRoute) return false;

  // A malformed staging identity fails closed on protected routes only. It can
  // never serve production discovery metadata or silently reuse production.
  const identity=resolveProtectedResourceIdentity(env);
  if (!identity.ok) {
    reply(res,503,{
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"no-store",
      "X-Content-Type-Options":"nosniff",
    },JSON.stringify({error:"resource_identity_unavailable"}));
    return true;
  }

  if (isMetadataRoute) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      reply(res,405,{"Allow":"GET, HEAD","Cache-Control":"no-store"},"method_not_allowed");
      return true;
    }
    reply(res,200,{
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"no-store",
      "X-Content-Type-Options":"nosniff",
    },req.method==="HEAD"?"":JSON.stringify(identity.metadata));
    return true;
  }
  if (isPaidRoute) {
    // Explicitly enabled staging-only OAuth handshake: no paid tools.
    // Remains disabled without operator-provisioned trusted public JWKS.
    if (env.SHENSHU_AUTH_MCP_ENABLED === "1") {
      await handleStagingAuthenticatedMcp(req,res,{
        env,issuer:identity.issuer,audience:identity.paidResource,
        resourceMetadataUrl:identity.resourceMetadataUrl,
        jwksCache:env.SHENSHU_AUTH_PUBLIC_JWKS_JSON ? null : runtimeJwksCache,
        proposalBroker:identity.staging ? proposalBroker : null
      });
      return true;
    }
    // The login-diagnostic is optional and defaults OFF. Verified identity
    // receives 403, not a paid grant. No paid tool or synthesis lives here.
    const diagnostic=createConfiguredPaidDiagnostic(env,{
      issuer:identity.issuer,audience:identity.paidResource
    });
    const outcome=await evaluatePaidDiagnostic(req,diagnostic);
    reply(res,outcome.status,{
      ...identity.challenge.headers,
      "Content-Type":"application/json; charset=utf-8",
      "X-Content-Type-Options":"nosniff",
    },JSON.stringify({error:outcome.code}));
    return true;
  }
  return false;
}
