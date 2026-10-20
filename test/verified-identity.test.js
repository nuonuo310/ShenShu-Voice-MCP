import {test} from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,sign} from "node:crypto";
import {createVerifiedIdentityResolver} from "../src/verified-identity.js";
const {publicKey,privateKey}=generateKeyPairSync("rsa",{modulusLength:2048});
const pub={...publicKey.export({format:"jwk"}),kid:"testkey1",alg:"RS256",use:"sig"};
const now=1900000000;
const setup={issuer:"https://issuer.example.invalid",audience:"https://mcp.example.invalid/mcp",publicJwks:[pub],clock:()=>now*1000};
const resolve=createVerifiedIdentityResolver(setup);
function token(overrides={},header={}) {
  const hdr=Buffer.from(JSON.stringify({alg:"RS256",typ:"JWT",kid:"testkey1",...header})).toString("base64url");
  const claims=Buffer.from(JSON.stringify({iss:setup.issuer,aud:setup.audience,sub:"user-17",iat:now-10,exp:now+300,...overrides})).toString("base64url");
  const data=hdr+"."+claims;
  return data+"."+sign("RSA-SHA256",Buffer.from(data),privateKey).toString("base64url");
}
const req=t=>({headers:{authorization:"Bearer "+t}});
test("accept valid signed token and derive stable opaque principal",async()=>{
 const a=await resolve(req(token()));const b=await resolve(req(token()));
 assert.deepEqual(a,b);assert.equal(a.verified,true);assert.match(a.subject,/^[A-Za-z0-9_-]{43}$/);
 assert.notEqual(a.subject,"user-17");
});
test("reject unsigned, tampered, wrong algorithm, unknown key",async()=>{
 await assert.rejects(resolve({headers:{}}),/not_authorized/);
 await assert.rejects(resolve(req((()=>{const p=token().split(".");const bytes=Buffer.from(p[1],"base64url");bytes[10]^=1;p[1]=bytes.toString("base64url");return p.join(".")})())),/not_authorized/);
 await assert.rejects(resolve(req(token({}, {alg:"none"}))),/not_authorized/);
 await assert.rejects(resolve(req(token({}, {kid:"unknown"}))),/not_authorized/);
});
test("reject wrong issuer and audience, expired, future, oversized lifetime",async()=>{
 for (const bad of [{iss:"https://evil.invalid"},{aud:"other"},{exp:now},{iat:now+100},{nbf:now+100},{exp:now+4000}])
  await assert.rejects(resolve(req(token(bad))),/not_authorized/);
});
test("reject forged identity from caller-supplied field",async()=>{
 const a=await resolve({...req(token()),principal:"evil",subject:"evil",headers:{...req(token()).headers,"x-user-id":"evil"}});
 assert.notEqual(a.subject,"evil");
});
test("reject unsafe trust anchors on startup",()=>{
 assert.throws(()=>createVerifiedIdentityResolver({...setup,publicJwks:[{...pub,d:"private"}]}),/invalid_auth_configuration/);
 assert.throws(()=>createVerifiedIdentityResolver({...setup,publicJwks:[]}),/invalid_auth_configuration/);
});

test("paid voice authorization requires voice:speak scope even with valid JWT",async()=>{
 const scoped=createVerifiedIdentityResolver({...setup,requiredScopes:["voice:speak"]});
 await assert.rejects(scoped(req(token())),/insufficient_scope/);
 await assert.rejects(scoped(req(token({scope:"profile email"}))),/insufficient_scope/);
 const okay=await scoped(req(token({scope:"profile voice:speak"})));
 assert.equal(okay.verified,true);
 const scpOkay=await scoped(req(token({scp:["voice:speak"]})));
 assert.equal(scpOkay.verified,true);
});
test("scope configuration refuses malformed or duplicate entitlements",()=>{
 assert.throws(()=>createVerifiedIdentityResolver({...setup,requiredScopes:["voice:speak","voice:speak"]}),/invalid_auth_configuration/);
 assert.throws(()=>createVerifiedIdentityResolver({...setup,requiredScopes:[""]}),/invalid_auth_configuration/);
});

test("accept exact resource inside standards-compliant aud array but reject arrays without it",async()=>{
 const arrayResolver=createVerifiedIdentityResolver({...setup,maxLifetimeSeconds:86400});
 const good=await arrayResolver(req(token({aud:[setup.audience,"https://issuer.example.invalid/userinfo"],exp:now+7200})));
 assert.equal(good.verified,true);
 await assert.rejects(arrayResolver(req(token({aud:["https://other.example"],exp:now+7200}))),/not_authorized/);
});
test("Auth0-compatible 24h ceiling accepts long-lived valid token but still rejects beyond ceiling",async()=>{
 const long=createVerifiedIdentityResolver({...setup,maxLifetimeSeconds:86400});
 assert.equal((await long(req(token({exp:now+86300})))).verified,true);
 await assert.rejects(long(req(token({exp:now+90000}))),/not_authorized/);
});
