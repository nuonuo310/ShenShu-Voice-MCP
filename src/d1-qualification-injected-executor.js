/** Bounded qualification engine: injected store only, never opens network or credentials. */
import {buildD1QualificationPlan} from "./d1-qualification-plan-only.js";
function createOfflineFakeStore(){
 const reservations=new Map(),grants=new Map(),slots=new Set();
 return {
  async reserveAtomic({subject,day,requestId,limit}){
   if(reservations.has(requestId))return {reserved:false};
   for(let slot=1;slot<=limit;slot++){
    const key=subject+":"+day+":"+slot;
    if(!slots.has(key)){slots.add(key);reservations.set(requestId,{subject,day,slot});return {reserved:true,slot}}
   }
   return {reserved:false};
  },
  async issue({grantId,requestId,subject}){
   const r=reservations.get(requestId);
   if(!r||r.subject!==subject||grants.has(grantId))return {issued:false};
   grants.set(grantId,{requestId,subject,consumed:false});return {issued:true};
  },
  async consume({grantId,requestId,subject}){
   const g=grants.get(grantId);
   if(!g||g.consumed||g.requestId!==requestId||g.subject!==subject)return {consumed:false};
   g.consumed=true;return {consumed:true};
  }
 };
}
export async function executeBoundedD1Qualification({plan,approved=false}={}){
 if(approved!==true||!plan||plan.mode!=="plan_only"||plan.writesEnabled!==false||plan.networkEnabled!==false||plan.paidVoiceEnabled!==false)throw Error("qualification_not_approved");
 // Revalidate every plan field: callers must not bypass the plan builder with a forged object.
 const checked=buildD1QualificationPlan({testPrincipal:plan.testPrincipal,day:plan.day,runId:plan.runId,attempts:plan.attempts,limit:plan.limit});
 if(!Array.isArray(plan.requests)||plan.requests.length!==checked.requests.length||plan.requests.some((id,i)=>id!==checked.requests[i]))throw Error("invalid_qualification_plan");
 const store=createOfflineFakeStore();
 // No automatic retries. Only one bounded batch of reservation attempts.
 const results=await Promise.allSettled(checked.requests.map(requestId=>store.reserveAtomic({subject:checked.testPrincipal,day:checked.day,requestId,limit:3})));
 if(results.some(r=>r.status!=="fulfilled"))throw Error("ambiguous_reservation_stop");
 const successful=results.map((r,i)=>({r:r.value,requestId:checked.requests[i]})).filter(x=>x.r?.reserved===true);
 if(successful.length>3||new Set(successful.map(x=>x.r.slot)).size!==successful.length||successful.some(x=>!Number.isInteger(x.r.slot)||x.r.slot<1||x.r.slot>3))throw Error("reservation_invariant_stop");
 // Do not issue grants on ambiguous responses or unexpected success counts.
 if(results.some(r=>r.value?.reserved!==true&&r.value?.reserved!==false))throw Error("ambiguous_reservation_stop");
 let grants=0;
 for(const {requestId} of successful){
  const grantId="drygrant_"+requestId.slice(7);
  const issued=await store.issue({grantId,requestId,subject:checked.testPrincipal});
  if(issued?.issued!==true)throw Error("grant_issue_stop");
  grants++;
  const consumed=await store.consume({grantId,requestId,subject:checked.testPrincipal});
  if(consumed?.consumed!==true)throw Error("grant_consume_stop");
 }
 return Object.freeze({attempted:checked.attempts,reserved:successful.length,grantsConsumed:grants,paidVoiceEnabled:false});
}
