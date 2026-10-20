import test from "node:test";
import assert from "node:assert/strict";
import {createScopedQualificationWriteStore} from "../src/d1-qualification-scoped-write-store.js";
import {D1_PAID_SQL} from "../src/d1-paid-store.js";
const subject="dryrun_qualification_p2x_20261020_a",day="2026-10-20",requestId="dryreq_p2x20261020a_01";
function fake(){const calls=[];return {calls,client:{async query(sql,args){calls.push({sql,args});if(sql===D1_PAID_SQL.reserve)return [{request_id:requestId,slot:1}];return [{grant_id:"drygrant_p2x20261020a_01"}]}}}}
test("valid isolated reservation and grant use only fixed SQL",async()=>{const f=fake(),s=createScopedQualificationWriteStore({client:f.client});assert.equal((await s.reserveAtomic({subject,day,requestId,limit:3})).reserved,true);const grantId="drygrant_p2x20261020a_01";assert.equal((await s.issue({subject,requestId,grantId})).issued,true);assert.equal((await s.consume({subject,requestId,grantId})).consumed,true);assert.deepEqual(f.calls.map(x=>x.sql),[D1_PAID_SQL.reserve,D1_PAID_SQL.issue,D1_PAID_SQL.consume])});
test("wrong identity/day/limit/request/grant rejected before any query",async()=>{const f=fake(),s=createScopedQualificationWriteStore({client:f.client});for(const bad of [{subject:"real_user_001"},{day:"2026-10-21"},{limit:20},{requestId:"dryreq_p2x20261020a_13"}])await assert.rejects(s.reserveAtomic({...{subject,day,requestId,limit:3},...bad}),/qualification_scope_denied/);await assert.rejects(s.issue({subject,requestId,grantId:"grant_real_001"}),/qualification_scope_denied/);assert.equal(f.calls.length,0)});
