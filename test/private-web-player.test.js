import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {
  PRIVATE_PLAYER_AUDIO_PATH,
  PRIVATE_PLAYER_CALLBACK_PATH,
  PRIVATE_PLAYER_CALLBACK_URL,
  PRIVATE_PLAYER_LOGIN_COOKIE,
  PRIVATE_PLAYER_LOGIN_PATH,
  PRIVATE_PLAYER_PATH,
  PRIVATE_PLAYER_SESSION_COOKIE,
  handlePrivateWebPlayer,
} from "../src/private-web-player.js";
import {AUTH0_ISSUER,STAGING_RESOURCE_ORIGIN} from "../src/protected-resource-identity.js";
import {makeInlineToneFixture} from "../src/inline-fixture.js";

const START_MS=Date.parse("2026-10-27T00:00:00.000Z");
const CLIENT_ID="a".repeat(32);
const SESSION_SECRET="offline-player-test-session-secret-0123456789abcdef";
const SUBJECT="auth0|offline-player-user";
const FIXTURE=Buffer.from(makeInlineToneFixture().audioBase64,"base64");
const TOKEN_URL=new URL("oauth/token",AUTH0_ISSUER).href;
const AUTHORIZE_URL=new URL("authorize",AUTH0_ISSUER).href;
const USERINFO_URL=new URL("userinfo",AUTH0_ISSUER).href;

function baseEnv(overrides={}) {
  return {
    SHENSHU_STAGING_RESOURCE_MODE:"1",
    SHENSHU_STAGING_ORIGIN:STAGING_RESOURCE_ORIGIN,
    SHENSHU_PLAYER_ENABLED:"1",
    SHENSHU_PLAYER_AUTH0_CLIENT_ID:CLIENT_ID,
    SHENSHU_PLAYER_SESSION_SECRET:SESSION_SECRET,
    ...overrides,
  };
}

function makeResponse() {
  return {
    statusCode:0,
    headers:{},
    body:null,
    writeHead(status,headers={}) {
      this.statusCode=status;
      Object.assign(this.headers,headers);
      return this;
    },
    end(chunk) {
      this.body=chunk===undefined?null:
        (Buffer.isBuffer(chunk)?Buffer.from(chunk):Buffer.from(String(chunk)));
    },
  };
}

async function invoke(path,{
  method="GET",headers={},env=baseEnv(),clock=()=>START_MS,
  randomBytesImpl=deterministicRandom(),fetchImpl,loadAudio,
}={}) {
  const url=new URL(STAGING_RESOURCE_ORIGIN+path);
  const req={method,headers,url:url.pathname+url.search};
  const res=makeResponse();
  const handled=await handlePrivateWebPlayer(req,res,url,{
    env,clock,randomBytesImpl,fetchImpl,loadAudio,
  });
  return {
    handled,status:res.statusCode,headers:res.headers,body:res.body,
    text:res.body?res.body.toString("utf8"):"",
  };
}

function deterministicRandom() {
  let count=0;
  return (size)=>{
    if(size!==32) throw Error("unexpected_random_size");
    count++;
    return Buffer.alloc(size,count);
  };
}

function setCookies(headers) {
  const value=headers["Set-Cookie"];
  if(value===undefined) return [];
  return Array.isArray(value)?value:[value];
}

function cookiePair(setCookie) {
  return setCookie.slice(0,setCookie.indexOf(";"));
}

function cookieValue(setCookie) {
  const pair=cookiePair(setCookie);
  return pair.slice(pair.indexOf("=")+1);
}

function payloadOf(cookieValueText) {
  return cookieValueText.slice(0,cookieValueText.lastIndexOf("."));
}

function findCookie(setCookieList,name) {
  return setCookieList.find((value)=>value.startsWith(name+"="));
}

function decodeLogin(setCookie) {
  const parts=payloadOf(cookieValue(setCookie)).split(".");
  assert.equal(parts.length,4);
  assert.equal(parts[0],"v1");
  return {expiry:Number(parts[1]),state:parts[2],verifier:parts[3]};
}

function decodeSession(setCookie) {
  const parts=payloadOf(cookieValue(setCookie)).split(".");
  assert.equal(parts.length,3);
  assert.equal(parts[0],"v1");
  return {expiry:Number(parts[1]),subject:parts[2]};
}

async function begin(env=baseEnv()) {
  const response=await invoke(PRIVATE_PLAYER_LOGIN_PATH,{env});
  assert.equal(response.handled,true);
  assert.equal(response.status,302);
  const loginSet=findCookie(setCookies(response.headers),PRIVATE_PLAYER_LOGIN_COOKIE);
  assert.ok(loginSet);
  return {
    response,
    loginSet,
    loginCookie:cookiePair(loginSet),
    ...decodeLogin(loginSet),
  };
}

function identityHash() {
  return createHash("sha256").update(AUTH0_ISSUER+"\0"+SUBJECT).digest("base64url").slice(0,43);
}

test("player routes are absent unless explicitly enabled in staging", async () => {
  for(const env of [
    baseEnv({SHENSHU_PLAYER_ENABLED:"0"}),
    baseEnv({SHENSHU_STAGING_RESOURCE_MODE:"0"}),
  ]) {
    const response=await invoke(PRIVATE_PLAYER_PATH,{env});
    assert.equal(response.handled,false);
    assert.equal(response.status,0);
  }
});

test("enabled but incomplete or invalid player configuration fails closed", async () => {
  for(const env of [
    baseEnv({SHENSHU_PLAYER_AUTH0_CLIENT_ID:""}),
    baseEnv({SHENSHU_PLAYER_SESSION_SECRET:"too-short"}),
    baseEnv({SHENSHU_STAGING_ORIGIN:"https://wrong.invalid"}),
  ]) {
    const response=await invoke(PRIVATE_PLAYER_PATH,{env});
    assert.equal(response.handled,true);
    assert.equal(response.status,503);
    assert.deepEqual(JSON.parse(response.text),{error:"player_unavailable"});
  }
});

test("the standalone page has a strict CSP, no external assets and no automatic playback", async () => {
  const response=await invoke(PRIVATE_PLAYER_PATH);
  assert.equal(response.status,200);
  assert.equal(response.headers["Content-Type"],"text/html; charset=utf-8");
  assert.match(response.headers["Content-Security-Policy"],/default-src 'none'/);
  assert.match(response.headers["Content-Security-Policy"],/media-src 'self'/);
  assert.match(response.headers["Content-Security-Policy"],/frame-ancestors 'none'/);
  assert.equal(response.headers["X-Frame-Options"],"DENY");
  assert.match(response.text,/href="\/player\/login"/);
  assert.match(response.text,/audio\.src="\/player\/audio"/);
  assert.match(response.text,/<audio[^>]+controls[^>]+preload="none"[^>]+playsinline/);
  assert.doesNotMatch(response.text,/autoplay\s*=/i);
  assert.doesNotMatch(response.text,/<script[^>]+src=/i);
  assert.doesNotMatch(response.text,/<link[^>]+href="https?:/i);
  assert.doesNotMatch(response.text,/\?access_token|\?token=|Authorization:/i);
});

test("login redirect uses exact Auth0 endpoints, PKCE S256 and a secure state cookie", async () => {
  const login=await begin();
  const location=new URL(login.response.headers.Location);
  assert.equal(location.origin+location.pathname,AUTHORIZE_URL);
  assert.equal(location.searchParams.get("response_type"),"code");
  assert.equal(location.searchParams.get("client_id"),CLIENT_ID);
  assert.equal(location.searchParams.get("redirect_uri"),PRIVATE_PLAYER_CALLBACK_URL);
  assert.equal(location.searchParams.get("scope"),"openid profile");
  assert.equal(location.searchParams.get("code_challenge_method"),"S256");
  assert.equal(location.searchParams.get("state"),login.state);
  assert.equal(location.searchParams.get("code_challenge"),
    createHash("sha256").update(login.verifier).digest("base64url"));
  assert.match(login.loginSet,/Path=\//);
  assert.match(login.loginSet,/Max-Age=600/);
  assert.match(login.loginSet,/HttpOnly/);
  assert.match(login.loginSet,/Secure/);
  assert.match(login.loginSet,/SameSite=Lax/);
  assert.equal(findCookie(setCookies(login.response.headers),PRIVATE_PLAYER_SESSION_COOKIE),undefined);
  assert.doesNotMatch(login.response.headers.Location,/access_token|client_secret/i);
});

function responseWithBody(text,{contentLength=null,body}={}) {
  const bytes=new TextEncoder().encode(text);
  return {
    status:200,
    ok:true,
    headers:{get(name){return name.toLowerCase()==="content-length"?contentLength:null;}},
    body:body??new ReadableStream({start(controller){controller.enqueue(bytes);controller.close();}}),
  };
}

function fakeAuthFetch({
  token={access_token:"fixture-access-token-123",token_type:"Bearer"},
  user={sub:SUBJECT},tokenText,userText,tokenResponse,userResponse,
}={}) {
  const calls=[];
  async function fetchImpl(url,options={}) {
    calls.push({url,options});
    if(url===TOKEN_URL) {
      return tokenResponse??responseWithBody(tokenText??JSON.stringify(token));
    }
    if(url===USERINFO_URL) {
      return userResponse??responseWithBody(userText??JSON.stringify(user));
    }
    throw Error("unexpected_auth_url");
  }
  return {fetchImpl,calls};
}

test("callback exchanges a one-time code without a client secret and sets an opaque session", async () => {
  const login=await begin();
  const auth=fakeAuthFetch();
  const code="offline.code-fixture-123";
  const response=await invoke(
    PRIVATE_PLAYER_CALLBACK_PATH+"?code="+encodeURIComponent(code)+"&state="+login.state,
    {headers:{cookie:login.loginCookie},fetchImpl:auth.fetchImpl},
  );
  assert.equal(response.status,303);
  assert.equal(response.headers.Location,PRIVATE_PLAYER_PATH);
  assert.equal(auth.calls.length,2);
  assert.equal(auth.calls[0].url,TOKEN_URL);
  assert.equal(auth.calls[0].options.method,"POST");
  const tokenBody=new URLSearchParams(auth.calls[0].options.body);
  assert.equal(tokenBody.get("grant_type"),"authorization_code");
  assert.equal(tokenBody.get("client_id"),CLIENT_ID);
  assert.equal(tokenBody.get("code"),code);
  assert.equal(tokenBody.get("redirect_uri"),PRIVATE_PLAYER_CALLBACK_URL);
  assert.equal(tokenBody.get("code_verifier"),login.verifier);
  assert.equal(tokenBody.has("client_secret"),false);
  assert.equal(auth.calls[1].url,USERINFO_URL);
  assert.equal(auth.calls[1].options.headers.Authorization,"Bearer fixture-access-token-123");

  const cookies=setCookies(response.headers);
  const sessionSet=findCookie(cookies,PRIVATE_PLAYER_SESSION_COOKIE);
  assert.ok(sessionSet);
  const session=decodeSession(sessionSet);
  assert.equal(session.subject,identityHash());
  assert.equal(session.expiry,Math.floor(START_MS/1000)+3600);
  assert.match(sessionSet,/Path=\//);
  assert.match(sessionSet,/Max-Age=3600/);
  assert.match(sessionSet,/HttpOnly/);
  assert.match(sessionSet,/Secure/);
  assert.match(sessionSet,/SameSite=Lax/);
  assert.doesNotMatch(cookieValue(sessionSet),/fixture-access-token/);
  assert.doesNotMatch(response.headers.Location,/code=|token|state=/i);
  assert.ok(findCookie(cookies,PRIVATE_PLAYER_LOGIN_COOKIE)?.includes("Max-Age=0"));
});

async function authenticatedSession() {
  const login=await begin();
  const auth=fakeAuthFetch();
  const callback=await invoke(
    PRIVATE_PLAYER_CALLBACK_PATH+"?code=offline-code&state="+login.state,
    {headers:{cookie:login.loginCookie},fetchImpl:auth.fetchImpl},
  );
  const sessionSet=findCookie(setCookies(callback.headers),PRIVATE_PLAYER_SESSION_COOKIE);
  assert.ok(sessionSet);
  return {cookie:cookiePair(sessionSet),subject:identityHash()};
}

test("private audio requires the signed session and passes only its opaque subject", async () => {
  const session=await authenticatedSession();
  const subjects=[];
  const response=await invoke(PRIVATE_PLAYER_AUDIO_PATH,{
    headers:{cookie:session.cookie},
    loadAudio:async ({verifiedSubject})=>{subjects.push(verifiedSubject);return Buffer.from(FIXTURE);},
  });
  assert.equal(response.status,200);
  assert.deepEqual(subjects,[session.subject]);
  assert.deepEqual(response.body,FIXTURE);
  assert.equal(response.headers["Content-Type"],"audio/wav");
  assert.equal(response.headers["Cache-Control"],"private, no-store, max-age=0");
  assert.equal(response.headers["Content-Disposition"],"inline");
  assert.equal(response.headers["Vary"],"Cookie");
  assert.equal(response.headers["Cross-Origin-Resource-Policy"],"same-origin");
  assert.equal(response.headers["Access-Control-Allow-Origin"],undefined);
  assert.equal(response.headers["Location"],undefined);

  const head=await invoke(PRIVATE_PLAYER_AUDIO_PATH,{
    method:"HEAD",headers:{cookie:session.cookie},loadAudio:async()=>Buffer.from(FIXTURE),
  });
  assert.equal(head.status,200);
  assert.equal(head.body,null);
  assert.equal(head.headers["Content-Length"],String(FIXTURE.length));
});

test("missing, duplicate, tampered, wrong-key and expired sessions never load audio", async () => {
  const session=await authenticatedSession();
  const tampered=session.cookie.slice(0,-1)+(session.cookie.endsWith("A")?"B":"A");
  const cases=[
    {},
    {cookie:session.cookie+"; "+session.cookie},
    {cookie:tampered},
  ];
  for(const headers of cases) {
    let loads=0;
    const response=await invoke(PRIVATE_PLAYER_AUDIO_PATH,{
      headers,loadAudio:async()=>{loads++;return Buffer.from(FIXTURE);},
    });
    assert.equal(response.status,401);
    assert.equal(loads,0);
    assert.deepEqual(JSON.parse(response.text),{error:"login_required"});
  }
  let expiredLoads=0;
  const expired=await invoke(PRIVATE_PLAYER_AUDIO_PATH,{
    headers:{cookie:session.cookie},clock:()=>START_MS+3601_000,
    loadAudio:async()=>{expiredLoads++;return Buffer.from(FIXTURE);},
  });
  assert.equal(expired.status,401);
  assert.equal(expiredLoads,0);

  let wrongKeyLoads=0;
  const wrongKey=await invoke(PRIVATE_PLAYER_AUDIO_PATH,{
    headers:{cookie:session.cookie},
    env:baseEnv({SHENSHU_PLAYER_SESSION_SECRET:"different-offline-secret-0123456789abcdef"}),
    loadAudio:async()=>{wrongKeyLoads++;return Buffer.from(FIXTURE);},
  });
  assert.equal(wrongKey.status,401);
  assert.equal(wrongKeyLoads,0);
});

test("callback rejects missing/mismatched state, duplicate parameters and bad Auth0 responses", async () => {
  const login=await begin();
  const failureCases=[
    {},
    {headers:{cookie:login.loginCookie}},
    {headers:{cookie:login.loginCookie},path:"?code=one&code=two&state="+login.state},
    {headers:{cookie:login.loginCookie},path:"?code=one&state=wrong"},
  ];
  for(const item of failureCases) {
    const auth=fakeAuthFetch();
    const response=await invoke(PRIVATE_PLAYER_CALLBACK_PATH+(item.path??""),{
      headers:item.headers??{},fetchImpl:auth.fetchImpl,
    });
    assert.equal(response.status,303);
    assert.equal(response.headers.Location,PRIVATE_PLAYER_PATH+"?login=failed");
    assert.equal(auth.calls.length,0);
    assert.equal(findCookie(setCookies(response.headers),PRIVATE_PLAYER_SESSION_COOKIE),undefined);
  }

  for(const auth of [
    fakeAuthFetch({tokenText:"{".padEnd(65537," ")}),
    fakeAuthFetch({user:{}}),
  ]) {
    const response=await invoke(
      PRIVATE_PLAYER_CALLBACK_PATH+"?code=good-code&state="+login.state,
      {headers:{cookie:login.loginCookie},fetchImpl:auth.fetchImpl},
    );
    assert.equal(response.status,303);
    assert.equal(response.headers.Location,PRIVATE_PLAYER_PATH+"?login=failed");
    assert.equal(findCookie(setCookies(response.headers),PRIVATE_PLAYER_SESSION_COOKIE),undefined);
  }

  const throwingFetch=async()=>{throw Error("network_failure");};
  const network=await invoke(
    PRIVATE_PLAYER_CALLBACK_PATH+"?code=good-code&state="+login.state,
    {headers:{cookie:login.loginCookie},fetchImpl:throwingFetch},
  );
  assert.equal(network.headers.Location,PRIVATE_PLAYER_PATH+"?login=failed");
  assert.equal(findCookie(setCookies(network.headers),PRIVATE_PLAYER_SESSION_COOKIE),undefined);
});

test("callback rejects non-ASCII aliases of the exact OAuth state", async () => {
  const login=await begin();
  assert.match(login.state,/^A/);
  const alias="\u0141"+login.state.slice(1);
  assert.equal(alias.length,login.state.length);
  assert.deepEqual(Buffer.from(alias,"ascii"),Buffer.from(login.state,"ascii"));
  const auth=fakeAuthFetch();
  const response=await invoke(
    PRIVATE_PLAYER_CALLBACK_PATH+"?code=good-code&state="+encodeURIComponent(alias),
    {headers:{cookie:login.loginCookie},fetchImpl:auth.fetchImpl},
  );
  assert.equal(response.status,303);
  assert.equal(response.headers.Location,PRIVATE_PLAYER_PATH+"?login=failed");
  assert.equal(auth.calls.length,0);
  assert.equal(findCookie(setCookies(response.headers),PRIVATE_PLAYER_SESSION_COOKIE),undefined);
});

test("Auth0 response bodies are bounded while streaming and failures cancel the body", async () => {
  const cases=[
    {name:"declared_oversize",contentLength:"65537",
      chunks:[new Uint8Array([123])],reads:0,cancels:0,released:0},
    {name:"stream_oversize",contentLength:null,
      chunks:[new Uint8Array(32768),new Uint8Array(32768),new Uint8Array(1)],
      reads:3,cancels:1,released:1},
    {name:"malformed_length",contentLength:"not-a-number",
      chunks:[new Uint8Array([123])],reads:0,cancels:0,released:0},
  ];
  for(const item of cases) {
    const login=await begin();
    const state={reads:0,cancels:0,released:0};
    const remaining=[...item.chunks];
    const tokenResponse=responseWithBody("",{
      contentLength:item.contentLength,
      body:{getReader(){return {
        async read(){
          state.reads++;
          if(remaining.length===0) return {done:true};
          return {done:false,value:remaining.shift()};
        },
        async cancel(){state.cancels++;},
        releaseLock(){state.released++;},
      };}},
    });
    const auth=fakeAuthFetch({tokenResponse});
    const response=await invoke(
      PRIVATE_PLAYER_CALLBACK_PATH+"?code=good-code&state="+login.state,
      {headers:{cookie:login.loginCookie},fetchImpl:auth.fetchImpl},
    );
    assert.equal(response.status,303,item.name);
    assert.equal(response.headers.Location,PRIVATE_PLAYER_PATH+"?login=failed",item.name);
    assert.equal(auth.calls.length,1,item.name);
    assert.equal(state.reads,item.reads,item.name);
    assert.equal(state.cancels,item.cancels,item.name);
    assert.equal(state.released,item.released,item.name);
    assert.equal(findCookie(setCookies(response.headers),PRIVATE_PLAYER_SESSION_COOKIE),undefined,item.name);
  }
});

test("invalid or non-WAV loaded bytes fail closed without a partial audio response", async () => {
  const session=await authenticatedSession();
  for(const loadAudio of [
    async()=>Buffer.from("not-a-wav"),
    async()=>"not-a-buffer",
    async()=>{throw Error("store_failure");},
  ]) {
    const response=await invoke(PRIVATE_PLAYER_AUDIO_PATH,{
      headers:{cookie:session.cookie},loadAudio,
    });
    assert.equal(response.status,503);
    assert.deepEqual(JSON.parse(response.text),{error:"audio_unavailable"});
    assert.equal(response.body.includes(FIXTURE),false);
  }
});

test("player methods are bounded and unknown paths do not reach the player handler", async () => {
  for(const [route,allow] of [
    [PRIVATE_PLAYER_PATH,"GET"],
    [PRIVATE_PLAYER_LOGIN_PATH,"GET"],
    [PRIVATE_PLAYER_CALLBACK_PATH,"GET"],
    [PRIVATE_PLAYER_AUDIO_PATH,"GET, HEAD"],
  ]) {
    const response=await invoke(route,{method:"POST"});
    assert.equal(response.status,405);
    assert.equal(response.headers.Allow,allow);
  }
  const unknown=await invoke("/player/not-a-route");
  assert.equal(unknown.handled,false);
});

test("the player source has no provider, D1, public URL or chat-audio path", async () => {
  const source=await readFile(new URL("../src/private-web-player.js",import.meta.url),"utf8");
  const server=await readFile(new URL("../server.js",import.meta.url),"utf8");
  assert.match(source,/code_challenge_method/);
  assert.match(source,/HttpOnly; Secure; SameSite=Lax/);
  assert.match(source,/Authorization:"Bearer "/);
  assert.doesNotMatch(source,/client_secret|MINIMAX|MiniMax|cloudflare|d1-|ui\/message|sendMessage/i);
  assert.doesNotMatch(source,/console\.(?:log|error|warn)/);
  assert.match(server,/handlePrivateWebPlayer\(req,\s*res,\s*url,\s*\{\s*env,\s*fetchImpl\s*\}\)/);
  assert.ok(server.indexOf("handlePrivateWebPlayer(req, res, url, { env, fetchImpl })")<
    server.indexOf("handleProtectedResourceShell(req, res, url.pathname"));
});
