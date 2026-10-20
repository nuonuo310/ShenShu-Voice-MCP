import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createLiveVoice} from "../src/live-voice.js";
import {makeInlineToneFixture} from "../src/inline-fixture.js";
const wav=Buffer.from(makeInlineToneFixture().audioBase64,"base64");
const principal="verified_subject_001";
function harness({identity=principal,limit=3,failAt=null}={}) {
 const reservations=new Set(),grants=new Map();let synthCalls=0;
 const store={
  async reserveAtomic({subject,requestId}){if(failAt==="reserve"||subject!==principal||reservations.size>=limit||reservations.has(requestId))return {reserved:false};reservations.add(requestId);return {reserved:true}},
  async issue({grantId,requestId,subject}){if(failAt==="issue"||subject!==principal||!reservations.has(requestId)||grants.has(grantId))return {issued:false};grants.set(grantId,{requestId,subject,used:false});return {issued:true}},
  async consume({grantId,requestId,subject}){const g=grants.get(grantId);if(failAt==="consume"||!g||g.used||g.requestId!==requestId||g.subject!==subject)return {consumed:false};g.used=true;return {consumed:true}}
 };
 const authorize=async({requestId})=>{
  if(identity!==principal)throw Error("not_authorized");
  const r=await store.reserveAtomic({subject:identity,requestId});if(!r.reserved)throw Error("budget_denied");
  const grantId="grant_"+randomUUID().replaceAll("-","");
  if(!(await store.issue({grantId,requestId,subject:identity})).issued)throw Error("grant_denied");
  if(!(await store.consume({grantId,requestId,subject:identity})).consumed)throw Error("grant_denied");
  return {allowed:true,principal:identity,oneTime:true};
 };
 const synthesize=async()=>{synthCalls++;return {audio:wav,durationSeconds:0.7}};
 return {authorize,synthesize,store,get calls(){return synthCalls}};
}
test("fake synth runs exactly once after reserve, issue and consume",async()=>{
 const h=harness();const r=await createLiveVoice({text:"糯糯，哥哥在。",authorize:h.authorize,synthesize:h.synthesize});
 assert.equal(h.calls,1);assert.equal(r.record.generated,true);assert.equal(r.record.audioMimeType,"audio/wav");
 assert.deepEqual(Buffer.from(r.record.audioBase64,"base64"),wav);
});
test("identity, budget, issue and consume denials never synthesize",async()=>{
 for(const opts of [{identity:"wrong_user"},{limit:0},{failAt:"reserve"},{failAt:"issue"},{failAt:"consume"}]){
  const h=harness(opts);await assert.rejects(createLiveVoice({text:"测试",authorize:h.authorize,synthesize:h.synthesize}));assert.equal(h.calls,0);
 }
});
test("same request replay and consumed grant replay are rejected",async()=>{
 const h=harness();const requestId="request_replay_001";
 await createLiveVoice({text:"测试",requestId,authorize:h.authorize,synthesize:h.synthesize});
 await assert.rejects(createLiveVoice({text:"测试",requestId,authorize:h.authorize,synthesize:h.synthesize}));
 assert.equal(h.calls,1);
 const id="grant_replay_001";assert.equal((await h.store.consume({grantId:id,requestId,subject:principal})).consumed,false);
});
