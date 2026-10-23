import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  WORKER_SIGNED_REQUEST_HEADERS,
  createWorkerRequestVerifier,
  signWorkerRequest,
} from "../src/worker-signed-request.js";

const KEY_ID = "test_key_20261023";
const OLD_KEY_ID = "test_old_20261023";
const HOST = "private-worker.invalid";
const PATH = "/internal/v1/paid-operations/admit";
const NOW_SECONDS = Math.floor(Date.parse("2026-10-23T12:00:00.000Z") / 1000);
const NONCE = "nonce_1234567890abcdef";
const BODY = JSON.stringify({
  version: 1,
  principal: "principal_test_0001",
  operation_id: "operation_test_0001",
  action: "generate_shenshu_voice",
  text_digest: "A".repeat(43),
  text_bytes: 19,
  ttl_ms: 300000,
});
const BODY_BYTES = new TextEncoder().encode(BODY);
const SECRET = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const SECRET_B64 = Buffer.from(SECRET).toString("base64url");
const OLD_SECRET = Uint8Array.from({ length: 32 }, (_, index) => 255 - index);

function signedRequest(overrides = {}) {
  return signWorkerRequest({
    method: "POST",
    host: HOST,
    path: PATH,
    contentType: "application/json",
    body: BODY,
    keyId: KEY_ID,
    secret: SECRET_B64,
    timestamp: NOW_SECONDS,
    nonce: NONCE,
    ...overrides,
  });
}

function requestParts(overrides = {}) {
  return {
    method: "POST",
    host: HOST,
    path: PATH,
    contentType: "application/json",
    body: BODY_BYTES,
    ...overrides,
  };
}

test("a signed request verifies without exposing the secret or body", async () => {
  const headers = await signedRequest();
  const verify = createWorkerRequestVerifier({
    keyring: { [KEY_ID]: SECRET_B64 },
    clock: () => NOW_SECONDS,
  });
  const result = await verify({
    ...requestParts(),
    headers,
  });
  assert.equal(result.ok, true);
  assert.equal(result.keyId, KEY_ID);
  assert.equal(result.timestamp, NOW_SECONDS);
  assert.equal(result.nonce, NONCE);
  assert.equal(result.bodyDigest.length, 43);
  assert.equal(headers["content-type"], "application/json");
  assert.equal(Object.hasOwn(headers, "x-shenshu-secret"), false);
  assert.doesNotMatch(JSON.stringify(headers), new RegExp(SECRET_B64));
  assert.doesNotMatch(JSON.stringify(headers), /generate_shenshu_voice|operation_test/);
});

test("signature binding covers method, host, path, content type, body and metadata", async () => {
  const headers = await signedRequest();
  const verify = createWorkerRequestVerifier({
    keyring: { [KEY_ID]: SECRET_B64 },
    clock: () => NOW_SECONDS,
  });
  const rejected = [
    requestParts({ method: "GET" }),
    requestParts({ host: "other-worker.invalid" }),
    requestParts({ path: "/internal/v1/paid-operations/status" }),
    requestParts({ contentType: "application/json; charset=utf-8" }),
    requestParts({ body: new TextEncoder().encode(BODY + " ") }),
  ];
  for (const parts of rejected) {
    await assert.rejects(verify({ ...parts, headers }), /signed_request_invalid/);
  }

  const tampered = {
    ...headers,
    [WORKER_SIGNED_REQUEST_HEADERS.nonce]: "nonce_abcdefghijklmnopqrst",
  };
  await assert.rejects(verify({ ...requestParts(), headers: tampered }), /signed_request_invalid/);
  await assert.rejects(verify({
    ...requestParts(),
    headers: { ...headers, [WORKER_SIGNED_REQUEST_HEADERS.signature]: "A".repeat(43) },
  }), /signed_request_invalid/);
});

test("timestamp skew is bounded in both directions", async () => {
  const verify = createWorkerRequestVerifier({
    keyring: { [KEY_ID]: SECRET_B64 },
    clock: () => NOW_SECONDS,
    maxSkewSeconds: 30,
  });
  for (const timestamp of [NOW_SECONDS - 30, NOW_SECONDS, NOW_SECONDS + 30]) {
    const headers = await signedRequest({ timestamp });
    await assert.doesNotReject(verify({ ...requestParts(), headers }));
  }
  for (const timestamp of [NOW_SECONDS - 31, NOW_SECONDS + 31]) {
    const headers = await signedRequest({ timestamp });
    await assert.rejects(verify({ ...requestParts(), headers }), /signed_request_invalid/);
  }
  await assert.rejects(verify({
    ...requestParts(),
    headers: { ...await signedRequest(), [WORKER_SIGNED_REQUEST_HEADERS.timestamp]: "not-a-time" },
  }), /signed_request_invalid/);
});

test("unknown keys, malformed headers and oversized bodies fail closed", async () => {
  const verify = createWorkerRequestVerifier({
    keyring: { [KEY_ID]: SECRET_B64 },
    clock: () => NOW_SECONDS,
  });
  const headers = await signedRequest();
  await assert.rejects(verify({
    ...requestParts(),
    headers: { ...headers, [WORKER_SIGNED_REQUEST_HEADERS.keyId]: "test_unknown_key" },
  }), /signed_request_invalid/);

  for (const header of Object.values(WORKER_SIGNED_REQUEST_HEADERS)) {
    const copy = { ...headers };
    delete copy[header];
    await assert.rejects(verify({ ...requestParts(), headers: copy }), /signed_request_invalid/);
  }
  await assert.rejects(verify({
    ...requestParts({ body: new TextEncoder().encode("x".repeat(2049)) }),
    headers,
  }), /signed_request_invalid/);
  await assert.rejects(verify({
    ...requestParts({ path: "/internal/v1/paid-operations/admit?debug=1" }),
    headers,
  }), /signed_request_invalid/);
  await assert.rejects(verify({
    ...requestParts(),
    headers: { ...headers, [WORKER_SIGNED_REQUEST_HEADERS.nonce]: "bad\nnonce" },
  }), /signed_request_invalid/);
});

test("a bounded two-key rotation window accepts old or new and rejects a third", async () => {
  const oldHeaders = await signedRequest({ keyId: OLD_KEY_ID, secret: OLD_SECRET });
  const newHeaders = await signedRequest();
  const verifier = createWorkerRequestVerifier({
    keyring: { [KEY_ID]: SECRET_B64, [OLD_KEY_ID]: OLD_SECRET },
    clock: () => NOW_SECONDS,
  });
  assert.equal((await verifier({ ...requestParts(), headers: oldHeaders })).ok, true);
  assert.equal((await verifier({ ...requestParts(), headers: newHeaders })).ok, true);

  const onlyNew = createWorkerRequestVerifier({
    keyring: { [KEY_ID]: SECRET_B64 },
    clock: () => NOW_SECONDS,
  });
  await assert.rejects(onlyNew({ ...requestParts(), headers: oldHeaders }), /signed_request_invalid/);
  assert.throws(() => createWorkerRequestVerifier({
    keyring: { [KEY_ID]: SECRET_B64, [OLD_KEY_ID]: OLD_SECRET, third_key: SECRET_B64 },
    clock: () => NOW_SECONDS,
  }), /signed_request_config_invalid/);
});

test("the verifier accepts Headers objects but not duplicate or injected fields", async () => {
  const headers = await signedRequest();
  const verify = createWorkerRequestVerifier({
    keyring: { [KEY_ID]: SECRET_B64 },
    clock: () => NOW_SECONDS,
  });
  const webHeaders = new Headers(headers);
  assert.equal((await verify({ ...requestParts(), headers: webHeaders })).ok, true);

  const duplicate = {
    ...headers,
    "X-SHENSHU-NONCE": headers[WORKER_SIGNED_REQUEST_HEADERS.nonce],
  };
  await assert.rejects(verify({ ...requestParts(), headers: duplicate }), /signed_request_invalid/);
});

test("the signer rejects malformed inputs and the contract remains offline-only", async () => {
  await assert.rejects(signedRequest({ body: "x".repeat(2049) }), /signed_request_invalid/);
  await assert.rejects(signedRequest({ path: "/internal/v1/paid-operations/admit?x=1" }), /signed_request_invalid/);
  await assert.rejects(signedRequest({ nonce: "short" }), /signed_request_invalid/);
  await assert.rejects(signedRequest({ secret: "short" }), /signed_request_config_invalid/);
  assert.throws(() => createWorkerRequestVerifier({
    keyring: { [KEY_ID]: new Uint8Array(31) },
    clock: () => NOW_SECONDS,
  }), /signed_request_config_invalid/);
  assert.throws(() => createWorkerRequestVerifier({
    keyring: { [KEY_ID]: SECRET_B64 },
    clock: () => NOW_SECONDS,
    maxSkewSeconds: 301,
  }), /signed_request_config_invalid/);

  const source = readFileSync(new URL("../src/worker-signed-request.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from\s+["']node:|fetch\s*\(|CF_D1_API_TOKEN|CF-Access|minimax/i);
  assert.match(source, /subtle\.verify/);
  assert.match(source, /WORKER_SIGNED_REQUEST_VERSION/);
});
