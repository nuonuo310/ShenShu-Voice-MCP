import test from "node:test";
import assert from "node:assert/strict";
import {createD1HttpPaidStore} from "../src/d1-http-paid-store.js";
import {D1_PAID_SQL} from "../src/d1-paid-store.js";

// Deterministic offline concurrency model of D1's unique slot/request constraints.
// This is NOT an actual D1 concurrency test.
function serializedFakeD1(){
 const reservations=new Map(),slots=new Set(),grants=new Map();let queue=Promise.resolve();
 const query=(sql,args)=>{
  const task=queue.then(()=>{
   if(sql===D1_PAID_SQL.reserve){
    const [requestId,subject,day,limit]=args;
    if(reservations.has(requestId))return [];
    for(let slot=1;slot<=limit;slot++){
     const key=subject+":"+day+":"+slot;
     if(!slots.has(key)){slots.add(key);reservations.set(requestId,{subject,day,slot});return [{request_id:requestId,slot}]}
    }
    return [];
   }
   if(sql===D1_PAID_SQL.issue){
    const [grantId,requestId,subject]=args;
    if(!reservations.has(requestId)||reservations.get(requestId).subject!==subject||grants.has(grantId))return [];
    grants.set(grantId,{requestId,subject,state:"issued"});return [{grant_id:grantId}];
   }
   if(sql===D1_PAID_SQL.consume){
    const [grantId,requestId,subject]=args,g=grants.get(grantId);
    if(!g||g.requestId!==requestId||g.subject!==subject||g.state!=="issued")return [];
    g.state="consumed";return [{grant_id:grantId}];
   }
   throw Error("unexpected_query");
  });
  queue=task.then(()=>{},()=>{});return task;
 };
 return createD1HttpPaidStore({client:{query}});
}
const subject="verified_subject_001",day="2026-10-20";
test("simulated concurrent reservations cannot exceed three slots",async()=>{
 const store=serializedFakeD1();
 const outcomes=await Promise.all(Array.from({length:12},(_,i)=>store.reserveAtomic({subject,day,requestId:"request_"+String(i).padStart(8,"0"),limit:3})));
 assert.equal(outcomes.filter(x=>x.reserved).length,3);
 assert.deepEqual(outcomes.filter(x=>x.reserved).map(x=>x.slot).sort(),[1,2,3]);
});
test("same request replay cannot allocate a second slot",async()=>{
 const store=serializedFakeD1(),args={subject,day,requestId:"request_replay_001",limit:3};
 const outcomes=await Promise.all([store.reserveAtomic(args),store.reserveAtomic(args)]);
 assert.equal(outcomes.filter(x=>x.reserved).length,1);
});
test("wrong subject and repeated grant consumption fail closed",async()=>{
 const store=serializedFakeD1(),requestId="request_grant_001",grantId="grant_example_001";
 assert.equal((await store.reserveAtomic({subject,day,requestId,limit:3})).reserved,true);
 assert.equal((await store.issue({subject,requestId,grantId})).issued,true);
 assert.equal((await store.consume({subject:"another_subject_001",requestId,grantId})).consumed,false);
 const results=await Promise.all([store.consume({subject,requestId,grantId}),store.consume({subject,requestId,grantId})]);
 assert.equal(results.filter(x=>x.consumed).length,1);
});
