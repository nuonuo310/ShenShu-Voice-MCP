import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {generateKeyPairSync,sign} from "node:crypto";
import {
  AUTH0_ISSUER,
  PAID_PATH,
  PAID_RESOURCE,
  RESOURCE_METADATA_PATH,
  RESOURCE_METADATA_URL,
  handleProtectedResourceShell,
} from "../src/protected-resource-shell.js";
import {
  PRODUCTION_PAID_RESOURCE,
  PRODUCTION_RESOURCE_METADATA_URL,
  STAGING_RESOURCE_ORIGIN,
  resolveProtectedResourceIdentity,
} from "../src/protected-resource-identity.js";
import {createStagingIdentityVerifier} from "../src/staging-authenticated-mcp.js";

const PRODUCTION_METADATA={
  resource:"https://shenshu-voice-mcp.onrender.com/paid-mcp",
  authorization_servers:["https://dev-nwr87q0tnrbjeapr.us.auth0.com/"],
  scopes_supported:["voice:speak"],
  bearer_methods_supported:["header"],
};
const PRODUCTION_CHALLENGE=
  'Bearer resource_metadata="https://shenshu-voice-mcp.onrender.com/.well-known/oauth-protected-resource/paid-mcp", scope="voice:speak"';
const STAGING_ENV={
  SHENSHU_STAGING_RESOURCE_MODE:"1",
  SHENSHU_STAGING_ORIGIN:STAGING_RESOURCE_ORIGIN,
};
const HOSTILE_HEADERS={
  host:"shenshu-voice-mcp.onrender.com",
  forwarded:"host=evil.example",
  "x-forwarded-host":"evil.example",
  "x-forwarded-proto":"http",
};
const {publicKey,privateKey}=generateKeyPairSync("rsa",{modulusLength:2048});
const TEST_JWK={...publicKey.export({format:"jwk"}),alg:"RS256",use:"sig",kid:"v7-resource-key"};
const TEST_JWKS_JSON=JSON.stringify({keys:[TEST_JWK]});

function token({audience,scope="voice:speak",issuer=AUTH0_ISSUER}={}) {
  const now=Math.floor(Date.now()/1000);
  const header=Buffer.from(JSON.stringify({alg:"RS256",typ:"JWT",kid:TEST_JWK.kid})).toString("base64url");
  const payload=Buffer.from(JSON.stringify({
    iss:issuer,aud:audience,sub:"v7-fixture-user",scope,iat:now-10,exp:now+300
  })).toString("base64url");
  const message=header+"."+payload;
  return message+"."+sign("RSA-SHA256",Buffer.from(message),privateKey).toString("base64url");
}

function response() {
  return {
    statusCode:null,headers:null,body:"",
    writeHead(status,headers){this.statusCode=status;this.headers=headers;return this;},
    end(body=""){this.body=String(body);},
  };
}

async function invoke(pathname,{env={},method="GET",headers={}}={}) {
  const req={method,headers,url:pathname};
  const res=response();
  const handled=await handleProtectedResourceShell(req,res,pathname,{env});
  let json=null;
  try {json=JSON.parse(res.body);} catch {}
  return {handled,status:res.statusCode,headers:res.headers,body:res.body,json};
}

test("default identity, discovery document and 401 challenge are exact",async()=>{
  assert.equal(PAID_RESOURCE,PRODUCTION_PAID_RESOURCE);
  assert.equal(RESOURCE_METADATA_URL,PRODUCTION_RESOURCE_METADATA_URL);
  const identity=resolveProtectedResourceIdentity({});
  assert.equal(identity.ok,true);
  assert.equal(identity.staging,false);
  assert.equal(identity.paidResource,PRODUCTION_PAID_RESOURCE);
  assert.equal(identity.resourceMetadataUrl,PRODUCTION_RESOURCE_METADATA_URL);
  assert.deepEqual(identity.metadata,PRODUCTION_METADATA);
  assert.equal(identity.challenge.headers["WWW-Authenticate"],PRODUCTION_CHALLENGE);

  const discovery=await invoke(RESOURCE_METADATA_PATH,{env:{}});
  assert.equal(discovery.handled,true);
  assert.equal(discovery.status,200);
  assert.equal(discovery.body,JSON.stringify(PRODUCTION_METADATA));
  assert.equal(discovery.headers["Cache-Control"],"no-store");

  const challenge=await invoke(PAID_PATH,{env:{}});
  assert.equal(challenge.handled,true);
  assert.equal(challenge.status,401);
  assert.equal(challenge.headers["WWW-Authenticate"],PRODUCTION_CHALLENGE);
  assert.deepEqual(challenge.json,{error:"unauthorized"});
});

test("staging flag absent or false ignores overrides and request headers",async()=>{
  const environments=[
    {},
    {SHENSHU_STAGING_ORIGIN:STAGING_RESOURCE_ORIGIN},
    {SHENSHU_STAGING_RESOURCE_MODE:"0",SHENSHU_STAGING_ORIGIN:STAGING_RESOURCE_ORIGIN},
    {SHENSHU_STAGING_RESOURCE_MODE:"false",SHENSHU_STAGING_ORIGIN:"https://evil.example"},
  ];
  for(const env of environments) {
    const identity=resolveProtectedResourceIdentity(env);
    assert.equal(identity.ok,true);
    assert.equal(identity.staging,false);
    assert.equal(identity.paidResource,PRODUCTION_PAID_RESOURCE);
    const discovery=await invoke(RESOURCE_METADATA_PATH,{env,headers:HOSTILE_HEADERS});
    assert.equal(discovery.status,200);
    assert.equal(discovery.body,JSON.stringify(PRODUCTION_METADATA));
    const challenge=await invoke(PAID_PATH,{env,headers:HOSTILE_HEADERS});
    assert.equal(challenge.status,401);
    assert.equal(challenge.headers["WWW-Authenticate"],PRODUCTION_CHALLENGE);
  }
});

test("invalid staging configuration fails closed without identity fallback",async()=>{
  const invalidOrigins=[
    undefined,
    "",
    "http://shenshu-voice-mcp-staging.onrender.com",
    "https://user:pass@shenshu-voice-mcp-staging.onrender.com",
    "https://shenshu-voice-mcp-staging.onrender.com/paid-mcp",
    "https://shenshu-voice-mcp-staging.onrender.com/?query=1",
    "https://shenshu-voice-mcp-staging.onrender.com/#fragment",
    "https://shenshu-voice-mcp-staging.onrender.com:443",
    "https://127.0.0.1",
    "https://localhost",
    "https://*.onrender.com",
    "https://evil.onrender.com",
    "https://shenshu-voice-mcp.onrender.com",
    "https://shenshu-voice-mcp-staging.onrender.com/",
    "https://SHENSHU-VOICE-MCP-STAGING.ONRENDER.COM",
    "https://shenshu-voice-mcp-staging.onrender.com.evil.example",
    "https://shenshu-voice-mcp-staging.onrender.com%2e.evil.example",
    "https://xn--shenshu-voice-mcp-staging-8fc.onrender.com",
  ];
  for(const origin of invalidOrigins) {
    const env={SHENSHU_STAGING_RESOURCE_MODE:"1",SHENSHU_STAGING_ORIGIN:origin};
    assert.equal(resolveProtectedResourceIdentity(env).ok,false,String(origin));
    for(const pathname of [RESOURCE_METADATA_PATH,PAID_PATH]) {
      const result=await invoke(pathname,{env,headers:HOSTILE_HEADERS});
      assert.equal(result.status,503,String(origin));
      assert.deepEqual(result.json,{error:"resource_identity_unavailable"});
      assert.equal(result.body.includes(PRODUCTION_PAID_RESOURCE),false);
      assert.equal(result.body.includes(STAGING_RESOURCE_ORIGIN),false);
    }
  }
  for(const mode of ["true","yes","2"]) {
    const env={SHENSHU_STAGING_RESOURCE_MODE:mode,SHENSHU_STAGING_ORIGIN:STAGING_RESOURCE_ORIGIN};
    assert.equal(resolveProtectedResourceIdentity(env).ok,false);
  }
});

test("valid staging origin consistently changes audience, metadata and challenge",async()=>{
  const identity=resolveProtectedResourceIdentity(STAGING_ENV);
  assert.equal(identity.ok,true);
  assert.equal(identity.staging,true);
  assert.equal(identity.paidResource,STAGING_RESOURCE_ORIGIN+"/paid-mcp");
  assert.equal(identity.resourceMetadataUrl,
    STAGING_RESOURCE_ORIGIN+"/.well-known/oauth-protected-resource/paid-mcp");
  assert.deepEqual(identity.metadata,{
    resource:STAGING_RESOURCE_ORIGIN+"/paid-mcp",
    authorization_servers:[AUTH0_ISSUER],
    scopes_supported:["voice:speak"],
    bearer_methods_supported:["header"],
  });
  const stagingChallenge=
    'Bearer resource_metadata="'+STAGING_RESOURCE_ORIGIN+'/.well-known/oauth-protected-resource/paid-mcp", scope="voice:speak"';
  assert.equal(identity.challenge.headers["WWW-Authenticate"],stagingChallenge);

  const discovery=await invoke(RESOURCE_METADATA_PATH,{env:STAGING_ENV,headers:HOSTILE_HEADERS});
  assert.equal(discovery.status,200);
  assert.deepEqual(discovery.json,identity.metadata);
  assert.equal(discovery.body.includes(PRODUCTION_PAID_RESOURCE),false);

  const challenge=await invoke(PAID_PATH,{env:STAGING_ENV,headers:HOSTILE_HEADERS});
  assert.equal(challenge.status,401);
  assert.equal(challenge.headers["WWW-Authenticate"],stagingChallenge);
  assert.deepEqual(challenge.json,{error:"unauthorized"});
});

test("protected-route misconfiguration does not consume or alter public routes",async()=>{
  const env={SHENSHU_STAGING_RESOURCE_MODE:"1"};
  const publicResult=await invoke("/mcp",{env,headers:HOSTILE_HEADERS});
  assert.equal(publicResult.handled,false);
  assert.equal(publicResult.status,null);
  assert.equal(publicResult.body,"");
});

test("staging verifier accepts only the staging audience under trusted issuer and scope",async()=>{
  const identity=resolveProtectedResourceIdentity(STAGING_ENV);
  const env={
    SHENSHU_AUTH_MCP_ENABLED:"1",
    SHENSHU_AUTH_STATIC_JWKS_TEST_ONLY:"1",
    SHENSHU_AUTH_PUBLIC_JWKS_JSON:TEST_JWKS_JSON,
  };
  const stagingVerifier=createStagingIdentityVerifier(env,{
    issuer:identity.issuer,audience:identity.paidResource
  });
  assert.equal(typeof stagingVerifier,"function");
  const request=(raw)=>({headers:{authorization:"Bearer "+raw}});
  const verified=await stagingVerifier(request(token({audience:identity.paidResource})));
  assert.equal(verified.verified,true);
  await assert.rejects(
    stagingVerifier(request(token({audience:PRODUCTION_PAID_RESOURCE}))),
    /not_authorized/
  );
  await assert.rejects(
    stagingVerifier(request(token({audience:identity.paidResource,scope:"openid"}))),
    /insufficient_scope/
  );
  await assert.rejects(
    stagingVerifier(request(token({
      audience:identity.paidResource,issuer:"https://evil.example/"
    }))),
    /not_authorized/
  );

  const productionVerifier=createStagingIdentityVerifier(env,{
    issuer:AUTH0_ISSUER,audience:PRODUCTION_PAID_RESOURCE
  });
  assert.equal((await productionVerifier(request(token({audience:PRODUCTION_PAID_RESOURCE})))).verified,true);
  await assert.rejects(
    productionVerifier(request(token({audience:identity.paidResource}))),
    /not_authorized/
  );
});

test("shell diagnostic uses the resolved staging audience and challenge",async()=>{
  const identity=resolveProtectedResourceIdentity(STAGING_ENV);
  const env={
    ...STAGING_ENV,
    SHENSHU_AUTH_DIAGNOSTIC_ENABLED:"1",
    SHENSHU_AUTH_PUBLIC_JWKS_JSON:TEST_JWKS_JSON,
  };
  const staging=await invoke(PAID_PATH,{
    env,headers:{authorization:"Bearer "+token({audience:identity.paidResource})}
  });
  assert.equal(staging.status,403);
  assert.deepEqual(staging.json,{error:"paid_voice_disabled"});
  assert.match(staging.headers["WWW-Authenticate"],
    new RegExp("resource_metadata=\""+STAGING_RESOURCE_ORIGIN.replaceAll(".","\\.")));

  const production=await invoke(PAID_PATH,{
    env,headers:{authorization:"Bearer "+token({audience:PRODUCTION_PAID_RESOURCE})}
  });
  assert.equal(production.status,401);
  assert.deepEqual(production.json,{error:"unauthorized"});
  assert.match(production.headers["WWW-Authenticate"],
    new RegExp("resource_metadata=\""+STAGING_RESOURCE_ORIGIN.replaceAll(".","\\.")));
});

test("resolver remains pure and introduces no provider, D1, secrets or ambient env access",async()=>{
  const source=await readFile(new URL("../src/protected-resource-identity.js",import.meta.url),"utf8");
  assert.doesNotMatch(source,/process\.env|fetch\s*\(|minimax|cloudflare|\bD1\b|readFile|voiceId|secret/i);
  assert.match(source,/SHENSHU_STAGING_RESOURCE_MODE/);
  assert.match(source,/SHENSHU_STAGING_ORIGIN/);
});
