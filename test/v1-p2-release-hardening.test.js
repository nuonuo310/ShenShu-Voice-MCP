/**
 * Release-hardening guards for the gated paid staging candidate.
 *
 * The deployment identity is the platform-provided RENDER_GIT_COMMIT. The
 * operator-writable legacy runtime SHA is deliberately ignored. Only an
 * explicit currentSha argument on a NODE_ENV=test fixture can stand in for it.
 * No real Render, D1, Kodo, MiniMax or Call operation occurs here.
 */
process.env.NODE_ENV = "test";

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CONTROLLED_STAGING_APPROVED_SHA_ENV,
  CONTROLLED_STAGING_FINAL_WIRING_FLAG,
  CONTROLLED_STAGING_PAID_CONFIRM_FLAG,
  CONTROLLED_STAGING_PRIVATE_AUDIO_FLAG,
  CONTROLLED_STAGING_REAL_PROVIDER_FLAG,
  CONTROLLED_STAGING_RUNTIME_SHA_ENV,
  KODO_BUCKET_ENV,
  KODO_MASTER_KEY_ENV,
  MINIMAX_API_KEY_ENV,
  MINIMAX_VOICE_ID_ENV,
  PLATFORM_COMMIT_ENV,
  PRIVATE_AUDIO_TTL_ENV,
  V1_FIXED_VOICE_ID,
  assessV1P2ControlledStagingConfig,
} from "../src/v1-p2-controlled-staging-candidate.js";
import { STAGING_RESOURCE_ORIGIN } from "../src/protected-resource-identity.js";
import { PRIVATE_TEXT_MASTER_KEY_ENV } from "../src/v1-p2-staging-sealed-closure.js";

const APPROVED_SHA = "a".repeat(40);
const OTHER_SHA = "b".repeat(40);
const MASTER_KEY = Buffer.from(
  Array.from({ length: 32 }, (_, index) => index + 31),
).toString("base64");

function baseEnv(overrides = {}) {
  return {
    NODE_ENV: "production",
    SHENSHU_STAGING_RESOURCE_MODE: "1",
    SHENSHU_STAGING_ORIGIN: STAGING_RESOURCE_ORIGIN,
    SHENSHU_AUTH_MCP_ENABLED: "1",
    SHENSHU_PLAYER_ENABLED: "1",
    SHENSHU_PLAYER_AUTH0_CLIENT_ID: "w".repeat(32),
    SHENSHU_PLAYER_SESSION_SECRET:
      "release-hardening-session-secret-0123456789abcdef",
    SHENSHU_NONBILLABLE_PLAYER_ENABLED: "1",
    SHENSHU_STAGING_SEALED_PLAYER_ENABLED: "1",
    [CONTROLLED_STAGING_FINAL_WIRING_FLAG]: "1",
    [CONTROLLED_STAGING_PAID_CONFIRM_FLAG]: "1",
    [CONTROLLED_STAGING_REAL_PROVIDER_FLAG]: "1",
    [CONTROLLED_STAGING_PRIVATE_AUDIO_FLAG]: "1",
    [CONTROLLED_STAGING_APPROVED_SHA_ENV]: APPROVED_SHA,
    [PLATFORM_COMMIT_ENV]: APPROVED_SHA,
    [KODO_BUCKET_ENV]: "shenshu-private-fixture",
    [KODO_MASTER_KEY_ENV]: MASTER_KEY,
    [MINIMAX_API_KEY_ENV]: "test-only-provider-key-0123456789",
    [MINIMAX_VOICE_ID_ENV]: V1_FIXED_VOICE_ID,
    [PRIVATE_AUDIO_TTL_ENV]: "60",
    [PRIVATE_TEXT_MASTER_KEY_ENV]: MASTER_KEY,
    ...overrides,
  };
}

test("production accepts only the exact platform deployment commit", () => {
  const env = baseEnv();
  assert.equal(
    assessV1P2ControlledStagingConfig(env, { expectedSha: APPROVED_SHA }),
    "final_wiring_ready",
  );
  assert.equal(
    assessV1P2ControlledStagingConfig({
      ...env,
      [PLATFORM_COMMIT_ENV]: undefined,
      [CONTROLLED_STAGING_RUNTIME_SHA_ENV]: APPROVED_SHA,
    }, { expectedSha: APPROVED_SHA }),
    "render_git_commit_required",
  );
  assert.equal(
    assessV1P2ControlledStagingConfig({
      ...env,
      [PLATFORM_COMMIT_ENV]: OTHER_SHA,
    }, { expectedSha: APPROVED_SHA }),
    "render_git_commit_mismatch",
  );
  assert.equal(
    assessV1P2ControlledStagingConfig(env, {
      expectedSha: APPROVED_SHA,
      currentSha: APPROVED_SHA,
    }),
    "test_sha_injection_forbidden",
  );
});

test("test fixtures inject SHA explicitly and no env self-attests", () => {
  const testEnv = baseEnv({
    NODE_ENV: "test",
    [PLATFORM_COMMIT_ENV]: undefined,
  });
  assert.equal(
    assessV1P2ControlledStagingConfig({
      ...testEnv,
      [CONTROLLED_STAGING_RUNTIME_SHA_ENV]: APPROVED_SHA,
    }, { expectedSha: APPROVED_SHA }),
    "staging_runtime_sha_required",
  );
  assert.equal(
    assessV1P2ControlledStagingConfig(testEnv, {
      expectedSha: APPROVED_SHA,
      currentSha: APPROVED_SHA,
    }),
    "final_wiring_ready",
  );
  assert.equal(
    assessV1P2ControlledStagingConfig({
      ...testEnv,
      [PLATFORM_COMMIT_ENV]: OTHER_SHA,
    }, {
      expectedSha: APPROVED_SHA,
      currentSha: APPROVED_SHA,
    }),
    "final_wiring_ready",
  );
});

test("static test JWKS and unapproved or missing SHAs fail closed", () => {
  const env = baseEnv();
  assert.equal(
    assessV1P2ControlledStagingConfig({
      ...env,
      SHENSHU_AUTH_STATIC_JWKS_TEST_ONLY: "1",
    }, { expectedSha: APPROVED_SHA }),
    "static_test_jwks_forbidden",
  );
  assert.equal(
    assessV1P2ControlledStagingConfig({
      ...env,
      [CONTROLLED_STAGING_APPROVED_SHA_ENV]: OTHER_SHA,
    }, { expectedSha: APPROVED_SHA }),
    "staging_sha_not_approved",
  );
  assert.equal(
    assessV1P2ControlledStagingConfig(env, { expectedSha: undefined }),
    "staging_sha_required",
  );
});

test("Node24 bound and lockfile pin the reproducible production tree", async () => {
  const pkg = JSON.parse(await readFile(
    new URL("../package.json", import.meta.url),
    "utf8",
  ));
  const lock = JSON.parse(await readFile(
    new URL("../package-lock.json", import.meta.url),
    "utf8",
  ));
  assert.equal(pkg.engines.node, ">=24 <25");
  assert.deepEqual(lock.packages[""].engines, pkg.engines);
  assert.equal(lock.lockfileVersion, 3);
  for (const name of Object.keys(pkg.dependencies)) {
    const entry = lock.packages["node_modules/" + name];
    assert.ok(entry, name);
    assert.equal(typeof entry.version, "string", name);
    assert.equal(typeof entry.integrity, "string", name);
  }
  const zod = lock.packages["node_modules/zod"].version
    .split(".")
    .map(Number);
  assert.equal(zod[0], 4);
  assert.equal(zod[1] >= 6, true);
  assert.equal(zod[1] > 6 || zod[2] >= 7, true);
});

test("deployable source mounts only the fully gated paid candidate", async () => {
  const server = await readFile(
    new URL("../server.js", import.meta.url),
    "utf8",
  );
  const kodo = await readFile(
    new URL("../src/p2-kodo-private-audio-backend.js", import.meta.url),
    "utf8",
  );
  const candidate = await readFile(
    new URL("../src/v1-p2-controlled-staging-candidate.js", import.meta.url),
    "utf8",
  );
  assert.match(server, /v1-p2-controlled-staging-candidate/);
  assert.match(server, /createV1P2ControlledStagingCandidate/);
  assert.match(server, /paidConfirmation\.handleRequest/);
  assert.doesNotMatch(server, /p2-kodo-private-audio-backend/);
  assert.doesNotMatch(server,
    /DeleteObjectCommand|HeadObjectCommand|ListObjectsV2Command|IfMatch|getSignedUrl/i);
  assert.doesNotMatch(kodo,
    /DeleteObjectCommand|HeadObjectCommand|ListObjectsV2Command|IfMatch|getSignedUrl/i);
  assert.doesNotMatch(candidate,
    /DeleteObjectCommand|HeadObjectCommand|ListObjects|IfMatch|getSignedUrl|presign/i);
});

test("real go/no-go card records limits, exact gates and 2/9", async () => {
  const card = await readFile(new URL(
    "../docs/v1-closure/V1-P2-REAL-GO-NO-GO-20261030.md",
    import.meta.url,
  ), "utf8");
  for (const marker of [
    "COMPLETE (offline hardening only)",
    "BLOCKED FOR REAL CLOUD",
    "PR #146",
    "2/9",
    "paid OFF",
    "142f109cefeeb3c0082fd0f8c27117a1429eb5a5",
    "RENDER_GIT_COMMIT",
    "SHENSHU_STAGING_RUNTIME_SHA",
    "GHSA-mrhx-c7xc-m3w5",
    "0 vulnerabilities",
    "24.19.0",
    "26.13.0",
    "234913cd-8901-4607-8147-31c4a4317111",
    "c39a6895-7028-4f59-a100-1455b92c96c1",
    "shenshu-voice-v1-sg-20261029",
    "1 PUT / 3 GET",
    "0 DELETE",
    "speech-2.8-hd",
    "No real D1/Kodo/MiniMax/Render",
    "rollback",
  ]) {
    assert.equal(card.includes(marker), true, marker);
  }
});
