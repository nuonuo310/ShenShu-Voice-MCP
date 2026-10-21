/** Offline orchestration contract; no credentials, CLI, or live D1 access. */
import {buildD1QualificationPlan} from "./d1-qualification-plan-only.js";
import {inspectD1QualificationReadOnly} from "./d1-qualification-readonly-preflight.js";
import {runBoundedQualificationCore} from "./d1-qualification-bounded-write-core.js";
import {inspectD1QualificationPostflight} from "./d1-qualification-postflight-readonly.js";
export async function exerciseQualificationGates({plan,readClient,store}={}){
 if(!plan||!readClient||!store)throw Error("qualification_gate_missing");
 const p=buildD1QualificationPlan({testPrincipal:plan.testPrincipal,day:plan.day,runId:plan.runId,attempts:plan.attempts,limit:plan.limit});
 if(!Array.isArray(plan.requests)||plan.requests.length!==p.requests.length||plan.requests.some((x,i)=>x!==p.requests[i]))throw Error("qualification_plan_mismatch");
 const pre=await inspectD1QualificationReadOnly({plan:p,client:readClient});
 if(pre.preflight!=="pass"||pre.writeAuthorized!==false)throw Error("qualification_preflight_stop");
 const result=await runBoundedQualificationCore({plan:p,store});
 if(result.status!=="completed_pending_readonly_postflight"||result.reserved!==3||result.consumed!==3)throw Error("qualification_core_incomplete");
 const post=await inspectD1QualificationPostflight({plan:p,client:readClient});
 if(post.status!=="pass"||post.reservations!==3||post.consumedGrants!==3)throw Error("qualification_postflight_stop");
 return Object.freeze({status:"offline_orchestration_pass",paidVoiceEnabled:false});
}
