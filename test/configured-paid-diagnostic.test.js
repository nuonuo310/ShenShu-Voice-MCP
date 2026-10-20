import { test } from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,sign} from "node:crypto";
import {createConfiguredPaidDiagnostic,evaluatePaidDiagnostic} from "../src/configured-paid-diagnostic.js";
import {AUTH0_ISSUER,PAID_RESOURCE} from "../src/protected-resource-shell.js";
const {publicKey,privateKey}=generateKeyPairSync("rsa",{modulusLength:2048});
const jwk={...publicKey.export({format:"jwk"}),kid:"testkey",alg:"RS256",use:"sig"};
const env={SHENSHU_AUTH_DIAGNOSTIC_ENABLED:"1",SHENSHU_AUTH_PUBLIC_JWKS_JSON:JSON.stringify({keys:[jwk]})};
function token(scope="voice:speak", overrides={}) {
  const now=Math.floor(Date.now()/1000);
  const h=Buffer.from(JSON.stringify({alg:"RS256",typ:"JWT",kid:"testkey"})).toString("base64url");
  const p=Buffer.from(JSON.stringify({iss:AUTH0_ISSUER,aud:PAID_RESOURCE,
    sub:"test-user",iat:now-10,exp:now+120,scope,...overrides})).toString("base64url");
  const signed=h+"."+p;
  return signed+"."+sign("RSA-SHA256",Buffer.from(signed),privateKey).toString("base64url");
}
const request=t=>({headers:{authorization:"Bearer "+t}});
test("identity diagnostic remains disabled without an explicit switch",async()=>{
  const diagnostic=createConfiguredPaidDiagnostic({SHENSHU_AUTH_PUBLIC_JWKS_JSON:env.SHENSHU_AUTH_PUBLIC_JWKS_JSON},{issuer:AUTH0_ISSUER,audience:PAID_RESOURCE});
  assert.equal(diagnostic,null);
  assert.deepEqual(await evaluatePaidDiagnostic(request(token()),diagnostic),{status:401,code:"unauthorized"});
});
test("misconfiguration fails closed",async()=>{
  for(const config of [
    {SHENSHU_AUTH_DIAGNOSTIC_ENABLED:"1"},
    {...env,SHENSHU_AUTH_PUBLIC_JWKS_JSON:"not-json"},
    {...env,SHENSHU_AUTH_PUBLIC_JWKS_JSON:JSON.stringify({keys:[]})}
  ]) {
    assert.equal(createConfiguredPaidDiagnostic(config,{issuer:AUTH0_ISSUER,audience:PAID_RESOURCE}),null);
  }
});
test("verified identity cannot enable any paid synthesis",async()=>{
  const probe=createConfiguredPaidDiagnostic(env,{issuer:AUTH0_ISSUER,audience:PAID_RESOURCE});
  assert.equal(typeof probe,"function");
  assert.deepEqual(await evaluatePaidDiagnostic(request(token()),probe),{status:403,code:"paid_voice_disabled"});
  assert.deepEqual(await evaluatePaidDiagnostic(request(token("openid")),probe),{status:403,code:"insufficient_scope"});
});
test("signature, issuer, audience and expiry remain enforced",async()=>{
  const probe=createConfiguredPaidDiagnostic(env,{issuer:AUTH0_ISSUER,audience:PAID_RESOURCE});
  assert.deepEqual(await evaluatePaidDiagnostic(request(token("voice:speak",{aud:"other"})),probe),{status:401,code:"unauthorized"});
  assert.deepEqual(await evaluatePaidDiagnostic(request(token("voice:speak",{iss:"https://evil.example.com/"})),probe),{status:401,code:"unauthorized"});
  assert.deepEqual(await evaluatePaidDiagnostic(request("fake.jwt.signature"),probe),{status:401,code:"unauthorized"});
  assert.deepEqual(await evaluatePaidDiagnostic({headers:{}},probe),{status:401,code:"unauthorized"});
});
