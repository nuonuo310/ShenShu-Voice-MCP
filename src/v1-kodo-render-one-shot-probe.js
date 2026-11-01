/**
 * Staging-only / explicitly owner-confirmed Render -> Kodo one-shot probe.
 *
 * DORMANT unless a distinct operator-only flag, exact Render SHA, secure
 * consent token, signed browser session and four paid-OFF flags all pass.
 * Exactly one D1 INSERT/claim in an isolated already-approved lock table
 * MUST commit before any Kodo request. A timeout permanently spends the lock.
 * This probe NEVER imports paid quota, MiniMax or other voice operations.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { Readable } from "node:stream";
import { makeInlineToneFixture } from "./inline-fixture.js";
import { readPrivatePlayerSession } from "./private-web-player.js";
import { STAGING_RESOURCE_ORIGIN, resolveProtectedResourceIdentity } from "./protected-resource-identity.js";
import {
  createP2KodoS3Client,
  createP2KodoPrivateAudioBackend,
  KODO_DEFAULT_PREFIX,
} from "./p2-kodo-private-audio-backend.js";
import { createCloudflareD1Http } from "./cloudflare-d1-http.js";

export const KODO_RENDER_PROBE_PATH = "/player/internal/kodo-probe-once";
export const KODO_RENDER_PROBE_LOCK_ID = "shenshu_kodo_render_probe_once_20261101_v1";
export const KODO_RENDER_PROBE_MAX_OBJECT_BYTES = 32768;
const PROBE_AUDIO_TTL_SECONDS = 60;
const SHA = /^[a-f0-9]{40}$/;
const TOKEN = /^[A-Za-z0-9_-]{32,128}$/;
const FIXED_OWNER = createHash("sha256")
  .update("shenshu-voice-render-kodo-probe-v1/never-a-real-owner")
  .digest("base64url");

const CLAIM_ONCE = [
  "INSERT INTO shenshu_kodo_render_single_probe_locks",
  " (probe_id, claimed_at_ms) VALUES (?1, ?2)",
  " ON CONFLICT(probe_id) DO NOTHING RETURNING probe_id",
].join("");

function reply(res, status, code) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'",
  });
  res.end(JSON.stringify({ code }));
}
function form(res) {
  const page = '<!doctype html><html lang="zh-CN"><head>' +
    '<meta charset="utf-8"><meta name="robots" content="noindex,nofollow">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>七牛单次验证</title></head><body><main>' +
    '<h1>七牛单次验证</h1><p>仅在本人确认后执行一次加密测试音频上传和读取。' +
    '最多 1 PUT + 1 GET，单对象最多 32 KiB，可能产生七牛费用。</p>' +
    '<form method="post" action="' + KODO_RENDER_PROBE_PATH + '" autocomplete="off">' +
    '<label>一次性批准码 <input name="approval" type="password" minlength="32" maxlength="128" required></label>' +
    '<button type="submit">执行唯一一次非 MiniMax 验证</button></form></main></body></html>';
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  });
  res.end(page);
}

function allowedConfig(env, currentSha) {
  if (env?.SHENSHU_KODO_RENDER_PROBE_ENABLED !== "1") return false;
  if (resolveProtectedResourceIdentity(env).staging !== true ||
      env?.SHENSHU_PLAYER_ENABLED !== "1" ||
      env?.SHENSHU_STAGING_FINAL_WIRING_ENABLED !== "0" ||
      env?.SHENSHU_STAGING_PAID_CONFIRM_ENABLED !== "0" ||
      env?.SHENSHU_STAGING_REAL_PROVIDER_ENABLED !== "0" ||
      env?.SHENSHU_STAGING_PRIVATE_AUDIO_ENABLED !== "0" ||
      env?.SHENSHU_AUTH_STATIC_JWKS_TEST_ONLY === "1" && env?.NODE_ENV !== "test") {
    return false;
  }
  const expected = env?.SHENSHU_KODO_RENDER_PROBE_APPROVED_SHA;
  const live = env?.NODE_ENV === "test" ? currentSha : env?.RENDER_GIT_COMMIT;
  return SHA.test(expected ?? "") && expected === live &&
    (env?.NODE_ENV === "test" || currentSha === undefined) &&
    TOKEN.test(env?.SHENSHU_KODO_RENDER_PROBE_APPROVAL_TOKEN ?? "") &&
    typeof env?.SHENSHU_PLAYER_SESSION_SECRET === "string" &&
    env.SHENSHU_PLAYER_SESSION_SECRET.length >= 32;
}

function decodeMasterKey(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]{43}=$/.test(value)) return null;
  const key = Buffer.from(value, "base64");
  if (key.length !== 32 || key.every(byte => byte === 0) ||
      key.toString("base64") !== value) return null;
  return key;
}

function boundedGetBody(response, limit) {
  const length = response?.ContentLength;
  if (length !== undefined && (!Number.isSafeInteger(length) || length > limit || length < 0)) {
    throw new Error("probe_response_too_large");
  }
  const raw = response?.Body;
  if (!raw) throw new Error("probe_missing_body");
  if (raw instanceof Uint8Array) {
    if (raw.byteLength > limit) throw new Error("probe_response_too_large");
    return { ...response, Body: Buffer.from(raw) };
  }
  const source = raw[Symbol.asyncIterator];
  if (typeof source !== "function") throw new Error("probe_response_invalid");
  return {
    ...response,
    Body: Readable.from((async function* () {
      let total = 0;
      for await (const chunk of raw) {
        const bytes = Buffer.from(chunk);
        total += bytes.length;
        if (total > limit) {
          raw.destroy?.();
          throw new Error("probe_response_too_large");
        }
        yield bytes;
      }
    })()),
  };
}

function limitedClient(client, counters) {
  return Object.freeze({
    async send(command, options = {}) {
      const name = command?.constructor?.name;
      if (name === "PutObjectCommand") {
        if (counters.put++ !== 0) throw new Error("probe_put_limit");
        const body = command.input?.Body;
        if (!Buffer.isBuffer(body) ||
            body.byteLength > KODO_RENDER_PROBE_MAX_OBJECT_BYTES ||
            body.byteLength !== command.input.ContentLength ||
            command.input.Key?.startsWith(KODO_DEFAULT_PREFIX) !== true ||
            command.input.ContentType !== "application/octet-stream") {
          throw new Error("probe_put_invalid");
        }
        return client.send(command, options);
      }
      if (name === "GetObjectCommand") {
        if (counters.get++ !== 0) throw new Error("probe_get_limit");
        if (command.input?.Key?.startsWith(KODO_DEFAULT_PREFIX) !== true) {
          throw new Error("probe_get_invalid");
        }
        const result = await client.send(command, options);
        return boundedGetBody(result, KODO_RENDER_PROBE_MAX_OBJECT_BYTES);
      }
      throw new Error("probe_command_forbidden");
    },
  });
}

async function boundedForm(req) {
  if (!/^application\/x-www-form-urlencoded(?:;|$)/i.test(req.headers?.["content-type"] ?? "")) {
    return null;
  }
  let total = 0;
  const parts = [];
  try {
    for await (const chunk of req) {
      total += chunk.byteLength;
      if (total > 512) return null;
      parts.push(Buffer.from(chunk));
    }
  } catch {
    return null;
  }
  const params = new URLSearchParams(Buffer.concat(parts).toString("utf8"));
  const keys = [...params.keys()];
  return keys.length === 1 && keys[0] === "approval" ? params.get("approval") : null;
}

export function createV1KodoRenderOneShotProbe({
  env = process.env,
  currentSha,
  d1Client,
  s3Client,
  createD1Client = createCloudflareD1Http,
  createS3Client = createP2KodoS3Client,
  clock = () => new Date(),
} = {}) {
  if (!allowedConfig(env, currentSha)) return null;
  const masterKey = decodeMasterKey(env.SHENSHU_KODO_MASTER_KEY_BASE64);
  if (!masterKey || typeof clock !== "function" ||
      !env.SHENSHU_KODO_BUCKET || !env.SHENSHU_KODO_ACCESS_KEY_ID ||
      !env.SHENSHU_KODO_SECRET_ACCESS_KEY) return null;

  // Lazily create clients only AFTER an authenticated owner POST passes
  // all gates; even startup must make no D1 or Kodo requests.
  return Object.freeze({
    async handleRequest(req, res, url) {
      if (url?.pathname !== KODO_RENDER_PROBE_PATH) return false;
      const session = readPrivatePlayerSession(req, {
        sessionSecret: env.SHENSHU_PLAYER_SESSION_SECRET,
        clock: () => clock().valueOf(),
      });
      if (!session) { reply(res, 401, "login_required"); return true; }
      if (req.method === "GET") { form(res); return true; }
      if (req.method !== "POST") { reply(res, 405, "method_not_allowed"); return true; }
      if (req.headers?.origin !== STAGING_RESOURCE_ORIGIN ||
          (req.headers?.["sec-fetch-site"] != null &&
           req.headers["sec-fetch-site"] !== "same-origin")) {
        reply(res, 403, "origin_forbidden"); return true;
      }
      const approval = await boundedForm(req);
      const secret = env.SHENSHU_KODO_RENDER_PROBE_APPROVAL_TOKEN;
      if (!TOKEN.test(approval ?? "") ||
          !timingSafeEqual(Buffer.from(approval), Buffer.from(secret))) {
        reply(res, 403, "approval_forbidden"); return true;
      }

      // Global permanent lock, shared by every process/deploy. NO refund or
      // retry if a D1/PUT/GET response was lost or uncertain.
      let client;
      try {
        client = d1Client ?? createD1Client({ env });
        const now = clock();
        if (!(now instanceof Date) || !Number.isFinite(now.valueOf())) {
          throw new Error("probe_clock_invalid");
        }
        const claimed = await client.query(CLAIM_ONCE, [
          KODO_RENDER_PROBE_LOCK_ID, now.valueOf(),
        ]);
        if (!Array.isArray(claimed) || claimed.length !== 1 ||
            claimed[0]?.probe_id !== KODO_RENDER_PROBE_LOCK_ID) {
          reply(res, 409, "probe_already_spent_or_unavailable");
          return true;
        }
      } catch {
        reply(res, 503, "probe_lock_unavailable");
        return true;
      }

      const counters = { put: 0, get: 0 };
      let kodo;
      try {
        kodo = s3Client ?? createS3Client({
          accessKeyId: env.SHENSHU_KODO_ACCESS_KEY_ID,
          secretAccessKey: env.SHENSHU_KODO_SECRET_ACCESS_KEY,
          sessionToken: env.SHENSHU_KODO_SESSION_TOKEN,
          requestTimeoutMs: 10000,
        });
        const backend = createP2KodoPrivateAudioBackend({
          s3Client: limitedClient(kodo, counters),
          bucket: env.SHENSHU_KODO_BUCKET,
          prefix: KODO_DEFAULT_PREFIX,
          masterKey,
          clock,
          requestTimeoutMs: 10000,
        });
        const audio = Buffer.from(makeInlineToneFixture().audioBase64, "base64");
        const started = clock().valueOf();
        const createdAt = new Date(started).toISOString();
        const saved = await backend.putLatest({
          principal: FIXED_OWNER,
          recordId: "voice_" + "7".repeat(32),
          audio,
          mimeType: "audio/wav",
          durationSeconds: 0.7,
          createdAt,
          expiresAt: new Date(started + PROBE_AUDIO_TTL_SECONDS * 1000).toISOString(),
        });
        if (saved?.stored !== true) throw new Error("probe_not_stored");
        const read = await backend.getLatest({ principal: FIXED_OWNER, now: clock() });
        if (!read?.audio || !Buffer.from(read.audio).equals(audio)) {
          throw new Error("probe_readback_failed");
        }
        if (counters.put !== 1 || counters.get !== 1) {
          throw new Error("probe_count_invalid");
        }
        reply(res, 200, "private_roundtrip_verified");
      } catch {
        reply(res, 503, "probe_outcome_unknown");
      } finally {
        kodo?.destroy?.();
      }
      return true;
    },
  });
}
