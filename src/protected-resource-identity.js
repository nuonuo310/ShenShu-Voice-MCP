/**
 * Operator-selected protected-resource identity.
 *
 * Production identity is frozen and remains the default. Staging requires an
 * explicit flag and one exact allowlisted HTTPS origin. No request header,
 * path, query, port, credential, wildcard, IDN spelling or fallback selects it.
 */
import {createProtectedResourceMetadata, unauthorizedChallenge} from "./oauth-resource-metadata.js";

export const AUTH0_ISSUER = "https://dev-nwr87q0tnrbjeapr.us.auth0.com/";
export const PRODUCTION_PAID_RESOURCE = "https://shenshu-voice-mcp.onrender.com/paid-mcp";
export const PRODUCTION_RESOURCE_METADATA_URL =
  "https://shenshu-voice-mcp.onrender.com/.well-known/oauth-protected-resource/paid-mcp";
export const STAGING_RESOURCE_ORIGIN = "https://shenshu-voice-mcp-staging.onrender.com";
export const PAID_PATH = "/paid-mcp";
export const RESOURCE_METADATA_PATH = "/.well-known/oauth-protected-resource/paid-mcp";

const RESOURCE_SCOPE = "voice:speak";

function exactHttpsOrigin(value) {
  if(typeof value!=="string" || value.length>2048) return null;
  try {
    const parsed=new URL(value);
    if(parsed.protocol!=="https:" || parsed.username!=="" || parsed.password!=="" ||
       parsed.port!=="" || parsed.pathname!=="/" || parsed.search!=="" ||
       parsed.hash!=="" || parsed.origin!==value) return null;
    return parsed.origin;
  } catch {return null;}
}

function createIdentity(origin,staging) {
  const paidResource=origin+PAID_PATH;
  const resourceMetadataUrl=origin+RESOURCE_METADATA_PATH;
  return Object.freeze({
    ok:true,
    staging,
    issuer:AUTH0_ISSUER,
    scope:RESOURCE_SCOPE,
    paidResource,
    resourceMetadataUrl,
    metadata:createProtectedResourceMetadata({
      resource:paidResource,
      authorizationServers:[AUTH0_ISSUER],
      scopes:[RESOURCE_SCOPE],
    }),
    challenge:unauthorizedChallenge({resourceMetadataUrl,scope:RESOURCE_SCOPE}),
  });
}

const productionOrigin=exactHttpsOrigin("https://shenshu-voice-mcp.onrender.com");
const allowlistedStagingOrigin=exactHttpsOrigin(STAGING_RESOURCE_ORIGIN);
if(!productionOrigin || !allowlistedStagingOrigin) throw Error("invalid_resource_origin");

const productionIdentity=createIdentity(productionOrigin,false);
const stagingIdentity=createIdentity(allowlistedStagingOrigin,true);
const invalidIdentity=Object.freeze({ok:false,error:"invalid_staging_resource_configuration"});

export function resolveProtectedResourceIdentity(env={}) {
  const mode=env?.SHENSHU_STAGING_RESOURCE_MODE;
  if(mode==null || mode===false || mode==="" || mode==="0" || mode==="false")
    return productionIdentity;
  if(mode!=="1") return invalidIdentity;
  const configuredOrigin=env?.SHENSHU_STAGING_ORIGIN;
  if(configuredOrigin!==STAGING_RESOURCE_ORIGIN ||
     exactHttpsOrigin(configuredOrigin)!==allowlistedStagingOrigin) return invalidIdentity;
  return stagingIdentity;
}
