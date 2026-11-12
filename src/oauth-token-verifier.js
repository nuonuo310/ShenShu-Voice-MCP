/**
 * Offline RS256 JWT verifier for a FUTURE private MCP resource server.
 * No JWKS retrieval, no OAuth issuance, no public MCP integration.
 * Trusted caller supplies provider-verified, pinned public JWKs, issuer and audience.
 * Never accept JWK / issuer / audience from the token or tool arguments.
 */
import {createPublicKey, verify as cryptoVerify} from "node:crypto";

const TOKEN_MAX=8192;
const SUBJECT=/^[A-Za-z0-9:_-]{8,180}$/;
const B64URL=/^[A-Za-z0-9_-]+$/;
function decode(part){
 if(typeof part!=="string"||!B64URL.test(part))throw Error("invalid_token");
 const b=Buffer.from(part,"base64url");
 if(b.toString("base64url")!==part)throw Error("invalid_token");
 return b;
}
function json(part){
 let v;
 try{v=JSON.parse(decode(part).toString("utf8"));}catch{throw Error("invalid_token");}
 if(!v||typeof v!=="object"||Array.isArray(v))throw Error("invalid_token");
 return v;
}
export function createPinnedRs256Verifier({issuer,audience,publicJwks,allowedSubjects,clock=()=>Math.floor(Date.now()/1000)}){
 if(typeof issuer!=="string"||!issuer.startsWith("https://")||
    typeof audience!=="string"||!audience.startsWith("https://")||
    !Array.isArray(publicJwks)||publicJwks.length<1||publicJwks.length>5||
    !Array.isArray(allowedSubjects)||allowedSubjects.length<1||
    allowedSubjects.some(s=>!SUBJECT.test(s)))throw Error("auth_not_configured");
 const keys=new Map();
 for(const jwk of publicJwks){
  if(jwk?.kty!=="RSA"||typeof jwk.kid!=="string"||!SUBJECT.test(jwk.kid)||
     jwk.alg!=="RS256"||jwk.use!=="sig"||jwk.d||jwk.p||jwk.q||keys.has(jwk.kid))throw Error("auth_not_configured");
  try{keys.set(jwk.kid,createPublicKey({key:jwk,format:"jwk"}));}
  catch{throw Error("auth_not_configured");}
 }
 const allowed=new Set(allowedSubjects);
 return function verifyToken(token){
  if(typeof token!=="string"||token.length>TOKEN_MAX)throw Error("not_authorized");
  const parts=token.split(".");
  if(parts.length!==3)throw Error("not_authorized");
  try{
   const header=json(parts[0]),payload=json(parts[1]);
   if(header.alg!=="RS256"||header.typ!=="JWT"||typeof header.kid!=="string"||
      !keys.has(header.kid)||header.jku!==undefined||header.jwk!==undefined||
      header.crit!==undefined)throw Error("invalid_token");
   const message=Buffer.from(parts[0]+"."+parts[1],"ascii");
   if(!cryptoVerify("RSA-SHA256",message,keys.get(header.kid),decode(parts[2])))throw Error("invalid_token");
   const now=clock();
   if(!Number.isSafeInteger(now)||payload.iss!==issuer||
      payload.aud!==audience||!SUBJECT.test(payload.sub??"")||!allowed.has(payload.sub)||
      !Number.isSafeInteger(payload.exp)||payload.exp<=now+10||
      !Number.isSafeInteger(payload.iat)||payload.iat>now+60||
      (payload.nbf!==undefined&&(!Number.isSafeInteger(payload.nbf)||payload.nbf>now))||
      typeof payload.scope!=="string"||!payload.scope.split(/\s+/).includes("voice:generate"))
      throw Error("invalid_token");
   return Object.freeze({verified:true,source:"trusted_oauth_resource_middleware",
      subject:payload.sub,issuer:payload.iss,audience:payload.aud,
      expiresAt:payload.exp,scopes:Object.freeze(payload.scope.split(/\s+/))});
  }catch{throw Error("not_authorized");}
 };
}
