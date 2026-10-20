import test from "node:test";
import assert from "node:assert/strict";
import {createServerOwnedVoiceAdmission} from "../src/server-owned-voice-admission.js";
import {createLiveVoice} from "../src/live-voice.js";
import {makeInlineToneFixture} from "../src/inline-fixture.js";
const audio=Buffer.from(makeInlineToneFixture().audioBase64,"base64");
function setup(fail){const calls=[];const used=new Set();const store={
 async reserveAtomic(x){calls.push("reserve");return {reserved:fail!=="reserve"&&!used.has(x.requestId)&&!!used.add(x.requestId)}},
 async issue(){calls.push("issue");return {issued:fail!=="issue"}},
 async consume(){calls.push("consume");return {consumed:fail!=="consume"}}};
 const authorize=createServerOwnedVoiceAdmission({verifiedSubject:"verified_subject_001",store,makeGrantId:()=>"grant_fixed_001"});
 return {authorize,calls};}
test("server-owned grant sequence precedes exactly one fake synthesis",async()=>{const h=setup();let synth=0;const r=await createLiveVoice({text:"测试",requestId:"request_valid_001",authorize:h.authorize,synthesize:async()=>{synth++;h.calls.push("synth");return {audio,durationSeconds:0.7}}});assert.equal(r.record.generated,true);assert.equal(synth,1);assert.deepEqual(h.calls,["reserve","issue","consume","synth"])});
test("every admission denial blocks synthesis",async()=>{for(const fail of ["reserve","issue","consume"]){const h=setup(fail);let synth=0;await assert.rejects(createLiveVoice({text:"测试",requestId:"request_valid_001",authorize:h.authorize,synthesize:async()=>{synth++;return {audio,durationSeconds:0.7}}}));assert.equal(synth,0)}});
test("request replay rejected before synthesis",async()=>{const h=setup();let synth=0;const args={text:"测试",requestId:"request_valid_001",authorize:h.authorize,synthesize:async()=>{synth++;return {audio,durationSeconds:0.7}}};await createLiveVoice(args);await assert.rejects(createLiveVoice(args));assert.equal(synth,1)});
test("invalid identity, action and request ID fail closed",async()=>{assert.throws(()=>createServerOwnedVoiceAdmission({verifiedSubject:"bad"}),/admission_unavailable/);const h=setup();await assert.rejects(h.authorize({action:"other",textBytes:2,requestId:"request_valid_001"}),/not_authorized/);assert.deepEqual(h.calls,[])});
