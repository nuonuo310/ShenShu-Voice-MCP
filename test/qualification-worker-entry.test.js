import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  WORKER_SIGNED_REQUEST_HEADERS,
  signWorkerRequest,
} from "../src/worker-signed-request.js";
import { signWorkerOperationRequest } from "../worker/signed-d1-worker-bridge.js";
import {
  QUALIFICATION_D1_DATABASE_ID,
  QUALIFICATION_D1_DATABASE_NAME,
  QUALIFICATION_ENV_NAMES,
  QUALIFICATION_MODE,
  QUALIFICATION_ROUTES,
  QUALIFICATION_WORKER_NAME,
  createQualificationWorker,
  default as qualificationWorker,
} from "../worker/qualification-entry.js";
import {
  applyPaidSchema,
  countRows,
  localSqliteAvailable,
  openPaidSqlite,
} from "./fixtures/local-sqlite-atomic-client.mjs";
import { createWorkerD1Binding } from "./fixtures/worker-d1-binding-contract.mjs";

const HOST = "shenshu-voice-v1-qualification-20261024.test-account.workers.dev";
const ORIGIN = "https://" + HOST;
const ADMIT_PATH = "/internal/v1/paid-operations/admit";
const STATUS_PATH = "/internal/v1/paid-operations/status";
const KEY_ID = "v1qual_test_20261024";
const SECRET = Uint8Array.from({ length: 32 }, (_, index) => index + 7);
const SECRET_B64 = Buffer.from(SECRET).toString("base64url");
const NOW_MS = Date.parse("2026-10-24T16:00:00.000Z");
const NOW_SECONDS = Math.floor(NOW_MS / 1_000);
const PRINCIPAL = "dryrun_qualification_worker_0001";
const OPERATION_ID = "operation_qualification_0001";
const TEXT = "bounded qualification worker text";
const TEXT_DIGEST = createHash("sha256").update(TEXT, "utf8").digest("base64url");
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

function makeEnv(binding, overrides = {}) {
  const env = {
    [QUALIFICATION_ENV_NAMES.enabled]: "1",
    [QUALIFICATION_ENV_NAMES.mode]: QUALIFICATION_MODE,
    [QUALIFICATION_ENV_NAMES.expectedHost]: HOST,
    [QUALIFICATION_ENV_NAMES.keyId]: KEY_ID,
    [QUALIFICATION_ENV_NAMES.secret]: SECRET_B64,
    DB: binding,
    ...overrides,
  };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete env[key];
  }
  return env;
}

function makeWorker(binding, envOverrides = {}, options = {}) {
  let requestNumber = 0;
  let grantNumber = 0;
  const clock = { value: NOW_MS };
  const worker = createQualificationWorker({
    env: makeEnv(binding, envOverrides),
    now: () => clock.value,
    makeRequestId: () => "request_qualification_" + String(++requestNumber).padStart(4, "0"),
    makeGrantId: () => "grant_qualification_" + String(++grantNumber).padStart(4, "0"),
    ...options,
  });
  return { worker, clock };
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
    nonce: "qualification_nonce_0001",
    ...overrides,
  };
}

async function signedRequest(overrides = {}) {
  return signWorkerOperationRequest(signedOptions(overrides));
}

async function invoke(worker, signed, overrides = {}) {
  const request = new Request(overrides.url ?? signed.url, {
    method: overrides.method ?? signed.method,
    headers: overrides.headers ?? signed.headers,
    body: overrides.body !== undefined ? overrides.body : signed.body,
  });
  const response = await worker.fetch(request);
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {}
  return { response, text, payload };
}

test("the qualification manifest has exactly one fixed D1 binding and no cloud identity", () => {
  const manifest = JSON.parse(readFileSync(
    new URL("../wrangler.qualification.json", import.meta.url),
    "utf8",
  ));
  assert.equal(manifest.name, QUALIFICATION_WORKER_NAME);
  assert.equal(manifest.main, "worker/qualification-entry.js");
  assert.equal(manifest.compatibility_date, "2026-10-24");
  assert.equal(manifest.workers_dev, false);
  assert.equal(Array.isArray(manifest.d1_databases), true);
  assert.equal(manifest.d1_databases.length, 1);
  assert.deepEqual(manifest.d1_databases[0], {
    binding: "DB",
    database_name: QUALIFICATION_D1_DATABASE_NAME,
    database_id: QUALIFICATION_D1_DATABASE_ID,
  });
  assert.equal(Object.hasOwn(manifest, "account_id"), false);
  assert.equal(Object.hasOwn(manifest, "routes"), false);
  assert.equal(Object.hasOwn(manifest, "vars"), false);
  assert.equal(Object.hasOwn(manifest.d1_databases[0], "preview_database_id"), false);
  assert.doesNotMatch(JSON.stringify(manifest), /c39a6895-7028-4f59-a100-1455b92c96c1/i);
  assert.doesNotMatch(JSON.stringify(manifest), /secret|token|password|api[_-]?key/i);
});

test("the entrypoint is dormant-by-default and imports no Node, provider or secret source", () => {
  const source = readFileSync(
    new URL("../worker/qualification-entry.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /createSignedD1WorkerBridge/);
  assert.match(source, /env\.DB/);
  assert.match(source, /QUALIFICATION_WORKER_ENABLED/);
  assert.doesNotMatch(source, /from\s+["']node:/);
  assert.doesNotMatch(source, /console\.|minimax|CF_D1_API_TOKEN|CF_D1_ACCOUNT_ID/i);
  assert.doesNotMatch(source, /from\s+["'][^"']*provider[^"']*["']/i);
  assert.doesNotMatch(source, /https?:\/\//);
  assert.doesNotMatch(source, /a4e000|f5a0fb|2fab14/i);
  assert.deepEqual(QUALIFICATION_ROUTES, [
    ADMIT_PATH,
    STATUS_PATH,
    "/internal/v1/paid-operations/provider-pending",
    "/internal/v1/paid-operations/completed",
    "/internal/v1/paid-operations/unknown",
  ]);
});

test("missing, disabled or unsafe activation configuration fails closed before D1", async () => {
  const cases = [
    ["disabled", makeEnv(makeCountingBinding(), {
      [QUALIFICATION_ENV_NAMES.enabled]: "0",
    }), 404, { error: "not_found" }],
    ["missing enabled", makeEnv(makeCountingBinding(), {
      [QUALIFICATION_ENV_NAMES.enabled]: undefined,
    }), 404, { error: "not_found" }],
    ["wrong mode", makeEnv(makeCountingBinding(), {
      [QUALIFICATION_ENV_NAMES.mode]: "production",
    }), 503, { error: "qualification_unavailable" }],
    ["missing mode", makeEnv(makeCountingBinding(), {
      [QUALIFICATION_ENV_NAMES.mode]: undefined,
    }), 503, { error: "qualification_unavailable" }],
    ["missing host", makeEnv(makeCountingBinding(), {
      [QUALIFICATION_ENV_NAMES.expectedHost]: undefined,
    }), 503, { error: "qualification_unavailable" }],
    ["old worker host", makeEnv(makeCountingBinding(), {
      [QUALIFICATION_ENV_NAMES.expectedHost]: "asteria-voice.example.workers.dev",
    }), 503, { error: "qualification_unavailable" }],
    ["host with port", makeEnv(makeCountingBinding(), {
      [QUALIFICATION_ENV_NAMES.expectedHost]: HOST + ":8443",
    }), 503, { error: "qualification_unavailable" }],
    ["missing key id", makeEnv(makeCountingBinding(), {
      [QUALIFICATION_ENV_NAMES.keyId]: undefined,
    }), 503, { error: "qualification_unavailable" }],
    ["missing secret", makeEnv(makeCountingBinding(), {
      [QUALIFICATION_ENV_NAMES.secret]: undefined,
    }), 503, { error: "qualification_unavailable" }],
    ["short secret", makeEnv(makeCountingBinding(), {
      [QUALIFICATION_ENV_NAMES.secret]: "short",
    }), 503, { error: "qualification_unavailable" }],
    ["missing DB", makeEnv(null, { DB: undefined }), 503, {
      error: "qualification_unavailable",
    }],
    ["partial DB", makeEnv({ prepare() {} }), 503, {
      error: "qualification_unavailable",
    }],
  ];

  for (const [name, env, status, payload] of cases) {
    const worker = createQualificationWorker({ env });
    const response = await worker.fetch(new Request(ORIGIN + ADMIT_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }));
    assert.equal(response.status, status, name);
    assert.deepEqual(await response.json(), payload, name);
    if (env?.DB?.stats) {
      assert.equal(env.DB.stats.prepareCalls, 0, name);
      assert.equal(env.DB.stats.batchCalls, 0, name);
    }
  }

  const response = await qualificationWorker.fetch(
    new Request(ORIGIN + ADMIT_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
    {},
  );
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "not_found" });
});

test("unsigned, confused or forged requests return one 403 with zero D1 prepare/batch", async () => {
  const binding = makeCountingBinding();
  const { worker } = makeWorker(binding);
  const valid = await signedRequest();

  const requests = [
    ["unsigned", new Request(ORIGIN + ADMIT_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: valid.body,
    })],
    ["wrong host", new Request(
      "https://shenshu-voice-v1-qualification-20261024.other-account.workers.dev" + ADMIT_PATH,
      { method: "POST", headers: valid.headers, body: valid.body },
    )],
    ["wrong path", new Request(ORIGIN + "/internal/v1/paid-operations/other", {
      method: "POST", headers: valid.headers, body: valid.body,
    })],
    ["query", new Request(ORIGIN + ADMIT_PATH + "?debug=1", {
      method: "POST", headers: valid.headers, body: valid.body,
    })],
    ["GET", new Request(ORIGIN + ADMIT_PATH, {
      method: "GET", headers: valid.headers,
    })],
    ["content type", new Request(ORIGIN + ADMIT_PATH, {
      method: "POST",
      headers: { ...valid.headers, "content-type": "application/json; charset=utf-8" },
      body: valid.body,
    })],
    ["zero length", new Request(ORIGIN + ADMIT_PATH, {
      method: "POST",
      headers: { ...valid.headers, "content-length": "0" },
      body: valid.body,
    })],
  ];

  const stale = await signedRequest({ timestamp: NOW_SECONDS - 31, nonce: "qualification_nonce_stale" });
  requests.push(["stale", new Request(ORIGIN + ADMIT_PATH, {
    method: "POST", headers: stale.headers, body: stale.body,
  })]);

  const forged = {
    ...valid.headers,
    [WORKER_SIGNED_REQUEST_HEADERS.signature]: "A".repeat(43),
  };
  requests.push(["forged", new Request(ORIGIN + ADMIT_PATH, {
    method: "POST", headers: forged, body: valid.body,
  })]);

  for (const [name, request] of requests) {
    const response = await worker.fetch(request);
    const text = await response.text();
    assert.equal(response.status, 403, name);
    assert.deepEqual(JSON.parse(text), { error: "not_authorized" }, name);
    assert.equal(response.headers.get("cache-control"), "no-store", name);
  }
  assert.equal(binding.stats.prepareCalls, 0);
  assert.equal(binding.stats.batchCalls, 0);
});

sqliteTest("a valid signed request reaches only env.DB and preserves the operation state", async () => {
  const db = openPaidSqlite();
  try {
    applyPaidSchema(db);
    const binding = createWorkerD1Binding(db);
    const { worker } = makeWorker(binding);
    const admitted = await invoke(worker, await signedRequest());
    assert.equal(admitted.response.status, 200);
    assert.equal(admitted.payload.status, "admitted");
    assert.equal(admitted.payload.state, "admitted");
    assert.equal(admitted.payload.slot, 1);
    assert.doesNotMatch(admitted.text, new RegExp(SECRET_B64));
    assert.doesNotMatch(admitted.text, /text_digest|grant_id|bearer|authorization/i);
    assert.equal(countRows(db, "paid_voice_reservations"), 1);
    assert.equal(countRows(db, "paid_voice_grants"), 1);
    assert.equal(countRows(db, "paid_voice_operations"), 1);
    assert.equal(db.prepare("SELECT state FROM paid_voice_grants").get().state, "consumed");

    const status = await invoke(
      worker,
      await signedRequest({ kind: "status", nonce: "qualification_nonce_status" }),
    );
    assert.equal(status.response.status, 200);
    assert.equal(status.payload.status, "found");
    assert.equal(status.payload.state, "admitted");
    assert.equal(status.payload.request_id, admitted.payload.request_id);
    assert.equal(countRows(db, "paid_voice_reservations"), 1);
    assert.equal(countRows(db, "paid_voice_grants"), 1);
    assert.equal(countRows(db, "paid_voice_operations"), 1);
  } finally {
    db.close();
  }
});

sqliteTest("a validly signed malformed body is rejected with zero D1 calls", async () => {
  const binding = makeCountingBinding();
  const { worker } = makeWorker(binding);
  const headers = await signWorkerRequest({
    host: HOST,
    path: ADMIT_PATH,
    body: "{",
    keyId: KEY_ID,
    secret: SECRET_B64,
    timestamp: NOW_SECONDS,
    nonce: "qualification_nonce_bad_json",
  });
  const response = await worker.fetch(new Request(ORIGIN + ADMIT_PATH, {
    method: "POST",
    headers,
    body: "{",
  }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_request" });
  assert.equal(binding.stats.prepareCalls, 0);
  assert.equal(binding.stats.batchCalls, 0);
});

sqliteTest("admission replay is a no-write replay and a skipped state transition is rejected", async () => {
  const db = openPaidSqlite();
  try {
    applyPaidSchema(db);
    const binding = createWorkerD1Binding(db);
    const { worker } = makeWorker(binding);
    const admission = await signedRequest({
      nonce: "qualification_nonce_replay",
    });

    const first = await invoke(worker, admission);
    assert.equal(first.response.status, 200);
    assert.equal(first.payload.status, "admitted");
    const batchCallsAfterAdmission = binding.stats.batchCalls;
    assert.equal(batchCallsAfterAdmission, 1);

    const replay = await invoke(worker, admission);
    assert.equal(replay.response.status, 200);
    assert.equal(replay.payload.status, "replay");
    assert.equal(replay.payload.state, "admitted");
    assert.equal(replay.payload.request_id, first.payload.request_id);
    assert.equal(binding.stats.batchCalls, batchCallsAfterAdmission);
    assert.equal(countRows(db, "paid_voice_reservations"), 1);
    assert.equal(countRows(db, "paid_voice_grants"), 1);
    assert.equal(countRows(db, "paid_voice_operations"), 1);

    const skipped = await invoke(worker, await signedRequest({
      kind: "completed",
      requestId: first.payload.request_id,
      resultRef: "qualification_result_0001",
      nonce: "qualification_nonce_skipped_transition",
    }));
    assert.equal(skipped.response.status, 409);
    assert.deepEqual(skipped.payload, { error: "operation_state_invalid" });
    assert.equal(
      db.prepare("SELECT state FROM paid_voice_operations").get().state,
      "admitted",
    );
    assert.equal(countRows(db, "paid_voice_reservations"), 1);
    assert.equal(countRows(db, "paid_voice_grants"), 1);
  } finally {
    db.close();
  }
});

test("Node 24 CI is configured to run SQLite tests and syntax-check the Worker entrypoint", () => {
  const ci = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  assert.match(ci, /node-version:\s*["']24["']/);
  assert.match(ci, /node --test/);
  assert.match(ci, /node --check worker\/qualification-entry\.js/);
  assert.match(ci, /node -e "const \{ DatabaseSync \} = require\('node:sqlite'\)/);
});

test("Node 24 executes SQLite-backed tests instead of silently skipping", {
  skip: Number(process.versions.node.split(".")[0]) < 24
    ? "node:sqlite execution assertion requires Node 24 CI"
    : false,
}, () => {
  assert.equal(localSqliteAvailable, true);
});
