import test from "node:test";
import assert from "node:assert/strict";
import {buildD1QualificationPlan} from "../src/d1-qualification-plan-only.js";
const good={testPrincipal:"dryrun_qualification_001",day:"2026-10-20",runId:"p2x_run_001"};
test("plan is bounded, nonexecuting and nonbillable",()=>{const p=buildD1QualificationPlan(good);assert.equal(p.mode,"plan_only");assert.equal(p.writesEnabled,false);assert.equal(p.networkEnabled,false);assert.equal(p.paidVoiceEnabled,false);assert.equal(p.requests.length,12);assert.equal(new Set(p.requests).size,12);assert.ok(p.readOnlySql.every(s=>/^(PRAGMA|SELECT)/.test(s)))});
test("reject non-test principal, invalid day, oversize run and excess attempts",()=>{for(const bad of [{testPrincipal:"paid_owner_001"},{day:"2026-02-30"},{attempts:13},{attempts:0},{limit:20},{runId:"!"}])assert.throws(()=>buildD1QualificationPlan({...good,...bad}),/invalid_qualification_plan/)});
