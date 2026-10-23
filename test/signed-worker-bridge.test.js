import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { WORKER_SIGNED_REQUEST_HEADERS, signWorkerRequest } from "../src/worker-signed-request.js";
import {
  createSignedD1WorkerBridge,
  signWorkerOperationRequest,
} from "../worker/signed-d1-worker-bridge.js";
import {
  applyPaidSchema,
  countRows,
  localSqliteAvailable,
  openPaidSqlite,
} from "./fixtures/local-sqlite-atomic-client.mjs";
import { createWorkerD1Binding } from "./fixtures/worker-d1-binding-contract.mjs";

const NOW_MS = Date.parse("2026-10-23T12:00:00.000Z");
const NOW_SECONDS = Math.floor(NOW_MS / 1_000);
const ORIGIN = "https://private-worker.invalid";
const ADMIT_PATH = "/internal/v1/paid-operations/admit";
const STATUS_PATH = "/internal/v1/paid-operations/status";
const KEY_ID = "test_bridge_20261023";
const OLD_KEY_ID = "test_old_bridge_20261023";
const THIRD_KEY_ID = "test_third_bridge_20261023";
const NONCE = "bridge_nonce_1234567890";
const PRINCIPAL = "principal_bridge_0001";
const OTHER_PRINCIPAL = "principal_bridge_0002";
const OPERATION_ID = "operation_bridge_0001";
const TEXT = "bounded signed bridge text";
const TEXT_DIGEST = createHash("sha256").update(TEXT, "utf8").digest("base64url");
const SECRET = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const OLD_SECRET = Uint8Array.from({ length: 32 }, (_, index) => 255 - index);
const THIRD_SECRET = Uint8Array.from({ length: 32 }, (_, index) => 64 + index);
const SECRET_B64 = Buffer.from(SECRET).toString("base64url");
const OLD_SECRET_B64 = Buffer.from(OLD_SECRET).toString("base64url");
const THIRD_SECRET_B64 = Buffer.from(THIRD_SECRET).toString("base64url");
const sqliteTest = (name, fn) => test(name, {
  skip: localSqliteAvailable ? false : "node:sqlite requires Node 22 or newer",
}, fn);

function makeCountingBinding() {
  const stats = { prepareCalls: 0, batchCalls: 0 };
  return {
    stats,
    prepare() {
      stats.prepareCalls += 1;
      throw new Error("d1_must_not_be_called");
    },
    async batch() {
      stats.batchCalls += 1;
      throw new Error("d1_must_not_be_called");
    },
  };
}

function makeBridge(binding, {
  keyring = { [KEY_ID]: SECRET_B64 },
  now = NOW_MS,
  maximumDailyCalls = 3,
} = {}) {
  let requestNumber = 0;
  let grantNumber = 0;
  const clock = { value: now };
  const bridge = createSignedD1WorkerBridge({
    env: binding ? { DB: binding } : {},
    keyring,
    now: () => clock.value,
    maximumDailyCalls,
    makeRequestId: () => "request_bridge_" + String(++requestNumber).padStart(4, "0"),
    makeGrantId: () => "grant_bridge_" + String(++grantNumber).padStart(4, "0"),
  });
  return { bridge, clock };
}

function signedOptions(overrides = {}) {
  return {
    workerOrigin: ORIGIN,
    kind: "admit",
    keyId: KEY_ID,
    secret: SECRET_B64,
    principal: PRINCIPAL,
    operationId: OPERATION_ID,
    textDigest: TEXT_DIGEST,
    textBytes: Buffer.byteLength(TEXT),
    ttlMs: 300_000,
    timestamp: NOW_SECONDS,
    nonce: NONCE,
    ...overrides,
  };
}

async function signedRequest(overrides = {}) {
  return signWorkerOperationRequest(signedOptions(overrides));
}

async function invokeSigned(bridge, signed, overrides = {}) {
  const headers = overrides.headers ?? signed.headers;
  const request = new Request(overrides.url ?? signed.url, {
    method: overrides.method ?? signed.method,
    headers,
    body: overrides.body !== undefined ? overrides.body : signed.body,
  });
  const response = await bridge.fetch(request);
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {}
  return { response, text, payload };
}

function assertNoAuthLeak(text) {
  assert.doesNotMatch(text, new RegExp(SECRET_B64));
  assert.doesNotMatch(text, new RegExp(OLD_SECRET_B64));
  assert.doesNotMatch(text, new RegExp(THIRD_SECRET_B64));
  assert.doesNotMatch(text, /Bearer|authorization|x-shenshu-signature|text_digest|grant_id/i);
}

test("the Render signer emits only schema-exact fields and no secret material", async () => {
  const signed = await signWorkerOperationRequest({
    ...signedOptions(),
    bearer: "forged-bearer",
    text: TEXT,
    model_id: "forged-model",
    voice_id: "forged-voice",
    sql: "DELETE FROM paid_voice_operations",
    approval: "forged-approval",
  });
  const body = JSON.parse(signed.body);
  assert.deepEqual(Object.keys(body).sort(), [
    "action", "operation_id", "principal", "text_bytes", "text_digest", "ttl_ms", "version",
  ]);
  assert.equal(body.version, 1);
  assert.equal(body.action, "generate_shenshu_voice");
  assert.equal(body.principal, PRINCIPAL);
  assert.equal(body.operation_id, OPERATION_ID);
  assert.equal(body.text_digest, TEXT_DIGEST);
  assert.equal(body.text_bytes, Buffer.byteLength(TEXT));
  assert.equal(signed.url, ORIGIN + ADMIT_PATH);
  assert.equal(signed.method, "POST");
  assert.equal(signed.headers["content-type"], "application/json");
  assert.equal(signed.headers[WORKER_SIGNED_REQUEST_HEADERS.keyId], KEY_ID);
  assert.doesNotMatch(signed.body, /forged-bearer|forged-model|forged-voice|DELETE|forged-approval/);
  assert.doesNotMatch(signed.body, new RegExp(TEXT));
  assert.doesNotMatch(JSON.stringify(signed.headers), new RegExp(SECRET_B64));

  const source = readFileSync(
    new URL("../worker/signed-d1-worker-bridge.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /workers\.dev/);
  assert.match(source, /public endpoint/i);
  assert.match(source, /allow-all hook only after the exact body/);
  assert.doesNotMatch(source, /from\s+["']node:|console\.|CF_D1_API_TOKEN|CF-Access|Authorization|Bearer|minimax/i);

  const server = readFileSync(new URL("../server.js", import.meta.url), "utf8");
  const staging = readFileSync(
    new URL("../src/staging-authenticated-mcp.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(server, /signed-d1-worker-bridge|createSignedD1WorkerBridge/);
  assert.doesNotMatch(staging, /signed-d1-worker-bridge|createSignedD1WorkerBridge/);
});

test("unsigned, forged, stale and confused requests are denied before D1", async () => {
  const binding = makeCountingBinding();
  const { bridge } = makeBridge(binding);
  const valid = await signedRequest();
  const denied = [];

  async function expectDenied(request) {
    const response = await bridge.fetch(request);
    const text = await response.text();
    assert.equal(response.status, 403);
    assert.equal(text, JSON.stringify({ error: "not_authorized" }));
    assert.equal(response.headers.get("cache-control"), "no-store");
    assertNoAuthLeak(text);
  }

  denied.push(await invokeSigned(bridge, valid, {
    headers: { ...valid.headers, [WORKER_SIGNED_REQUEST_HEADERS.signature]: "A".repeat(43) },
  }));
  denied.push(await invokeSigned(bridge, await signedRequest({ timestamp: NOW_SECONDS - 31 })));
  denied.push(await invokeSigned(bridge, await signedRequest({ timestamp: NOW_SECONDS + 31 })));
  denied.push(await invokeSigned(bridge, valid, {
    url: "https://other-worker.invalid" + ADMIT_PATH,
  }));
  denied.push(await invokeSigned(bridge, valid, { url: ORIGIN + STATUS_PATH }));
  denied.push(await invokeSigned(bridge, valid, {
    headers: { ...valid.headers, "content-type": "application/json; charset=utf-8" },
  }));
  denied.push(await invokeSigned(bridge, valid, { url: ORIGIN + ADMIT_PATH + "?debug=1" }));
  denied.push(await invokeSigned(bridge, valid, { url: "http://private-worker.invalid" + ADMIT_PATH }));
  denied.push(await invokeSigned(bridge, valid, { body: valid.body + " " }));

  await expectDenied(new Request(ORIGIN + ADMIT_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: valid.body,
  }));
  await expectDenied(new Request(ORIGIN + ADMIT_PATH, {
    method: "GET",
    headers: valid.headers,
  }));
  await expectDenied(new Request(ORIGIN + ADMIT_PATH, {
    method: "POST",
    headers: { ...valid.headers, "content-length": String(Buffer.byteLength(valid.body) - 1) },
    body: valid.body,
  }));
  await expectDenied(new Request(ORIGIN + ADMIT_PATH, {
    method: "POST",
    headers: { ...valid.headers, "content-length": "2049" },
    body: valid.body,
  }));

  for (const result of denied) {
    assert.equal(result.response.status, 403);
    assert.deepEqual(result.payload, { error: "not_authorized" });
    assertNoAuthLeak(result.text);
  }
  assert.equal(binding.stats.prepareCalls, 0);
  assert.equal(binding.stats.batchCalls, 0);
});

test("an oversized stream is cancelled before verification or D1", async () => {
  const binding = makeCountingBinding();
  const { bridge } = makeBridge(binding);
  let pulls = 0;
  let cancelled = false;
  const body = new ReadableStream({
    pull(controller) {
      pulls += 1;
      if (pulls === 1) controller.enqueue(new Uint8Array(1_024));
      else if (pulls === 2) controller.enqueue(new Uint8Array(1_025));
      else controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request(ORIGIN + ADMIT_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    duplex: "half",
  });
  const response = await bridge.fetch(request);
  assert.equal(response.status, 403);
  assert.equal(cancelled, true);
  assert.equal(request.bodyUsed, true);
  assert.equal(binding.stats.prepareCalls, 0);
  assert.equal(binding.stats.batchCalls, 0);
});

test("missing or malformed key and factory configuration fail closed", () => {
  assert.throws(() => createSignedD1WorkerBridge({ env: {} }), /signed_bridge_config_invalid/);
  assert.throws(() => createSignedD1WorkerBridge({
    env: {},
    keyring: {
      [KEY_ID]: SECRET_B64,
      [OLD_KEY_ID]: OLD_SECRET_B64,
      [THIRD_KEY_ID]: THIRD_SECRET_B64,
    },
  }), /signed_bridge_config_invalid/);
  assert.throws(() => createSignedD1WorkerBridge({
    env: {},
    keyring: { [KEY_ID]: "short" },
  }), /signed_bridge_config_invalid/);
  assert.throws(() => createSignedD1WorkerBridge({
    env: {},
    keyring: { [KEY_ID]: SECRET_B64 },
    now: null,
  }), /signed_bridge_config_invalid/);
  assert.throws(() => createSignedD1WorkerBridge({
    env: {},
    keyring: { [KEY_ID]: SECRET_B64 },
    maximumDailyCalls: 0,
  }), /signed_bridge_config_invalid/);
});

function makeDb() {
  const db = openPaidSqlite();
  applyPaidSchema(db);
  return db;
}

sqliteTest("a valid signed admit reaches D1 and signed status recovers it", async () => {
  const db = makeDb();
  try {
    const binding = createWorkerD1Binding(db);
    const { bridge } = makeBridge(binding);
    const admitted = await invokeSigned(bridge, await signedRequest());
    assert.equal(admitted.response.status, 200);
    assert.equal(admitted.payload.status, "admitted");
    assert.equal(admitted.payload.state, "admitted");
    assert.equal(admitted.payload.operation_id, OPERATION_ID);
    assert.equal(admitted.payload.slot, 1);
    assertNoAuthLeak(admitted.text);

    const status = await invokeSigned(bridge, await signedRequest({ kind: "status" }));
    assert.equal(status.response.status, 200);
    assert.equal(status.payload.status, "found");
    assert.equal(status.payload.state, "admitted");
    assert.equal(status.payload.request_id, admitted.payload.request_id);
    assertNoAuthLeak(status.text);

    assert.equal(countRows(db, "paid_voice_reservations"), 1);
    assert.equal(countRows(db, "paid_voice_grants"), 1);
    assert.equal(countRows(db, "paid_voice_operations"), 1);
  } finally {
    db.close();
  }
});

sqliteTest("a validly signed malformed body is rejected before D1", async () => {
  const binding = makeCountingBinding();
  const { bridge } = makeBridge(binding);
  const headers = await signWorkerRequest({
    host: "private-worker.invalid",
    path: ADMIT_PATH,
    body: "{",
    keyId: KEY_ID,
    secret: SECRET_B64,
    timestamp: NOW_SECONDS,
    nonce: NONCE,
  });
  const response = await bridge.fetch(new Request(ORIGIN + ADMIT_PATH, {
    method: "POST",
    headers,
    body: "{",
  }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_request" });
  assert.equal(binding.stats.prepareCalls, 0);
  assert.equal(binding.stats.batchCalls, 0);
});

sqliteTest("cross-principal operation IDs remain owner isolated", async () => {
  const db = makeDb();
  try {
    const binding = createWorkerD1Binding(db);
    const { bridge } = makeBridge(binding);
    const first = await invokeSigned(bridge, await signedRequest());
    const second = await invokeSigned(bridge, await signedRequest({
      principal: OTHER_PRINCIPAL,
      nonce: "bridge_nonce_0987654321",
    }));
    assert.equal(first.payload.status, "admitted");
    assert.equal(second.payload.status, "admitted");
    assert.notEqual(first.payload.request_id, second.payload.request_id);
    assert.equal(first.payload.slot, 1);
    assert.equal(second.payload.slot, 1);
    assert.equal(countRows(db, "paid_voice_reservations"), 2);
    assert.equal(countRows(db, "paid_voice_grants"), 2);
    assert.equal(countRows(db, "paid_voice_operations"), 2);
  } finally {
    db.close();
  }
});

sqliteTest("same principal and operation with a different digest conflicts without mutation", async () => {
  const db = makeDb();
  try {
    const binding = createWorkerD1Binding(db);
    const { bridge } = makeBridge(binding);
    const admitted = await invokeSigned(bridge, await signedRequest());
    assert.equal(admitted.payload.status, "admitted");
    const otherDigest = createHash("sha256").update("different text", "utf8").digest("base64url");
    const conflict = await invokeSigned(bridge, await signedRequest({
      textDigest: otherDigest,
      nonce: "bridge_nonce_conflict_01",
    }));
    assert.equal(conflict.response.status, 409);
    assert.deepEqual(conflict.payload, { status: "conflict" });
    assert.equal(countRows(db, "paid_voice_reservations"), 1);
    assert.equal(countRows(db, "paid_voice_grants"), 1);
    assert.equal(countRows(db, "paid_voice_operations"), 1);
  } finally {
    db.close();
  }
});

sqliteTest("concurrent identical signed replay creates one reservation and no second mutation", async () => {
  const db = makeDb();
  try {
    const binding = createWorkerD1Binding(db);
    const { bridge } = makeBridge(binding);
    const signed = await signedRequest({ nonce: "bridge_nonce_concurrent1" });
    const [first, second] = await Promise.all([
      invokeSigned(bridge, signed),
      invokeSigned(bridge, signed),
    ]);
    assert.equal(first.response.status, 200);
    assert.equal(second.response.status, 200);
    assert.deepEqual([first.payload.status, second.payload.status].sort(), ["admitted", "replay"]);
    assert.equal(countRows(db, "paid_voice_reservations"), 1);
    assert.equal(countRows(db, "paid_voice_grants"), 1);
    assert.equal(countRows(db, "paid_voice_operations"), 1);

    const replay = await invokeSigned(bridge, signed);
    assert.equal(replay.response.status, 200);
    assert.equal(replay.payload.status, "replay");
    assert.equal(countRows(db, "paid_voice_reservations"), 1);
    assert.equal(countRows(db, "paid_voice_grants"), 1);
    assert.equal(countRows(db, "paid_voice_operations"), 1);
  } finally {
    db.close();
  }
});

sqliteTest("commit-then-lost response is ambiguous, then signed status recovers without duplicate", async () => {
  const db = makeDb();
  try {
    const base = createWorkerD1Binding(db);
    let loseNextResponse = true;
    const binding = {
      stats: base.stats,
      prepare: (...args) => base.prepare(...args),
      async batch(statements) {
        const results = await base.batch(statements);
        if (loseNextResponse) {
          loseNextResponse = false;
          throw new Error("response_lost_after_commit");
        }
        return results;
      },
    };
    const { bridge } = makeBridge(binding);
    const ambiguous = await invokeSigned(bridge, await signedRequest());
    assert.equal(ambiguous.response.status, 503);
    assert.deepEqual(ambiguous.payload, { error: "operation_store_unavailable" });
    assert.equal(countRows(db, "paid_voice_reservations"), 1);
    assert.equal(countRows(db, "paid_voice_grants"), 1);
    assert.equal(countRows(db, "paid_voice_operations"), 1);
    const committedRequestId = db.prepare(
      "SELECT request_id FROM paid_voice_operations WHERE principal = ? AND operation_id = ?",
    ).get(PRINCIPAL, OPERATION_ID).request_id;

    const status = await invokeSigned(bridge, await signedRequest({
      kind: "status",
      nonce: "bridge_nonce_status_after1",
    }));
    assert.equal(status.response.status, 200);
    assert.equal(status.payload.status, "found");
    assert.equal(status.payload.state, "admitted");
    assert.equal(status.payload.request_id, committedRequestId);

    const retry = await invokeSigned(bridge, await signedRequest({
      nonce: "bridge_nonce_retry_after1",
    }));
    assert.equal(retry.response.status, 200);
    assert.equal(retry.payload.status, "replay");
    assert.equal(retry.payload.request_id, committedRequestId);
    assert.equal(countRows(db, "paid_voice_reservations"), 1);
    assert.equal(countRows(db, "paid_voice_grants"), 1);
    assert.equal(countRows(db, "paid_voice_operations"), 1);
  } finally {
    db.close();
  }
});

sqliteTest("current and previous keys verify while an unavailable third key is denied before D1", async () => {
  const db = makeDb();
  try {
    const binding = createWorkerD1Binding(db);
    const keyring = { [KEY_ID]: SECRET_B64, [OLD_KEY_ID]: OLD_SECRET_B64 };
    const { bridge } = makeBridge(binding, { keyring });
    const current = await invokeSigned(bridge, await signedRequest({
      operationId: "operation_bridge_new1",
      nonce: "bridge_nonce_current01",
    }));
    const previous = await invokeSigned(bridge, await signedRequest({
      keyId: OLD_KEY_ID,
      secret: OLD_SECRET_B64,
      operationId: "operation_bridge_old1",
      nonce: "bridge_nonce_previous1",
    }));
    assert.equal(current.payload.status, "admitted");
    assert.equal(previous.payload.status, "admitted");
    assert.equal(countRows(db, "paid_voice_operations"), 2);
  } finally {
    db.close();
  }

  const counting = makeCountingBinding();
  const { bridge: deniedBridge } = makeBridge(counting, {
    keyring: { [KEY_ID]: SECRET_B64, [OLD_KEY_ID]: OLD_SECRET_B64 },
  });
  const unavailable = await invokeSigned(deniedBridge, await signedRequest({
    keyId: THIRD_KEY_ID,
    secret: THIRD_SECRET_B64,
    operationId: "operation_bridge_third1",
    nonce: "bridge_nonce_third0001",
  }));
  assert.equal(unavailable.response.status, 403);
  assert.deepEqual(unavailable.payload, { error: "not_authorized" });
  assert.equal(counting.stats.prepareCalls, 0);
  assert.equal(counting.stats.batchCalls, 0);
});
