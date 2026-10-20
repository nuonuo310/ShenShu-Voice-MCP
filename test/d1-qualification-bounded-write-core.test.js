import test from "node:test";
import assert from "node:assert/strict";
import {buildD1QualificationPlan} from "../src/d1-qualification-plan-only.js";
import {runBoundedQualificationCore} from "../src/d1-qualification-bounded-write-core.js";
const plan=buildD1QualificationPlan({testPrincipal:"dryrun_qualification_p2x_20261020_a",day:"2026-10-20",runId:"p2x20261020a"});
function fake({failure}={}){const calls=[];let slot=0;return {calls,async reserveAtomic(x){calls.push(["reserve",x]);if(failure==="timeout")throw Error("timeout");if(failure==="badslot")return {reserved:true,slot:1};if(slot>=3)return {reserved:false};return {reserved:true,slot:++slot}},async issue(x){calls.push(["issue",x]);return {issued:failure!=="issue"}},async consume(x){calls.push(["consume",x]);return {consumed:failure!=="consume"}}}}
test("exactly 12 reservation attempts, 3 grants, no retries",async()=>{const s=fake(),r=await runBoundedQualificationCore({plan,store:s});assert.equal(r.attempts,12);assert.equal(r.reserved,3);assert.equal(r.consumed,3);assert.equal(s.calls.filter(x=>x[0]==="reserve").length,12);assert.equal(s.calls.filter(x=>x[0]==="issue").length,3);assert.equal(s.calls.filter(x=>x[0]==="consume").length,3)});
test("ambiguous reservations never issue grants",async()=>{const s=fake({failure:"timeout"});await assert.rejects(runBoundedQualificationCore({plan,store:s}),/reservation_ambiguous_stop/);assert.equal(s.calls.filter(x=>x[0]==="issue").length,0)});
test("duplicate slots stop before grants",async()=>{const s=fake({failure:"badslot"});await assert.rejects(runBoundedQualificationCore({plan,store:s}),/reservation_invariant_stop/);assert.equal(s.calls.filter(x=>x[0]==="issue").length,0)});
test("grant failure stops without retries",async()=>{for(const failure of ["issue","consume"]){const s=fake({failure});await assert.rejects(runBoundedQualificationCore({plan,store:s}));assert.equal(s.calls.filter(x=>x[0]==="issue").length,1)}});

test("contradictory denied reservation with slot fails closed",async()=>{let grants=0;const s={reserveAtomic:async()=>({reserved:false,slot:1}),issue:async()=>{grants++;return {issued:true}},consume:async()=>({consumed:true})};await assert.rejects(runBoundedQualificationCore({plan,store:s}),/reservation_invariant_stop/);assert.equal(grants,0)});
