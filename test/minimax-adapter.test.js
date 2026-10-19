import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMiniMaxRequest, synthesizeMiniMax, MINIMAX_ENDPOINT } from "../src/minimax-adapter.js";

function wav(seconds=1) {
  const count=Math.round(32000*seconds),b=Buffer.alloc(44+count);
  b.write("RIFF",0);b.writeUInt32LE(b.length-8,4);b.write("WAVE",8);b.write("fmt ",12);b.writeUInt32LE(16,16);
  b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);
  b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write("data",36);b.writeUInt32LE(count,40);return b;
}

test("MiniMax request fixes model/voice settings and output format",()=>{
  const body=buildMiniMaxRequest({text:"糯糯，过来。",voiceId:"voice-test"});
  assert.equal(body.model,"speech-2.8-hd");
  assert.deepEqual(body.voice_setting,{voice_id:"voice-test",speed:1,vol:1,pitch:0});
  assert.deepEqual(body.audio_setting,{sample_rate:16000,format:"wav",channel:1});
  assert.equal(body.output_format,"hex");
  assert.equal(body.stream,false);
});

test("synthesizer makes exactly one upstream call and validates WAV",async()=>{
  const audio=wav(1);let calls=0,seen;
  const fetchImpl=async(url,options)=>{
    calls++;seen={url,options};
    return {ok:true,json:async()=>({base_resp:{status_code:0},data:{audio:audio.toString("hex")}})};
  };
  const result=await synthesizeMiniMax({text:"糯糯，过来。",apiKey:"secret",voiceId:"voice-test",fetchImpl});
  assert.equal(calls,1);
  assert.equal(seen.url,MINIMAX_ENDPOINT);
  assert.equal(seen.options.headers.Authorization,"Bearer secret");
  assert.equal(result.durationSeconds,1);
  assert.deepEqual(result.audio,audio);
});

test("synthesizer never retries a failed upstream",async()=>{
  let calls=0;
  const fetchImpl=async()=>{calls++;return {ok:false,json:async()=>({})}};
  await assert.rejects(()=>synthesizeMiniMax({text:"糯糯",apiKey:"secret",voiceId:"voice-test",fetchImpl}),/upstream_error/);
  assert.equal(calls,1);
});

test("synthesizer refuses missing secrets before any fetch",async()=>{
  let calls=0;
  await assert.rejects(()=>synthesizeMiniMax({text:"糯糯",apiKey:"",voiceId:"voice-test",fetchImpl:async()=>{calls++;}}),/not_configured/);
  assert.equal(calls,0);
});
