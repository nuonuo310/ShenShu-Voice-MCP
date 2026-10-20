/** Allowlisted read-only adapter for Cloudflare D1 HTTP. No arbitrary SQL accepted. */
import {createCloudflareD1Http} from "./cloudflare-d1-http.js";
const SCHEMA="SELECT name,sql FROM sqlite_master WHERE type='table' AND name IN ('paid_voice_reservations','paid_voice_grants') ORDER BY name";
const RES="SELECT COUNT(*) AS count FROM paid_voice_reservations WHERE principal = ?1 OR substr(request_id,1,?2) = ?3";
const GRANTS="SELECT COUNT(*) AS count FROM paid_voice_grants WHERE principal = ?1 OR substr(request_id,1,?2) = ?3";
const ALLOWED=new Set([SCHEMA,RES,GRANTS,"PRAGMA foreign_keys","PRAGMA foreign_key_check"]);
export function createQualificationReadOnlyD1Http({env,fetchImpl}={}){
 const raw=createCloudflareD1Http({env,fetchImpl});
 return Object.freeze({async query(sql,params=[]){
  if(!ALLOWED.has(sql)||!Array.isArray(params))throw Error("readonly_sql_denied");
  if(sql===RES||sql===GRANTS){
   if(params.length!==3||typeof params[0]!=="string"||!/^dryrun_qualification_[A-Za-z0-9_]+$/.test(params[0])||typeof params[2]!=="string"||!/^dryreq_[A-Za-z0-9_]+_$/.test(params[2])||params[1]!==params[2].length)throw Error("readonly_params_denied");
  }else if(params.length!==0)throw Error("readonly_params_denied");
  return raw.query(sql,params);
 }});
}
