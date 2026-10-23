/**
 * Dormant offline bridge between a Render-side HMAC signer and the existing
 * Worker D1 candidate.
 *
 * The bridge is intentionally unreferenced by server.js or any MCP route. Its
 * signature check is the authentication boundary even when the future Worker
 * is reachable through a public workers.dev hostname. A public endpoint remains
 * subject to request flooding and Free-plan quota consumption.
 *
 * The operation state machine, not a nonce table, remains the durable replay
 * anchor. This module has no Node built-in, network, provider or secret-source
 * import.
 */
import {
  WORKER_SIGNED_REQUEST_MAX_BODY_BYTES,
  createWorkerRequestVerifier,
  signWorkerRequest,
} from "../src/worker-signed-request.js";
import { createPrivateWorkerCandidate } from "./private-d1-worker-candidate.js";

const ACTION = "generate_shenshu_voice";
const MIN_TTL_MS = 1_000;
const MAX_TTL_MS = 15 * 60 * 1000;
const IDENT = /^[A-Za-z0-9_-]{8,128}$/;
const DIGEST = /^[A-Za-z0-9_-]{43}$/;
const ROUTES = Object.freeze({
  admit: "/internal/v1/paid-operations/admit",
  status: "/internal/v1/paid-operations/status",
  "provider-pending": "/internal/v1/paid-operations/provider-pending",
  completed: "/internal/v1/paid-operations/completed",
  unknown: "/internal/v1/paid-operations/unknown",
});

function fail() {
  throw new Error("signed_request_invalid");
}

function configInvalid() {
  throw new Error("signed_bridge_config_invalid");
}

function denial() {
  return new Response(JSON.stringify({ error: "not_authorized" }), {
    status: 403,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function validIdent(value) {
  return typeof value === "string" && IDENT.test(value);
}

function validTtl(value) {
  return Number.isSafeInteger(value) && value >= MIN_TTL_MS && value <= MAX_TTL_MS;
}

function workerTarget(workerOrigin) {
  let url;
  try {
    url = new URL(workerOrigin);
  } catch {
    fail();
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "" ||
      url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    fail();
  }
  return url.origin;
}

function operationBody({
  kind,
  principal,
  operationId,
  textDigest,
  textBytes,
  ttlMs,
  requestId,
  resultRef,
}) {
  if (!validIdent(principal) || !validIdent(operationId)) fail();
  if (kind === "admit") {
    if (!DIGEST.test(textDigest ?? "") ||
        !Number.isSafeInteger(textBytes) || textBytes < 1 || textBytes > 800 ||
        !validTtl(ttlMs)) {
      fail();
    }
    return {
      version: 1,
      principal,
      operation_id: operationId,
      action: ACTION,
      text_digest: textDigest,
      text_bytes: textBytes,
      ttl_ms: ttlMs,
    };
  }
  if (kind === "status") {
    return { version: 1, principal, operation_id: operationId };
  }
  if (!validIdent(requestId)) fail();
  if (kind === "completed") {
    if (!validIdent(resultRef)) fail();
    return {
      version: 1,
      principal,
      operation_id: operationId,
      request_id: requestId,
      result_ref: resultRef,
    };
  }
  return {
    version: 1,
    principal,
    operation_id: operationId,
    request_id: requestId,
  };
}

/**
 * Build and sign one fixed, schema-exact internal operation request. The caller
 * must supply an already verified opaque principal binding. Extra properties
 * are ignored and can never be serialized into the request body.
 */
export async function signWorkerOperationRequest({
  workerOrigin,
  kind,
  keyId,
  secret,
  principal,
  operationId,
  textDigest,
  textBytes,
  ttlMs = 300_000,
  requestId,
  resultRef,
  timestamp,
  nonce,
} = {}) {
  if (typeof kind !== "string" || !Object.hasOwn(ROUTES, kind)) fail();
  const path = ROUTES[kind];
  const origin = workerTarget(workerOrigin);
  const body = JSON.stringify(operationBody({
    kind,
    principal,
    operationId,
    textDigest,
    textBytes,
    ttlMs,
    requestId,
    resultRef,
  }));
  const url = new URL(path, origin);
  const headers = await signWorkerRequest({
    method: "POST",
    host: url.host,
    path: url.pathname,
    contentType: "application/json",
    body,
    keyId,
    secret,
    timestamp,
    nonce,
  });
  return Object.freeze({
    url: url.href,
    method: "POST",
    headers,
    body,
  });
}

async function readBoundedBody(request) {
  const declaredText = request.headers.get("content-length");
  let declared = null;
  if (declaredText !== null) {
    if (!/^[1-9][0-9]{0,4}$/.test(declaredText)) fail();
    declared = Number(declaredText);
    if (declared > WORKER_SIGNED_REQUEST_MAX_BODY_BYTES) fail();
  }
  if (request.bodyUsed === true || !request.body ||
      typeof request.body.getReader !== "function") {
    fail();
  }

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (!item || typeof item !== "object") fail();
      if (item.done) break;
      if (!(item.value instanceof Uint8Array)) fail();
      total += item.value.byteLength;
      if (total > WORKER_SIGNED_REQUEST_MAX_BODY_BYTES) {
        try {
          await reader.cancel("body_too_large");
        } catch {}
        fail();
      }
      if (item.value.byteLength > 0) chunks.push(item.value.slice());
    }
  } catch {
    try {
      await reader.cancel("body_read_failed");
    } catch {}
    fail();
  } finally {
    try {
      reader.releaseLock();
    } catch {}
  }

  if (total < 1 || (declared !== null && total !== declared)) fail();
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function requestTarget(request) {
  if (!request || typeof request !== "object" ||
      typeof request.method !== "string" || typeof request.url !== "string" ||
      !request.headers || typeof request.headers.get !== "function") {
    fail();
  }
  let url;
  try {
    url = new URL(request.url);
  } catch {
    fail();
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "" ||
      url.search !== "" || url.hash !== "") {
    fail();
  }
  return url;
}

/**
 * Create the dormant signed bridge around the existing D1 candidate. The
 * candidate is called with an allow-all hook only after the exact body bytes
 * and signed metadata have been verified. The rebuilt request contains only
 * the verified body and the fixed content type; no caller auth headers reach
 * the D1 adapter.
 */
export function createSignedD1WorkerBridge({
  env,
  keyring,
  now = () => Date.now(),
  maximumDailyCalls = 3,
  makeRequestId,
  makeGrantId,
} = {}) {
  if (typeof now !== "function") configInvalid();

  let verifier;
  let candidate;
  try {
    verifier = createWorkerRequestVerifier({
      keyring,
      clock: () => {
        const milliseconds = now();
        if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) fail();
        return Math.floor(milliseconds / 1_000);
      },
    });
    candidate = createPrivateWorkerCandidate({
      env,
      authorize: async () => true,
      clock: now,
      maximumDailyCalls,
      makeRequestId,
      makeGrantId,
    });
  } catch {
    configInvalid();
  }

  return Object.freeze({
    async fetch(request) {
      let forwarded;
      try {
        const url = requestTarget(request);
        const contentType = request.headers.get("content-type") ?? "";
        const bytes = await readBoundedBody(request);
        const verified = await verifier({
          method: request.method,
          host: url.host,
          path: url.pathname,
          contentType,
          body: bytes,
          headers: request.headers,
        });
        if (verified?.ok !== true || !(verified.bodyBytes instanceof Uint8Array)) fail();
        forwarded = new Request(url.href, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: verified.bodyBytes,
        });
      } catch {
        return denial();
      }
      return candidate.fetch(forwarded);
    },
  });
}
