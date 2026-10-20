import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,sign} from "node:crypto";
import {createVerifiedIdentityResolver} from "../src/verified-identity.js";
import {createServerOwnedVoiceAdmission} from "../src/server-owned-voice-admission.js";
import {createLiveVoice} from "../src/live-voice.js";
import {makeInlineToneFixture} from "../src/inline-fixture.js";
const {publicKey,privateKey}=generateKeyPairSync("rsa",{modulusLength:2048});
const jwk={...publicKey.export({format:"jwk"}),kid:"offline_key",alg:"RS256",use:"sig"};
const now=1900000000,issuer="https://offline.invalid",audience="https://offline.invalid/mcp";
const verify=createVerifiedIdentityResolver({issuer,audience,publicJwks:[jwk],requiredScopes:["voice:speak"],clock:()=>now*1000});
function token(overrides={}){const h=Buffer.from(JSON.stringify({alg:"RS256",typ:"JWT",kid:"offline_key"})).toString("base64url");const p=Buffer.from(JSON.stringify({iss:issuer,aud:audience,sub:"user_001",iat:now-10,exp:now+300,scope:"voice:speak",...overrides})).toString("base64url");const signed=h+"."+p;return signed+"."+sign("RSA-SHA256",Buffer.from(signed),privateKey).toString("base64url")}
const audio=Buffer.from(makeInlineToneFixture().audioBase64,"base64");
async function invoke(jwt){let synthCalls=0,storeCalls=0;const verified=await verify({headers:{authorization:"Bearer "+jwt}});const store={async reserveAtomic(){storeCalls++;return {reserved:true}},async issue(){storeCalls++;return {issued:true}},async consume(){storeCalls++;return {consumed:true}}};const authorize=createServerOwnedVoiceAdmission({verifiedSubject:verified.subject,store,makeGrantId:()=>"grant_offline_001"});const result=await createLiveVoice({text:"测试",requestId:"request_offline_001",authorize,synthesize:async()=>{synthCalls++;return {audio,durationSeconds:0.7}}});return {result,synthCalls,storeCalls,subject:verified.subject}}
test("signed scoped OAuth identity reaches D1 mock and one fake synthesis",async()=>{const r=await invoke(token());assert.equal(r.synthCalls,1);assert.equal(r.storeCalls,3);assert.equal(r.result.record.generated,true);assert.notEqual(r.subject,"user_001")});
test("invalid or insufficient-scope OAuth never reaches admission or synthesis",async()=>{for(const claims of [{scope:"profile"},{aud:"wrong"},{exp:now-1}])await assert.rejects(invoke(token(claims)));await assert.rejects(invoke("not.a.jwt"))});
