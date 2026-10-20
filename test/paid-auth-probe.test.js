import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { createVerifiedIdentityResolver } from "../src/verified-identity.js";
import { createPaidAuthProbe } from "../src/paid-auth-probe.js";

const pair=generateKeyPairSync("rsa",{modulusLength:2048});
const issuer="https://dev-nwr87q0tnrbjeapr.us.auth0.com/";
const audience="https://shenshu-voice-mcp.onrender.com/paid-mcp";
const now=1900000000;
const key={...pair.publicKey.export({format:"jwk"}),kid:"probe-key-1",alg:"RS256",use:"sig"};
const verifier=createVerifiedIdentityResolver({
  issuer,audience,publicJwks:[key],
  requiredScopes:["voice:speak"],clock:()=>now*1000,
});
const disabled=createPaidAuthProbe({resolveVerifiedPrincipal:verifier});
const diagnostic=createPaidAuthProbe({resolveVerifiedPrincipal:verifier,enabled:true});
function jwt(overrides={}) {
  const head=Buffer.from(JSON.stringify({alg:"RS256",typ:"JWT",kid:key.kid})).toString("base64url");
  const data=Buffer.from(JSON.stringify({
    iss:issuer,aud:audience,sub:"auth0-user",iat:now-20,exp:now+120,
    scope:"openid voice:speak",...overrides
  })).toString("base64url");
  return head+"."+data+"."+sign("RSA-SHA256",Buffer.from(head+"."+data),pair.privateKey).toString("base64url");
}
const req=token=>({headers:{authorization:"Bearer "+token}});
test("default disabled probe refuses even valid signed token",async()=>{
  assert.deepEqual(await disabled(req(jwt())),{status:401,code:"unauthorized"});
});
test("enabled diagnostic accepts signature but never allows paid synthesis",async()=>{
  const response=await diagnostic(req(jwt()));
  assert.deepEqual(response,{status:403,code:"paid_voice_disabled"});
  assert.equal("subject" in response,false);
});
test("reject forged, wrong audience, wrong scope and expired tokens",async()=>{
  assert.deepEqual(await diagnostic(req("forged")),{status:401,code:"unauthorized"});
  assert.deepEqual(await diagnostic(req(jwt({aud:"https://other.example/"}))),{status:401,code:"unauthorized"});
  assert.deepEqual(await diagnostic(req(jwt({scope:"openid"}))),{status:403,code:"insufficient_scope"});
  assert.deepEqual(await diagnostic(req(jwt({exp:now-5}))),{status:401,code:"unauthorized"});
});
test("caller-claimed principal does not grant paid access",async()=>{
  const result=await diagnostic({...req(jwt()),principal:"admin",trusted:true});
  assert.deepEqual(result,{status:403,code:"paid_voice_disabled"});
});
test("cannot create an enabled diagnostic without a verifier",()=>{
  assert.throws(()=>createPaidAuthProbe({enabled:true}),/invalid_auth_probe_configuration/);
});
