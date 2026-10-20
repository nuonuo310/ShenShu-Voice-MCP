/**
 * P2N OFFLINE ONLY: trusted Auth0 JWKS refresh/cache.
 * Never reads issuer/JWKS URLs from a bearer token or tool argument.
 * Startup and stale-refresh failures fail closed; no stale grace period.
 * This is NOT wired to the public MCP or production Render.
 */
import { createPublicKey } from "node:crypto";

const MAX_BODY_BYTES=65536;
export const AUTH0_JWKS_URL="https://dev-nwr87q0tnrbjeapr.us.auth0.com/.well-known/jwks.json";
function checkKeys(payload) {
  if(!payload || !Array.isArray(payload.keys) || payload.keys.length<1 ||
    payload.keys.length>10) throw Error("invalid_jwks");
  const ids=new Set();
  const keys=[];
  for(const raw of payload.keys) {
    if(!raw || raw.kty!=="RSA" || raw.alg!=="RS256" || raw.use!=="sig" ||
      typeof raw.kid!=="string" || !/^[A-Za-z0-9_-]{1,128}$/.test(raw.kid) ||
      typeof raw.n!=="string" || typeof raw.e!=="string" ||
      raw.d!==undefined || ids.has(raw.kid)) throw Error("invalid_jwks");
    ids.add(raw.kid);
    try {createPublicKey({key:raw,format:"jwk"});} catch {throw Error("invalid_jwks");}
    keys.push(Object.freeze({kty:"RSA",alg:"RS256",use:"sig",kid:raw.kid,n:raw.n,e:raw.e}));
  }
  return Object.freeze({keys:Object.freeze(keys)});
}
async function readBounded(response) {
  if(!response?.ok) throw Error("jwks_unavailable");
  const type=response.headers?.get?.("content-type")||"";
  if(!/^application\/json(?:\s*;|\s*$)/i.test(type)) throw Error("invalid_jwks");
  const declared=response.headers?.get?.("content-length");
  if(declared!==null && declared!==undefined) {
    const n=Number(declared);
    if(!Number.isSafeInteger(n)||n>MAX_BODY_BYTES||n<0)throw Error("invalid_jwks");
  }
  if(!response.body?.getReader)throw Error("jwks_unavailable");
  const reader=response.body.getReader();const chunks=[];let total=0;
  try{
    for(;;){
      const {done,value}=await reader.read();if(done)break;
      total+=value.byteLength;
      if(total>MAX_BODY_BYTES)throw Error("invalid_jwks");
      chunks.push(Buffer.from(value));
    }
  }finally{reader.releaseLock();}
  let payload;
  try{payload=JSON.parse(Buffer.concat(chunks).toString("utf8"));}
  catch{throw Error("invalid_jwks");}
  return checkKeys(payload);
}

export function createAuth0JwksCache({
  fetchImpl=fetch,clock=()=>Date.now(),ttlMs=300000,timeoutMs=8000,
  endpoint=AUTH0_JWKS_URL
}={}) {
  if(endpoint!==AUTH0_JWKS_URL || typeof fetchImpl!=="function" ||
    typeof clock!=="function" ||
    !Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>3600000||
    !Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>15000)
    throw Error("invalid_jwks_configuration");
  let snapshot=null,expiresAt=0,inflight=null;
  async function refresh() {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try {
      const response=await fetchImpl(endpoint,{
        method:"GET",redirect:"error",signal:controller.signal,
        headers:{Accept:"application/json"}
      });
      const validated=await readBounded(response);
      const now=clock();
      if(!Number.isFinite(now))throw Error("jwks_unavailable");
      snapshot=validated;
      expiresAt=now+ttlMs;
      return snapshot;
    }catch{
      // Never reuse a stale signing key after an uncertain refresh.
      snapshot=null;expiresAt=0;
      throw Error("jwks_unavailable");
    }finally{clearTimeout(timer);}
  }
  return Object.freeze({
    async get() {
      const now=clock();
      if(!Number.isFinite(now))throw Error("jwks_unavailable");
      if(snapshot && now<expiresAt)return snapshot;
      if(!inflight)inflight=refresh().finally(()=>{inflight=null;});
      return inflight;
    },
    invalidate(){snapshot=null;expiresAt=0;}
  });
}
