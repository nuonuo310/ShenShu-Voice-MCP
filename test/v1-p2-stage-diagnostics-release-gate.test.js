/**
 * Voice V1 P2 privacy/release safety gate.
 *
 * The optional stage hook is deliberately offline-only. No production server,
 * D1 composition, or controlled staging wiring may supply it without a
 * separately reviewed release, privacy and paid-operation approval.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  V1_P2_STAGE,
  createV1P2StageEmitter,
} from "../src/v1-p2-stage-diagnostics.js";

async function source(relativePath) {
  return readFile(new URL("../" + relativePath, import.meta.url), "utf8");
}

test("stage codes are a closed generic string vocabulary with no user-bearing fields", () => {
  assert.equal(Object.isFrozen(V1_P2_STAGE), true);
  const codes = Object.values(V1_P2_STAGE);
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(codes.length >= 8);
  for (const code of codes) {
    assert.equal(typeof code, "string");
    assert.match(code, /^[a-z][a-z0-9_]{2,60}$/);
    assert.doesNotMatch(code, /owner|principal|handle|request_id|token|voice_id|audio_bytes/i);
  }
  const seen = [];
  const emit = createV1P2StageEmitter(stage => seen.push(stage));
  emit(V1_P2_STAGE.AUDIO_READY);
  assert.deepEqual(seen, ["audio_accepted"]);
  assert.throws(() => emit("actor-secret:abc"), /diagnostic_stage_invalid/);
  assert.doesNotThrow(() => createV1P2StageEmitter()(
    V1_P2_STAGE.D1_COMPLETION_READY,
  ));
});

test("staging and deployable runtime cannot silently enable this observer", async () => {
  const deployable = [
    "server.js",
    "src/v1-p2-d1-confirmation.js",
    "src/v1-p2-controlled-staging-candidate.js",
    "src/v1-p2-player-confirmation.js",
    "src/v1-p2-nonbillable-mcp.js",
  ];
  for (const file of deployable) {
    const body = await source(file);
    assert.doesNotMatch(body, /onStageDiagnostic|createV1P2StageEmitter|V1_P2_STAGE|v1-p2-stage-diagnostics/, file);
  }
  const broker = await source("src/v1-p2-stable-operation-identity.js");
  assert.match(broker, /onStageDiagnostic\s*=\s*null/);
  assert.match(broker, /createV1P2StageEmitter\(onStageDiagnostic\)/);
});

test("stage emitter never writes to a sink or automatically emits to logs", async () => {
  const module = await source("src/v1-p2-stage-diagnostics.js");
  assert.doesNotMatch(module,
    /(?:console\s*\.|process\s*\.\s*stdout|fetch\s*\(|createWriteStream|appendFile|writeFile|S3Client|D1Client|Authorization\s*:|Bearer\s+)/);
  assert.doesNotMatch(module, /import\s+.*?\s+from\s+["'](?:node:fs|node:http|node:https|@aws-sdk)/);
});
