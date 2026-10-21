/** Allowlisted read-only adapter for Cloudflare D1 HTTP. No arbitrary SQL accepted. */
import {createCloudflareD1Http} from "./cloudflare-d1-http.js";
const SCHEMA="SELECT name,sql FROM sqlite_master WHERE type='table' AND name IN ('paid_voice_reservations','paid_voice_grants') ORDER BY name";
const RES="SELECT COUNT(*) AS count FROM paid_voice_reservations WHERE principal = ?1 OR substr(request_id,1,?2) = ?3";
const GRANTS="SELECT COUNT(*) AS count FROM paid_voice_grants WHERE principal = ?1 OR substr(request_id,1,?2) = ?3";
const POST_RES="SELECT request_id,slot FROM paid_voice_reservations WHERE principal=?1 AND day_utc=?2 AND substr(request_id,1,?3)=?4 ORDER BY slot,request_id";
const POST_GRANTS="SELECT g.grant_id,g.request_id,g.state,g.principal FROM paid_voice_grants g WHERE substr(g.request_id,1,?1)=?2 ORDER BY g.request_id";
const ALLOWED=new Set([SCHEMA,RES,GRANTS,POST_RES,POST_GRANTS,"PRAGMA foreign_keys","PRAGMA foreign_key_check"]);
export function createQualificationReadOnlyD1Http({env,fetchImpl}={}){
 const raw=createCloudflareD1Http({env,fetchImpl});
 return Object.freeze({async query(sql,params=[]){
  if(!ALLOWED.has(sql)||!Array.isArray(params))throw Error("readonly_sql_denied");
  if(sql===RES||sql===GRANTS){
   if(params.length!==3||typeof params[0]!=="string"||!/^dryrun_qualification_[A-Za-z0-9_]+$/.test(params[0])||typeof params[2]!=="string"||!/^dryreq_[A-Za-z0-9_]+_$/.test(params[2])||params[1]!==params[2].length)throw Error("readonly_params_denied");
  }else if(sql===POST_RES){
   if(params.length!==4||params[0]!=="dryrun_qualification_p2x_20261020_a"||params[1]!=="2026-10-20"||params[2]!==20||params[3]!=="dryreq_p2x20261020a_")throw Error("readonly_params_denied");
  }else if(sql===POST_GRANTS){
   if(params.length!==2||params[0]!==20||params[1]!=="dryreq_p2x20261020a_")throw Error("readonly_params_denied");
  }else if(params.length!==0)throw Error("readonly_params_denied");
  return raw.query(sql,params);
 }});
}
