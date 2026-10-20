/** P2X read-only planning only. Never imports a D1 client or performs network I/O. */
import {randomUUID} from "node:crypto";
const ID=/^[A-Za-z0-9_-]{8,128}$/;
export function buildD1QualificationPlan({testPrincipal,day,runId=randomUUID().replaceAll("-",""),attempts=12,limit=3}={}){
 if(!ID.test(testPrincipal??"")||!testPrincipal.startsWith("dryrun_")||!/^\d{4}-\d{2}-\d{2}$/.test(day??"")||!ID.test(runId??"")||!Number.isSafeInteger(attempts)||attempts<1||attempts>12||limit!==3)throw Error("invalid_qualification_plan");
 const parsed=new Date(day+"T00:00:00.000Z");if(Number.isNaN(parsed.valueOf())||parsed.toISOString().slice(0,10)!==day)throw Error("invalid_qualification_plan");
 const requests=Array.from({length:attempts},(_,i)=>"dryreq_"+runId+"_"+String(i+1).padStart(2,"0"));
 if(requests.some(id=>!ID.test(id)))throw Error("invalid_qualification_plan");
 return Object.freeze({mode:"plan_only",writesEnabled:false,networkEnabled:false,paidVoiceEnabled:false,
  testPrincipal,day,attempts,limit,requests:Object.freeze(requests),
  readOnlySql:Object.freeze([
   "PRAGMA foreign_keys;",
   "PRAGMA foreign_key_check;",
   "SELECT type,name,tbl_name,sql FROM sqlite_master WHERE tbl_name IN ('paid_voice_reservations','paid_voice_grants') ORDER BY tbl_name,type,name;"
  ])
 });
}
