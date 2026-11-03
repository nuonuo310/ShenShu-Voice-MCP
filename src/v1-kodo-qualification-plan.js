/**
 * Pure Kodo lifecycle-only qualification plan.
 *
 * No S3 client, credential, network call or filesystem marker is created.
 * The plan deliberately contains no DELETE, HEAD, LIST, presigned URL or
 * public URL. Physical removal remains the configured one-day bucket
 * lifecycle; access expiry is enforced by the application read contract.
 */
import { KODO_DEFAULT_PREFIX } from "./p2-kodo-private-audio-backend.js";

export const KODO_QUALIFICATION_BUCKET = "shenshu-voice-v1-sg-20261029";
export const KODO_QUALIFICATION_REGION = "ap-southeast-1";
export const KODO_QUALIFICATION_PREFIX = KODO_DEFAULT_PREFIX;
export const KODO_QUALIFICATION_MAX_REQUESTS = 4;
export const KODO_QUALIFICATION_MAX_PUT_BYTES = 256 * 1024;
export const KODO_QUALIFICATION_MAX_GET_BYTES = 768 * 1024;
export const KODO_QUALIFICATION_MAX_WALL_CLOCK_MS = 15 * 60 * 1000;

const RUN_ID = /^[A-Za-z0-9_-]{8,128}$/;
const OPERATIONS = Object.freeze(["PUT", "GET", "GET", "GET"]);

export function buildKodoPrivateAudioQualificationPlan({ runId } = {}) {
  if (!RUN_ID.test(runId ?? "")) {
    throw new Error("invalid_kodo_qualification_plan");
  }
  const owner = "dryowner_kodo_" + runId + "_a";
  const foreignOwner = "dryowner_kodo_" + runId + "_b";
  if (![owner, foreignOwner].every(value => RUN_ID.test(value))) {
    throw new Error("invalid_kodo_qualification_plan");
  }
  return Object.freeze({
    mode: "plan_only",
    bucket: KODO_QUALIFICATION_BUCKET,
    region: KODO_QUALIFICATION_REGION,
    prefix: KODO_QUALIFICATION_PREFIX,
    owner,
    foreignOwner,
    operations: OPERATIONS,
    requests: Object.freeze([
      Object.freeze({
        step: 1,
        method: "PUT",
        actor: owner,
        expected: "one_encrypted_private_object",
      }),
      Object.freeze({
        step: 2,
        method: "GET",
        actor: owner,
        expected: "owner_decrypted_wav_bytes_match",
      }),
      Object.freeze({
        step: 3,
        method: "GET",
        actor: foreignOwner,
        expected: "not_found_or_denied_no_audio",
      }),
      Object.freeze({
        step: 4,
        method: "GET",
        actor: owner,
        expected: "null_after_access_ttl_without_delete",
      }),
    ]),
    budgets: Object.freeze({
      maxRequests: KODO_QUALIFICATION_MAX_REQUESTS,
      maxPutBytes: KODO_QUALIFICATION_MAX_PUT_BYTES,
      maxGetBytes: KODO_QUALIFICATION_MAX_GET_BYTES,
      maxWallClockMs: KODO_QUALIFICATION_MAX_WALL_CLOCK_MS,
      maxObjects: 1,
      maxBuckets: 1,
      retries: 0,
      providerCalls: 0,
    }),
    accessTtlSeconds: 60,
    lifecycleDays: 1,
    writesEnabled: false,
    networkEnabled: false,
    deleteEnabled: false,
    headEnabled: false,
    listEnabled: false,
    presignedUrls: false,
    publicUrls: false,
    stopRules: Object.freeze([
      "stop_on_ambiguous_put_or_get",
      "stop_on_cross_owner_audio_visible",
      "stop_on_expired_read_returning_audio",
      "never_issue_delete_head_list_or_presign",
      "never_delete_or_unlock_the_consumed_legacy_trial",
      "leave_physical_removal_to_one_day_bucket_lifecycle",
    ]),
  });
}

export function assertKodoPrivateAudioQualificationPlan(plan) {
  if (!plan || plan.mode !== "plan_only" ||
      plan.bucket !== KODO_QUALIFICATION_BUCKET ||
      plan.region !== KODO_QUALIFICATION_REGION ||
      plan.prefix !== KODO_QUALIFICATION_PREFIX ||
      plan.writesEnabled !== false ||
      plan.networkEnabled !== false ||
      plan.deleteEnabled !== false ||
      plan.headEnabled !== false ||
      plan.listEnabled !== false ||
      plan.presignedUrls !== false ||
      plan.publicUrls !== false ||
      plan.lifecycleDays !== 1 ||
      plan.accessTtlSeconds < 60 ||
      plan.accessTtlSeconds > 300 ||
      plan.budgets?.maxRequests !== KODO_QUALIFICATION_MAX_REQUESTS ||
      plan.budgets?.maxPutBytes !== KODO_QUALIFICATION_MAX_PUT_BYTES ||
      plan.budgets?.maxGetBytes !== KODO_QUALIFICATION_MAX_GET_BYTES ||
      plan.budgets?.maxObjects !== 1 ||
      plan.budgets?.maxBuckets !== 1 ||
      plan.budgets?.retries !== 0 ||
      plan.budgets?.providerCalls !== 0 ||
      !Array.isArray(plan.requests) ||
      plan.requests.length !== KODO_QUALIFICATION_MAX_REQUESTS ||
      plan.requests.some((request, index) =>
        request.method !== OPERATIONS[index] ||
        !["PUT", "GET"].includes(request.method))) {
    throw new Error("kodo_qualification_plan_invalid");
  }
  return true;
}
