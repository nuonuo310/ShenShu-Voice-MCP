import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkText, validateWav, makeVoiceRecord } from '../src/contract.js';
function wav(seconds=1) {
  const count=Math.round(32000*seconds),b=Buffer.alloc(44+count);
  b.write('RIFF',0);b.writeUInt32LE(b.length-8,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);
  b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);
  b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(count,40);return b;
}
test('accept natural Chinese but reject control and oversized text',()=>{
  assert.equal(checkText('糯糯，过来。'),'糯糯，过来。');
  assert.throws(()=>checkText(''),/invalid_text/);
  assert.throws(()=>checkText('a'.repeat(801)),/invalid_text/);
  assert.throws(()=>checkText('hi\u0000'),/invalid_text/);
});
test('accept 16k mono PCM WAV and bound duration',()=>{
  assert.equal(validateWav(wav()).durationSeconds,1);
  assert.throws(()=>validateWav(wav(0.1)),/invalid_audio/);
  assert.throws(()=>validateWav(wav(61)),/invalid_audio/);
  const corrupt=wav();corrupt.writeUInt32LE(8000,24);assert.throws(()=>validateWav(corrupt),/invalid_audio/);
});
test('no insecure URLs or oversized claimed duration',()=>{
  const good={id:'voice_12345',text:'糯糯',audioUrl:'https://example.invalid/audio/1',durationSeconds:2};
  assert.equal(makeVoiceRecord(good).voiceLabel,'沈述');
  assert.throws(()=>makeVoiceRecord({...good,audioUrl:'http://localhost:3000/voice'}),/invalid_audio_url/);
  assert.throws(()=>makeVoiceRecord({...good,durationSeconds:61}),/invalid_duration/);
});
