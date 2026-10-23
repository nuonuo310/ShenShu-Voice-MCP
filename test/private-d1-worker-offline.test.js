import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { createPrivateWorkerCandidate } from "../worker/private-d1-worker-candidate.js";
import {
  applyPaidSchema,
  countRows,
  localSqliteAvailable,
  openPaidSqlite,
} from "./fixtures/local-sqlite-atomic-client.mjs";
import { createWorkerD1Binding } from "./fixtures/worker-d1-binding-contract.mjs";

const NOW_MS = Date.parse("2026-10-23T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const PRINCIPAL = "principal_worker_0001";
const ADMIT_PATH = "/internal/v1/paid-operations/admit";
const STATUS_PATH = "/internal/v1/paid-operations/status";
const PENDING_PATH = "/internal/v1/paid-operations/provider-pending";
const COMPLETED_PATH = "/internal/v1/paid-operations/completed";
const UNKNOWN_PATH = "/internal/v1/paid-operations/unknown";
const sqliteTest = (name, fn) => test(name, {
  skip: localSqliteAvailable ? false : "node:sqlite requires Node 22 or newer",
}, fn);

function digest(text) {
  return createHash("sha256").update(text, "utf8").digest("base64url");
}

function admitBody(overrides = {}) {
  return {
    version: 1,
    principal: PRINCIPAL,
    operation_id: "operation_worker_0001",
    action: "generate_shenshu_voice",
    text_digest: digest("bounded worker text"),
    text_bytes: 19,
    ttl_ms: 300000,
    ...overrides,
  };
}

function makeDb() {
  const db = openPaidSqlite();
  applyPaidSchema(db);
  return db;
}

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

function makeCandidate(binding, {
  now = { value: NOW_MS },
  maximumDailyCalls = 3,
  authorize = async () => true,
  makeRequestId,
  makeGrantId,
} = {}) {
  let requestNumber = 0;
  let grantNumber = 0;
  const candidate = createPrivateWorkerCandidate({
    env: binding ? { DB: binding } : {},
    authorize,
    clock: () => now.value,
    maximumDailyCalls,
    makeRequestId: makeRequestId ?? (() =>
      "request_worker_" + String(++requestNumber).padStart(4, "0")),
    makeGrantId: makeGrantId ?? (() =>
      "grant_worker_" + String(++grantNumber).padStart(4, "0")),
  });
  return { candidate, now };
}

async function call(candidate, path, body, {
  method = "POST",
  contentType = "application/json",
  query = "",
} = {}) {
  const request = new Request("https://private.invalid" + path + query, {
    method,
    headers: contentType ? { "content-type": contentType } : {},
    body: method === "POST"
      ? (typeof body === "string" ? body : JSON.stringify(body))
      : undefined,
  });
  const response = await candidate.fetch(request);
  return { response, payload: await response.json() };
}

function assertNoSensitiveResponse(payload) {
  const text = JSON.stringify(payload);
  assert.doesNotMatch(text, /grant_id|grantId|text_digest|textDigest|Bearer|authorization/i);
}

sqliteTest("admit is idempotent, owner scoped and never exposes the grant", async () => {
  const db = makeDb();
  try {
    const binding = createWorkerD1Binding(db);
    const { candidate } = makeCandidate(binding);
    const first = await call(candidate, ADMIT_PATH, admitBody());
    assert.equal(first.response.status, 200);
    assert.equal(first.payload.status, "admitted");
    assert.equal(first.payload.state, "admitted");
    assert.equal(first.payload.slot, 1);
    assertNoSensitiveResponse(first.payload);

    const replay = await call(candidate, ADMIT_PATH, admitBody());
    assert.equal(replay.response.status, 200);
    assert.equal(replay.payload.status, "replay");
    assert.equal(replay.payload.request_id, first.payload.request_id);
    assert.equal(replay.payload.slot, 1);

    const status = await call(candidate, STATUS_PATH, {
      version: 1,
      principal: PRINCIPAL,
      operation_id: "operation_worker_0001",
    });
    assert.equal(status.response.status, 200);
    assert.equal(status.payload.status, "found");
    assert.equal(status.payload.state, "admitted");

    const foreignStatus = await call(candidate, STATUS_PATH, {
      version: 1,
      principal: "principal_worker_other",
      operation_id: "operation_worker_0001",
    });
    assert.equal(foreignStatus.response.status, 404);
    assert.equal(foreignStatus.payload.status, "not_found");

    const conflict = await call(candidate, ADMIT_PATH, admitBody({
      text_digest: digest("different bounded text"),
    }));
    assert.equal(conflict.response.status, 409);
    assert.equal(conflict.payload.status, "conflict");

    assert.equal(countRows(db, "paid_voice_reservations"), 1);
    assert.equal(countRows(db, "paid_voice_grants"), 1);
    assert.equal(countRows(db, "paid_voice_operations"), 1);
    assert.equal(db.prepare("SELECT state FROM paid_voice_grants").get().state, "consumed");
  } finally {
    db.close();
  }
});

sqliteTest("state transitions are ordered, owner bound and terminal states do not retry", async () => {
  const db = makeDb();
  try {
    const binding = createWorkerD1Binding(db);
    const { candidate } = makeCandidate(binding);
    const admitted = await call(candidate, ADMIT_PATH, admitBody());
    const keys = {
      version: 1,
      principal: PRINCIPAL,
      operation_id: "operation_worker_0001",
      request_id: admitted.payload.request_id,
    };

    const completedTooSoon = await call(candidate, COMPLETED_PATH, {
      ...keys,
      result_ref: "result_worker_0001",
    });
    assert.equal(completedTooSoon.response.status, 409);

    const pending = await call(candidate, PENDING_PATH, keys);
    assert.equal(pending.response.status, 200);
    assert.equal(pending.payload.state, "provider_pending");
    const pendingAgain = await call(candidate, PENDING_PATH, keys);
    assert.equal(pendingAgain.response.status, 409);

    const completed = await call(candidate, COMPLETED_PATH, {
      ...keys,
      result_ref: "result_worker_0001",
    });
    assert.equal(completed.response.status, 200);
    assert.equal(completed.payload.state, "completed");

    const finalStatus = await call(candidate, STATUS_PATH, {
      version: 1,
      principal: PRINCIPAL,
      operation_id: "operation_worker_0001",
    });
    assert.equal(finalStatus.payload.state, "completed");
    assert.equal(finalStatus.payload.result_ref, "result_worker_0001");
    assertNoSensitiveResponse(finalStatus.payload);

    const completedAgain = await call(candidate, COMPLETED_PATH, {
      ...keys,
      result_ref: "result_worker_0002",
    });
    assert.equal(completedAgain.response.status, 409);
    const unknownAfterCompleted = await call(candidate, UNKNOWN_PATH, keys);
    assert.equal(unknownAfterCompleted.response.status, 409);

    const foreignTransition = await call(candidate, PENDING_PATH, {
      ...keys,
      principal: "principal_worker_other",
    });
    assert.equal(foreignTransition.response.status, 409);
  } finally {
    db.close();
  }
});

sqliteTest("daily limit, UTC rollover and grant one-use fail closed", async () => {
  const db = makeDb();
  try {
    const binding = createWorkerD1Binding(db);
    const { candidate, now } = makeCandidate(binding, { maximumDailyCalls: 1 });
    const first = await call(candidate, ADMIT_PATH, admitBody());
    assert.equal(first.response.status, 200);
    assert.equal(first.payload.slot, 1);

    const limited = await call(candidate, ADMIT_PATH, admitBody({
      operation_id: "operation_worker_0002",
      text_digest: digest("second operation"),
    }));
    assert.equal(limited.response.status, 429);
    assert.equal(limited.payload.status, "daily_limit");
    assert.equal(countRows(db, "paid_voice_reservations"), 1);

    now.value += DAY_MS;
    const nextDay = await call(candidate, ADMIT_PATH, admitBody({
      operation_id: "operation_worker_0003",
      text_digest: digest("next day operation"),
    }));
    assert.equal(nextDay.response.status, 200);
    assert.equal(nextDay.payload.slot, 1);
    assert.equal(countRows(db, "paid_voice_reservations"), 2);
    assert.equal(countRows(db, "paid_voice_grants"), 2);
    assert.equal(countRows(db, "paid_voice_operations"), 2);
  } finally {
    db.close();
  }

  const collisionDb = makeDb();
  try {
    const binding = createWorkerD1Binding(collisionDb);
    let requestNumber = 0;
    const { candidate } = makeCandidate(binding, {
      makeRequestId: () => "request_collision_" + String(++requestNumber).padStart(4, "0"),
      makeGrantId: () => "grant_collision_fixed",
    });
    const first = await call(candidate, ADMIT_PATH, admitBody());
    assert.equal(first.response.status, 200);
    const second = await call(candidate, ADMIT_PATH, admitBody({
      operation_id: "operation_worker_0002",
      text_digest: digest("grant collision"),
    }));
    assert.equal(second.response.status, 503);
    assert.equal(countRows(collisionDb, "paid_voice_reservations"), 1);
    assert.equal(countRows(collisionDb, "paid_voice_grants"), 1);
    assert.equal(countRows(collisionDb, "paid_voice_operations"), 1);
  } finally {
    collisionDb.close();
  }
});

sqliteTest("expired operations stop replay and transitions without writing again", async () => {
  const db = makeDb();
  try {
    const binding = createWorkerD1Binding(db);
    const { candidate, now } = makeCandidate(binding);
    const admitted = await call(candidate, ADMIT_PATH, admitBody({ ttl_ms: 1000 }));
    assert.equal(admitted.response.status, 200);
    const keys = {
      version: 1,
      principal: PRINCIPAL,
      operation_id: "operation_worker_0001",
      request_id: admitted.payload.request_id,
    };

    now.value += 1001;
    const replay = await call(candidate, ADMIT_PATH, admitBody({ ttl_ms: 1000 }));
    assert.equal(replay.response.status, 410);
    assert.equal(replay.payload.status, "expired");
    const status = await call(candidate, STATUS_PATH, {
      version: 1,
      principal: PRINCIPAL,
      operation_id: "operation_worker_0001",
    });
    assert.equal(status.response.status, 410);
    assert.equal(status.payload.status, "expired");
    const pending = await call(candidate, PENDING_PATH, keys);
    assert.equal(pending.response.status, 409);

    assert.equal(countRows(db, "paid_voice_reservations"), 1);
    assert.equal(countRows(db, "paid_voice_grants"), 1);
    assert.equal(countRows(db, "paid_voice_operations"), 1);
  } finally {
    db.close();
  }
});

sqliteTest("a request-id collision rolls back the entire four-statement batch", async () => {
  const db = makeDb();
  try {
    const day = new Date(NOW_MS).toISOString().slice(0, 10);
    db.prepare(
      "INSERT INTO paid_voice_reservations (request_id, principal, day_utc, slot) VALUES (?1, ?2, ?3, 1)",
    ).run("request_collision_worker", PRINCIPAL, day);
    const binding = createWorkerD1Binding(db);
    const { candidate } = makeCandidate(binding, {
      makeRequestId: () => "request_collision_worker",
      makeGrantId: () => "grant_collision_worker",
    });
    const result = await call(candidate, ADMIT_PATH, admitBody());
    assert.equal(result.response.status, 503);
    assert.equal(binding.stats.batchCalls, 1);
    assert.equal(countRows(db, "paid_voice_reservations"), 1);
    assert.equal(countRows(db, "paid_voice_grants"), 0);
    assert.equal(countRows(db, "paid_voice_operations"), 0);
  } finally {
    db.close();
  }
});

sqliteTest("malformed, short, failed or throwing D1 responses never become success", async () => {
  const shapes = [
    async () => [],
    async () => [
      { success: true, results: [], meta: {} },
      { success: true, results: [], meta: {} },
      { success: true, results: [], meta: {} },
    ],
    async () => [
      { success: false, results: [], meta: {} },
      { success: true, results: [], meta: {} },
      { success: true, results: [], meta: {} },
      { success: true, results: [], meta: {} },
    ],
    async () => { throw new Error("simulated_timeout"); },
  ];
  for (const batch of shapes) {
    const db = makeDb();
    try {
      const real = createWorkerD1Binding(db);
      const malformed = {
        stats: real.stats,
        prepare: real.prepare,
        batch,
      };
      const { candidate } = makeCandidate(malformed);
      const result = await call(candidate, ADMIT_PATH, admitBody());
      assert.equal(result.response.status, 503);
      assert.equal(countRows(db, "paid_voice_reservations"), 0);
      assert.equal(countRows(db, "paid_voice_grants"), 0);
      assert.equal(countRows(db, "paid_voice_operations"), 0);
    } finally {
      db.close();
    }
  }
});

test("strict routing, authorization and bounded JSON reject before D1", async () => {
  const binding = makeCountingBinding();
  const { candidate } = makeCandidate(binding);
  const cases = [];
  cases.push(await call(candidate, "/internal/v1/paid-operations/other", admitBody()));
  cases.push(await call(candidate, ADMIT_PATH, null, { method: "GET" }));
  cases.push(await call(candidate, ADMIT_PATH, admitBody(), { contentType: "text/plain" }));
  cases.push(await call(candidate, ADMIT_PATH, admitBody(), {
    contentType: "application/json; charset=utf-8",
  }));
  cases.push(await call(candidate, ADMIT_PATH, admitBody(), { query: "?debug=1" }));
  cases.push(await call(candidate, ADMIT_PATH, { ...admitBody(), text: "secret raw text" }));
  cases.push(await call(candidate, ADMIT_PATH, { ...admitBody(), request_id: "request_caller_0001" }));
  cases.push(await call(candidate, ADMIT_PATH, { ...admitBody(), grant_id: "grant_caller_0001" }));
  cases.push(await call(candidate, ADMIT_PATH, { ...admitBody(), action: "speak" }));
  cases.push(await call(candidate, ADMIT_PATH, { ...admitBody(), text_digest: "short" }));
  cases.push(await call(candidate, ADMIT_PATH, { ...admitBody(), text_bytes: 0 }));
  cases.push(await call(candidate, ADMIT_PATH, { ...admitBody(), ttl_ms: 999 }));
  cases.push(await call(candidate, ADMIT_PATH, { ...admitBody(), ttl_ms: 900001 }));
  cases.push(await call(candidate, ADMIT_PATH, "{"));
  cases.push(await call(candidate, ADMIT_PATH, {
    ...admitBody(),
    padding: "x".repeat(3000),
  }));
  assert.deepEqual(cases.map(entry => entry.response.status),
    [404, 405, 415, 415, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 413]);
  assert.equal(cases[1].response.headers.get("allow"), "POST");
  assert.equal(cases[0].response.headers.get("access-control-allow-origin"), null);
  assert.equal(binding.stats.prepareCalls, 0);
  assert.equal(binding.stats.batchCalls, 0);

  for (const authorize of [async () => false, async () => { throw new Error("denied"); }]) {
    const guardedBinding = makeCountingBinding();
    const { candidate: guarded } = makeCandidate(guardedBinding, { authorize });
    const result = await call(guarded, ADMIT_PATH, admitBody());
    assert.equal(result.response.status, 403);
    assert.equal(guardedBinding.stats.prepareCalls, 0);
    assert.equal(guardedBinding.stats.batchCalls, 0);
  }

  const forgedBinding = makeCountingBinding();
  const { candidate: forgedCandidate } = makeCandidate(forgedBinding, {
    authorize: async () => false,
  });
  const forged = new Request("https://private.invalid" + ADMIT_PATH, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cf-access-jwt-assertion": "forged-token",
      "cf-access-client-id": "forged-client",
    },
    body: JSON.stringify(admitBody()),
  });
  const result = await forgedCandidate.fetch(forged);
  assert.equal(result.status, 403);
  assert.equal(forgedBinding.stats.prepareCalls, 0);
  assert.equal(forgedBinding.stats.batchCalls, 0);
});

test("missing D1 binding and invalid factory configuration fail closed", async () => {
  const { candidate } = makeCandidate(null);
  const result = await call(candidate, ADMIT_PATH, admitBody());
  assert.equal(result.response.status, 503);
  assert.equal(result.payload.error, "operation_store_unavailable");
  assert.throws(
    () => createPrivateWorkerCandidate({ env: {}, authorize: null }),
    /private_worker_config_invalid/,
  );
});

sqliteTest("independent competing Worker requests allocate distinct slots and enforce limit", async () => {
  const dir = mkdtempSync(join(tmpdir(), "shenshu-private-worker-"));
  const dbPath = join(dir, "paid.sqlite");
  const db = openPaidSqlite(dbPath, { wal: false });
  applyPaidSchema(db);
  db.close();
  try {
    const jobs = 4;
    const arrivals = new SharedArrayBuffer(4);
    const release = new SharedArrayBuffer(4);
    const workerUrl = new URL("./fixtures/private-worker-concurrency.mjs", import.meta.url);
    const workers = [];
    const completions = Array.from({ length: jobs }, (_, index) => new Promise((resolve, reject) => {
      const worker = new Worker(workerUrl, {
        workerData: {
          dbPath,
          arrivals,
          release,
          index,
          now: NOW_MS,
          principal: PRINCIPAL,
          maximumDailyCalls: 3,
        },
      });
      workers.push(worker);
      let settled = false;
      worker.once("message", message => {
        settled = true;
        resolve(message);
      });
      worker.once("error", error => {
        settled = true;
        reject(error);
      });
      worker.once("exit", code => {
        if (!settled && code !== 0) reject(new Error("worker_exit_" + code));
      });
    }));

    const arrivalView = new Int32Array(arrivals);
    const deadline = Date.now() + 15000;
    while (Atomics.load(arrivalView, 0) < jobs) {
      if (Date.now() > deadline) throw new Error("worker_barrier_timeout");
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    const releaseView = new Int32Array(release);
    Atomics.store(releaseView, 0, 1);
    Atomics.notify(releaseView, 0, jobs);

    const results = await Promise.all(completions);
    assert.ok(results.every(result => result.ok), JSON.stringify(results));
    const admitted = results.filter(result => result.status === "admitted");
    const limited = results.filter(result => result.status === "daily_limit");
    assert.equal(admitted.length, 3);
    assert.equal(limited.length, 1);
    assert.deepEqual(admitted.map(result => result.slot).sort(), [1, 2, 3]);

    const verify = openPaidSqlite(dbPath, { wal: false });
    try {
      assert.equal(countRows(verify, "paid_voice_reservations"), 3);
      assert.equal(countRows(verify, "paid_voice_grants"), 3);
      assert.equal(countRows(verify, "paid_voice_operations"), 3);
      assert.equal(verify.prepare(
        "SELECT COUNT(*) AS count FROM paid_voice_grants WHERE state = 'consumed'",
      ).get().count, 3);
    } finally {
      verify.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the Worker candidate remains dormant and has no REST, provider, secret or Node import", () => {
  const source = readFileSync(
    new URL("../worker/private-d1-worker-candidate.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /env\?\.DB/);
  assert.match(source, /db\.batch\(prepared\)/);
  assert.match(source, /D1_OPERATION_SQL\.reserveStrict/);
  assert.doesNotMatch(source, /fetchImpl|cloudflare-d1-http|CF_D1_API_TOKEN|CF-Access|minimax/i);
  assert.doesNotMatch(source, /from\s+["']node:/);
  assert.doesNotMatch(source, /INSERT\s+INTO[\s\S]*\$\{/i);

  const server = readFileSync(new URL("../server.js", import.meta.url), "utf8");
  const staging = readFileSync(
    new URL("../src/staging-authenticated-mcp.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(server, /private-d1-worker/);
  assert.doesNotMatch(staging, /private-d1-worker/);
});
