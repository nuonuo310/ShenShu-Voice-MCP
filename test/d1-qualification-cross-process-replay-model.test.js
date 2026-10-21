import test from "node:test";
import assert from "node:assert/strict";
import {createScopedQualificationWriteStore} from "../src/d1-qualification-scoped-write-store.js";
import {D1_PAID_SQL} from "../src/d1-paid-store.js";
const subject="dryrun_qualification_p2x_20261020_a",day="2026-10-20",requestId="dryreq_p2x20261020a_01";
function durableFake(){const reservations=new Set(),grants=new Map(),calls=[];return {calls,client:{async query(sql,args){calls.push(sql);
 if(sql===D1_PAID_SQL.reserve){const id=args[0];if(reservations.has(id))return [];reservations.add(id);return [{request_id:id,slot:1}]}
 if(sql===D1_PAID_SQL.issue){const [id,request,owner]=args;if(!reservations.has(request)||grants.has(id))return [];grants.set(id,{request,owner,state:"issued"});return [{grant_id:id}]}
 if(sql===D1_PAID_SQL.consume){const [id,request,owner]=args,g=grants.get(id);if(!g||g.request!==request||g.owner!==owner||g.state!=="issued")return [];g.state="consumed";return [{grant_id:id}]}
 throw Error("unexpected_sql");
 }}}}
test("second process cannot re-reserve the same durable request",async()=>{const d=durableFake(),a=createScopedQualificationWriteStore({client:d.client}),b=createScopedQualificationWriteStore({client:d.client});const args={subject,day,requestId,limit:3};assert.equal((await a.reserveAtomic(args)).reserved,true);assert.equal((await b.reserveAtomic(args)).reserved,false)});
test("durable issue/consume reject replay across distinct instances",async()=>{const d=durableFake(),a=createScopedQualificationWriteStore({client:d.client}),b=createScopedQualificationWriteStore({client:d.client});const grantId="drygrant_p2x20261020a_01";await a.reserveAtomic({subject,day,requestId,limit:3});assert.equal((await a.issue({subject,requestId,grantId})).issued,true);assert.equal((await b.issue({subject,requestId,grantId})).issued,false);assert.equal((await a.consume({subject,requestId,grantId})).consumed,true);await b.reserveAtomic({subject,day,requestId,limit:3});await assert.rejects(b.consume({subject,requestId,grantId}),/qualification_consume_replay_denied/)});
