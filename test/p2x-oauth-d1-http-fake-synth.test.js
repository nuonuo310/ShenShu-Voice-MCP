import test from "node:test";
import assert from "node:assert/strict";
import {createServerOwnedVoiceAdmission} from "../src/server-owned-voice-admission.js";
import {createD1HttpPaidStore} from "../src/d1-http-paid-store.js";
import {D1_PAID_SQL} from "../src/d1-paid-store.js";
import {createLiveVoice} from "../src/live-voice.js";
import {makeInlineToneFixture} from "../src/inline-fixture.js";
const audio=Buffer.from(makeInlineToneFixture().audioBase64,"base64");
function setup({verifiedSubject="verified_subject_001",failure=null}={}){
 const calls=[],reservations=new Set(),grants=new Map();
 const client={async query(sql,args){
  if(sql===D1_PAID_SQL.reserve){calls.push("reserve");if(failure==="reserve")throw Error("d1_error");const [id,subject]=args;if(reservations.has(id))return [];reservations.add(id);return [{request_id:id,slot:1}]}
  if(sql===D1_PAID_SQL.issue){calls.push("issue");if(failure==="issue")throw Error("d1_error");const [grantId,id,subject]=args;if(!reservations.has(id))return [];grants.set(grantId,{id,subject,used:false});return [{grant_id:grantId}]}
  if(sql===D1_PAID_SQL.consume){calls.push("consume");if(failure==="consume")throw Error("d1_error");const [grantId,id,subject]=args,g=grants.get(grantId);if(!g||g.used||g.id!==id||g.subject!==subject)return [];g.used=true;return [{grant_id:grantId}]}
  throw Error("unexpected_sql");
 }};
 const store=createD1HttpPaidStore({client});
 const authorize=createServerOwnedVoiceAdmission({verifiedSubject,store,makeGrantId:()=>"grant_fixed_001"});
 return {authorize,calls};
}
test("verified server principal -> D1 HTTP adapter -> consumed grant -> one fake synth",async()=>{
 const h=setup();let n=0;const result=await createLiveVoice({text:"糯糯，哥哥在。",requestId:"request_fixed_001",authorize:h.authorize,synthesize:async()=>{h.calls.push("synth");n++;return {audio,durationSeconds:0.7}}});
 assert.equal(n,1);assert.deepEqual(h.calls,["reserve","issue","consume","synth"]);assert.equal(result.record.generated,true);
});
test("D1 HTTP errors block fake synth",async()=>{
 for(const failure of ["reserve","issue","consume"]){const h=setup({failure});let n=0;await assert.rejects(createLiveVoice({text:"测试",requestId:"request_fixed_001",authorize:h.authorize,synthesize:async()=>{n++;return {audio,durationSeconds:0.7}}}));assert.equal(n,0)}
});
test("D1 HTTP adapter rejects replay before fake synth",async()=>{
 const h=setup();let n=0;const args={text:"测试",requestId:"request_fixed_001",authorize:h.authorize,synthesize:async()=>{n++;return {audio,durationSeconds:0.7}}};await createLiveVoice(args);await assert.rejects(createLiveVoice(args));assert.equal(n,1);
});
