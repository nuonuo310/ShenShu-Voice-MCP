import {test} from "node:test";
import assert from "node:assert/strict";
import {verifyPaidVoicePolicy,VOICE_GENERATE_SCOPE} from "../src/paid-identity-policy.js";
const nowSeconds=1792454400;
const opts={
  approvedSubject:"github_owner_12345",
  expectedIssuer:"https://auth.example.invalid",
  expectedAudience:"https://paid.example.invalid/mcp",
  nowSeconds
};
const identity={
  verified:true,
  source:"trusted_oauth_resource_middleware",
  subject:opts.approvedSubject,
  issuer:opts.expectedIssuer,
  audience:opts.expectedAudience,
  expiresAt:nowSeconds+600,
  scopes:[VOICE_GENERATE_SCOPE]
};
test("trusted owner context with correct audience and scope passes policy",()=>{
  assert.deepEqual(verifyPaidVoicePolicy({...opts,identity}),{subject:opts.approvedSubject,scope:VOICE_GENERATE_SCOPE});
});
test("unauthenticated, wrong identity and forged context are rejected",()=>{
  for(const x of [
    undefined,
    {...identity,verified:false},
    {...identity,source:"client_tool_arguments"},
    {...identity,subject:"github_other_12345"},
    {...identity,issuer:"https://evil.example.invalid"},
    {...identity,audience:"https://public.example.invalid/mcp"},
    {...identity,expiresAt:nowSeconds+5},
    {...identity,scopes:["voice:read"]},
    {...identity,scopes:"voice:generate"}
  ])assert.throws(()=>verifyPaidVoicePolicy({...opts,identity:x}),/not_authorized/);
});
test("missing owner, issuer or audience fail closed",()=>{
  for(const x of [
    {...opts,approvedSubject:""},
    {...opts,expectedIssuer:""},
    {...opts,expectedAudience:"http://example.invalid"}
  ])assert.throws(()=>verifyPaidVoicePolicy({...x,identity}),/identity_policy_not_configured/);
});
test("public MCP cannot import policy as a substitute for OAuth",async()=>{
  const {readFile}=await import("node:fs/promises");
  const s=await readFile(new URL("../server.js",import.meta.url),"utf8");
  assert.doesNotMatch(s,/paid-identity-policy|speak_shenshu|MINIMAX_API_KEY/);
});
