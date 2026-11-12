import { test } from "node:test";
import assert from "node:assert/strict";
import { createD1ReserveAtomic,D1_RESERVE_SQL } from "../src/d1-budget-store.js";

const input={subject:"owner_12345",day:"2026-10-20",requestId:"request_123456",limit:3};
test("D1 adapter issues one parameterized atomic statement",async()=>{
 const calls=[];
 const db={prepare:(sql)=>{calls.push(["prepare",sql]);return {bind:(...args)=>{calls.push(["bind",args]);return {first:async()=>({request_id:input.requestId})};}};}};
 assert.deepEqual(await createD1ReserveAtomic({db})(input),{reserved:true});
 assert.equal(calls.filter(x=>x[0]==="prepare").length,1);
 assert.deepEqual(calls[1][1],[input.requestId,input.subject,input.day,input.limit]);
 assert.match(D1_RESERVE_SQL,/UNION ALL/);
 assert.match(D1_RESERVE_SQL,/ON CONFLICT DO NOTHING RETURNING request_id/);
});
test("no free slot or duplicate request fails closed",async()=>{
 const db={prepare:()=>({bind:()=>({first:async()=>null})})};
 assert.deepEqual(await createD1ReserveAtomic({db})(input),{reserved:false});
});
test("D1 quota/exhaustion or broken storage is a refusal",async()=>{
 const db={prepare:()=>({bind:()=>({first:async()=>{throw Error("D1_ERROR");}})})};
 await assert.rejects(()=>createD1ReserveAtomic({db})(input),/budget_store_unavailable/);
});
test("invalid day, principal and limits rejected without querying DB",async()=>{
 let called=0;const db={prepare:()=>{called++;throw Error("must_not_query");}};
 const f=createD1ReserveAtomic({db});
 for(const arg of [{...input,day:"2026-02-30"},{...input,subject:"x"},{...input,limit:21},{...input,requestId:"bad"}]){
   await assert.rejects(()=>f(arg),/invalid_reservation/);
 }
 assert.equal(called,0);
});
test("public MCP cannot import or expose paid D1 budget tool",async()=>{
 const {readFile}=await import("node:fs/promises");
 const server=await readFile(new URL("../server.js",import.meta.url),"utf8");
 assert.doesNotMatch(server,/d1-budget-store|speak_shenshu|MINIMAX_API_KEY/);
});
