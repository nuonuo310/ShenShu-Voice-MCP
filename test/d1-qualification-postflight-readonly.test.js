import test from "node:test";
import assert from "node:assert/strict";
import {buildD1QualificationPlan} from "../src/d1-qualification-plan-only.js";
import {inspectD1QualificationPostflight} from "../src/d1-qualification-postflight-readonly.js";
const plan=buildD1QualificationPlan({testPrincipal:"dryrun_qualification_p2x_20261020_a",day:"2026-10-20",runId:"p2x20261020a"});
const reservations=plan.requests.slice(0,3).map((request_id,i)=>({request_id,slot:i+1}));
const grants=reservations.map(({request_id},i)=>({grant_id:"drygrant_"+i,request_id,principal:plan.testPrincipal,state:"consumed"}));
function fake(r=reservations,g=grants){const calls=[];return {calls,async query(sql,args){calls.push({sql,args});return calls.length===1?r:g}}}
test("postflight confirms exactly 3 unique consumed grants using SELECT only",async()=>{const c=fake(),r=await inspectD1QualificationPostflight({plan,client:c});assert.equal(r.reservations,3);assert.equal(r.consumedGrants,3);assert.ok(c.calls.every(x=>x.sql.startsWith("SELECT")))});
test("over-limit and duplicate slots stop",async()=>{await assert.rejects(inspectD1QualificationPostflight({plan,client:fake([...reservations,...reservations.slice(0,1)],grants)}),/postflight_limit_violation/);await assert.rejects(inspectD1QualificationPostflight({plan,client:fake([{...reservations[0]},{...reservations[1],slot:1}],grants.slice(0,2))}),/postflight_reservation_violation/)});
test("unconsumed and wrong-subject grants stop",async()=>{await assert.rejects(inspectD1QualificationPostflight({plan,client:fake(reservations,grants.map(x=>({...x,state:"issued"})))}),/postflight_grant_violation/);await assert.rejects(inspectD1QualificationPostflight({plan,client:fake(reservations,grants.map(x=>({...x,principal:"wrong_subject"})))}),/postflight_grant_violation/)});
test("no rows is a valid empty snapshot, not concurrency PASS",async()=>{const r=await inspectD1QualificationPostflight({plan,client:fake([],[])});assert.equal(r.reservations,0);assert.equal(r.consumedGrants,0)});

test("postflight queries grants across all principals to detect misattribution",async()=>{const c=fake(reservations,grants);await inspectD1QualificationPostflight({plan,client:c});assert.deepEqual(c.calls[1].args,[20,"dryreq_p2x20261020a_"]);assert.doesNotMatch(c.calls[1].sql,/WHERE g\.principal/)});
