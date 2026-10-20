import {test} from "node:test";
import assert from "node:assert/strict";
import {createD1AdmissionDryRun} from "../src/d1-admission-dry-run.js";

const baseEnv={
 SHENSHU_D1_ADMISSION_DRY_RUN_ENABLED:"1",
 CF_D1_ACCOUNT_ID:"0123456789abcdef0123456789abcdef",
 CF_D1_DATABASE_ID:"123e4567-e89b-12d3-a456-426614174000",
 CF_D1_API_TOKEN:"token_abcdefghijklmnopqrstuvwxyz123456"
};
function response(results) {
 return {
  ok:true,
  headers:{get:()=>null},
  text:async()=>JSON.stringify({success:true,result:[{success:true,results}]})
 };
}
test("dry-run uses isolated principal namespace and consumes one-use grant",async()=>{
 const calls=[];let step=0;
 const fetchImpl=async(url,opts)=>{
   calls.push({url,body:JSON.parse(opts.body)});
   step++;
   if(step===1)return response([{request_id:"dryreq_aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaa",slot:1}]);
   if(step===2)return response([{grant_id:"drygrant_bbbbbbbbbbbb4bbb8bbbbbbbbbbbbbbb"}]);
   if(step===3)return response([{grant_id:"drygrant_bbbbbbbbbbbb4bbb8bbbbbbbbbbbbbbb"}]);
   return response([]);
 };
 const run=createD1AdmissionDryRun({
  env:baseEnv,
  clock:()=>new Date("2026-10-20T12:00:00Z"),
  idFactory:(()=>{let n=0;return()=>n++===0?"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";})(),
  fetchImpl
 });
 const result=await run({verifiedSubject:"owner_12345"});
 assert.deepEqual(result,{admission_verified:true,paid_voice_enabled:false,real_quota_consumed:false});
 assert.equal(calls.length,3);
 const reserve=calls[0].body;
 assert.equal(reserve.params[1],"dryrun_owner_12345");
 assert.equal(reserve.params[2],"2026-10-20");
 assert.equal(reserve.params[3],20);
});
test("dry-run disabled by default and refuses invalid subject",async()=>{
 assert.equal(createD1AdmissionDryRun({env:{}}),null);
 const run=createD1AdmissionDryRun({env:baseEnv,fetchImpl:async()=>response([])});
 await assert.rejects(()=>run({verifiedSubject:"bad"}),/not_authorized/);
});
