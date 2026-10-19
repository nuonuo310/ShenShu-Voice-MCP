import { test } from "node:test";
import assert from "node:assert/strict";
import { createLiveVoice } from "../src/live-voice.js";

const wav = () => Buffer.alloc(32044);
const synthesize = async () => ({ audio: wav(), durationSeconds: 1 });

test("live core refuses missing gate before any synthesis", async () => {
  let n = 0;
  await assert.rejects(() => createLiveVoice({ text: "糯糯", synthesize: async () => { n++; return synthesize(); } }), /authorization_unavailable/);
  assert.equal(n, 0);
});
test("live core refuses rejected or untrusted authorization", async () => {
  let n = 0;
  const counted = async () => { n++; return synthesize(); };
  for (const authorize of [
    async () => ({ allowed: false }),
    async () => ({ allowed: true, principal: "nuo" }),
    async () => ({ allowed: true, principal: "", oneTime: true }),
  ]) {
    await assert.rejects(() => createLiveVoice({ text: "糯糯", authorize, synthesize: counted }), /not_authorized/);
  }
  assert.equal(n, 0);
});
test("one authorized request yields one synthesizer call and bounded inline result", async () => {
  let n = 0;
  const result = await createLiveVoice({
    text: "糯糯，哥哥在。",
    authorize: async () => ({ allowed: true, principal: "owner", oneTime: true }),
    synthesize: async () => { n++; return synthesize(); },
  });
  assert.equal(n, 1);
  assert.equal(result.record.source, "minimax");
  assert.equal(result.record.audioMimeType, "audio/wav");
  assert.deepEqual(Buffer.from(result.record.audioBase64, "base64"), wav());
});
test("upstream errors do not trigger retries", async () => {
  let n = 0;
  await assert.rejects(() => createLiveVoice({
    text: "糯糯",
    authorize: async () => ({ allowed: true, principal: "owner", oneTime: true }),
    synthesize: async () => { n++; throw new Error("upstream_error"); },
  }), /upstream_error/);
  assert.equal(n, 1);
});
