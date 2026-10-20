import {test} from "node:test";
import assert from "node:assert/strict";
import {createProtectedResourceMetadata,unauthorizedChallenge} from "../src/oauth-resource-metadata.js";
const params={
  resource:"https://shenshu-voice-mcp.onrender.com/paid-mcp",
  authorizationServers:["https://auth.example.com"],
};
test("build standards-shaped operator configured protected resource metadata",()=>{
  const meta=createProtectedResourceMetadata(params);
  assert.deepEqual(meta.authorization_servers,["https://auth.example.com"]);
  assert.equal(meta.resource,params.resource);
  assert.deepEqual(meta.scopes_supported,["voice:speak"]);
  assert.deepEqual(meta.bearer_methods_supported,["header"]);
  assert.ok(Object.isFrozen(meta));
});
test("reject missing issuer, insecure origins and duplicate trust anchors",()=>{
  for(const wrong of [
    {...params,authorizationServers:[]},
    {...params,authorizationServers:["http://auth.example.com"]},
    {...params,authorizationServers:["https://auth.example.com","https://auth.example.com"]},
    {...params,resource:"http://localhost:8080/paid-mcp"},
    {...params,scopes:["voice:speak","voice:speak"]},
  ]) assert.throws(()=>createProtectedResourceMetadata(wrong),/invalid_resource_metadata/);
});
test("401 challenge points at resource metadata, no auth grants issued",()=>{
  const challenge=unauthorizedChallenge({resourceMetadataUrl:"https://shenshu-voice-mcp.onrender.com/.well-known/oauth-protected-resource/paid-mcp"});
  assert.equal(challenge.status,401);
  assert.match(challenge.headers["WWW-Authenticate"],/resource_metadata=/);
  assert.equal(challenge.headers["Cache-Control"],"no-store");
  assert.throws(()=>unauthorizedChallenge({resourceMetadataUrl:"http://example.com/x"}));
});
