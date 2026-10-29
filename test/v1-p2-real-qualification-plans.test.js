/**
 * Offline review of the future real D1 and Kodo qualification plans.
 * These tests use only an in-memory Node24 SQLite schema. No Cloudflare API,\n * S3 client, remote database, payment, or secret is accessed.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { CANONICAL_PRINCIPAL_PATTERN } from "../src/canonical-principal.js";
import {
  V1_P2_FORBIDDEN_DATABASE_UUID,
  V1_P2_QUALIFICATION_DATABASE_UUID,
  assertV1P2D1QualificationPlan,
  buildV1P2D1QualificationPlan,
} from "../src/v1-p2-d1-qualification-plan.js";
import {
  KODO_QUALIFICATION_BUCKET,
  KODO_QUALIFICATION_MAX_GET_BYTES,
  KODO_QUALIFICATION_MAX_PUT_BYTES,
  KODO_QUALIFICATION_MAX_REQUESTS,
  KODO_QUALIFICATION_PREFIX,
  assertKodoPrivateAudioQualificationPlan,
  buildKodoPrivateAudioQualificationPlan,
} from "../src/v1-kodo-qualification-plan.js";

const RUN_ID = "v1p2qual20261030";
const DAY = "2026-10-30";

test("D1 004+005 plan is bounded, read-only and covers all required failures", () => {
  const plan = buildV1P2D1QualificationPlan({ runId: RUN_ID, day: DAY });
  assert.equal(assertV1P2D1QualificationPlan(plan), true);
  assert.equal(plan.databaseUuid, V1_P2_QUALIFICATION_DATABASE_UUID);
  assert.notEqual(plan.databaseUuid, V1_P2_FORBIDDEN_DATABASE_UUID);
  assert.equal(plan.mode, "plan_only");
  assert.equal(plan.writesEnabled, false);
  assert.equal(plan.networkEnabled, false);
  assert.equal(plan.migrationEnabled, false);
  assert.equal(plan.paidVoiceEnabled, false);
  assert.equal(plan.providerCalls, 0);
  assert.equal(plan.retries, 0);
  assert.equal(plan.deletes, 0);
  assert.deepEqual(plan.migrations, [
    "004_paid_voice_confirmation_operations.sql",
    "005_paid_voice_confirmation_private_text_sealing.sql",
  ]);
  assert.equal(plan.budgets.maxD1Writes, 12);
  assert.equal(plan.budgets.maxReservations, 3);
  assert.equal(plan.budgets.maxGrants, 3);
  assert.equal(plan.steps.length, 8);
  for (const action of [
    "concurrent_claim",
    "replay_claim",
    "quota_denied_operation",
    "other_owner_claim",
    "unknown_outcome",
  ]) {
    assert.equal(plan.steps.some(step => step.action === action), true, action);
  }
  assert.doesNotMatch(
    plan.readOnlySql.join("\n"),
    /\b(?:ALTER|DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b/i,
  );
});

test("D1 qualification read-only checks compile against the real 001/002/004/005 local schema", async () => {
  const plan = buildV1P2D1QualificationPlan({ runId: RUN_ID, day: DAY });
  assert.match(plan.ownerA, CANONICAL_PRINCIPAL_PATTERN);
  assert.match(plan.ownerB, CANONICAL_PRINCIPAL_PATTERN);
  assert.notEqual(plan.ownerA, plan.ownerB);
  assert.doesNotMatch(plan.readOnlySql.join("\n"), /\bsubject\b|dryreq_|drygrant_/);
  for (const sql of plan.readOnlySql.slice(-2)) {
    assert.ok(sql.includes(plan.ownerA));
    assert.ok(sql.includes(plan.ownerB));
  }
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("PRAGMA foreign_keys = ON;");
    for (const file of [
      "001_paid_voice_reservations.sql",
      "002_paid_voice_grants.sql",
      "004_paid_voice_confirmation_operations.sql",
      "005_paid_voice_confirmation_private_text_sealing.sql",
    ]) {
      const sql = await readFile(new URL("../db/d1/" + file, import.meta.url), "utf8");
      db.exec(sql);
    }
    for (const sql of plan.readOnlySql) {
      // This verifies actual column names and SQL syntax without any live D1 I/O.
      assert.doesNotThrow(() => db.prepare(sql).all(), sql);
    }
  } finally {
    db.close();
  }
});

test("D1 plan rejects invalid IDs and forged unsafe plans", () => {
  assert.throws(
    () => buildV1P2D1QualificationPlan({ runId: "short", day: DAY }),
    /invalid_v1_p2_d1_qualification_plan/,
  );
  assert.throws(
    () => buildV1P2D1QualificationPlan({ runId: RUN_ID, day: "2026-02-30" }),
    /invalid_v1_p2_d1_qualification_plan/,
  );
  const plan = buildV1P2D1QualificationPlan({ runId: RUN_ID, day: DAY });
  assert.throws(
    () => assertV1P2D1QualificationPlan({
      ...plan,
      databaseUuid: V1_P2_FORBIDDEN_DATABASE_UUID,
    }),
    /v1_p2_d1_qualification_plan_invalid/,
  );
  assert.throws(
    () => assertV1P2D1QualificationPlan({
      ...plan,
      readOnlySql: [...plan.readOnlySql, "DELETE FROM paid_voice_grants;"],
    }),
    /v1_p2_d1_qualification_plan_invalid/,
  );
});

test("Kodo plan is one private PUT plus owner/foreign/expired GET only", () => {
  const plan = buildKodoPrivateAudioQualificationPlan({ runId: RUN_ID });
  assert.equal(assertKodoPrivateAudioQualificationPlan(plan), true);
  assert.equal(plan.bucket, KODO_QUALIFICATION_BUCKET);
  assert.equal(plan.prefix, KODO_QUALIFICATION_PREFIX);
  assert.deepEqual(plan.requests.map(request => request.method), [
    "PUT",
    "GET",
    "GET",
    "GET",
  ]);
  assert.equal(plan.requests.length, KODO_QUALIFICATION_MAX_REQUESTS);
  assert.equal(plan.budgets.maxRequests, KODO_QUALIFICATION_MAX_REQUESTS);
  assert.equal(plan.budgets.maxPutBytes, KODO_QUALIFICATION_MAX_PUT_BYTES);
  assert.equal(plan.budgets.maxGetBytes, KODO_QUALIFICATION_MAX_GET_BYTES);
  assert.equal(plan.budgets.maxObjects, 1);
  assert.equal(plan.budgets.maxBuckets, 1);
  assert.equal(plan.budgets.retries, 0);
  assert.equal(plan.budgets.providerCalls, 0);
  assert.equal(plan.deleteEnabled, false);
  assert.equal(plan.headEnabled, false);
  assert.equal(plan.listEnabled, false);
  assert.equal(plan.presignedUrls, false);
  assert.equal(plan.publicUrls, false);
  assert.equal(plan.lifecycleDays, 1);
  assert.equal(plan.accessTtlSeconds, 60);
});

test("Kodo plan rejects destructive or unbounded forged plans", () => {
  const plan = buildKodoPrivateAudioQualificationPlan({ runId: RUN_ID });
  assert.throws(
    () => buildKodoPrivateAudioQualificationPlan({ runId: "short" }),
    /invalid_kodo_qualification_plan/,
  );
  assert.throws(
    () => assertKodoPrivateAudioQualificationPlan({
      ...plan,
      deleteEnabled: true,
    }),
    /kodo_qualification_plan_invalid/,
  );
  assert.throws(
    () => assertKodoPrivateAudioQualificationPlan({
      ...plan,
      requests: [
        ...plan.requests.slice(0, 3),
        { step: 4, method: "DELETE", actor: plan.owner, expected: "x" },
      ],
    }),
    /kodo_qualification_plan_invalid/,
  );
  assert.throws(
    () => assertKodoPrivateAudioQualificationPlan({
      ...plan,
      budgets: { ...plan.budgets, maxRequests: 10 },
    }),
    /kodo_qualification_plan_invalid/,
  );
});
