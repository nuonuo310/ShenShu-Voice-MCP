import test from "node:test";
import assert from "node:assert/strict";
import {createOfflinePrivateAudioTickets} from "../src/private-https-audio-tickets.js";
import {makeInlineToneFixture} from "../src/inline-fixture.js";
const audio=Buffer.from(makeInlineToneFixture().audioBase64,"base64");
const principal="verified_subject_001";
test("single use private ticket is bound to subject",()=>{
 const tickets=createOfflinePrivateAudioTickets();const token=tickets.issue({verifiedSubject:principal,audio});
 assert.deepEqual(tickets.consume({token,verifiedSubject:principal}),audio);
 assert.throws(()=>tickets.consume({token,verifiedSubject:principal}),/not_authorized/);
});
test("wrong principal burns ticket",()=>{
 const tickets=createOfflinePrivateAudioTickets();const token=tickets.issue({verifiedSubject:principal,audio});
 assert.throws(()=>tickets.consume({token,verifiedSubject:"verified_subject_002"}),/not_authorized/);
 assert.throws(()=>tickets.consume({token,verifiedSubject:principal}),/not_authorized/);
});
test("expired ticket and malformed audio fail closed",()=>{
 let now=1000;const tickets=createOfflinePrivateAudioTickets({clock:()=>now});
 const token=tickets.issue({verifiedSubject:principal,audio,ttlMs:1000});now=2001;
 assert.throws(()=>tickets.consume({token,verifiedSubject:principal}),/not_authorized/);
 assert.throws(()=>tickets.issue({verifiedSubject:principal,audio:Buffer.from("bad")}),/invalid_audio/);
});
