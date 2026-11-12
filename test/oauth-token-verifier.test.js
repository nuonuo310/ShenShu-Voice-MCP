import {test} from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,sign} from "node:crypto";
import {createPinnedRs256Verifier} from "../src/oauth-token-verifier.js";
import {verifyPaidVoicePolicy} from "../src/paid-identity-policy.js";
const {privateKey,publicKey}=generateKeyPairSync("rsa",{modulusLength:2048});
const pub={...publicKey.export({format:"jwk"}),kid:"trusted_key_01",alg:"RS256",use:"sig"};
const now=1792454400, issuer="https://auth.example.invalid",audience="https://paid.example.invalid/mcp";
const sub="github_owner_12345";
const verify=createPinnedRs256Verifier({issuer,audience,publicJwks:[pub],allowedSubjects:[sub],clock:()=>now});
function token(payload={},header={}){
 const h={typ:"JWT",alg:"RS256",kid:pub.kid,...header};
 const p={iss:issuer,aud:audience,sub,iat:now-10,exp:now+600,scope:"voice:generate",...payload};
 const part=x=>Buffer.from(JSON.stringify(x)).toString("base64url");
 const input=part(h)+"."+part(p);
 return input+"."+sign("RSA-SHA256",Buffer.from(input),privateKey).toString("base64url");
}
test("signed authorized owner passes signature and policy",()=>{
 const verified=verify(token());
 assert.equal(verified.subject,sub);
 assert.equal(verifyPaidVoicePolicy({identity:verified,approvedSubject:sub,expectedIssuer:issuer,expectedAudience:audience,nowSeconds:now}).subject,sub);
});
test("tampered JWT signature or unknown kid is denied",()=>{
 const good=token(), parts=good.split(".");
 const tampered=parts[0]+"."+Buffer.from(JSON.stringify({sub:"github_evil_12345"})).toString("base64url")+"."+parts[2];
 assert.throws(()=>verify(tampered),/not_authorized/);
 assert.throws(()=>verify(token({}, {kid:"unknown_key_01"})),/not_authorized/);
});
test("wrong issuer audience sub scope and expired tokens denied",()=>{
 for(const p of [{iss:"https://evil.invalid"},{aud:"https://public.invalid"},{sub:"github_other_12345"},
  {scope:"voice:read"},{exp:now-1},{iat:now+70},{nbf:now+1}])
  assert.throws(()=>verify(token(p)),/not_authorized/);
});
test("untrusted algorithm/header and malformed tokens denied",()=>{
 for(const t of [token({}, {alg:"none"}),token({}, {jku:"https://evil.invalid/key"}),
  "malformed","a.b.c", "", "x".repeat(8193)])assert.throws(()=>verify(t),/not_authorized/);
});
test("misconfigured verifier fails closed",()=>{
 assert.throws(()=>createPinnedRs256Verifier({issuer,audience,publicJwks:[],allowedSubjects:[sub]}),/auth_not_configured/);
 assert.throws(()=>createPinnedRs256Verifier({issuer,audience,publicJwks:[{...pub,d:"private"}],allowedSubjects:[sub]}),/auth_not_configured/);
});
test("public demo does not load token verifier",async()=>{
 const {readFile}=await import("node:fs/promises");
 const s=await readFile(new URL("../server.js",import.meta.url),"utf8");
 assert.doesNotMatch(s,/oauth-token-verifier|speak_shenshu|MINIMAX_API_KEY/);
});
