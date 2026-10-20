/**
 * Offline OAuth Protected Resource Metadata (RFC 9728) builder.
 * This is NOT an OAuth server, not wired into public /mcp, and doesn't enable TTS.
 * Trust only operator-configured issuer URLs, never client headers/parameters.
 */
const validHttpsUrl=(value)=>{
  if(typeof value!=="string" || value.length>2048) return false;
  try {
    const u=new URL(value);
    return u.protocol==="https:" && u.username==="" && u.password==="" &&
      u.hash==="" && u.search==="" && !u.hostname.endsWith(".invalid");
  } catch {return false;}
};
const unique=xs=>new Set(xs).size===xs.length;
export function createProtectedResourceMetadata({resource,authorizationServers,scopes=["voice:speak"]}) {
  if(!validHttpsUrl(resource) || !Array.isArray(authorizationServers) ||
     authorizationServers.length<1 || authorizationServers.length>3 ||
     !authorizationServers.every(validHttpsUrl) || !unique(authorizationServers) ||
     !Array.isArray(scopes)|| scopes.length<1 || scopes.length>10 ||
     !scopes.every(s=>typeof s==="string" && /^[a-zA-Z][a-zA-Z0-9:_-]{1,63}$/.test(s)) ||
     !unique(scopes)) throw new Error("invalid_resource_metadata");
  return Object.freeze({
    resource,
    authorization_servers: Object.freeze([...authorizationServers]),
    scopes_supported: Object.freeze([...scopes]),
    bearer_methods_supported: Object.freeze(["header"]),
  });
}
export function unauthorizedChallenge({resourceMetadataUrl,scope="voice:speak"}) {
  if(!validHttpsUrl(resourceMetadataUrl) ||
     !/^[a-zA-Z][a-zA-Z0-9:_-]{1,63}$/.test(scope)) throw Error("invalid_resource_metadata");
  return Object.freeze({
    status:401,
    headers:Object.freeze({
      "WWW-Authenticate":'Bearer resource_metadata="'+resourceMetadataUrl+'", scope="'+scope+'"',
      "Cache-Control":"no-store",
    }),
  });
}
