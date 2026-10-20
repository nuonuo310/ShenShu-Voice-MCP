import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAuthorizationServerMetadata } from "../src/oauth-provider-discovery.js";

// Public OIDC fields copied from user-provided Auth0 /.well-known/openid-configuration
// on 2026-10-20. No tokens or secrets. This is NOT an independent live fetch.
const issuer="https://dev-nwr87q0tnrbjeapr.us.auth0.com/";
const disclosed={
  issuer,
  authorization_endpoint:issuer+"authorize",
  token_endpoint:issuer+"oauth/token",
  jwks_uri:issuer+".well-known/jwks.json",
  response_types_supported:["code","token","id_token","code token"],
  code_challenge_methods_supported:["S256","plain"],
  grant_types_supported:["client_credentials","authorization_code","refresh_token","implicit"],
  token_endpoint_auth_methods_supported:["client_secret_basic","client_secret_post","private_key_jwt","none"],
  authorization_response_iss_parameter_supported:true,
  scopes_supported:["openid","profile","offline_access","email"]
};
test("user-supplied actual Auth0 discovery passes issuer, authorization code, S256 and JWKS shape",()=>{
 const result=validateAuthorizationServerMetadata(disclosed,{expectedIssuer:issuer});
 assert.equal(result.issuer,issuer);
 assert.equal(result.authorizationCode,true);
 assert.equal(result.pkceS256,true);
 assert.equal(result.supportsDynamicRegistration,false);
 assert.equal(result.advertisesClientIdMetadata,false);
});
test("discovery proves neither registration nor API authorization",()=>{
 assert.equal(Object.hasOwn(disclosed,"registration_endpoint"),false);
 assert.equal(Object.hasOwn(disclosed,"client_id_metadata_document_supported"),false);
 assert.equal(disclosed.scopes_supported.includes("voice:speak"),false);
 // API-specific scopes can exist independently of the OIDC discovery
 // scopes_supported list; this is NOT evidence that the API scope is missing.
});
