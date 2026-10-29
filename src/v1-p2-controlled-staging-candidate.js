/**
 * Final controlled-staging candidate for the Voice V1 paid-to-private-audio
 * journey. This module is deliberately not imported by server.js.
 *
 * It composes the existing verified MCP proposal, explicit owner confirmation,
 * D1 sealed atomic claim, fixed MiniMax adapter and Kodo lifecycle-only private
 * audio store. It returns null unless every independent staging gate, exact SHA
 * approval, validated identity and injected/pinned dependency is present.
 */
import { createServer as createHttpServer } from "node:http";
import { createAuth0JwksCache } from "./auth0-jwks-cache.js";
import { createCloudflareD1Http } from "./cloudflare-d1-http.js";
import { synthesizeMiniMax } from "./minimax-adapter.js";
import {
  KODO_DEFAULT_PREFIX,
  KODO_DEFAULT_TIMEOUT_MS,
  createP2KodoPrivateAudioBackend,
  createP2KodoS3Client,
} from "./p2-kodo-private-audio-backend.js";
import {
  MAX_PRIVATE_RESULT_TTL_SECONDS,
  MIN_PRIVATE_RESULT_TTL_SECONDS,
  createP2PlayerAudioLoader,
  createP2PrivateResultStore,
} from "./p2-private-result-store.js";
import { handlePrivateWebPlayer } from "./private-web-player.js";
import {
  PAID_PATH,
  resolveProtectedResourceIdentity,
} from "./protected-resource-identity.js";
import {
  createStagingIdentityVerifier,
  handleStagingAuthenticatedMcp,
} from "./staging-authenticated-mcp.js";
import { createV1P2D1Confirmation } from "./v1-p2-d1-confirmation.js";
import { createPrivateTextSealer } from "./v1-p2-private-text-sealer.js";
import {
  PRIVATE_TEXT_MASTER_KEY_ENV,
  assessV1P2StagingSealedConfig,
} from "./v1-p2-staging-sealed-closure.js";
import { V1_FIXED_MODEL_ID } from "./v1-offline-paid-pipeline.js";

export const CONTROLLED_STAGING_FINAL_WIRING_FLAG =
  "SHENSHU_STAGING_FINAL_WIRING_ENABLED";
export const CONTROLLED_STAGING_PAID_CONFIRM_FLAG =
  "SHENSHU_STAGING_PAID_CONFIRM_ENABLED";
export const CONTROLLED_STAGING_REAL_PROVIDER_FLAG =
  "SHENSHU_STAGING_REAL_PROVIDER_ENABLED";
export const CONTROLLED_STAGING_PRIVATE_AUDIO_FLAG =
  "SHENSHU_STAGING_PRIVATE_AUDIO_ENABLED";
export const CONTROLLED_STAGING_APPROVED_SHA_ENV =
  "SHENSHU_STAGING_APPROVED_SHA";
// Legacy operator-writable value. It is intentionally never consulted as a
// deployment identity; real deployments use RENDER_GIT_COMMIT and tests must
// pass the explicit currentSha fixture argument.
export const CONTROLLED_STAGING_RUNTIME_SHA_ENV =
  "SHENSHU_STAGING_RUNTIME_SHA";
export const PLATFORM_COMMIT_ENV = "RENDER_GIT_COMMIT";
export const KODO_BUCKET_ENV = "SHENSHU_KODO_BUCKET";
export const KODO_ACCESS_KEY_ENV = "SHENSHU_KODO_ACCESS_KEY_ID";
export const KODO_SECRET_KEY_ENV = "SHENSHU_KODO_SECRET_ACCESS_KEY";
export const KODO_SESSION_TOKEN_ENV = "SHENSHU_KODO_SESSION_TOKEN";
export const KODO_MASTER_KEY_ENV = "SHENSHU_KODO_MASTER_KEY_BASE64";
export const MINIMAX_API_KEY_ENV = "SHENSHU_MINIMAX_API_KEY";
export const MINIMAX_VOICE_ID_ENV = "SHENSHU_MINIMAX_VOICE_ID";
export const PRIVATE_AUDIO_TTL_ENV = "SHENSHU_PRIVATE_AUDIO_TTL_SECONDS";

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const BUCKET_PATTERN = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const VOICE_PATTERN = /^[\x21-\x7e]{1,128}$/;
const MAX_PROVIDER_KEY_BYTES = 512;
const DEFAULT_AUDIO_TTL_SECONDS = 300;
const FIXED_DAILY_CALLS = 1;

function configured(value, maximumBytes = 4096) {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    Buffer.byteLength(value, "utf8") <= maximumBytes &&
    !/[\x00-\x1f\x7f]/.test(value);
}

function validSha(value) {
  return typeof value === "string" && SHA_PATTERN.test(value);
}

function validKodoBucket(value) {
  return typeof value === "string" &&
    BUCKET_PATTERN.test(value) &&
    !value.includes("..") &&
    !/^[0-9.]+$/.test(value);
}

function decodeKey32(value) {
  if (typeof value !== "string") return null;
  let key;
  if (/^[A-Za-z0-9_-]{43}$/.test(value)) {
    key = Buffer.from(value, "base64url");
    if (key.toString("base64url") !== value) return null;
  } else if (/^[A-Za-z0-9+/]{43}=$/.test(value)) {
    key = Buffer.from(value, "base64");
    if (key.toString("base64") !== value) return null;
  } else {
    return null;
  }
  return key.length === 32 && key.some(byte => byte !== 0) ? key : null;
}

function audioTtlSecondsFrom(value) {
  if (value === undefined) return DEFAULT_AUDIO_TTL_SECONDS;
  if (typeof value !== "string" || !/^[0-9]{1,3}$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) &&
    parsed >= MIN_PRIVATE_RESULT_TTL_SECONDS &&
    parsed <= Math.min(300, MAX_PRIVATE_RESULT_TTL_SECONDS)
    ? parsed
    : null;
}

function clockMs(clock) {
  const value = clock();
  const ms = value instanceof Date ? value.valueOf() : value;
  if (!Number.isSafeInteger(ms) || ms < 0) {
    throw new Error("candidate_clock_error");
  }
  return ms;
}

/**
 * Nonsecret readiness diagnostic. The caller supplies the independently
 * approved exact SHA; env must attest both the approval and the running code.
 */
export function assessV1P2ControlledStagingConfig(
  env = process.env,
  { expectedSha, currentSha } = {},
) {
  if (env?.[CONTROLLED_STAGING_FINAL_WIRING_FLAG] !== "1") {
    return "final_wiring_flag_off";
  }
  if (env?.[CONTROLLED_STAGING_PAID_CONFIRM_FLAG] !== "1") {
    return "paid_confirm_flag_off";
  }
  if (env?.[CONTROLLED_STAGING_REAL_PROVIDER_FLAG] !== "1") {
    return "real_provider_flag_off";
  }
  if (env?.[CONTROLLED_STAGING_PRIVATE_AUDIO_FLAG] !== "1") {
    return "private_audio_flag_off";
  }
  const sealed = assessV1P2StagingSealedConfig(env);
  if (sealed !== "sealed_config_ready") return sealed;
  if (!validSha(expectedSha)) return "staging_sha_required";
  if (env?.[CONTROLLED_STAGING_APPROVED_SHA_ENV] !== expectedSha) {
    return "staging_sha_not_approved";
  }
  const testMode = env?.NODE_ENV === "test";
  if (!testMode && currentSha !== undefined) {
    return "test_sha_injection_forbidden";
  }
  if (!testMode && env?.SHENSHU_AUTH_STATIC_JWKS_TEST_ONLY === "1") {
    return "static_test_jwks_forbidden";
  }
  // Outside tests the only accepted running identity is the platform-provided
  // Render deployment commit. Even in tests the explicit currentSha fixture is
  // accepted; no operator-writable environment value can self-attest a deploy.
  const runtimeSha = testMode
    ? (currentSha ??
       env?.[PLATFORM_COMMIT_ENV])
    : env?.[PLATFORM_COMMIT_ENV];
  if (!validSha(runtimeSha)) {
    return testMode
      ? "staging_runtime_sha_required"
      : "render_git_commit_required";
  }
  if (runtimeSha !== expectedSha) {
    return testMode
      ? "runtime_sha_mismatch"
      : "render_git_commit_mismatch";
  }
  if (!configured(env?.[MINIMAX_API_KEY_ENV], MAX_PROVIDER_KEY_BYTES)) {
    return "provider_key_invalid";
  }
  if (!VOICE_PATTERN.test(env?.[MINIMAX_VOICE_ID_ENV] ?? "")) {
    return "provider_voice_invalid";
  }
  if (!validKodoBucket(env?.[KODO_BUCKET_ENV])) return "kodo_bucket_invalid";
  if (!decodeKey32(env?.[KODO_MASTER_KEY_ENV])) return "kodo_master_key_invalid";
  if (audioTtlSecondsFrom(env?.[PRIVATE_AUDIO_TTL_ENV]) === null) {
    return "audio_ttl_invalid";
  }
  return "final_wiring_ready";
}

function createFixedMiniMaxSynthesizer({ apiKey, voiceId, fetchImpl }) {
  const fixedVoiceId = voiceId.trim();
  if (!configured(apiKey, MAX_PROVIDER_KEY_BYTES) ||
      !VOICE_PATTERN.test(fixedVoiceId)) {
    throw new Error("provider_config_invalid");
  }
  return async function synthesizeFixedVoice({ text, modelId, voiceId: requestedVoiceId } = {}) {
    if (modelId !== V1_FIXED_MODEL_ID || requestedVoiceId !== fixedVoiceId) {
      throw new Error("provider_config_mismatch");
    }
    return synthesizeMiniMax({
      text,
      apiKey,
      voiceId: fixedVoiceId,
      modelId: V1_FIXED_MODEL_ID,
      fetchImpl,
    });
  };
}

function makeServer({
  env,
  identity,
  verifier,
  confirmation,
  loadAudio,
  fetchImpl,
  playerClock,
}) {
  return createHttpServer(async (req, res) => {
    if (!req.url) {
      res.writeHead(400).end("missing_url");
      return;
    }
    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
    try {
      if (await confirmation.playerHandler.handle(req, res, url)) return;
      if (await handlePrivateWebPlayer(req, res, url, {
        env,
        fetchImpl,
        clock: playerClock,
        loadAudio,
      })) return;
      if (url.pathname === PAID_PATH) {
        await handleStagingAuthenticatedMcp(req, res, {
          env,
          issuer: identity.issuer,
          audience: identity.paidResource,
          resourceMetadataUrl: identity.resourceMetadataUrl,
          jwksCache: null,
          identityVerifier: verifier,
          proposalBroker: confirmation.broker,
        });
        return;
      }
      res.writeHead(404).end("not_found");
    } catch {
      if (!res.headersSent) res.writeHead(500).end("internal_error");
      else if (!res.writableEnded) res.end();
    }
  });
}

export async function createV1P2ControlledStagingCandidate({
  env = process.env,
  expectedSha,
  currentSha,
  d1Client,
  s3Client,
  fetchImpl = globalThis.fetch,
  jwksCache,
  requestHandler,
  clock = () => new Date(),
  operationTtlMs,
  createD1Client = createCloudflareD1Http,
  createS3Client = createP2KodoS3Client,
} = {}) {
  try {
    if (assessV1P2ControlledStagingConfig(env, { expectedSha, currentSha }) !==
        "final_wiring_ready" ||
        typeof fetchImpl !== "function" ||
        typeof clock !== "function" ||
        typeof createD1Client !== "function" ||
        typeof createS3Client !== "function") {
      return null;
    }
    const identity = resolveProtectedResourceIdentity(env);
    if (identity.ok !== true || identity.staging !== true) return null;

    const client = d1Client ?? createD1Client({ env });
    if (!client || typeof client.query !== "function") return null;

    const textMasterKey = decodeKey32(env?.[PRIVATE_TEXT_MASTER_KEY_ENV]);
    const kodoMasterKey = decodeKey32(env?.[KODO_MASTER_KEY_ENV]);
    const ttlSeconds = audioTtlSecondsFrom(env?.[PRIVATE_AUDIO_TTL_ENV]);
    if (!textMasterKey || !kodoMasterKey || ttlSeconds === null) return null;

    const kodo = s3Client ?? createS3Client({
      accessKeyId: env?.[KODO_ACCESS_KEY_ENV],
      secretAccessKey: env?.[KODO_SECRET_KEY_ENV],
      sessionToken: env?.[KODO_SESSION_TOKEN_ENV],
      requestTimeoutMs: KODO_DEFAULT_TIMEOUT_MS,
      ...(requestHandler === undefined ? {} : { requestHandler }),
    });
    if (!kodo || typeof kodo.send !== "function") return null;

    const backend = createP2KodoPrivateAudioBackend({
      s3Client: kodo,
      bucket: env[KODO_BUCKET_ENV],
      prefix: KODO_DEFAULT_PREFIX,
      masterKey: kodoMasterKey,
      clock,
      requestTimeoutMs: KODO_DEFAULT_TIMEOUT_MS,
    });
    const privateResultStore = createP2PrivateResultStore({
      backend,
      ttlSeconds,
      clock,
    });

    const staticTestJwks = env?.SHENSHU_AUTH_STATIC_JWKS_TEST_ONLY === "1";
    const cache = jwksCache ?? (staticTestJwks
      ? null
      : createAuth0JwksCache({ fetchImpl }));
    const verifier = createStagingIdentityVerifier(env, {
      issuer: identity.issuer,
      audience: identity.paidResource,
      jwksCache: cache,
    });
    if (typeof verifier !== "function") return null;

    const textSealer = createPrivateTextSealer({ masterKey: textMasterKey });
    const synthesize = createFixedMiniMaxSynthesizer({
      apiKey: env[MINIMAX_API_KEY_ENV],
      voiceId: env[MINIMAX_VOICE_ID_ENV],
      fetchImpl,
    });
    const confirmation = createV1P2D1Confirmation({
      client,
      maximumDailyCalls: FIXED_DAILY_CALLS,
      voiceId: env[MINIMAX_VOICE_ID_ENV],
      synthesize,
      privateResultStore,
      mcpResolveVerifiedPrincipal: verifier,
      sessionSecret: env.SHENSHU_PLAYER_SESSION_SECRET,
      clock,
      maximumProposals: 10,
      textSealer,
      ...(operationTtlMs === undefined ? {} : { operationTtlMs }),
    });
    const schema = await confirmation.operationStore.verifySchema();
    if (schema?.ok !== true || schema?.sealedText !== true) return null;

    const loadAudio = createP2PlayerAudioLoader({ privateResultStore });
    const playerClock = () => clockMs(clock);
    const server = makeServer({
      env,
      identity,
      verifier,
      confirmation,
      loadAudio,
      fetchImpl,
      playerClock,
    });
    return Object.freeze({
      code: "final_wiring_ready",
      paidConfirmMounted: true,
      server,
      confirmation,
      privateResultStore,
      loadAudio,
      schema,
      staticTestJwks,
    });
  } catch {
    return null;
  }
}
