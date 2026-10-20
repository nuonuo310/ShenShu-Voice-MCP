import {test} from "node:test";
import assert from "node:assert/strict";
import {createDurablePaidAuthorizer} from "../src/durable-paid-admission.js";

function make(overrides={}) {
  const events=[];
  let issued=false,consumed=false;
  const grantStore={
    async issue(x){events.push(["issue",x]);if(issued)return {issued:false};issued=true;return {issued:true};},
    async consume(x){events.push(["consume",x]);if(consumed)return {consumed:false};consumed=true;return {consumed:true};}
  };
  const auth=createDurablePaidAuthorizer({
    resolveVerifiedPrincipal:async()=>({verified:true,subject:"owner_12345"}),
    reserveAtomic:async x=>{events.push(["reserve",x]);return {reserved:true};},
    grantStore,maximumDailyCalls:3,
    clock:()=>new Date("2026-10-20T12:00:00Z"),
    makeRequestId:()=>"request_123456",
    makeGrantId:()=>"grant_12345678",
    ...overrides
  });
  return {auth,events};
}
test("verified identity reserves, issues and consumes one-use grant in strict order",async()=>{
  const f=make();
  const result=await f.auth({trustedRequest:{},textBytes:24});
  assert.deepEqual(f.events.map(x=>x[0]),["reserve","issue","consume"]);
  assert.deepEqual(result,{allowed:true,principal:"owner_12345",oneTime:true,requestId:"request_123456"});
  assert.equal(JSON.stringify(result).includes("grant_"),false);
});
test("unauthenticated identity never reaches budget or grant store",async()=>{
  const f=make({resolveVerifiedPrincipal:async()=>({verified:false,subject:"owner_12345"})});
  await assert.rejects(()=>f.auth({trustedRequest:{},textBytes:4}),/not_authorized/);
  assert.deepEqual(f.events,[]);
});
test("budget refusal prevents grant issue and consumption",async()=>{
  const f=make({reserveAtomic:async x=>{f.events.push(["reserve",x]);return {reserved:false};}});
  await assert.rejects(()=>f.auth({trustedRequest:{},textBytes:4}),/budget_denied/);
  assert.deepEqual(f.events.map(x=>x[0]),["reserve"]);
});
test("issue or consume refusal prevents authorization and is never refunded",async()=>{
  let reserveCalls=0;
  const issue=createDurablePaidAuthorizer({
    resolveVerifiedPrincipal:async()=>({verified:true,subject:"owner_12345"}),
    reserveAtomic:async()=>{reserveCalls++;return {reserved:true};},
    grantStore:{issue:async()=>({issued:false}),consume:async()=>{throw Error("should_not_run");}},
    clock:()=>new Date("2026-10-20T00:00:00Z"),
    makeRequestId:()=>"request_123456",makeGrantId:()=>"grant_12345678"
  });
  await assert.rejects(()=>issue({trustedRequest:{},textBytes:4}),/grant_denied/);
  assert.equal(reserveCalls,1);

  const consume=createDurablePaidAuthorizer({
    resolveVerifiedPrincipal:async()=>({verified:true,subject:"owner_12345"}),
    reserveAtomic:async()=>({reserved:true}),
    grantStore:{issue:async()=>({issued:true}),consume:async()=>({consumed:false})},
    clock:()=>new Date("2026-10-20T00:00:00Z"),
    makeRequestId:()=>"request_123456",makeGrantId:()=>"grant_12345678"
  });
  await assert.rejects(()=>consume({trustedRequest:{},textBytes:4}),/grant_denied/);
});
