import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAuthorizationServerMetadata } from "../src/oauth-provider-discovery.js";
const issuer="https://auth.example.com";
const valid={
  issuer,
  authorization_endpoint:issuer+"/authorize",
  token_endpoint:issuer+"/oauth/token",
  jwks_uri:issuer+"/.well-known/jwks.json",
  response_types_supported:["code"],
  grant_types_supported:["authorization_code"],
  code_challenge_methods_supported:["S256"],
  registration_endpoint:issuer+"/register"
};
function verify(x=valid,expectedIssuer=issuer){
 return validateAuthorizationServerMetadata(x,{expectedIssuer});
}
test("accept operator-pinned HTTPS issuer with code+PKCE S256",()=>{
 const result=verify();assert.equal(result.issuer,issuer);
 assert.equal(result.pkceS256,true);
 assert.equal(result.supportsDynamicRegistration,true);
});
test("reject issuer substitution and insecure endpoints",()=>{
 assert.throws(()=>verify({...valid,issuer:"https://attacker.example"}),/issuer_mismatch/);
 assert.throws(()=>verify({...valid,token_endpoint:"http://auth.example.com/token"}),/invalid_authorization_server/);
 assert.throws(()=>verify({...valid,jwks_uri:"https://auth.example.com/keys?token=secret"}),/invalid_authorization_server/);
 assert.throws(()=>verify(valid,"http://auth.example.com"),/invalid_authorization_server/);
});
test("reject password/implicit only and missing PKCE S256",()=>{
 assert.throws(()=>verify({...valid,response_types_supported:["token"]}),/unsupported_authorization_flow/);
 assert.throws(()=>verify({...valid,grant_types_supported:["client_credentials"]}),/unsupported_authorization_flow/);
 assert.throws(()=>verify({...valid,code_challenge_methods_supported:["plain"]}),/pkce_s256_required/);
});
test("metadata validation never accepts client-supplied identity",()=>{
 const result=verify({...valid,subject:"someone",access_token:"forged"});
 assert.equal(Object.hasOwn(result,"subject"),false);
 assert.equal(Object.hasOwn(result,"access_token"),false);
});
