import test from "node:test";
import assert from "node:assert/strict";
import {prepareAuthorizedAudioHttpResponse} from "../src/private-https-audio-response.js";
import {makeInlineToneFixture} from "../src/inline-fixture.js";
const wav=Buffer.from(makeInlineToneFixture().audioBase64,"base64");
test("authenticated response is no-store HTTPS-compatible WAV",async()=>{
 const result=await prepareAuthorizedAudioHttpResponse({trustedRequest:{},authorize:async()=>({authenticated:true,subject:"verified_subject_001"}),loadAudio:async()=>wav});
 assert.equal(result.status,200);assert.equal(result.headers["Content-Type"],"audio/wav");
 assert.match(result.headers["Cache-Control"],/no-store/);assert.deepEqual(result.body,wav);
 assert.equal("Location" in result.headers,false);assert.equal("Set-Cookie" in result.headers,false);
});
test("unauthorized request cannot load audio",async()=>{
 let loads=0;
 for(const identity of [null,{authenticated:false,subject:"verified_subject_001"},{authenticated:true,subject:"short"}]){
  await assert.rejects(prepareAuthorizedAudioHttpResponse({trustedRequest:{},authorize:async()=>identity,loadAudio:async()=>{loads++;return wav}}),/not_authorized/);
 }
 assert.equal(loads,0);
});
test("invalid audio fails closed",async()=>{
 await assert.rejects(prepareAuthorizedAudioHttpResponse({trustedRequest:{},authorize:async()=>({authenticated:true,subject:"verified_subject_001"}),loadAudio:async()=>Buffer.from("bad")}),/invalid_audio/);
});
