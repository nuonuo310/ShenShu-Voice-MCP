import test from "node:test";
import assert from "node:assert/strict";
import {buildD1QualificationPlan} from "../src/d1-qualification-plan-only.js";
import {inspectD1QualificationReadOnly} from "../src/d1-qualification-readonly-preflight.js";
const plan=buildD1QualificationPlan({testPrincipal:"dryrun_qualification_p2x_20261020_a",day:"2026-10-20",runId:"p2x20261020a"});
const schema=[{name:"paid_voice_grants",sql:"CREATE TABLE paid_voice_grants (grant_id TEXT PRIMARY KEY NOT NULL,request_id TEXT NOT NULL UNIQUE,FOREIGN KEY(request_id) REFERENCES paid_voice_reservations(request_id))"},{name:"paid_voice_reservations",sql:"CREATE TABLE paid_voice_reservations (request_id TEXT PRIMARY KEY NOT NULL, UNIQUE(principal,day_utc,slot))"}];
function client({occupied=false,foreignKeys=1}={}){const calls=[];return {calls,async query(sql,args){calls.push({sql,args});if(sql.includes("sqlite_master"))return schema;if(sql==="PRAGMA foreign_keys")return [{foreign_keys:foreignKeys}];if(sql==="PRAGMA foreign_key_check")return [];return [{count:occupied?1:0}]}}}
test("read-only preflight uses only fixed SELECT/PRAGMA and exact 20-char prefix",async()=>{const c=client();const result=await inspectD1QualificationReadOnly({plan,client:c});assert.equal(result.preflight,"pass");assert.equal(c.calls.length,5);assert.ok(c.calls.every(x=>/^(SELECT|PRAGMA)/.test(x.sql)));assert.deepEqual(c.calls[3].args,[plan.testPrincipal,20,"dryreq_p2x20261020a_"])});
test("occupied namespace and foreign key disablement stop",async()=>{await assert.rejects(inspectD1QualificationReadOnly({plan,client:client({occupied:true})}),/namespace_occupied/);await assert.rejects(inspectD1QualificationReadOnly({plan,client:client({foreignKeys:0})}),/foreign_keys_disabled/)});
test("forged plan cannot pass preflight",async()=>{const c=client();await assert.rejects(inspectD1QualificationReadOnly({plan:{...plan,attempts:13},client:c}),/invalid_qualification_plan/);assert.equal(c.calls.length,0)});
