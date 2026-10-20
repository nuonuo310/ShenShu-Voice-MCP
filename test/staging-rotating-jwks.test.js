import {test} from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,sign} from "node:crypto";
import {createStagingIdentityVerifier} from "../src/staging-authenticated-mcp.js";

const issuer="https://dev-nwr87q0tnrbjeapr.us.auth0.com/";
const audience="https://shenshu-voice-mcp.onrender.com/paid-mcp";
const pair=generateKeyPairSync("rsa",{modulusLength:2048});
const jwk={...pair.publicKey.export({format:"jwk"}),kid:"rotating-key",alg:"RS256",use:"sig"};
function token(scope="voice:speak"){
  const now=Math.floor(Date.now()/1000);
  const h=Buffer.from(JSON.stringify({alg:"RS256",typ:"JWT",kid:jwk.kid})).toString("base64url");
  const p=Buffer.from(JSON.stringify({iss:issuer,aud:audience,sub:"user-x",iat:now-10,exp:now+120,scope})).toString("base64url");
  const data=h+"."+p;
  return data+"."+sign("RSA-SHA256",Buffer.from(data),pair.privateKey).toString("base64url");
}
test("staging verifier can use rotating JWKS supplier and re-reads per verification",async()=>{
  let gets=0;
  const verifier=createStagingIdentityVerifier(
    {SHENSHU_AUTH_MCP_ENABLED:"1"},
    {issuer,audience,jwksCache:{get:async()=>{gets++;return {keys:[jwk]};}}}
  );
  assert.equal(typeof verifier,"function");
  const req={headers:{authorization:"Bearer "+token()}};
  assert.equal((await verifier(req)).verified,true);
  assert.equal((await verifier(req)).verified,true);
  assert.equal(gets,2);
});
test("staging verifier fails closed when rotating key fetch fails",async()=>{
  const verifier=createStagingIdentityVerifier(
    {SHENSHU_AUTH_MCP_ENABLED:"1"},
    {issuer,audience,jwksCache:{get:async()=>{throw Error("network");}}}
  );
  await assert.rejects(verifier({headers:{authorization:"Bearer "+token()}}));
});
test("static JWKS fallback is refused outside test env",()=>{
  const env={SHENSHU_AUTH_MCP_ENABLED:"1",SHENSHU_AUTH_PUBLIC_JWKS_JSON:JSON.stringify({keys:[jwk]})};
  assert.equal(createStagingIdentityVerifier(env,{issuer,audience}),null);
  assert.equal(typeof createStagingIdentityVerifier({...env,NODE_ENV:"test"},{issuer,audience}),"function");
});
