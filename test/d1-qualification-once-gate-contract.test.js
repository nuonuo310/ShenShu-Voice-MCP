import test from "node:test";
import assert from "node:assert/strict";
import {claimQualificationOnce} from "../src/d1-qualification-once-gate-contract.js";
function fake(){const claimed=new Set();return {async claimOnce(runId){if(claimed.has(runId))return {claimed:false};claimed.add(runId);return {claimed:true,runId}}}}
test("only one of two concurrent callers claims the same run",async()=>{const gate=fake(),results=await Promise.all([claimQualificationOnce({runId:"p2x20261020a",gate}),claimQualificationOnce({runId:"p2x20261020a",gate})]);assert.equal(results.filter(x=>x.claimed).length,1);assert.equal(results.filter(x=>!x.claimed).length,1)});
test("repeat run remains denied",async()=>{const gate=fake();await claimQualificationOnce({runId:"p2x20261020a",gate});assert.deepEqual(await claimQualificationOnce({runId:"p2x20261020a",gate}),{claimed:false,reason:"already_claimed"})});
test("unknown run and ambiguous outcomes fail closed",async()=>{const gate=fake();await assert.rejects(claimQualificationOnce({runId:"another_run",gate}),/once_gate_invalid/);await assert.rejects(claimQualificationOnce({runId:"p2x20261020a",gate:{claimOnce:async()=>{throw Error("timeout")}}}),/timeout/);await assert.rejects(claimQualificationOnce({runId:"p2x20261020a",gate:{claimOnce:async()=>({claimed:true,runId:"other"})}}),/once_gate_ambiguous_stop/)});
