import { test } from "node:test";
import assert from "node:assert/strict";
import { makeInlineToneFixture } from "../src/inline-fixture.js";
import { validateWav } from "../src/contract.js";
test("inline audio is a bounded PCM WAV with a reproducible 0.7-second duration", () => {
  const a=makeInlineToneFixture(), b=makeInlineToneFixture();
  assert.equal(a.audioMimeType, "audio/wav");
  assert.equal(a.durationSeconds, 0.7);
  assert.equal(a.audioBase64,b.audioBase64);
  const binary=Buffer.from(a.audioBase64,"base64");
  assert.equal(binary.length,22444);
  assert.equal(validateWav(binary).durationSeconds,0.7);
});
test("public server must not register paid tool", async () => {
  const { readFile } = await import("node:fs/promises");
  const server=await readFile(new URL("../server.js",import.meta.url),"utf8");
  assert.doesNotMatch(server,/registerAppTool\(\s*server,\s*["']speak_shenshu["']/);
});
