import {test} from "node:test";
import assert from "node:assert/strict";
import {createD1HttpPaidStore} from "../src/d1-http-paid-store.js";
import {D1_PAID_SQL} from "../src/d1-paid-store.js";
test("HTTP paid store maps D1 RETURNING rows into reservation/grant contract",async()=>{
 const calls=[];const client={async query(sql,params){
  calls.push({sql,params});
  if(sql===D1_PAID_SQL.reserve)return [{request_id:"request_123456",slot:1}];
  if(sql===D1_PAID_SQL.issue)return [{grant_id:"grant_12345678"}];
  if(sql===D1_PAID_SQL.consume)return [{grant_id:"grant_12345678"}];
  throw Error("unexpected");
 }};
 const s=createD1HttpPaidStore({client});
 assert.deepEqual(await s.reserveAtomic({subject:"owner_12345",day:"2026-10-20",requestId:"request_123456",limit:3}),{reserved:true,slot:1});
 assert.deepEqual(await s.issue({grantId:"grant_12345678",requestId:"request_123456",subject:"owner_12345"}),{issued:true});
 assert.deepEqual(await s.consume({grantId:"grant_12345678",requestId:"request_123456",subject:"owner_12345"}),{consumed:true});
 assert.equal(calls.length,3);
});
test("empty D1 result means quota/grant refusal, never implicit success",async()=>{
 const s=createD1HttpPaidStore({client:{query:async()=>[]}});
 assert.deepEqual(await s.reserveAtomic({subject:"owner_12345",day:"2026-10-20",requestId:"request_123456",limit:3}),{reserved:false});
 assert.deepEqual(await s.issue({grantId:"grant_12345678",requestId:"request_123456",subject:"owner_12345"}),{issued:false});
 assert.deepEqual(await s.consume({grantId:"grant_12345678",requestId:"request_123456",subject:"owner_12345"}),{consumed:false});
});
test("malformed, non-array or multi-row D1 results are ambiguous and fail closed",async()=>{
 const args={subject:"owner_12345",day:"2026-10-20",requestId:"request_123456",limit:3};
 const grant={grantId:"grant_12345678",requestId:"request_123456",subject:"owner_12345"};
 const badResults=[null,{request_id:"request_123456",slot:1},[{request_id:"request_123456",slot:1},{request_id:"request_123456",slot:2}]];
 for(const result of badResults){
  const s=createD1HttpPaidStore({client:{query:async()=>result}});
  await assert.rejects(()=>s.reserveAtomic(args),/d1_result_invalid/);
 }
 const wrongRows=[
  [D1_PAID_SQL.reserve,{request_id:"another_request",slot:1},"reserveAtomic"],
  [D1_PAID_SQL.reserve,{request_id:"request_123456",slot:0},"reserveAtomic"],
  [D1_PAID_SQL.issue,{grant_id:"another_grant"},"issue"],
  [D1_PAID_SQL.consume,{grant_id:"another_grant"},"consume"],
 ];
 for(const [expectedSql,row,method] of wrongRows){
  const s=createD1HttpPaidStore({client:{query:async(sql)=>{assert.equal(sql,expectedSql);return [row];}}});
  await assert.rejects(()=>s[method](method==="reserveAtomic"?args:grant),/d1_result_invalid/);
 }
});
test("D1 transport errors propagate once and are never retried",async()=>{
 let calls=0;
 const s=createD1HttpPaidStore({client:{query:async()=>{calls++;throw Error("d1_unavailable");}}});
 await assert.rejects(()=>s.reserveAtomic({subject:"owner_12345",day:"2026-10-20",requestId:"request_123456",limit:3}),/d1_unavailable/);
 assert.equal(calls,1);
});
