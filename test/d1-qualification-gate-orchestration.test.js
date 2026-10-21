import test from "node:test";
import assert from "node:assert/strict";
import {buildD1QualificationPlan} from "../src/d1-qualification-plan-only.js";
import {exerciseQualificationGates} from "../src/d1-qualification-gate-orchestration.js";
const plan=buildD1QualificationPlan({testPrincipal:"dryrun_qualification_p2x_20261020_a",day:"2026-10-20",runId:"p2x20261020a"});
const schema=[{name:"paid_voice_grants",sql:"CREATE TABLE paid_voice_grants (grant_id TEXT PRIMARY KEY NOT NULL,request_id TEXT NOT NULL UNIQUE,FOREIGN KEY(request_id) REFERENCES paid_voice_reservations(request_id))"},{name:"paid_voice_reservations",sql:"CREATE TABLE paid_voice_reservations (request_id TEXT PRIMARY KEY NOT NULL,UNIQUE(principal,day_utc,slot))"}];
test("occupied preflight prevents all writes",async()=>{let writes=0;const readClient={async query(sql){if(sql.includes("sqlite_master"))return schema;if(sql==="PRAGMA foreign_keys")return [{foreign_keys:1}];if(sql==="PRAGMA foreign_key_check")return [];return [{count:1}]}};const store={reserveAtomic(){writes++},issue(){writes++},consume(){writes++}};await assert.rejects(exerciseQualificationGates({plan,readClient,store}),/namespace_occupied/);assert.equal(writes,0)});
test("missing gate refuses without any write",async()=>{let writes=0;await assert.rejects(exerciseQualificationGates({plan,store:{reserveAtomic(){writes++}}}),/qualification_gate_missing/);assert.equal(writes,0)});
