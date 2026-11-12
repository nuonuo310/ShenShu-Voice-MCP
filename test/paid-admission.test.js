import {test} from "node:test";
import assert from "node:assert/strict";
import {createPaidAdmission} from "../src/paid-admission.js";
const now=new Date("2026-10-20T08:00:00Z");
const issuer="https://auth.example.invalid",audience="https://paid.example.invalid/mcp",subject="github_owner_12345";
const identity={verified:true,source:"trusted_oauth_resource_middleware",issuer,audience,
 subject,expiresAt:Math.floor(now.getTime()/1000)+600,scopes:["voice:generate"]};
function harness({token="authorized",result={request_id:"request_123456"}}={}){
 let verified=0,queried=0;
 const db={prepare(){queried++;return {bind(){return {first:async()=>result}}}}};
 const admit=createPaidAdmission({verifyToken:t=>{verified++;if(t!=="authorized")throw Error("not_authorized");return identity;},
  db,approvedSubject:subject,expectedIssuer:issuer,expectedAudience:audience,clock:()=>now,
  makeRequestId:()=>"request_123456"});
 return {admit,counts:()=>({verified,queried}),token};
}
test("verified owner gets one atomic reservation",async()=>{
 const h=harness();
 const result=await h.admit({trustedBearer:h.token,text:"糯糯，哥哥在。"});
 assert.equal(result.admitted,true);assert.equal(result.subject,subject);
 assert.deepEqual(h.counts(),{verified:1,queried:1});
});
test("invalid bearer rejected before D1",async()=>{
 const h=harness({token:"invalid"});
 await assert.rejects(()=>h.admit({trustedBearer:h.token,text:"糯糯"}),/not_authorized/);
 assert.equal(h.counts().queried,0);
});
test("no bearer rejected before verifier or D1",async()=>{
 const h=harness();
 await assert.rejects(()=>h.admit({trustedBearer:"",text:"糯糯"}),/not_authorized/);
 assert.deepEqual(h.counts(),{verified:0,queried:0});
});
test("exhausted reservation never admits",async()=>{
 const h=harness({result:null});
 await assert.rejects(()=>h.admit({trustedBearer:"authorized",text:"糯糯"}),/budget_denied/);
});
test("paid admission remains absent from public tools",async()=>{
 const {readFile}=await import("node:fs/promises");
 const s=await readFile(new URL("../server.js",import.meta.url),"utf8");
 assert.doesNotMatch(s,/paid-admission|speak_shenshu|MINIMAX_API_KEY/);
});
