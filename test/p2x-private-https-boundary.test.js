import test from "node:test";
import assert from "node:assert/strict";
import {prepareAuthorizedAudioHttpResponse} from "../src/private-https-audio-response.js";
import {makeInlineToneFixture} from "../src/inline-fixture.js";
import {MAX_WAV_BYTES} from "../src/contract.js";
const wav=Buffer.from(makeInlineToneFixture().audioBase64,"base64");
const authorize=async()=>({authenticated:true,subject:"verified_subject_001"});
test("HTTPS response preserves existing WAV size limit and no-store",async()=>{
 const r=await prepareAuthorizedAudioHttpResponse({trustedRequest:{},authorize,loadAudio:async()=>wav});
 assert.ok(r.body.length<=MAX_WAV_BYTES);
 assert.equal(r.headers["Content-Length"],String(wav.length));
 assert.match(r.headers["Cache-Control"],/no-store/);
 assert.equal(r.headers["Vary"],"Authorization");
});
test("oversized WAV is rejected before a successful response",async()=>{
 const oversized=Buffer.alloc(MAX_WAV_BYTES+1);
 await assert.rejects(prepareAuthorizedAudioHttpResponse({trustedRequest:{},authorize,loadAudio:async()=>oversized}),/invalid_audio/);
});
test("failed auth never reads audio",async()=>{
 let reads=0;
 await assert.rejects(prepareAuthorizedAudioHttpResponse({trustedRequest:{},authorize:async()=>({authenticated:false}),loadAudio:async()=>{reads++;return wav}}),/not_authorized/);
 assert.equal(reads,0);
});
