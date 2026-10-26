/**
 * Staging-only standalone private player for Voice V1 P1.
 *
 * This is an authenticated browser entrypoint outside the ChatGPT iframe. It
 * uses Auth0 Authorization Code + PKCE, keeps the access token in server memory
 * only, and stores an opaque signed principal in an HttpOnly SameSite cookie.
 * P1 serves one fixed nonbillable WAV. No D1, provider, public audio URL or
 * chat audio message is involved.
 */
import {createHash,createHmac,randomBytes,timingSafeEqual} from "node:crypto";
import {readFileSync} from "node:fs";
import {validateWav} from "./contract.js";
import {makeInlineToneFixture} from "./inline-fixture.js";
import {
  AUTH0_ISSUER,
  STAGING_RESOURCE_ORIGIN,
  resolveProtectedResourceIdentity,
} from "./protected-resource-identity.js";

export const PRIVATE_PLAYER_PATH="/player";
export const PRIVATE_PLAYER_LOGIN_PATH="/player/login";
export const PRIVATE_PLAYER_CALLBACK_PATH="/player/callback";
export const PRIVATE_PLAYER_AUDIO_PATH="/player/audio";
export const PRIVATE_PLAYER_CALLBACK_URL=STAGING_RESOURCE_ORIGIN+PRIVATE_PLAYER_CALLBACK_PATH;
export const PRIVATE_PLAYER_LOGIN_COOKIE="__Host-shenshu_player_login";
export const PRIVATE_PLAYER_SESSION_COOKIE="__Host-shenshu_player_session";

const PLAYER_HTML=readFileSync(new URL("../ui/private-player.html",import.meta.url),"utf8");
const AUTH0_AUTHORIZE_URL=new URL("authorize",AUTH0_ISSUER).href;
const AUTH0_TOKEN_URL=new URL("oauth/token",AUTH0_ISSUER).href;
const AUTH0_USERINFO_URL=new URL("userinfo",AUTH0_ISSUER).href;
const LOGIN_TTL_SECONDS=600;
const SESSION_TTL_SECONDS=3600;
const MAX_COOKIE_BYTES=4096;
const MAX_AUTH_RESPONSE_BYTES=65536;
const MAX_ACCESS_TOKEN_BYTES=12000;
const PLAYER_PATHS=new Set([
  PRIVATE_PLAYER_PATH,
  PRIVATE_PLAYER_LOGIN_PATH,
  PRIVATE_PLAYER_CALLBACK_PATH,
  PRIVATE_PLAYER_AUDIO_PATH,
]);
const PLAYER_CSP="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; media-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'";
const FIXED_WAV=Buffer.from(makeInlineToneFixture().audioBase64,"base64");
validateWav(FIXED_WAV);

function responseHeaders(extra={}) {
  return {
    "Cache-Control":"private, no-store, max-age=0",
    "Pragma":"no-cache",
    "X-Content-Type-Options":"nosniff",
    "Referrer-Policy":"no-referrer",
    ...extra,
  };
}

function reply(res,status,headers,body) {
  res.writeHead(status,responseHeaders(headers));
  res.end(body);
}

function refuse(res,status,error) {
  reply(res,status,{"Content-Type":"application/json; charset=utf-8"},
    JSON.stringify({error}));
}

function methodNotAllowed(res,allow) {
  reply(res,405,{
    Allow:allow,
    "Content-Type":"application/json; charset=utf-8",
  },JSON.stringify({error:"method_not_allowed"}));
}

function redirect(res,status,location,setCookie=[]) {
  const headers=responseHeaders({
    Location:location,
    "Content-Type":"text/plain; charset=utf-8",
  });
  if(setCookie.length) headers["Set-Cookie"]=setCookie;
  res.writeHead(status,headers);
  res.end();
}

function cookieHeader(name,value,maxAge) {
  return name+"="+value+"; Path=/; Max-Age="+String(maxAge)+
    "; HttpOnly; Secure; SameSite=Lax";
}

function clearCookie(name) {
  return name+"=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; "+
    "HttpOnly; Secure; SameSite=Lax";
}

function parseCookies(header) {
  const result=new Map();
  if(typeof header!=="string"||header.length>8192) return result;
  for(const part of header.split(";")) {
    const at=part.indexOf("=");
    if(at<1) continue;
    const name=part.slice(0,at).trim();
    const value=part.slice(at+1).trim();
    if(!name||value.length>MAX_COOKIE_BYTES) continue;
    // Ambiguous duplicates fail closed instead of choosing one by position.
    if(result.has(name)) result.set(name,null);
    else result.set(name,value);
  }
  return result;
}

function signCookie(payload,secret) {
  const signature=createHmac("sha256",secret).update(payload).digest("base64url");
  return payload+"."+signature;
}

function openSignedCookie(raw,secret) {
  if(typeof raw!=="string"||!raw||raw.length>MAX_COOKIE_BYTES) return null;
  const at=raw.lastIndexOf(".");
  if(at<1||at===raw.length-1) return null;
  const payload=raw.slice(0,at);
  const supplied=raw.slice(at+1);
  if(!/^[A-Za-z0-9_-]{43}$/.test(supplied)) return null;
  const expected=createHmac("sha256",secret).update(payload).digest("base64url");
  const a=Buffer.from(supplied,"ascii");
  const b=Buffer.from(expected,"ascii");
  return a.length===b.length&&timingSafeEqual(a,b)?payload:null;
}

function safeEqualText(a,b) {
  if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length) return false;
  const left=Buffer.from(a,"ascii");
  const right=Buffer.from(b,"ascii");
  return left.length===right.length&&timingSafeEqual(left,right);
}

function nowSeconds(clock) {
  const value=clock();
  if(!Number.isFinite(value)) throw Error("invalid_clock");
  return Math.floor(value/1000);
}

function parseLoginCookie(raw,secret,now) {
  const payload=openSignedCookie(raw,secret);
  if(!payload) return null;
  const match=/^v1\.([0-9]{1,12})\.([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/.exec(payload);
  if(!match) return null;
  const expiry=Number(match[1]);
  if(!Number.isSafeInteger(expiry)||expiry<=now||expiry-now>LOGIN_TTL_SECONDS) return null;
  return {expiry,state:match[2],verifier:match[3]};
}

function parseSessionCookie(raw,secret,now) {
  const payload=openSignedCookie(raw,secret);
  if(!payload) return null;
  const match=/^v1\.([0-9]{1,12})\.([A-Za-z0-9_-]{43})$/.exec(payload);
  if(!match) return null;
  const expiry=Number(match[1]);
  if(!Number.isSafeInteger(expiry)||expiry<=now||expiry-now>SESSION_TTL_SECONDS) return null;
  return {expiry,subject:match[2]};
}

function validClientId(value) {
  return typeof value==="string"&&/^[A-Za-z0-9]{10,128}$/.test(value);
}

function validSessionSecret(value) {
  return typeof value==="string"&&
    Buffer.byteLength(value,"utf8")>=32&&Buffer.byteLength(value,"utf8")<=256&&
    !/[\x00-\x1f\x7f]/.test(value);
}

function resolvePlayerConfig(env) {
  if(env?.SHENSHU_PLAYER_ENABLED!=="1") return {active:false};
  const identity=resolveProtectedResourceIdentity(env);
  if(!identity.ok) return {active:true,ok:false};
  if(!identity.staging) return {active:false};
  const clientId=env?.SHENSHU_PLAYER_AUTH0_CLIENT_ID;
  const sessionSecret=env?.SHENSHU_PLAYER_SESSION_SECRET;
  if(!validClientId(clientId)||!validSessionSecret(sessionSecret))
    return {active:true,ok:false};
  return {
    active:true,
    ok:true,
    clientId,
    sessionSecret,
    issuer:AUTH0_ISSUER,
    redirectUri:PRIVATE_PLAYER_CALLBACK_URL,
  };
}

function randomValue(randomBytesImpl) {
  const bytes=randomBytesImpl(32);
  if(!Buffer.isBuffer(bytes)||bytes.length!==32) throw Error("random_unavailable");
  return bytes.toString("base64url");
}

function authFetchOptions() {
  let signal;
  try {signal=AbortSignal.timeout(5000);} catch {}
  return {redirect:"error",signal};
}

async function readBoundedJson(response,limit) {
  if(!response||typeof response.text!=="function"||
     (response.status!==undefined&&response.status!==200)||response.ok===false)
    throw Error("auth_response_invalid");
  const text=await response.text();
  if(typeof text!=="string"||Buffer.byteLength(text,"utf8")>limit)
    throw Error("auth_response_invalid");
  let value;
  try {value=JSON.parse(text);} catch {throw Error("auth_response_invalid");}
  if(!value||typeof value!=="object"||Array.isArray(value))
    throw Error("auth_response_invalid");
  return value;
}

function deriveSubject(issuer,sub) {
  return createHash("sha256").update(issuer+"\0"+sub).digest("base64url").slice(0,43);
}

async function beginLogin(res,config,{clock,randomBytesImpl}) {
  const state=randomValue(randomBytesImpl);
  const verifier=randomValue(randomBytesImpl);
  const challenge=createHash("sha256").update(verifier).digest("base64url");
  const now=nowSeconds(clock);
  const payload="v1."+String(now+LOGIN_TTL_SECONDS)+"."+state+"."+verifier;
  const cookie=cookieHeader(PRIVATE_PLAYER_LOGIN_COOKIE,
    signCookie(payload,config.sessionSecret),LOGIN_TTL_SECONDS);
  const location=new URL(AUTH0_AUTHORIZE_URL);
  location.searchParams.set("response_type","code");
  location.searchParams.set("client_id",config.clientId);
  location.searchParams.set("redirect_uri",config.redirectUri);
  location.searchParams.set("scope","openid profile");
  location.searchParams.set("state",state);
  location.searchParams.set("code_challenge",challenge);
  location.searchParams.set("code_challenge_method","S256");
  redirect(res,302,location.href,[cookie]);
}

async function completeLogin(req,res,url,config,{
  clock,fetchImpl,loadAudio,
}) {
  const now=nowSeconds(clock);
  const cookies=parseCookies(req.headers?.cookie);
  const login=parseLoginCookie(cookies.get(PRIVATE_PLAYER_LOGIN_COOKIE),
    config.sessionSecret,now);
  const clearLogin=clearCookie(PRIVATE_PLAYER_LOGIN_COOKIE);
  if(!login) {
    redirect(res,303,PRIVATE_PLAYER_PATH+"?login=failed",[clearLogin]);
    return;
  }
  const codes=url.searchParams.getAll("code");
  const states=url.searchParams.getAll("state");
  if(codes.length!==1||states.length!==1||
     !/^[A-Za-z0-9._~-]{1,4096}$/.test(codes[0])||
     !safeEqualText(states[0],login.state)) {
    redirect(res,303,PRIVATE_PLAYER_PATH+"?login=failed",[clearLogin]);
    return;
  }
  try {
    if(typeof fetchImpl!=="function") throw Error("auth_fetch_unavailable");
    const body=new URLSearchParams({
      grant_type:"authorization_code",
      client_id:config.clientId,
      code:codes[0],
      redirect_uri:config.redirectUri,
      code_verifier:login.verifier,
    });
    const tokenResponse=await fetchImpl(AUTH0_TOKEN_URL,{
      method:"POST",
      headers:{
        "Content-Type":"application/x-www-form-urlencoded",
        Accept:"application/json",
      },
      body:body.toString(),
      ...authFetchOptions(),
    });
    const token=await readBoundedJson(tokenResponse,MAX_AUTH_RESPONSE_BYTES);
    if(typeof token.access_token!=="string"||
       token.access_token.length>MAX_ACCESS_TOKEN_BYTES||
       !/^[^\s]+$/.test(token.access_token)||
       typeof token.token_type!=="string"||token.token_type.toLowerCase()!=="bearer")
      throw Error("auth_token_invalid");
    const userinfoResponse=await fetchImpl(AUTH0_USERINFO_URL,{
      method:"GET",
      headers:{Authorization:"Bearer "+token.access_token,Accept:"application/json"},
      ...authFetchOptions(),
    });
    const userinfo=await readBoundedJson(userinfoResponse,MAX_AUTH_RESPONSE_BYTES);
    if(typeof userinfo.sub!=="string"||userinfo.sub.length<1||userinfo.sub.length>512||
       /[\x00-\x1f\x7f]/.test(userinfo.sub))
      throw Error("auth_subject_invalid");
    const subject=deriveSubject(config.issuer,userinfo.sub);
    const sessionPayload="v1."+String(now+SESSION_TTL_SECONDS)+"."+subject;
    const sessionCookie=cookieHeader(PRIVATE_PLAYER_SESSION_COOKIE,
      signCookie(sessionPayload,config.sessionSecret),SESSION_TTL_SECONDS);
    // The access token is deliberately not retained after the identity lookup.
    redirect(res,303,PRIVATE_PLAYER_PATH,[clearLogin,sessionCookie]);
  } catch {
    redirect(res,303,PRIVATE_PLAYER_PATH+"?login=failed",[clearLogin]);
  }
}

async function defaultLoadAudio({verifiedSubject}) {
  if(typeof verifiedSubject!=="string"||verifiedSubject.length!==43)
    throw Error("invalid_subject");
  return Buffer.from(FIXED_WAV);
}

async function serveAudio(req,res,config,{clock,loadAudio}) {
  const now=nowSeconds(clock);
  const cookies=parseCookies(req.headers?.cookie);
  const session=parseSessionCookie(cookies.get(PRIVATE_PLAYER_SESSION_COOKIE),
    config.sessionSecret,now);
  if(!session) {
    refuse(res,401,"login_required");
    return;
  }
  let audio;
  try {audio=await loadAudio({verifiedSubject:session.subject});}
  catch {refuse(res,503,"audio_unavailable");return;}
  if(!Buffer.isBuffer(audio)) {refuse(res,503,"audio_unavailable");return;}
  try {validateWav(audio);} catch {refuse(res,503,"audio_unavailable");return;}
  const headers=responseHeaders({
    "Content-Type":"audio/wav",
    "Content-Length":String(audio.length),
    "Content-Disposition":"inline",
    "Content-Security-Policy":"default-src 'none'",
    "Cross-Origin-Resource-Policy":"same-origin",
    "Accept-Ranges":"none",
    Vary:"Cookie",
  });
  res.writeHead(200,headers);
  res.end(req.method==="HEAD"?undefined:audio);
}

export function isPrivatePlayerPath(pathname) {
  return PLAYER_PATHS.has(pathname);
}

export async function handlePrivateWebPlayer(req,res,url,{
  env=process.env,
  fetchImpl=globalThis.fetch,
  clock=Date.now,
  randomBytesImpl=randomBytes,
  loadAudio=defaultLoadAudio,
}={}) {
  const pathname=url?.pathname;
  if(!isPrivatePlayerPath(pathname)) return false;
  const config=resolvePlayerConfig(env);
  if(!config.active) return false;
  if(!config.ok) {refuse(res,503,"player_unavailable");return true;}

  if(pathname===PRIVATE_PLAYER_PATH) {
    if(req.method!=="GET") {methodNotAllowed(res,"GET");return true;}
    reply(res,200,{
      "Content-Type":"text/html; charset=utf-8",
      "Content-Security-Policy":PLAYER_CSP,
      "X-Frame-Options":"DENY",
      "Cross-Origin-Opener-Policy":"same-origin",
      "Cross-Origin-Resource-Policy":"same-origin",
      "Permissions-Policy":"camera=(), microphone=(), geolocation=(), payment=(), autoplay=()",
    },PLAYER_HTML);
    return true;
  }
  if(pathname===PRIVATE_PLAYER_LOGIN_PATH) {
    if(req.method!=="GET") {methodNotAllowed(res,"GET");return true;}
    try {await beginLogin(res,config,{clock,randomBytesImpl});}
    catch {refuse(res,503,"player_unavailable");}
    return true;
  }
  if(pathname===PRIVATE_PLAYER_CALLBACK_PATH) {
    if(req.method!=="GET") {methodNotAllowed(res,"GET");return true;}
    await completeLogin(req,res,url,config,{clock,fetchImpl,loadAudio});
    return true;
  }
  if(pathname===PRIVATE_PLAYER_AUDIO_PATH) {
    if(req.method!=="GET"&&req.method!=="HEAD") {
      methodNotAllowed(res,"GET, HEAD");
      return true;
    }
    await serveAudio(req,res,config,{clock,loadAudio});
    return true;
  }
  return true;
}
