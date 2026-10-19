import {test} from "node:test";
import assert from "node:assert/strict";
import {exchangeAndVerifyGitHubUser} from "../src/github-oauth-exchange.js";
const uri="https://auth.example.invalid/callback";
const base={code:"test_code_12345",clientId:"test-client",clientSecret:"test-secret",redirectUri:uri,expectedRedirectUri:uri};
const response=x=>new Response(JSON.stringify(x),{status:200,headers:{"content-type":"application/json"}});
test("exact callback required before network",async()=>{
 let calls=0;
 await assert.rejects(()=>exchangeAndVerifyGitHubUser({...base,redirectUri:"https://evil.example.invalid/callback",fetchImpl:async()=>{calls++;}}),/github_oauth_not_configured/);
 assert.equal(calls,0);
});
test("successful exchange returns stable account ID only",async()=>{
 let n=0;
 const fetchImpl=async(url,req)=>{
  n++;
  if(n===1){assert.match(url,/access_token/);assert.equal(req.method,"POST");return response({access_token:"safe_test_token_1234567890",token_type:"bearer"});}
  assert.equal(url,"https://api.github.com/user");
  assert.equal(req.headers.Authorization,"Bearer safe_test_token_1234567890");
  return response({id:123456,login:"exampleuser"});
 };
 const result=await exchangeAndVerifyGitHubUser({...base,fetchImpl});
 assert.deepEqual(result,{subject:"github_id_123456",login:"exampleuser"});
 assert.equal(n,2);
});
test("oversize upstream exchange response fails before user lookup",async()=>{
 let calls=0;
 const fetchImpl=async()=>{calls++;return response({access_token:"A".repeat(17000),token_type:"bearer"});};
 await assert.rejects(()=>exchangeAndVerifyGitHubUser({...base,fetchImpl}),/github_oauth_failed/);
 assert.equal(calls,1);
});
test("unavailable account lookup fails closed",async()=>{
 let calls=0;
 const fetchImpl=async()=>{calls++;return calls===1?response({access_token:"safe_test_token_1234567890",token_type:"bearer"}):new Response("down",{status:503});};
 await assert.rejects(()=>exchangeAndVerifyGitHubUser({...base,fetchImpl}),/github_oauth_failed/);
 assert.equal(calls,2);
});
