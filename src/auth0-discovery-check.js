/**
 * Check a specifically configured Auth0 tenant's OIDC discovery document.
 * Diagnostic only; does not register a client, log in, deploy, or call MiniMax.
 * URL is derived from a fixed operator-supplied issuer, not a request header.
 */
import { validateAuthorizationServerMetadata } from "./oauth-provider-discovery.js";
const DEFAULT_MAX_BYTES=64*1024;
export async function inspectAuth0Issuer({
  domain, fetchImpl=fetch, timeoutMs=8000, maxBytes=DEFAULT_MAX_BYTES
}) {
  if(typeof domain!=="string" ||
    !/^[a-z0-9-]{3,64}\\.(?:us|eu|au|jp)\\.auth0\\.com$/.test(domain) ||
    !Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>15000||
    !Number.isSafeInteger(maxBytes)||maxBytes<1024||maxBytes>DEFAULT_MAX_BYTES)
    throw Error("invalid_auth0_domain");
  const issuer="https://"+domain+"/";
  const discoveryUrl=issuer+".well-known/openid-configuration";
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const response=await fetchImpl(discoveryUrl,{
      method:"GET",headers:{Accept:"application/json"},
      redirect:"error",signal:controller.signal
    });
    if(!response?.ok) throw Error("discovery_unavailable");
    const declared=Number(response.headers?.get?.("content-length") ?? 0);
    if(declared>maxBytes) throw Error("discovery_oversized");
    // Response text is bounded after download. Production use a streaming
    // byte cap too; this is a diagnostic, never exposed as a public route.
    const text=await response.text();
    if(Buffer.byteLength(text,"utf8")>maxBytes) throw Error("discovery_oversized");
    let metadata;
    try{metadata=JSON.parse(text)}catch{throw Error("discovery_invalid_json")}
    const result=validateAuthorizationServerMetadata(metadata,{expectedIssuer:issuer});
    return Object.freeze({
      issuer:result.issuer,
      authorizationEndpoint:result.authorizationEndpoint,
      tokenEndpoint:result.tokenEndpoint,
      jwksUri:result.jwksUri,
      supportsDynamicRegistration:result.supportsDynamicRegistration,
      pkceS256:result.pkceS256,
      authorizationCode:result.authorizationCode,
      tokenAuthMethods:Array.isArray(metadata.token_endpoint_auth_methods_supported)
        ? metadata.token_endpoint_auth_methods_supported.filter(x=>typeof x==="string")
        : [],
      responseIssuerSupported:metadata.authorization_response_iss_parameter_supported===true
    });
  } finally {clearTimeout(timer)}
}
