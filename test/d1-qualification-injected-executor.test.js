import test from "node:test";
import assert from "node:assert/strict";
import {buildD1QualificationPlan} from "../src/d1-qualification-plan-only.js";
import {executeBoundedD1Qualification} from "../src/d1-qualification-injected-executor.js";
const plan=()=>buildD1QualificationPlan({testPrincipal:"dryrun_qualification_p2x_20261020_a",day:"2026-10-20",runId:"p2x20261020a",attempts:12,limit:3});
test("requires explicit approval even for internal fake",async()=>{await assert.rejects(executeBoundedD1Qualification({plan:plan()}),/qualification_not_approved/)});
test("internal fake bounds results to 3 consumed grants",async()=>{const r=await executeBoundedD1Qualification({plan:plan(),approved:true});assert.deepEqual(r,{attempted:12,reserved:3,grantsConsumed:3,paidVoiceEnabled:false})});
test("forged plans rejected",async()=>{await assert.rejects(executeBoundedD1Qualification({plan:{...plan(),attempts:13},approved:true}),/invalid_qualification_plan/)});
test("external store injection cannot be used",async()=>{let touched=0;const store={reserveAtomic(){touched++;throw Error("real_store_called")}};const r=await executeBoundedD1Qualification({plan:plan(),approved:true,store});assert.equal(touched,0);assert.equal(r.reserved,3)});
