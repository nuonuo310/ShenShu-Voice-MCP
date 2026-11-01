/**
 * Bounded staging one-shot probe, entirely offline.
 * Real HTTP route + signed browser session + fake durable D1 atomic lock +
 * fake Kodo PUT/GET. No MiniMax, Cloudflare, provider or paid D1 admission.
 */
process.env.NODE_ENV = "test";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { Readable } from "node:stream";
import { makeInlineToneFixture } from "../src/inline-fixture.js";
import { PRIVATE_PLAYER_SESSION_COOKIE } from "../src/private-web-player.js";
import { STAGING_RESOURCE_ORIGIN } from "../src/protected-resource-identity.js";
import {
  KODO_RENDER_PROBE_PATH,
  KODO_RENDER_PROBE_LOCK_ID,
  KODO_RENDER_PROBE_MAX_OBJECT_BYTES,
  createV1KodoRenderOneShotProbe,
} from "../src/v1-kodo-render-one-shot-probe.js";
const { createShenShuHttpServer, createShenShuRuntimeServer } = await import("../server.js");

const SHA = "e".repeat(40);
const APPROVAL = "KodoOnce" + "z".repeat(40);
const SESSION_SECRET = "one-shot-kodo-player-session-secret-abcdef1234567890";
const MASTER = Buffer.from(Array.from({length:32},(_,i)=>i+35));
const PRINCIPAL = createHash("sha256").update("signed-session-owner").digest("base64url");
const NOW = Date.parse("2026-11-01T18:00:00.000Z");
const ORIGIN = STAGING_RESOURCE_ORIGIN;
const BUCKET = "shenshu-test-private-bucket";

function env(overrides={}) {
  return {
    NODE_ENV:"test",
    SHENSHU_STAGING_RESOURCE_MODE:"1",
    SHENSHU_STAGING_ORIGIN: ORIGIN,
    SHENSHU_PLAYER_ENABLED:"1",
    SHENSHU_PLAYER_AUTH0_CLIENT_ID:"b".repeat(32),
    SHENSHU_PLAYER_SESSION_SECRET:SESSION_SECRET,
    SHENSHU_KODO_RENDER_PROBE_ENABLED:"1",
    SHENSHU_KODO_RENDER_PROBE_APPROVED_SHA:SHA,
    SHENSHU_KODO_RENDER_PROBE_APPROVAL_TOKEN:APPROVAL,
    SHENSHU_KODO_RENDER_PROBE_START_AT:"2026-11-01T17:59:00.000Z",
    SHENSHU_KODO_RENDER_PROBE_END_AT:"2026-11-01T18:10:00.000Z",
    SHENSHU_STAGING_FINAL_WIRING_ENABLED:"0",
    SHENSHU_STAGING_PAID_CONFIRM_ENABLED:"0",
    SHENSHU_STAGING_REAL_PROVIDER_ENABLED:"0",
    SHENSHU_STAGING_PRIVATE_AUDIO_ENABLED:"0",
    SHENSHU_KODO_MASTER_KEY_BASE64:MASTER.toString("base64"),
    SHENSHU_KODO_BUCKET:BUCKET,
    SHENSHU_KODO_ACCESS_KEY_ID:"fake-kodo-access-key",
    SHENSHU_KODO_SECRET_ACCESS_KEY:"fake-kodo-secret-key-0123456789",
    ...overrides,
  };
}
function cookie() {
  const payload = "v1." + Math.floor((NOW+600_000)/1000) + "." + PRINCIPAL;
  const mac = createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return PRIVATE_PLAYER_SESSION_COOKIE+"="+payload+"."+mac;
}
class AtomicLock {
  constructor(){this.claimed=false;this.calls=[];}
  async query(sql,params=[]) {
    this.calls.push({sql,params});
    assert.match(sql, /^INSERT INTO shenshu_kodo_render_single_probe_locks/);
    assert.deepEqual(params[0], KODO_RENDER_PROBE_LOCK_ID);
    if(this.claimed)return [];
    this.claimed=true;
    return [{probe_id:KODO_RENDER_PROBE_LOCK_ID}];
  }
}
class FakeKodo {
  constructor(){this.calls=[];this.object=null;this.fail=null;}
  async send(command) {
    const name=command.constructor.name;
    this.calls.push(name);
    if(this.fail===name)throw new Error("fake_live_egress_unknown");
    if(name==="PutObjectCommand") {
      const input=command.input;
      this.object = {
        key: input.Key,
        body: Buffer.from(input.Body),
        metadata: {...input.Metadata},
      };
      return {ETag:'"fixture"'};
    }
    if(name==="GetObjectCommand") {
      if(!this.object||this.object.key!==command.input.Key)
        throw Object.assign(new Error("not found"),{name:"NoSuchKey"});
      return {
        Body:Readable.from([this.object.body]),
        ContentLength:this.object.body.length,
        Metadata:{...this.object.metadata},
      };
    }
    throw Error("forbidden_fake_command_"+name);
  }
}
async function serverFor({config=env(),lock=new AtomicLock(),kodo=new FakeKodo(),clock=()=>new Date(NOW)}={}) {
  const probe=createV1KodoRenderOneShotProbe({
    env:config,currentSha:SHA,d1Client:lock,s3Client:kodo,clock,
  });
  const server=createShenShuHttpServer({env:config,kodoProbe:probe});
  await new Promise((resolve,reject)=>{
    server.once("error",reject);
    server.listen(0,"127.0.0.1",resolve);
  });
  const base="http://127.0.0.1:"+server.address().port;
  return {
    base,probe,lock,kodo,
    async close(){
      server.closeAllConnections?.();
      await new Promise(resolve=>server.close(resolve));
    },
  };
}
async function hit(world,{method="GET",authenticated=true,origin=ORIGIN,secret=APPROVAL}={}){
  const headers={};
  if(authenticated)headers.cookie=cookie();
  if(method==="POST"){
    headers["content-type"]="application/x-www-form-urlencoded";
    if(origin!==null)headers.origin=origin;
    headers["sec-fetch-site"]="same-origin";
  }
  return fetch(world.base+KODO_RENDER_PROBE_PATH,{
    method,headers,body:method==="POST"?
      new URLSearchParams({approval:secret}).toString():undefined,
    signal:AbortSignal.timeout(4000),
  });
}
test("probe stays invisible unless every independent paid-OFF, SHA, mode and token gate passes",async()=>{
  assert.equal(createV1KodoRenderOneShotProbe({
    env:env({SHENSHU_KODO_RENDER_PROBE_ENABLED:"0"}),currentSha:SHA,
  }),null);
  for(const override of [
    {SHENSHU_KODO_RENDER_PROBE_APPROVED_SHA:"f".repeat(40)},
    {SHENSHU_STAGING_FINAL_WIRING_ENABLED:"1"},
    {SHENSHU_STAGING_REAL_PROVIDER_ENABLED:"1"},
    {SHENSHU_STAGING_PAID_CONFIRM_ENABLED:"1"},
    {SHENSHU_STAGING_PRIVATE_AUDIO_ENABLED:"1"},
    {SHENSHU_KODO_RENDER_PROBE_APPROVAL_TOKEN:"short"},
    {SHENSHU_KODO_MASTER_KEY_BASE64:"bad"},
    {SHENSHU_STAGING_RESOURCE_MODE:"0"},
    {SHENSHU_KODO_RENDER_PROBE_START_AT:"2026-11-01T00:00:00.000Z"},
    {SHENSHU_KODO_RENDER_PROBE_END_AT:"2026-11-01T19:00:00.000Z"},
  ]){
    const probe=createV1KodoRenderOneShotProbe({
      env:env(override),currentSha:SHA,
    });
    assert.equal(probe,null,JSON.stringify(Object.keys(override)));
  }
});
test("normal production cannot spoof approved Render SHA from caller parameters",async()=>{
  const conf=env({
    NODE_ENV:"production",
    RENDER_GIT_COMMIT:"f".repeat(40),
  });
  assert.equal(createV1KodoRenderOneShotProbe({
    env:conf,currentSha:SHA,
  }),null);
  assert.equal(createV1KodoRenderOneShotProbe({
    env:{...conf,RENDER_GIT_COMMIT:SHA},
    currentSha:SHA,
  }),null);
  const good=createV1KodoRenderOneShotProbe({
    env:{...conf,RENDER_GIT_COMMIT:SHA},
    d1Client:new AtomicLock(),s3Client:new FakeKodo(),
    clock:()=>new Date(NOW),
  });
  assert.equal(typeof good.handleRequest,"function");
});
test("absent route and startup do not consume D1, Kodo or paid provider quota",async()=>{
  const world=await serverFor({config:env({SHENSHU_KODO_RENDER_PROBE_ENABLED:"0"})});
  try{
    const r=await hit(world,{method:"POST"});
    assert.equal(r.status,404);
    assert.equal(world.lock.calls.length,0);
    assert.equal(world.kodo.calls.length,0);
  }finally{await world.close();}
  // Normal startup should not construct any live probe when the flag is OFF.
  const runtime=await createShenShuRuntimeServer({
    env:env({SHENSHU_KODO_RENDER_PROBE_ENABLED:"0"}),
    d1Client:{query:async()=>{throw Error("D1 should never be contacted");}},
    s3Client:{send:async()=>{throw Error("Kodo should never be contacted");}},
    fetchImpl:async()=>{throw Error("Provider should never be contacted");},
    currentSha:SHA,
    clock:()=>new Date(NOW),
  });
  assert.equal(runtime.kodoProbeMounted,false);
  runtime.server.close();
});
test("owner login plus exact Origin and password required before the permanent D1 lock",async()=>{
  const world=await serverFor();
  try {
    assert.equal((await hit(world,{authenticated:false})).status,401);
    const page=await hit(world);
    assert.equal(page.status,200);
    assert.match(await page.text(),/执行唯一一次非 MiniMax 验证/);
    assert.equal((await hit(world,{method:"POST",origin:null})).status,403);
    assert.equal((await hit(world,{method:"POST",origin:"https://evil.example"})).status,403);
    assert.equal((await hit(world,{method:"POST",secret:"z".repeat(40)})).status,403);
    assert.equal((await hit(world,{method:"POST",authenticated:false})).status,401);
    assert.equal(world.lock.calls.length,0);
    assert.equal(world.kodo.calls.length,0);
  } finally {await world.close();}
});
test("one owner POST makes one D1 claim, one encrypted PUT, one GET and then replay locks",async()=>{
  const world=await serverFor();
  try {
    const result=await hit(world,{method:"POST"});
    assert.equal(result.status,200);
    // The response is JSON only and never contains token, private owner or WAV.
    const status=await result.json();
    assert.deepEqual(status,{code:"private_roundtrip_verified"});
    assert.equal(world.lock.calls.length,1);
    assert.equal(world.lock.claimed,true);
    assert.deepEqual(world.kodo.calls,["PutObjectCommand","GetObjectCommand"]);
    assert.ok(world.kodo.object.body.length<KODO_RENDER_PROBE_MAX_OBJECT_BYTES);
    assert.equal(world.kodo.object.body.includes(Buffer.from(PRINCIPAL)),false);
    assert.equal(world.kodo.object.body.includes(Buffer.from(makeInlineToneFixture().audioBase64,"base64")),false);
    assert.equal((await hit(world,{method:"POST"})).status,409);
    assert.deepEqual(world.kodo.calls,["PutObjectCommand","GetObjectCommand"]);
    assert.equal(world.lock.calls.length,2);
  } finally {await world.close();}
});
test("simultaneous double confirmation remains one global PUT and GET",async()=>{
  const lock=new AtomicLock(),kodo=new FakeKodo();
  const world=await serverFor({lock,kodo});
  try{
    const results=await Promise.all([
      hit(world,{method:"POST"}),
      hit(world,{method:"POST"}),
    ]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
    assert.equal(kodo.calls.filter(x=>x==="PutObjectCommand").length,1);
    assert.equal(kodo.calls.filter(x=>x==="GetObjectCommand").length,1);
  }finally{await world.close();}
});
test("Kodo PUT or GET error permanently consumes lock; no subsequent cloud request",async()=>{
  for(const failure of ["PutObjectCommand","GetObjectCommand"]){
    const lock=new AtomicLock(),kodo=new FakeKodo();
    kodo.fail=failure;
    const world=await serverFor({lock,kodo});
    try{
      const first=await hit(world,{method:"POST"});
      assert.equal(first.status,503);
      assert.deepEqual(await first.json(),{code:"probe_outcome_unknown"});
      assert.equal(lock.claimed,true);
      assert.equal((await hit(world,{method:"POST"})).status,409);
      assert.equal(kodo.calls.filter(x=>x==="PutObjectCommand").length,1);
      assert.equal(kodo.calls.filter(x=>x==="GetObjectCommand").length,
        failure==="PutObjectCommand"?0:1);
    }finally{await world.close();}
  }
});
test("expired 15-minute window rejects owner before D1 or Kodo",async()=>{
  const world=await serverFor({clock:()=>new Date(NOW+60*60*1000)});
  try{
    const r=await hit(world,{method:"POST"});
    assert.equal(r.status,410);
    assert.equal(world.lock.calls.length,0);
    assert.equal(world.kodo.calls.length,0);
  }finally{await world.close();}
});
