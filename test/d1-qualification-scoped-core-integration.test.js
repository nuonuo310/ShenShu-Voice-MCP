import test from "node:test";
import assert from "node:assert/strict";
import {buildD1QualificationPlan} from "../src/d1-qualification-plan-only.js";
import {createScopedQualificationWriteStore} from "../src/d1-qualification-scoped-write-store.js";
import {runBoundedQualificationCore} from "../src/d1-qualification-bounded-write-core.js";
import {D1_PAID_SQL} from "../src/d1-paid-store.js";
const plan=buildD1QualificationPlan({testPrincipal:"dryrun_qualification_p2x_20261020_a",day:"2026-10-20",runId:"p2x20261020a"});
function fakeD1({failAt=null}={}){
 const calls=[],reservations=new Map(),slots=new Set(),grants=new Map();
 return {calls,client:{async query(sql,args){
  calls.push(sql);
  if(sql===D1_PAID_SQL.reserve){
   if(failAt==="reserve")throw Error("d1_timeout");
   const [requestId,subject,day,limit]=args;
   if(reservations.has(requestId))return [];
   for(let slot=1;slot<=limit;slot++){const key=subject+":"+day+":"+slot;if(!slots.has(key)){slots.add(key);reservations.set(requestId,{subject,day,slot});return [{request_id:requestId,slot}]}}
   return [];
  }
  if(sql===D1_PAID_SQL.issue){
   if(failAt==="issue")throw Error("d1_timeout");
   const [grantId,requestId,subject]=args,r=reservations.get(requestId);
   if(!r||r.subject!==subject||grants.has(grantId))return [];
   grants.set(grantId,{requestId,subject,consumed:false});return [{grant_id:grantId}];
  }
  if(sql===D1_PAID_SQL.consume){
   if(failAt==="consume")throw Error("d1_timeout");
   const [grantId,requestId,subject]=args,g=grants.get(grantId);
   if(!g||g.consumed||g.requestId!==requestId||g.subject!==subject)return [];
   g.consumed=true;return [{grant_id:grantId}];
  }
  throw Error("unexpected_sql");
 }}};
}
test("full scoped core emits 12 reservation attempts, 3 consumed grants",async()=>{const f=fakeD1(),store=createScopedQualificationWriteStore({client:f.client});const r=await runBoundedQualificationCore({plan,store});assert.equal(r.attempts,12);assert.equal(r.reserved,3);assert.equal(r.consumed,3);assert.equal(f.calls.filter(x=>x===D1_PAID_SQL.reserve).length,12);assert.equal(f.calls.filter(x=>x===D1_PAID_SQL.issue).length,3);assert.equal(f.calls.filter(x=>x===D1_PAID_SQL.consume).length,3)});
test("ambiguous reservation stops before any grant",async()=>{const f=fakeD1({failAt:"reserve"}),store=createScopedQualificationWriteStore({client:f.client});await assert.rejects(runBoundedQualificationCore({plan,store}),/reservation_ambiguous_stop/);assert.equal(f.calls.filter(x=>x===D1_PAID_SQL.issue).length,0)});
test("grant failure stops without retries",async()=>{for(const failAt of ["issue","consume"]){const f=fakeD1({failAt}),store=createScopedQualificationWriteStore({client:f.client});await assert.rejects(runBoundedQualificationCore({plan,store}));assert.equal(f.calls.filter(x=>x===D1_PAID_SQL.issue).length,1)}});
