import {test} from "node:test";
import assert from "node:assert/strict";
import {createOAuthLoginState,STATE_TTL_SECONDS} from "../src/oauth-login-state.js";
const uri="https://auth.example.invalid/callback",now=1000;
function make(){
 const records=new Map();let sequence=0;
 const api=createOAuthLoginState({now:()=>now,random:()=>Buffer.alloc(32,++sequence).toString("base64url"),
  saveAtomic:async r=>{if(records.has(r.digest))return false;records.set(r.digest,r);return true;},
  consumeAtomic:async({digest})=>{const r=records.get(digest);records.delete(digest);return r;}});
 return api;
}
test("valid state generated and consumed once",async()=>{
 const gate=make();const s=await gate.start({redirectUri:uri});
 assert.equal(s.expiresAt,now+STATE_TTL_SECONDS);
 assert.deepEqual(await gate.consume({state:s.state,redirectUri:uri}),{accepted:true});
 await assert.rejects(()=>gate.consume({state:s.state,redirectUri:uri}),/invalid_oauth_state/);
});
test("redirect mismatch denies and consumes state",async()=>{
 const gate=make(),s=await gate.start({redirectUri:uri});
 await assert.rejects(()=>gate.consume({state:s.state,redirectUri:"https://evil.example.invalid/callback"}),/invalid_oauth_state/);
 await assert.rejects(()=>gate.consume({state:s.state,redirectUri:uri}),/invalid_oauth_state/);
});
test("reject malformed state and insecure callback",async()=>{
 const gate=make();
 await assert.rejects(()=>gate.start({redirectUri:"http://localhost/callback"}),/invalid_redirect_uri/);
 await assert.rejects(()=>gate.consume({state:"short",redirectUri:uri}),/invalid_oauth_state/);
});
test("missing durable store fails closed",()=>{
 assert.throws(()=>createOAuthLoginState({saveAtomic:()=>true}),/oauth_state_store_required/);
});
test("no login handler exposed on public fixture MCP",async()=>{
 const {readFile}=await import("node:fs/promises");
 const s=await readFile(new URL("../server.js",import.meta.url),"utf8");
 assert.doesNotMatch(s,/oauth-login-state|github\/callback|speak_shenshu/);
});
