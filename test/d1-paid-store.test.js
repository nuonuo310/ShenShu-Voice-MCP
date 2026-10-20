import {test} from "node:test";
import assert from "node:assert/strict";
import {createD1PaidStore,D1_PAID_SQL} from "../src/d1-paid-store.js";

function fakeDb(handler) {
  const calls=[];
  return {
    calls,
    prepare(sql){
      return {bind(...params){
        calls.push({sql,params});
        return {first:()=>handler(sql,params)};
      }};
    }
  };
}
const reservation={subject:"owner_12345",day:"2026-10-20",requestId:"request_123456",limit:3};
const grant={grantId:"grant_12345678",requestId:"request_123456",subject:"owner_12345"};

test("D1 reservation allocates returned slot with one prepared statement",async()=>{
  const db=fakeDb(async(sql)=>sql===D1_PAID_SQL.reserve?{request_id:reservation.requestId,slot:2}:null);
  const store=createD1PaidStore({db});
  assert.deepEqual(await store.reserveAtomic(reservation),{reserved:true,slot:2});
  assert.equal(db.calls.length,1);
  assert.deepEqual(db.calls[0].params,[reservation.requestId,reservation.subject,reservation.day,3]);
});
test("duplicate/over-budget no RETURNING row fails closed",async()=>{
  const db=fakeDb(async()=>null);
  assert.deepEqual(await createD1PaidStore({db}).reserveAtomic(reservation),{reserved:false});
});
test("grant issue and consumption require matching returned IDs",async()=>{
  const db=fakeDb(async(sql)=>{
    if(sql===D1_PAID_SQL.issue)return {grant_id:grant.grantId};
    if(sql===D1_PAID_SQL.consume)return {grant_id:grant.grantId};
    return null;
  });
  const store=createD1PaidStore({db});
  assert.deepEqual(await store.issue(grant),{issued:true});
  assert.deepEqual(await store.consume(grant),{consumed:true});
  assert.equal(db.calls.length,2);
});
test("replayed grant consumption fails when UPDATE RETURNING is empty",async()=>{
  const db=fakeDb(async(sql)=>sql===D1_PAID_SQL.issue?{grant_id:grant.grantId}:null);
  const store=createD1PaidStore({db});
  assert.deepEqual(await store.issue(grant),{issued:true});
  assert.deepEqual(await store.consume(grant),{consumed:false});
});
test("D1 SQL encodes replay and slot collision protection",()=>{
  assert.match(D1_PAID_SQL.reserve,/INSERT OR IGNORE/);
  assert.match(D1_PAID_SQL.reserve,/UNIQUE|NOT EXISTS|existing\.slot/);
  assert.match(D1_PAID_SQL.reserve,/RETURNING request_id, slot/);
  assert.match(D1_PAID_SQL.consume,/state = 'issued'/);
  assert.match(D1_PAID_SQL.consume,/RETURNING grant_id/);
});
test("invalid inputs and D1 failure fail closed",async()=>{
  let touched=0;
  const db={prepare(){touched++;throw Error("boom");}};
  const store=createD1PaidStore({db});
  await assert.rejects(()=>store.reserveAtomic({...reservation,day:"2026-02-30"}),/invalid_reservation/);
  assert.equal(touched,0);
  await assert.rejects(()=>store.reserveAtomic(reservation),/budget_store_unavailable/);
  await assert.rejects(()=>store.issue({...grant,grantId:"x"}),/invalid_grant/);
});
