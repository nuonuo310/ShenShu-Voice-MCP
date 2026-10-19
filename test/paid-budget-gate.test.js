import { test } from "node:test";
import assert from "node:assert/strict";
import { PaidVoiceGate } from "../src/paid-budget-gate.js";

function fakeStore() {
  const entries = new Set();
  const usage = new Map();
  return async ({subject, day, requestId, limit}) => {
    const key=subject + ":" + day;
    if (entries.has(requestId) || (usage.get(key) ?? 0) >= limit) return {reserved:false};
    entries.add(requestId); usage.set(key, (usage.get(key)??0)+1);
    return {reserved:true};
  };
}
const make = (overrides={}) => new PaidVoiceGate({
  resolveVerifiedPrincipal: async () => ({verified:true,subject:"owner_12345"}),
  reserveAtomic: fakeStore(), maximumDailyCalls:2,
  clock:()=>new Date("2026-10-19T08:00:00Z"),
  ...overrides,
});
test("unauthenticated requests never reach budget storage",async()=>{
  let called=0;
  const gate=make({
    resolveVerifiedPrincipal:async()=>({verified:false,subject:"owner_12345"}),
    reserveAtomic:async()=>{called++;return {reserved:true};},
  });
  await assert.rejects(()=>gate.authorize({textBytes:12}),/not_authorized/);
  assert.equal(called,0);
});
test("three daily calls: only two admitted, over-budget denied",async()=>{
  let counter=0;
  const gate=make({makeRequestId:()=> "request_"+(++counter)});
  const results=await Promise.allSettled(Array.from({length:3},()=>gate.authorize({textBytes:12})));
  assert.equal(results.filter(x=>x.status==="fulfilled").length,2);
  assert.equal(results.filter(x=>x.status==="rejected").length,1);
  assert.match(results.find(x=>x.status==="rejected").reason.message,/budget_denied/);
});
test("duplicate request ID never creates a second grant",async()=>{
  const gate=make({makeRequestId:()=> "same_request_id"});
  await gate.authorize({textBytes:12});
  await assert.rejects(()=>gate.authorize({textBytes:12}),/budget_denied/);
});
test("missing durable reservation refuses instead of allowing synthesis",async()=>{
  const gate=make({reserveAtomic:async()=>{throw new Error("db_unavailable");}});
  await assert.rejects(()=>gate.authorize({textBytes:12}),/db_unavailable/);
});
test("over-size and invalid settings rejected",async()=>{
  const gate=make();
  await assert.rejects(()=>gate.authorize({textBytes:801}),/invalid_text_size/);
  assert.throws(()=>new PaidVoiceGate({resolveVerifiedPrincipal:()=>{},reserveAtomic:()=>{},maximumDailyCalls:0}),/invalid_budget/);
});
