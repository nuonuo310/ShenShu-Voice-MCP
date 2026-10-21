/** Fixed-query, read-only postflight verifier. No D1 writes or credentials. */
import {buildD1QualificationPlan} from "./d1-qualification-plan-only.js";
const RES="SELECT request_id,slot FROM paid_voice_reservations WHERE principal=?1 AND day_utc=?2 AND substr(request_id,1,?3)=?4 ORDER BY slot,request_id";
const GRANTS="SELECT g.grant_id,g.request_id,g.state,g.principal FROM paid_voice_grants g WHERE substr(g.request_id,1,?1)=?2 ORDER BY g.request_id";
export async function inspectD1QualificationPostflight({plan,client}={}){
 if(!plan||!client||typeof client.query!=="function")throw Error("invalid_postflight");
 const p=buildD1QualificationPlan({testPrincipal:plan.testPrincipal,day:plan.day,runId:plan.runId,attempts:plan.attempts,limit:plan.limit});
 if(!Array.isArray(plan.requests)||plan.requests.length!==p.requests.length||plan.requests.some((id,i)=>id!==p.requests[i]))throw Error("invalid_postflight");
 const prefix="dryreq_"+p.runId+"_";
 const reservations=await client.query(RES,[p.testPrincipal,p.day,prefix.length,prefix]);
 const grants=await client.query(GRANTS,[prefix.length,prefix]);
 if(!Array.isArray(reservations)||!Array.isArray(grants))throw Error("postflight_invalid_rows");
 if(reservations.length>3||grants.length>3)throw Error("postflight_limit_violation");
 const ids=new Set(),slots=new Set();
 for(const row of reservations){
  if(!p.requests.includes(row?.request_id)||ids.has(row.request_id)||!Number.isSafeInteger(row.slot)||row.slot<1||row.slot>3||slots.has(row.slot))throw Error("postflight_reservation_violation");
  ids.add(row.request_id);slots.add(row.slot);
 }
 const grantRequests=new Set();
 for(const row of grants){
  if(typeof row?.grant_id!=="string"||row.principal!==p.testPrincipal||!ids.has(row.request_id)||grantRequests.has(row.request_id)||row.state!=="consumed")throw Error("postflight_grant_violation");
  grantRequests.add(row.request_id);
 }
 if(ids.size!==grantRequests.size)throw Error("postflight_incomplete");
 if(ids.size!==3||grantRequests.size!==3)throw Error("postflight_insufficient_evidence");
 return Object.freeze({status:"pass",readOnly:true,reservations:ids.size,consumedGrants:grantRequests.size,paidVoiceEnabled:false});
}
