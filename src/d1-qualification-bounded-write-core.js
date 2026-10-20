/** Candidate bounded D1 write core. Not exposed as CLI, MCP tool, or workflow. */
import {buildD1QualificationPlan} from "./d1-qualification-plan-only.js";
export async function runBoundedQualificationCore({plan,store}={}){
 if(!plan||!store||typeof store.reserveAtomic!=="function"||typeof store.issue!=="function"||typeof store.consume!=="function")throw Error("qualification_unavailable");
 const p=buildD1QualificationPlan({testPrincipal:plan.testPrincipal,day:plan.day,runId:plan.runId,attempts:plan.attempts,limit:plan.limit});
 if(!Array.isArray(plan.requests)||plan.requests.length!==p.requests.length||plan.requests.some((x,i)=>x!==p.requests[i]))throw Error("invalid_qualification_plan");
 // All 12 attempts are deliberately sent once. They cannot be cancelled after dispatch.
 const settled=await Promise.allSettled(p.requests.map(requestId=>store.reserveAtomic({subject:p.testPrincipal,day:p.day,requestId,limit:3})));
 if(settled.some(x=>x.status!=="fulfilled"))throw Error("reservation_ambiguous_stop");
 const accepted=[];const slots=new Set();
 for(let i=0;i<settled.length;i++){
  const r=settled[i].value;
  if(r?.reserved===false)continue;
  if(r?.reserved!==true||!Number.isSafeInteger(r.slot)||r.slot<1||r.slot>3||slots.has(r.slot))throw Error("reservation_invariant_stop");
  slots.add(r.slot);accepted.push(p.requests[i]);
 }
 if(accepted.length>3)throw Error("reservation_limit_stop");
 let consumed=0;
 for(const requestId of accepted){
  const grantId="drygrant_"+requestId.slice("dryreq_".length);
  if((await store.issue({grantId,requestId,subject:p.testPrincipal}))?.issued!==true)throw Error("grant_issue_stop");
  if((await store.consume({grantId,requestId,subject:p.testPrincipal}))?.consumed!==true)throw Error("grant_consume_stop");
  consumed++;
 }
 return Object.freeze({status:"completed_pending_readonly_postflight",attempts:p.requests.length,reserved:accepted.length,consumed,paidVoiceEnabled:false});
}
