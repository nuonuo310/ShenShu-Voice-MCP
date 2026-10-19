import {test} from "node:test";
import assert from "node:assert/strict";
import {createPostgresReserveAtomic,POSTGRES_BUDGET_SQL} from "../src/postgres-budget-store.js";
const args={subject:"owner_12345",day:"2026-10-20",requestId:"request_123456",limit:3};
function db({duplicate=false,limit=false,fail=false}={}){
 const calls=[];let released=0;
 const client={async query(sql,params=[]){
   calls.push({sql,params});
   if(fail&&sql.includes("paid_voice_daily_usage"))throw Error("offline");
   if(sql.includes("INSERT INTO paid_voice_reservations"))return {rowCount:duplicate?0:1};
   if(sql.includes("INSERT INTO paid_voice_daily_usage"))return {rowCount:limit?0:1};
   return {rowCount:0};
 },release(){released++;}};
 return {pool:{connect:async()=>client},calls,get released(){return released}};
}
test("successful reservation atomically commits exactly once",async()=>{
 const f=db();assert.deepEqual(await createPostgresReserveAtomic({pool:f.pool})(args),{reserved:true});
 assert.deepEqual([f.calls[0].sql,f.calls.at(-1).sql],["BEGIN","COMMIT"]);assert.equal(f.calls.length,4);assert.equal(f.released,1);
});
test("duplicate request cannot increment",async()=>{
 const f=db({duplicate:true});assert.deepEqual(await createPostgresReserveAtomic({pool:f.pool})(args),{reserved:false});
 assert.equal(f.calls.length,3);assert.equal(f.calls.at(-1).sql,"ROLLBACK");assert.equal(f.released,1);
});
test("over budget rolls back the reservation as well",async()=>{
 const f=db({limit:true});assert.deepEqual(await createPostgresReserveAtomic({pool:f.pool})(args),{reserved:false});
 assert.equal(f.calls.at(-1).sql,"ROLLBACK");assert.equal(f.released,1);
});
test("DB failure fails closed and releases client",async()=>{
 const f=db({fail:true});await assert.rejects(()=>createPostgresReserveAtomic({pool:f.pool})(args),/budget_store_unavailable/);
 assert.equal(f.calls.at(-1).sql,"ROLLBACK");assert.equal(f.released,1);
});
test("invalid inputs refuse before DB I/O",async()=>{
 let count=0;const reserve=createPostgresReserveAtomic({pool:{connect:async()=>{count++;throw Error("unexpected");}}});
 for(const v of [{...args,day:"2026-02-30"},{...args,subject:"bad"},{...args,requestId:"x"},{...args,limit:21}])await assert.rejects(()=>reserve(v),/invalid_reservation/);
 assert.equal(count,0);
});
test("parameterized SQL enforces per-day max with conflict update",()=>{
 assert.match(POSTGRES_BUDGET_SQL.insertReservation,/ON CONFLICT \(request_id\) DO NOTHING/);
 assert.match(POSTGRES_BUDGET_SQL.incrementCount,/WHERE paid_voice_daily_usage.used < \$3/);
 assert.match(POSTGRES_BUDGET_SQL.incrementCount,/ON CONFLICT \(principal, day_utc\) DO UPDATE/);
});
