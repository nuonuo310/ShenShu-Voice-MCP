/**
 * P2C OFFLINE identity verifier. Not wired to public /mcp.
 * Trust anchors (issuer, audience and JWKs) are supplied by server deployment,
 * NEVER by HTTP headers, tool arguments or token claims.
 * RS256 JWT only. This is a resource-server verification primitive, NOT OAuth
 * login, key discovery or a deployed identity provider.
 */
import { createHash, createPublicKey, verify as cryptoVerify } from "node:crypto";

const b64url = /^[A-Za-z0-9_-]+$/;
function decode(part) {
  if (typeof part !== "string" || part.length === 0 || !b64url.test(part)) throw Error("not_authorized");
  const bytes=Buffer.from(part,"base64url");
  if (bytes.toString("base64url")!==part) throw Error("not_authorized");
  return bytes;
}
function parseObject(part) {
  const bytes=decode(part);
  if(bytes.length>8192) throw Error("not_authorized");
  let value;
  try { value=JSON.parse(bytes.toString("utf8")); } catch { throw Error("not_authorized"); }
  if (!value || typeof value!=="object" || Array.isArray(value)) throw Error("not_authorized");
  return value;
}
function goodText(s) { return typeof s==="string" && s.length>0 && s.length<=512; }
const validNumericTime=n=>Number.isSafeInteger(n) && n>=0;

export function createVerifiedIdentityResolver({issuer,audience,publicJwks,clock=()=>Date.now(),maxLifetimeSeconds=3600}) {
  if(!goodText(issuer)||!goodText(audience)||!Array.isArray(publicJwks)||publicJwks.length<1||
    !Number.isSafeInteger(maxLifetimeSeconds)||maxLifetimeSeconds<1||maxLifetimeSeconds>86400)
    throw Error("invalid_auth_configuration");
  const keys=new Map();
  for (const jwk of publicJwks) {
    if (!jwk || jwk.kty!=="RSA" || jwk.alg!=="RS256" || jwk.use!=="sig" ||
        !goodText(jwk.kid) || !goodText(jwk.n) || !goodText(jwk.e) ||
        jwk.d!==undefined || keys.has(jwk.kid)) throw Error("invalid_auth_configuration");
    try { keys.set(jwk.kid,createPublicKey({key:jwk,format:"jwk"})); }
    catch { throw Error("invalid_auth_configuration"); }
  }
  return async function resolveVerifiedPrincipal(trustedRequest) {
    const raw=trustedRequest?.headers?.authorization ?? trustedRequest?.headers?.get?.("authorization");
    if(typeof raw!=="string" || !/^Bearer [A-Za-z0-9_.-]+$/.test(raw) || raw.length>12000) throw Error("not_authorized");
    const parts=raw.slice(7).split(".");
    if(parts.length!==3) throw Error("not_authorized");
    const [head,payload,sig]=parts;
    const header=parseObject(head);
    if(header.alg!=="RS256" || header.typ!=="JWT" || !goodText(header.kid) || header.crit!==undefined) throw Error("not_authorized");
    const key=keys.get(header.kid);
    if(!key) throw Error("not_authorized");
    const signature=decode(sig);
    if(!cryptoVerify("RSA-SHA256",Buffer.from(head+"."+payload),key,signature)) throw Error("not_authorized");
    const claims=parseObject(payload);
    const nowMs=clock();
    if(!Number.isFinite(nowMs)) throw Error("not_authorized");
    const now=Math.floor(nowMs/1000);
    if(claims.iss!==issuer || claims.aud!==audience || !goodText(claims.sub) ||
       !validNumericTime(claims.iat)||!validNumericTime(claims.exp)||
       claims.exp<=now || claims.iat>now+30 || claims.exp<=claims.iat ||
       claims.exp-claims.iat>maxLifetimeSeconds ||
       (claims.nbf!==undefined && (!validNumericTime(claims.nbf)||claims.nbf>now)))
       throw Error("not_authorized");
    // Stable opaque DB principal; valid with PaidVoiceGate's identifier pattern.
    const subject=createHash("sha256").update(issuer+"\0"+claims.sub).digest("base64url").slice(0,43);
    return Object.freeze({verified:true,subject});
  };
}
