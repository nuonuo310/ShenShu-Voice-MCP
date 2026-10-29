/**
 * Pure D1 004+005 real-qualification plan.
 *
 * This module performs no network I/O, opens no database, loads no credential
 * and cannot execute SQL. It only freezes the exact bounded future request
 * shape, read-only checks and STOP rules for a separately authorized run.
 */
export const V1_P2_QUALIFICATION_DATABASE_UUID =
  "234913cd-8901-4607-8147-31c4a4317111";
export const V1_P2_FORBIDDEN_DATABASE_UUID =
  "c39a6895-7028-4f59-a100-1455b92c96c1";
export const V1_P2_QUALIFICATION_MIGRATIONS = Object.freeze([
  "004_paid_voice_confirmation_operations.sql",
  "005_paid_voice_confirmation_private_text_sealing.sql",
]);

const RUN_ID = /^[A-Za-z0-9_-]{8,128}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DESTRUCTIVE_SQL = /\b(?:ALTER|DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b/i;

function validDay(value) {
  if (typeof value !== "string" || !DAY.test(value)) return false;
  const parsed = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value;
}

export function buildV1P2D1QualificationPlan({
  runId,
  day,
} = {}) {
  if (!RUN_ID.test(runId ?? "") || !validDay(day)) {
    throw new Error("invalid_v1_p2_d1_qualification_plan");
  }
  const ownerA = "dryrun_v1p2_" + runId + "_a";
  const ownerB = "dryrun_v1p2_" + runId + "_b";
  const operationId = "dryop_" + runId + "_01";
  if (![ownerA, ownerB, operationId].every(value => RUN_ID.test(value))) {
    throw new Error("invalid_v1_p2_d1_qualification_plan");
  }
  return Object.freeze({
    mode: "plan_only",
    databaseUuid: V1_P2_QUALIFICATION_DATABASE_UUID,
    ownerA,
    ownerB,
    operationId,
    day,
    writesEnabled: false,
    networkEnabled: false,
    migrationEnabled: false,
    paidVoiceEnabled: false,
    providerCalls: 0,
    retries: 0,
    deletes: 0,
    migrations: V1_P2_QUALIFICATION_MIGRATIONS,
    budgets: Object.freeze({
      maxOperationRows: 4,
      maxClaimAttempts: 5,
      maxD1Writes: 12,
      maxReservations: 3,
      maxGrants: 3,
      maxWallClockMs: 15 * 60 * 1000,
    }),
    steps: Object.freeze([
      Object.freeze({
        step: 1,
        action: "create_pending",
        owner: ownerA,
        expected: "pending_confirmation",
      }),
      Object.freeze({
        step: 2,
        action: "concurrent_claim",
        owner: ownerA,
        attempts: 2,
        expected: "exactly_one_admission_one_conflict",
      }),
      Object.freeze({
        step: 3,
        action: "read_claim_evidence",
        owner: ownerA,
        expected: "one_reservation_one_grant_one_provider_pending",
      }),
      Object.freeze({
        step: 4,
        action: "replay_claim",
        owner: ownerA,
        attempts: 1,
        expected: "no_second_admission_no_second_grant",
      }),
      Object.freeze({
        step: 5,
        action: "quota_denied_operation",
        owner: ownerA,
        expected: "abort_quota_denied_zero_new_reservation_or_grant",
      }),
      Object.freeze({
        step: 6,
        action: "other_owner_claim",
        owner: ownerB,
        expected: "isolated_slot_one_and_no_cross_owner_visibility",
      }),
      Object.freeze({
        step: 7,
        action: "unknown_outcome",
        owner: ownerA,
        expected: "terminal_unknown_no_refund_no_retry",
      }),
      Object.freeze({
        step: 8,
        action: "readonly_postflight",
        owner: null,
        expected: "counts_match_and_no_unexpected_rows",
      }),
    ]),
    readOnlySql: Object.freeze([
      "PRAGMA foreign_keys;",
      "PRAGMA foreign_key_check;",
      "SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name IN ('paid_voice_confirmation_operations','paid_voice_reservations','paid_voice_grants') ORDER BY name,type;",
      "SELECT request_id,subject,day_utc,slot FROM paid_voice_reservations WHERE request_id LIKE 'dryreq_%' ORDER BY request_id;",
      "SELECT grant_id,request_id,subject,consumed_at FROM paid_voice_grants WHERE grant_id LIKE 'drygrant_%' ORDER BY grant_id;",
    ]),
    stopRules: Object.freeze([
      "stop_on_ambiguous_claim_or_transport",
      "stop_on_second_admission_or_second_grant",
      "stop_on_unexpected_quota_consumption",
      "stop_on_cross_owner_visibility",
      "stop_on_refund_retry_or_automatic_repair",
      "never_run_004_or_005_migration_again",
      "never_use_forbidden_database_uuid",
    ]),
  });
}

export function assertV1P2D1QualificationPlan(plan) {
  if (!plan || plan.mode !== "plan_only" ||
      plan.databaseUuid !== V1_P2_QUALIFICATION_DATABASE_UUID ||
      plan.writesEnabled !== false ||
      plan.networkEnabled !== false ||
      plan.migrationEnabled !== false ||
      plan.paidVoiceEnabled !== false ||
      plan.providerCalls !== 0 ||
      plan.retries !== 0 ||
      plan.deletes !== 0 ||
      plan.migrations?.length !== 2 ||
      plan.migrations[0] !== V1_P2_QUALIFICATION_MIGRATIONS[0] ||
      plan.migrations[1] !== V1_P2_QUALIFICATION_MIGRATIONS[1] ||
      !Array.isArray(plan.readOnlySql) ||
      plan.readOnlySql.some(sql => DESTRUCTIVE_SQL.test(sql)) ||
      !Array.isArray(plan.steps) ||
      plan.steps.length !== 8) {
    throw new Error("v1_p2_d1_qualification_plan_invalid");
  }
  for (const marker of [
    "concurrent_claim",
    "replay_claim",
    "quota_denied_operation",
    "other_owner_claim",
    "unknown_outcome",
  ]) {
    if (!plan.steps.some(step => step.action === marker)) {
      throw new Error("v1_p2_d1_qualification_plan_invalid");
    }
  }
  return true;
}
