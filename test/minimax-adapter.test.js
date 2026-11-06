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

test("gentle preset softens only delivery settings and keeps the selected voice",()=>{
  const body=buildMiniMaxRequest({
    text:"嗯，我也想你。",voiceId:"voice-test",voicePreset:"gentle"
  });
  assert.deepEqual(body.voice_setting,{
    voice_id:"voice-test",speed:0.93,vol:0.95,pitch:-1
  });
  assert.equal(body.model,"speech-2.8-hd");
  assert.equal(body.text,"嗯，我也想你。");
});

test("unknown voice preset fails before a provider request",async()=>{
  let calls=0;
  await assert.rejects(()=>synthesizeMiniMax({
    text:"糯糯",apiKey:"secret",voiceId:"voice-test",voicePreset:"unknown",
    fetchImpl:async()=>{calls++;}
  }),/invalid_voice_preset/);
  assert.equal(calls,0);
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


/**
 * Header taken from a local FFmpeg 16 kHz mono PCM16 pipe-output recording
 * (RIFF and data length fields deliberately 0xffffffff); content bytes are
 * synthetic silent samples. No MiniMax request or real user voice.
 */
function pipedFfmpegWav() {
  const header = Buffer.from(
    "52494646ffffffff57415645666d742010000000" +
    "01000100803e0000007d000002001000" +
    "4c4953541a000000494e464f49534654" +
    "0d0000004c61766636312e372e3130330000" +
    "64617461ffffffff",
    "hex",
  );
  return Buffer.concat([header, Buffer.alloc(32000)]);
}

function fakeMiniMaxSuccess(audio) {
  return async () => ({
    ok: true,
    json: async () => ({
      base_resp: { status_code: 0, status_msg: "success" },
      data: { status: 2, audio: audio.toString("hex") },
      extra_info: {
        audio_format: "wav",
        audio_sample_rate: 16000,
        audio_channel: 1,
        audio_size: audio.length,
      },
    }),
  });
}

test("FFmpeg pipe-style nonseekable PCM WAV becomes canonical before strict acceptance", async () => {
  const original = pipedFfmpegWav();
  const dataAt = original.indexOf(Buffer.from("data"), 12);
  assert.ok(dataAt > 36);
  assert.equal(original.readUInt32LE(4), 0xffffffff);
  assert.equal(original.readUInt32LE(dataAt + 4), 0xffffffff);
  const result = await synthesizeMiniMax({
    text: "offline wav compatibility",
    apiKey: "secret", voiceId: "voice-test",
    fetchImpl: fakeMiniMaxSuccess(original),
  });
  const expected = Buffer.from(original);
  expected.writeUInt32LE(expected.length - 8, 4);
  expected.writeUInt32LE(32000, dataAt + 4);
  assert.deepEqual(result.audio, expected);
  assert.equal(result.durationSeconds, 1);
  assert.notDeepEqual(result.audio, original);
});

test("already-canonical WAV is unchanged byte for byte", async () => {
  const source = wav(1);
  const result = await synthesizeMiniMax({
    text: "canonical source",
    apiKey: "secret", voiceId: "voice-test",
    fetchImpl: fakeMiniMaxSuccess(source),
  });
  assert.deepEqual(result.audio, source);
});

test("only BOTH length sentinels may be fixed; non-PCM and ambiguous WAV stay rejected", async () => {
  const valid = pipedFfmpegWav();
  const dataAt = valid.indexOf(Buffer.from("data"), 12);
  const damagedVariants = [];

  const oneOnly = Buffer.from(valid);
  oneOnly.writeUInt32LE(oneOnly.length - 8, 4);
  damagedVariants.push(oneOnly);
  const otherOnly = Buffer.from(valid);
  otherOnly.writeUInt32LE(32000, dataAt + 4);
  damagedVariants.push(otherOnly);
  const unsupportedFormat = Buffer.from(valid);
  unsupportedFormat.writeUInt16LE(3, 20); // IEEE float, not PCM16.
  damagedVariants.push(unsupportedFormat);
  damagedVariants.push(valid.subarray(0, valid.length - 1)); // odd byte count.
  const shortAudio = valid.subarray(0, valid.length - 29000);
  damagedVariants.push(shortAudio); // <0.2 s at PCM16 mono 16 kHz.

  for (const input of damagedVariants) {
    let calls = 0;
    await assert.rejects(() => synthesizeMiniMax({
      text: "reject malformed synthetic",
      apiKey: "secret", voiceId: "voice-test",
      fetchImpl: async (...args) => {
        calls++;
        return fakeMiniMaxSuccess(input)(...args);
      },
    }), /upstream_error/);
    assert.equal(calls, 1);
  }
});

test("bounded hex decoder rejects bytes above private WAV limit without retry", async () => {
  const over = Buffer.alloc(2 * 1024 * 1024 + 2);
  let calls = 0;
  await assert.rejects(() => synthesizeMiniMax({
    text: "large payload fails closed",
    apiKey: "secret", voiceId: "voice-test",
    fetchImpl: async () => {
      calls++;
      return fakeMiniMaxSuccess(over)();
    },
  }), /upstream_error/);
  assert.equal(calls, 1);
});
