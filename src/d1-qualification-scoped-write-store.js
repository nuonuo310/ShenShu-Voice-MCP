/** Qualification-only D1 write adapter. Not wired to live credentials or routes. */
import {D1_PAID_SQL} from "./d1-paid-store.js";
const PRINCIPAL="dryrun_qualification_p2x_20261020_a";
const DAY="2026-10-20";
const PREFIX="dryreq_p2x20261020a_";
const ID=/^[A-Za-z0-9_-]{8,128}$/;
export function createScopedQualificationWriteStore({client}={}){
 if(!client||typeof client.query!=="function")throw Error("missing_qualification_client");
 const requestIds=new Set(Array.from({length:12},(_,i)=>PREFIX+String(i+1).padStart(2,"0")));
 const validRequest=x=>requestIds.has(x);
 return Object.freeze({
  async reserveAtomic({subject,day,requestId,limit}={}){
   if(subject!==PRINCIPAL||day!==DAY||limit!==3||!validRequest(requestId))throw Error("qualification_scope_denied");
   if(attempted.has(requestId))throw Error("qualification_replay_denied");
   attempted.add(requestId); // Mark before network, including timeout; never retry.
   const rows=await client.query(D1_PAID_SQL.reserve,[requestId,subject,day,3]);
   const row=rows?.[0];
   if(!row)return {reserved:false};
   if(row.request_id!==requestId||!Number.isSafeInteger(row.slot)||row.slot<1||row.slot>3)throw Error("qualification_result_invalid");
   return {reserved:true,slot:row.slot};
  },
  async issue({grantId,requestId,subject}={}){
   if(subject!==PRINCIPAL||!validRequest(requestId)||grantId!=="drygrant_"+requestId.slice(7)||!ID.test(grantId))throw Error("qualification_scope_denied");
   if(!attempted.has(requestId)||issued.has(requestId)||issued.size>=3)throw Error("qualification_grant_limit_denied");
   issued.add(requestId); // Mark before network; uncertain results cannot be retried.
   const rows=await client.query(D1_PAID_SQL.issue,[grantId,requestId,subject]);
   if(rows?.length>1)throw Error("qualification_result_invalid");
   return {issued:rows?.[0]?.grant_id===grantId};
  },
  async consume({grantId,requestId,subject}={}){
   if(subject!==PRINCIPAL||!validRequest(requestId)||grantId!=="drygrant_"+requestId.slice(7)||!ID.test(grantId))throw Error("qualification_scope_denied");
   if(!issued.has(requestId)||consumed.has(requestId))throw Error("qualification_consume_replay_denied");
   consumed.add(requestId);
   const rows=await client.query(D1_PAID_SQL.consume,[grantId,requestId,subject]);
   if(rows?.length>1)throw Error("qualification_result_invalid");
   return {consumed:rows?.[0]?.grant_id===grantId};
  }
 });
}
