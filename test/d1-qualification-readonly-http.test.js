import test from "node:test";
import assert from "node:assert/strict";
import {createQualificationReadOnlyD1Http} from "../src/d1-qualification-readonly-http.js";
const env={CF_D1_ACCOUNT_ID:"a".repeat(32),CF_D1_DATABASE_ID:"123e4567-e89b-42d3-a456-426614174000",CF_D1_API_TOKEN:"fake_test_token_123456789012345"};
function fixture(){const calls=[];const fetchImpl=async(_url,opts)=>{calls.push(JSON.parse(opts.body));return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify({success:true,result:[{success:true,results:[]}]})}};return {calls,client:createQualificationReadOnlyD1Http({env,fetchImpl})}}
test("allowlisted read-only query can reach fake HTTP",async()=>{const f=fixture();await f.client.query("PRAGMA foreign_keys",[]);assert.equal(f.calls.length,1);assert.equal(f.calls[0].sql,"PRAGMA foreign_keys")});
test("write and arbitrary SQL rejected before network",async()=>{const f=fixture();for(const sql of ["INSERT INTO paid_voice_reservations VALUES(1)","SELECT * FROM paid_voice_grants","PRAGMA foreign_keys=OFF","DELETE FROM paid_voice_grants"])await assert.rejects(f.client.query(sql,[]),/readonly_sql_denied/);assert.equal(f.calls.length,0)});
test("unsafe or mismatched prefix parameters rejected",async()=>{const f=fixture();const sql="SELECT COUNT(*) AS count FROM paid_voice_reservations WHERE principal = ?1 OR substr(request_id,1,?2) = ?3";await assert.rejects(f.client.query(sql,["owner_001",20,"dryreq_p2x20261020a_"]),/readonly_params_denied/);assert.equal(f.calls.length,0)});
