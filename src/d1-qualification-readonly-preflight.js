/** Real D1 read-only preflight, never a write runner. Caller supplies query client. */
import {buildD1QualificationPlan} from "./d1-qualification-plan-only.js";
const SCHEMA_SQL="SELECT name,sql FROM sqlite_master WHERE type='table' AND name IN ('paid_voice_reservations','paid_voice_grants') ORDER BY name";
const COUNT_RES="SELECT COUNT(*) AS count FROM paid_voice_reservations WHERE principal = ?1 OR substr(request_id,1,?2) = ?3";
const COUNT_GRANT="SELECT COUNT(*) AS count FROM paid_voice_grants WHERE principal = ?1 OR substr(request_id,1,?2) = ?3";
export async function inspectD1QualificationReadOnly({plan,client}={}){
 if(!plan||!client||typeof client.query!=="function")throw Error("invalid_preflight");
 const checked=buildD1QualificationPlan({testPrincipal:plan.testPrincipal,day:plan.day,runId:plan.runId,attempts:plan.attempts,limit:plan.limit});
 if(!Array.isArray(plan.requests)||plan.requests.length!==checked.requests.length||plan.requests.some((x,i)=>x!==checked.requests[i]))throw Error("invalid_preflight");
 const prefix="dryreq_"+checked.runId+"_";
 // Fixed read-only SQL statements only. Never forward caller SQL to D1.
 const tables=await client.query(SCHEMA_SQL,[]);
 const byName=new Map(tables.map(row=>[row.name,row.sql]));
 const reservations=byName.get("paid_voice_reservations"),grants=byName.get("paid_voice_grants");
 if(typeof reservations!=="string"||typeof grants!=="string"||
 !/request_id\\s+TEXT\\s+PRIMARY KEY/i.test(reservations)||
 !/UNIQUE\\s*\\(\\s*principal\\s*,\\s*day_utc\\s*,\\s*slot\\s*\\)/i.test(reservations)||
 !/grant_id\\s+TEXT\\s+PRIMARY KEY/i.test(grants)||
 !/request_id\\s+TEXT\\s+NOT NULL\\s+UNIQUE/i.test(grants)||
 !/FOREIGN KEY\\s*\\(\\s*request_id\\s*\\)/i.test(grants))throw Error("schema_gate_failed");
 const fk=await client.query("PRAGMA foreign_keys",[]);
 if(fk.length!==1||fk[0].foreign_keys!==1)throw Error("foreign_keys_disabled");
 const violations=await client.query("PRAGMA foreign_key_check",[]);
 if(violations.length!==0)throw Error("foreign_key_violation");
 const args=[checked.testPrincipal,prefix.length,prefix];
 const r=await client.query(COUNT_RES,args),g=await client.query(COUNT_GRANT,args);
 if(r.length!==1||g.length!==1||!Number.isSafeInteger(r[0].count)||!Number.isSafeInteger(g[0].count)||r[0].count!==0||g[0].count!==0)throw Error("namespace_occupied");
 return Object.freeze({preflight:"pass",readOnly:true,writeAuthorized:false,principalCollisionCount:0,requestPrefixCollisionCount:0});
}
