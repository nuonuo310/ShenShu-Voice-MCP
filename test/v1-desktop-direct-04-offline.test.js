import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {makeInlineToneFixture} from "../src/inline-fixture.js";
import {prepareGeneratedWebAudioBridge} from "../src/generated-audio-playback-contract.js";
import {V1_FIXED_VOICE_ID} from "../src/v1-p2-controlled-staging-candidate.js";
import {
  createDesktopDirect04Offline,
  DESKTOP_04_VOICE_ID,
  DESKTOP_04_MODEL_ID,
} from "../src/v1-desktop-direct-04-offline.js";

const PRINCIPAL="p".repeat(43);
const HANDLE="h".repeat(43);
const REQUEST_ID="bounded-request-unique-001";
const ORIGINAL="爱爱，今天也想和你说说话。";
const WAV=Buffer.from(makeInlineToneFixture().audioBase64,"base64");

function harness({
  resolveVerifiedPrincipal=async req=>{
    if(req?.authenticated!==true)throw Error("not_authorized");
    return {verified:true,principal:PRINCIPAL};
  },
  consumeConfirmedOneUseGrant,
  synthesize,
}={}){
  const events=[];
  const claimed=new Set();
  const grantConsumer=consumeConfirmedOneUseGrant??(async args=>{
    events.push("consume");
    assert.equal(args.principal,PRINCIPAL);
    assert.equal(args.handle,HANDLE);
    assert.equal(args.textBytes,Buffer.byteLength(ORIGINAL,"utf8"));
    assert.match(args.textDigest,/^[A-Za-z0-9_-]{43}$/);
    if(claimed.has(args.handle))return {allowed:false};
    claimed.add(args.handle);
    return {allowed:true,oneTime:true,consumed:true,principal:args.principal,requestId:args.requestId};
  });
  const provider=synthesize??(async args=>{
    events.push("provider");
    assert.deepEqual(args,{
      text:ORIGINAL,modelId:"speech-2.8-hd",voiceId:DESKTOP_04_VOICE_ID
    });
    return {audio:Buffer.from(WAV)};
  });
  const invoke=createDesktopDirect04Offline({
    resolveVerifiedPrincipal,
    consumeConfirmedOneUseGrant:grantConsumer,
    synthesize:provider,
    makeRequestId:()=>REQUEST_ID,
  });
  return {invoke,events,claimed};
}
const request=()=>({trustedRequest:{authenticated:true},handle:HANDLE,text:ORIGINAL});

test("the frozen 04 voice ID and model are identical to original controlled staging",()=>{
  assert.equal(DESKTOP_04_VOICE_ID,V1_FIXED_VOICE_ID);
  assert.equal(DESKTOP_04_MODEL_ID,"speech-2.8-hd");
});

test("owner-approved direct inline host result preserves the original text and validates via the EXISTING generated WAV bridge",async()=>{
  const t=harness();
  const result=await t.invoke(request());
  assert.deepEqual(t.events,["consume","provider"]);
  assert.equal(result.content.length,1);
  assert.equal(result.structuredContent.record.text,ORIGINAL);
  assert.equal(result.structuredContent.record.audioUrl,undefined);
  assert.equal(result.structuredContent.record.audioMimeType,"audio/wav");
  assert.equal(result.structuredContent.record.source,"minimax");
  assert.equal(result.structuredContent.record.generated,true);
  assert.equal(result.structuredContent.record.voiceLabel,"沈述");
  assert.deepEqual(Buffer.from(result.structuredContent.record.audioBase64,"base64"),WAV);
  const playback=prepareGeneratedWebAudioBridge(result.structuredContent.record);
  assert.deepEqual(Buffer.from(playback.audioBytes),WAV);
  assert.equal(playback.durationSeconds,0.7);
  assert.equal(playback.dataUrl,undefined);
});

test("verified owner, server-side claim and handle are required before the provider",async()=>{
  const t=harness();
  await assert.rejects(t.invoke({...request(),trustedRequest:{authenticated:false}}));
  await assert.rejects(t.invoke({...request(),handle:"forged"}));
  await assert.rejects(t.invoke({...request(),text:""}));
  assert.deepEqual(t.events,[]);
  const rejected=harness({consumeConfirmedOneUseGrant:async()=>({allowed:true,oneTime:true,consumed:true,principal:"x",requestId:REQUEST_ID})});
  await assert.rejects(rejected.invoke(request()),/not_authorized/);
  assert.deepEqual(rejected.events,[]);
});

test("a second request using the already-consumed confirmation handle NEVER calls provider again",async()=>{
  const t=harness();
  await t.invoke(request());
  await assert.rejects(t.invoke(request()),/not_authorized/);
  assert.deepEqual(t.events,["consume","provider","consume"]);
});

test("failed or ambiguous upstream is not silently retried and the grant remains spent",async()=>{
  let count=0;
  const t=harness({synthesize:async()=>{count++;throw Error("network_timeout");}});
  await assert.rejects(t.invoke(request()),/network_timeout/);
  assert.equal(count,1);
  assert.equal(t.claimed.size,1);
  await assert.rejects(t.invoke(request()),/not_authorized/);
  assert.equal(count,1);
  assert.deepEqual(t.events,["consume","consume"]);
});

test("invalid provider WAV fails after the single attempt without public URL fallback",async()=>{
  let count=0;
  const t=harness({synthesize:async()=>{count++;return {audio:Buffer.from("invalid")};}});
  await assert.rejects(t.invoke(request()),/invalid_audio/);
  assert.equal(count,1);
  assert.equal(t.claimed.size,1);
});

test("this is UNMOUNTED code: no paid MCP server route, Kodo side effects, or auto-enabled flag",async()=>{
  const path=new URL("../src/v1-desktop-direct-04-offline.js",import.meta.url);
  const [mod,server,authenticated]=await Promise.all([
    readFile(path,"utf8"),
    readFile(new URL("../server.js",import.meta.url),"utf8"),
    readFile(new URL("../src/staging-authenticated-mcp.js",import.meta.url),"utf8"),
  ]);
  assert.doesNotMatch(mod,/from\\s+["'][^"']*(?:kodo|cloudflare|d1-http)/i);
  assert.doesNotMatch(mod,/globalThis\\.fetch|fetchImpl|new S3Client|new PutObjectCommand/);
  assert.doesNotMatch(mod,/SHENSHU_DESKTOP_DIRECT_04_ENABLED|process\.env/);
  assert.doesNotMatch(server,/v1-desktop-direct-04-offline/);
  assert.doesNotMatch(authenticated,/v1-desktop-direct-04-offline/);
});
