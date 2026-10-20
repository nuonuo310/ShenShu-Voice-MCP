import test from "node:test";
import assert from "node:assert/strict";
import {preparePrivateFixtureAudio} from "../src/private-fixture-delivery.js";
import {makeInlineToneFixture} from "../src/inline-fixture.js";
const fixture=()=>Buffer.from(makeInlineToneFixture().audioBase64,"base64");
const input={text:"测试",trustedRequest:{},loadFixture:fixture};
test("authorized fixture returns inline audio without URL or paid synthesis",async()=>{
  let calls=0;
  const result=await preparePrivateFixtureAudio({...input,authorize:async()=>{calls++;return {authenticated:true,allowed:true}}});
  assert.equal(calls,1);assert.equal(result.source,"private-fixture");
  assert.equal(result.generated,false);assert.equal(result.audioMimeType,"audio/wav");
  assert.ok(result.audioBase64.length>100);assert.equal("audioUrl" in result,false);
});
test("missing and denied authorization fail closed without loading audio",async()=>{
  let loaded=0;const loadFixture=()=>{loaded++;return fixture()};
  await assert.rejects(preparePrivateFixtureAudio({...input,loadFixture,authorize:undefined}),/delivery_unavailable/);
  for(const decision of [{authenticated:false,allowed:true},{authenticated:true,allowed:false},null]){
    await assert.rejects(preparePrivateFixtureAudio({...input,loadFixture,authorize:async()=>decision}),/not_authorized/);
  }
  assert.equal(loaded,0);
});
test("rejects malformed and oversized audio",async()=>{
  for(const audio of [Buffer.from("invalid"),Buffer.alloc(2*1024*1024+1)]){
    await assert.rejects(preparePrivateFixtureAudio({...input,loadFixture:async()=>audio,authorize:async()=>({authenticated:true,allowed:true})}),/invalid_audio/);
  }
});
