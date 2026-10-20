import {test} from "node:test";
import assert from "node:assert/strict";
import {inspectAuth0Issuer} from "../src/auth0-discovery-check.js";
const domain="dev-test123.us.auth0.com";
const issuer="https://"+domain+"/";
function fixture(overrides={}) {
 const payload={issuer,authorization_endpoint:issuer+"authorize",
 token_endpoint:issuer+"oauth/token",jwks_uri:issuer+".well-known/jwks.json",
 response_types_supported:["code"],grant_types_supported:["authorization_code"],
 code_challenge_methods_supported:["S256"],
 token_endpoint_auth_methods_supported:["none","client_secret_post"],
 authorization_response_iss_parameter_supported:true,...overrides};
 return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(payload)};
}
test("looks up fixed issuer and checks OAuth metadata",async()=>{
 let called=0;
 const r=await inspectAuth0Issuer({domain,fetchImpl:async(url,opts)=>{
 called++;assert.equal(url,issuer+".well-known/openid-configuration");
 assert.equal(opts.redirect,"error");return fixture();
 }});
 assert.equal(called,1);assert.equal(r.issuer,issuer);
 assert.equal(r.pkceS256,true);assert.deepEqual(r.tokenAuthMethods,["none","client_secret_post"]);
});
test("refuses arbitrary URLs, issuer substitution and missing PKCE",async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;return fixture()};
 await assert.rejects(inspectAuth0Issuer({domain:"evil.example.com",fetchImpl}),/invalid_auth0_domain/);
 assert.equal(calls,0);
 await assert.rejects(inspectAuth0Issuer({domain,fetchImpl:async()=>fixture({issuer:"https://evil.example.com/"})}),/issuer_mismatch/);
 await assert.rejects(inspectAuth0Issuer({domain,fetchImpl:async()=>fixture({code_challenge_methods_supported:["plain"]})}),/pkce_s256_required/);
});
test("rejects non-200 response and too-large metadata",async()=>{
 await assert.rejects(inspectAuth0Issuer({domain,fetchImpl:async()=>({ok:false})}),/discovery_unavailable/);
 await assert.rejects(inspectAuth0Issuer({domain,fetchImpl:async()=>({ok:true,headers:{get:()=>null},text:async()=> "a".repeat(70000)})}),/discovery_oversized/);
});
