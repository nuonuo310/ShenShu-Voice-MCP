import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MAX_WAV_BYTES } from "../src/contract.js";
import {
  GENERATED_AUDIO_SOURCE,
  MAX_GENERATED_AUDIO_BASE64_LENGTH,
  decodeGeneratedAudioForPlayback,
  prepareGeneratedAudioPlayback,
} from "../src/generated-audio-playback-contract.js";
import { makeInlineToneFixture } from "../src/inline-fixture.js";

const fixture = makeInlineToneFixture();

function record(overrides = {}) {
  return {
    source: GENERATED_AUDIO_SOURCE,
    generated: true,
    audioMimeType: "audio/wav",
    audioBase64: fixture.audioBase64,
    ...overrides,
  };
}

test("a generated minimax record becomes a bounded inline WAV without a public URL", () => {
  const prepared = prepareGeneratedAudioPlayback(record());

  assert.equal(prepared.source, "minimax");
  assert.equal(prepared.generated, true);
  assert.equal(prepared.audioMimeType, "audio/wav");
  assert.equal(prepared.dataUrl, "data:audio/wav;base64," + fixture.audioBase64);
  assert.equal(prepared.byteLength, 22_444);
  assert.equal(prepared.durationSeconds, 0.7);
  assert.equal("audioUrl" in prepared, false);
});

test("an injected decoder receives the exact fake WAV and current generation", async () => {
  let received;
  let generationSeen;
  const playback = await decodeGeneratedAudioForPlayback({
    record: record(),
    decodeAudioData: async (buffer) => {
      received = Buffer.from(buffer);
      return { duration: 0.7, sampleRate: 16_000 };
    },
    generation: "load-7",
    isCurrent: (generation) => {
      generationSeen = generation;
      return generation === "load-7";
    },
  });

  assert.deepEqual(received, Buffer.from(fixture.audioBase64, "base64"));
  assert.equal(generationSeen, "load-7");
  assert.equal(playback.prepared.dataUrl, "data:audio/wav;base64," + fixture.audioBase64);
  assert.equal(playback.decoded.sampleRate, 16_000);
});

test("bad, malformed, oversized and non-inline generated records are rejected", () => {
  const unsupportedRecords = [
    null,
    {},
    record({ source: "fixture" }),
    record({ generated: false }),
    record({ generated: "true" }),
  ];
  for (const value of unsupportedRecords) {
    assert.throws(() => prepareGeneratedAudioPlayback(value), /unsupported_audio_result/);
  }

  const invalidRecords = [
    record({ audioMimeType: "audio/mpeg" }),
    record({ audioUrl: "https://example.invalid/generated.wav" }),
    record({ audioBase64: "A".repeat(100) }),
    record({ audioBase64: Buffer.alloc(200, 0x61).toString("base64") }),
    record({ audioBase64: " " + fixture.audioBase64 }),
    record({ audioBase64: "A".repeat(MAX_GENERATED_AUDIO_BASE64_LENGTH + 4) }),
    record({ audioBase64: Buffer.alloc(MAX_WAV_BYTES + 2).toString("base64") }),
  ];

  for (const value of invalidRecords) {
    assert.throws(() => prepareGeneratedAudioPlayback(value), /invalid_generated_audio/);
  }
});

test("decode failures, invalid decoded duration and stale results fail closed", async () => {
  const value = record();
  await assert.rejects(
    decodeGeneratedAudioForPlayback({ record: value }),
    /audio_decode_unavailable/,
  );
  await assert.rejects(
    decodeGeneratedAudioForPlayback({
      record: value,
      decodeAudioData: async () => { throw new Error("host_decoder_failure"); },
    }),
    /audio_decode_failed/,
  );
  for (const duration of [0.1, 61, Number.NaN, Number.POSITIVE_INFINITY]) {
    await assert.rejects(
      decodeGeneratedAudioForPlayback({
        record: value,
        decodeAudioData: async () => ({ duration }),
      }),
      /invalid_decoded_audio/,
    );
  }

  let current = true;
  await assert.rejects(
    decodeGeneratedAudioForPlayback({
      record: value,
      decodeAudioData: async () => {
        current = false;
        return { duration: 0.7 };
      },
      generation: "old-load",
      isCurrent: () => current,
    }),
    /stale_audio_result/,
  );
  await assert.rejects(
    decodeGeneratedAudioForPlayback({
      record: value,
      decodeAudioData: async () => ({ duration: 0.7 }),
      isCurrent: null,
    }),
    /invalid_playback_generation/,
  );
});

test("the shared player retains old sources and only adds an inline generated branch", async () => {
  const ui = await readFile(new URL("../ui/mcp-bubble.html", import.meta.url), "utf8");

  assert.match(
    ui,
    /next\.source==="minimax"&&next\.generated===true&&next\.audioBase64&&next\.audioUrl===undefined/,
  );
  assert.match(ui, /next\.source==="private-fixture"/);
  assert.match(ui, /next\.source==="tone-fixture"/);
  assert.match(ui, /next\.source==="hosted-tone"/);
  assert.match(ui, /next\.source==="fixture"/);
  assert.match(ui, /data:audio\/wav;base64,/);
  assert.match(ui, /next\.audioBase64\.length>3_000_000/);
  assert.match(ui, /raw\.length>2\*1024\*1024/);
  assert.match(ui, /loadPhase=next\.source==="private-fixture"\?"private-inline":next\.source==="minimax"\?"generated-inline":"other-source"/);
  assert.doesNotMatch(ui, /next\.source==="minimax"[\s\S]{0,240}?target=next\.audioUrl/);
  assert.doesNotMatch(ui, /api\.minimaxi\.com|MINIMAX_API_KEY|\bfetch\s*\(/);

  assert.match(ui, /const generation=\+\+mediaLoadGeneration/);
  assert.match(ui, /audio\.dataset\.loadGeneration=String\(generation\)/);
  assert.ok((ui.match(/Number\(audio\.dataset\.loadGeneration\)!==mediaLoadGeneration/g) ?? []).length >= 2);
});

test("existing CSP domains remain unchanged and offline modules are not mounted", async () => {
  const publicServer = await readFile(new URL("../server.js", import.meta.url), "utf8");
  const authenticatedServer = await readFile(
    new URL("../src/staging-authenticated-mcp.js", import.meta.url),
    "utf8",
  );
  const shell = await readFile(
    new URL("../src/protected-resource-shell.js", import.meta.url),
    "utf8",
  );

  assert.match(publicServer, /connectDomains:\s*\[\]/);
  assert.match(authenticatedServer, /connectDomains:\s*\[\]/);
  assert.match(publicServer, /resourceDomains:\s*\["https:\/\/raw\.githubusercontent\.com",\s*"https:\/\/shenshu-voice-mcp\.onrender\.com"\]/);
  assert.match(authenticatedServer, /resourceDomains:\s*\["https:\/\/shenshu-voice-mcp\.onrender\.com"\]/);

  for (const source of [publicServer, authenticatedServer, shell]) {
    assert.doesNotMatch(
      source,
      /first-audition-offline-candidate|audition-consent-capability|generated-audio-playback-contract/,
    );
  }
});
