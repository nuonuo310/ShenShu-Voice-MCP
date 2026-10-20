/**
 * P2J staging-only paid resource shell.
 *
 * NO live OAuth verification yet: every request to /paid-mcp is rejected,
 * including those presenting bearer tokens. NEVER call MiniMax here.
 * This endpoint's metadata allows OAuth discovery research without enabling
 * any paid tools. Do not turn on real calls until separate security gates pass.
 */
import {createProtectedResourceMetadata, unauthorizedChallenge} from "./oauth-resource-metadata.js";
import {createConfiguredPaidDiagnostic, evaluatePaidDiagnostic} from "./configured-paid-diagnostic.js";
import {handleStagingAuthenticatedMcp} from "./staging-authenticated-mcp.js";
import {createAuth0JwksCache} from "./auth0-jwks-cache.js";

export const PAID_PATH = "/paid-mcp";
export const RESOURCE_METADATA_PATH = "/.well-known/oauth-protected-resource/paid-mcp";
export const PAID_RESOURCE = "https://shenshu-voice-mcp.onrender.com/paid-mcp";
export const AUTH0_ISSUER = "https://dev-nwr87q0tnrbjeapr.us.auth0.com/";
export const RESOURCE_METADATA_URL =
  "https://shenshu-voice-mcp.onrender.com" + RESOURCE_METADATA_PATH;
const metadata = createProtectedResourceMetadata({
  resource: PAID_RESOURCE,
  authorizationServers: [AUTH0_ISSUER],
  scopes: ["voice:speak"],
});
const challenge = unauthorizedChallenge({resourceMetadataUrl:RESOURCE_METADATA_URL});
const runtimeJwksCache=createAuth0JwksCache();

function reply(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

/** Returns true only if a route was handled. No secrets or request body read. */
export async function handleProtectedResourceShell(req, res, pathname, {env = process.env} = {}) {
  if (pathname === RESOURCE_METADATA_PATH) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      reply(res,405,{"Allow":"GET, HEAD","Cache-Control":"no-store"},"method_not_allowed");
      return true;
    }
    reply(res,200,{
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"no-store",
      "X-Content-Type-Options":"nosniff",
    },req.method==="HEAD"?"":JSON.stringify(metadata));
    return true;
  }
  if (pathname === PAID_PATH) {
    // Explicitly enabled staging-only OAuth handshake: no paid tools.
    // Remains disabled without operator-provisioned trusted public JWKS.
    if (env.SHENSHU_AUTH_MCP_ENABLED === "1") {
      await handleStagingAuthenticatedMcp(req,res,{
        env,issuer:AUTH0_ISSUER,audience:PAID_RESOURCE,
        resourceMetadataUrl:RESOURCE_METADATA_URL,
        jwksCache:runtimeJwksCache
      });
      return true;
    }
    // The login-diagnostic is optional and defaults OFF. Verified identity
    // receives 403, not a paid grant. No paid tool or synthesis lives here.
    const diagnostic=createConfiguredPaidDiagnostic(env,{issuer:AUTH0_ISSUER,audience:PAID_RESOURCE});
    const outcome=await evaluatePaidDiagnostic(req,diagnostic);
    reply(res,outcome.status,{
      ...challenge.headers,
      "Content-Type":"application/json; charset=utf-8",
      "X-Content-Type-Options":"nosniff",
    },JSON.stringify({error:outcome.code}));
    return true;
  }
  return false;
}
