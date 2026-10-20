import {test} from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {generateKeyPairSync,sign} from "node:crypto";

const {publicKey,privateKey}=generateKeyPairSync("rsa",{modulusLength:2048});
const issuer="https://dev-nwr87q0tnrbjeapr.us.auth0.com/";
const audience="https://shenshu-voice-mcp.onrender.com/paid-mcp";
const key={...publicKey.export({format:"jwk"}),alg:"RS256",use:"sig",kid:"stage-key1"};
const port=18881;
const base="http://127.0.0.1:"+port;
function token({scope="voice:speak",iss=issuer,aud=audience,expiry=300}={}) {
  const now=Math.floor(Date.now()/1000);
  const h=Buffer.from(JSON.stringify({alg:"RS256",typ:"JWT",kid:key.kid})).toString("base64url");
  const p=Buffer.from(JSON.stringify({iss,aud,sub:"fixture-user",scope,
    iat:now-10,exp:now+expiry})).toString("base64url");
  const message=h+"."+p;
  return message+"."+sign("RSA-SHA256",Buffer.from(message),privateKey).toString("base64url");
}
async function post(method,id,auth) {
  return fetch(base+"/paid-mcp",{
    method:"POST",
    headers:{"content-type":"application/json","accept":"application/json, text/event-stream",
      ...(auth?{authorization:"Bearer "+auth}:{})},
    body:JSON.stringify({jsonrpc:"2.0",id,method,
      params:method==="initialize"?{
        protocolVersion:"2025-06-18",capabilities:{},
        clientInfo:{name:"test-auth-client",version:"1.0"}
      }:{}})
  });
}
test("P2M protected MCP: RSA identity, scope and audience gates; no paid tool",async()=>{
  const child=spawn(process.execPath,["server.js"],{
    env:{...process.env,PORT:String(port),SHENSHU_AUTH_MCP_ENABLED:"1",SHENSHU_AUTH_STATIC_JWKS_TEST_ONLY:"1",
      SHENSHU_AUTH_PUBLIC_JWKS_JSON:JSON.stringify({keys:[key]})},
    stdio:["ignore","pipe","pipe"]
  });
  let logs="";child.stdout.on("data",d=>logs+=d.toString());
  child.stderr.on("data",d=>logs+=d.toString());
  try {
    let ready=false;
    for(let i=0;i<55;i++){
      if(child.exitCode!==null)throw Error("server exited "+logs);
      try{const r=await fetch(base+"/");if(r.status===200){ready=true;break;}}catch{}
      await new Promise(done=>setTimeout(done,100));
    }
    assert.ok(ready,"server not ready "+logs);
    const missing=await post("initialize",1,null);
    assert.equal(missing.status,401);
    const fake=await post("initialize",2,"fake.jwt.signature");
    assert.equal(fake.status,401);
    const wrongAudience=await post("initialize",3,token({aud:"https://elsewhere.example"}));
    assert.equal(wrongAudience.status,401);
    const wrongScope=await post("initialize",4,token({scope:"openid"}));
    assert.equal(wrongScope.status,403);
    const expired=await post("initialize",5,token({expiry:-1}));
    assert.equal(expired.status,401);
    const good=token();
    const initialized=await post("initialize",6,good);
    assert.equal(initialized.status,200,await initialized.text().catch(()=>"(body unavailable)"));
    // A new request is independently verified, no session token bypass.
    const list=await post("tools/list",7,good);
    assert.equal(list.status,200);
    const body=await list.json();
    const names=body.result?.tools?.map(x=>x.name)||[];
    assert.deepEqual(names,["verify_shenshu_login"]);
    const unauthList=await post("tools/list",8,null);
    assert.equal(unauthList.status,401);
    const invoke=await fetch(base+"/paid-mcp",{
      method:"POST",
      headers:{"content-type":"application/json",
        accept:"application/json, text/event-stream",
        authorization:"Bearer "+good},
      body:JSON.stringify({jsonrpc:"2.0",id:9,method:"tools/call",
        params:{name:"verify_shenshu_login",arguments:{}}})
    });
    assert.equal(invoke.status,200);
    const result=await invoke.json();
    assert.equal(result.result?.structuredContent?.paid_voice_enabled,false);
    assert.equal("principal" in result.result.structuredContent,false);
  } finally {child.kill("SIGTERM");}
});
