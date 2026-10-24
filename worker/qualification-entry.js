/**
 * Qualification-only Cloudflare Worker module entrypoint.
 *
 * This is deliberately dormant until the deployment environment supplies an
 * exact test activation tuple. Authentication remains the existing signed
 * bridge: no D1 binding is touched until HMAC verification succeeds. The only
 * D1 binding name is DB; there is no fallback to another database or Worker.
 */
import { createSignedD1WorkerBridge } from "./signed-d1-worker-bridge.js";

export const QUALIFICATION_WORKER_NAME = "shenshu-voice-v1-qualification-20261024";
export const QUALIFICATION_D1_DATABASE_NAME = "shenshu-voice-v1-qualification-20261024";
export const QUALIFICATION_D1_DATABASE_ID = "234913cd-8901-4607-8147-31c4a4317111";
export const QUALIFICATION_MODE = "qualification";
export const QUALIFICATION_ROUTES = Object.freeze([
  "/internal/v1/paid-operations/admit",
  "/internal/v1/paid-operations/status",
  "/internal/v1/paid-operations/provider-pending",
  "/internal/v1/paid-operations/completed",
  "/internal/v1/paid-operations/unknown",
]);
export const QUALIFICATION_ENV_NAMES = Object.freeze({
  enabled: "QUALIFICATION_WORKER_ENABLED",
  mode: "QUALIFICATION_MODE",
  expectedHost: "QUALIFICATION_EXPECTED_HOST",
  keyId: "QUALIFICATION_HMAC_KEY_ID",
  secret: "QUALIFICATION_HMAC_SECRET",
});

const ROUTES = new Set(QUALIFICATION_ROUTES);
const EXPECTED_HOST = new RegExp(
  "^" + QUALIFICATION_WORKER_NAME.replaceAll("-", "\\-") +
  "\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.workers\\.dev$",
);
const KEY_ID = /^[A-Za-z0-9_-]{8,64}$/;
const SECRET = /^[A-Za-z0-9_-]{43,86}$/;
const DECLARED_LENGTH = /^[1-9][0-9]{0,4}$/;
const MAX_BODY_BYTES = 2048;

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function disabled() {
  return {
    fetch: async () => jsonResponse(404, { error: "not_found" }),
  };
}

function unavailable() {
  return {
    fetch: async () => jsonResponse(503, { error: "qualification_unavailable" }),
  };
}

function denial() {
  return jsonResponse(403, { error: "not_authorized" });
}

function resolveConfiguration(env) {
  if (!env || typeof env !== "object" || Array.isArray(env) ||
      env[QUALIFICATION_ENV_NAMES.enabled] !== "1") {
    return Object.freeze({ status: "disabled" });
  }
  if (env[QUALIFICATION_ENV_NAMES.mode] !== QUALIFICATION_MODE ||
      typeof env[QUALIFICATION_ENV_NAMES.expectedHost] !== "string" ||
      !EXPECTED_HOST.test(env[QUALIFICATION_ENV_NAMES.expectedHost].toLowerCase()) ||
      !KEY_ID.test(env[QUALIFICATION_ENV_NAMES.keyId] ?? "") ||
      !SECRET.test(env[QUALIFICATION_ENV_NAMES.secret] ?? "") ||
      !env.DB || typeof env.DB.prepare !== "function" ||
      typeof env.DB.batch !== "function") {
    return Object.freeze({ status: "invalid" });
  }
  return Object.freeze({
    status: "ready",
    expectedHost: env[QUALIFICATION_ENV_NAMES.expectedHost].toLowerCase(),
    keyId: env[QUALIFICATION_ENV_NAMES.keyId],
    secret: env[QUALIFICATION_ENV_NAMES.secret],
  });
}

function validRequestShape(request, expectedHost) {
  try {
    if (!request || typeof request !== "object" ||
        request.method !== "POST" || typeof request.url !== "string" ||
        !request.headers || typeof request.headers.get !== "function") {
      return false;
    }
    const url = new URL(request.url);
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "" ||
        url.search !== "" || url.hash !== "" || url.host !== expectedHost ||
        !ROUTES.has(url.pathname)) {
      return false;
    }
    if (request.headers.get("content-type") !== "application/json") return false;
    const declared = request.headers.get("content-length");
    return declared === null ||
      (DECLARED_LENGTH.test(declared) && Number(declared) <= MAX_BODY_BYTES);
  } catch {
    return false;
  }
}

/**
 * Build the request handler with injection points for offline tests. Missing or
 * malformed configuration never constructs a D1 client. Invalid request shape
 * and authentication return the same generic 403 before the body is read.
 */
export function createQualificationWorker({
  env,
  now = () => Date.now(),
  makeRequestId,
  makeGrantId,
} = {}) {
  const configuration = resolveConfiguration(env);
  if (configuration.status === "disabled") return Object.freeze(disabled());
  if (configuration.status !== "ready" || typeof now !== "function") {
    return Object.freeze(unavailable());
  }

  let bridge;
  try {
    bridge = createSignedD1WorkerBridge({
      env,
      keyring: { [configuration.keyId]: configuration.secret },
      now,
      maximumDailyCalls: 3,
      makeRequestId,
      makeGrantId,
    });
  } catch {
    return Object.freeze(unavailable());
  }

  return Object.freeze({
    async fetch(request) {
      try {
        if (!validRequestShape(request, configuration.expectedHost)) return denial();
        return await bridge.fetch(request);
      } catch {
        return jsonResponse(503, { error: "qualification_unavailable" });
      }
    },
  });
}

export default Object.freeze({
  async fetch(request, env) {
    return createQualificationWorker({ env }).fetch(request);
  },
});
