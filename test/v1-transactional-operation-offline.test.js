import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { createVerifiedIdentityResolver } from "../src/verified-identity.js";
import {
  buildOperationBinding,
  V1_OPERATION_DEFAULT_TTL_MS,
} from "../src/v1-transport-idempotency.js";
import { createD1TransactionalOperationStore } from "../src/d1-transactional-operation-store.js";
import { createV1TransactionalOperationRunner } from "../src/v1-transactional-operation-runner.js";
import {
  applyPaidSchema,
  countRows,
  createLocalAtomicClient,
  localSqliteAvailable,
  openPaidSqlite,
} from "./fixtures/local-sqlite-atomic-client.mjs";

const NOW_MS = Date.parse("2026-10-23T12:00:05.000Z");
const NOW_SECONDS = Math.floor(NOW_MS / 1000);
const DAY_MS = 24 * 60 * 60 * 1000;
const sqliteTest = (name, fn) => test(name, {
  skip: localSqliteAvailable ? false : "node:sqlite requires Node 22 or newer",
}, fn);
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "v1-transactional-offline-key",
  alg: "RS256",
  use: "sig",
};
const resolveVerifiedPrincipal = createVerifiedIdentityResolver({
  issuer: "https://issuer.invalid",
  audience: "https://staging.invalid/paid-mcp",
  publicJwks: [publicJwk],
  requiredScopes: ["voice:speak"],
  clock: () => NOW_MS,
});

function trustedRequest(subject = "offline-user-a") {
  const header = Buffer.from(JSON.stringify({
    alg: "RS256",
    typ: "JWT",
    kid: publicJwk.kid,
  })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({
    iss: "https://issuer.invalid",
    aud: "https://staging.invalid/paid-mcp",
    sub: subject,
    scope: "voice:speak",
    iat: NOW_SECONDS - 10,
    exp: NOW_SECONDS + 3500,
  })).toString("base64url");
  const data = header + "." + claims;
  return Object.freeze({
    headers: {
      authorization: "Bearer " + data + "." + sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url"),
    },
  });
}

async function principalFor(subject) {
  return (await resolveVerifiedPrincipal(trustedRequest(subject))).subject;
}

function input({ subject = "offline-user-a", operationId = "operation_sqlite_0001", text = "transactional voice text" } = {}) {
  return { trustedRequest: trustedRequest(subject), operationId, text };
}

function makeHarness({
  db,
  client,
  nowRef = { value: NOW_MS },
  maximumDailyCalls = 3,
  synthesize,
  makeRequestId,
  makeGrantId,
} = {}) {
  const localClient = client ?? createLocalAtomicClient(db);
  const store = createD1TransactionalOperationStore({
    client: localClient,
    clock: () => nowRef.value,
    maximumDailyCalls,
    makeRequestId,
    makeGrantId,
  });
  const providerArgs = [];
  let resultNumber = 0;
  const provider = synthesize ?? (async () => ({
    resultRef: "result_voice_" + String(++resultNumber).padStart(4, "0"),
  }));
  const invoke = createV1TransactionalOperationRunner({
    resolveVerifiedPrincipal,
    operationStore: store,
    synthesize: async args => {
      providerArgs.push(args);
      return provider(args);
    },
    clock: () => nowRef.value,
  });
  return { client: localClient, store, invoke, providerArgs, nowRef };
}

function makeMemoryDb() {
  const db = openPaidSqlite();
  applyPaidSchema(db);
  return db;
}

function schemaText(name) {
  return readFileSync(new URL("../db/d1/" + name, import.meta.url), "utf8");
}

async function runWorkers({ dbPath, jobs, maximumDailyCalls, now = NOW_MS }) {
  const arrivals = new SharedArrayBuffer(4);
  const release = new SharedArrayBuffer(4);
  const workerUrl = new URL("./fixtures/sqlite-operation-worker.mjs", import.meta.url);
  const workers = [];
  const completions = jobs.map(job => new Promise((resolve, reject) => {
    const worker = new Worker(workerUrl, {
      workerData: {
        dbPath,
        arrivals,
        release,
        maximumDailyCalls,
        now,
        ...job,
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
  try {
    const arrivalView = new Int32Array(arrivals);
    const deadline = Date.now() + 15000;
    while (Atomics.load(arrivalView, 0) < jobs.length) {
      if (Date.now() > deadline) throw new Error("worker_barrier_timeout");
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    const releaseView = new Int32Array(release);
    Atomics.store(releaseView, 0, 1);
    Atomics.notify(releaseView, 0, jobs.length);
    return await Promise.all(completions);
  } finally {
    await Promise.all(workers.map(worker => worker.terminate().catch(() => undefined)));
  }
}

async function makeFileDb(t) {
  const directory = await mkdtemp(join(tmpdir(), "shenshu-transaction-"));
  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  const dbPath = join(directory, "paid.sqlite");
  const db = openPaidSqlite(dbPath);
  applyPaidSchema(db);
  db.close();
  return { directory, dbPath };
}

sqliteTest("003 schema is additive, constrained and accepted by local SQLite with foreign keys intact", () => {
  const db = makeMemoryDb();
  try {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('paid_voice_reservations','paid_voice_grants','paid_voice_operations') ORDER BY name",
    ).all().map(row => row.name);
    assert.deepEqual(tables, ["paid_voice_grants", "paid_voice_operations", "paid_voice_reservations"]);
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name='paid_voice_operations_state_expiry'",
    ).all();
    assert.equal(indexes.length, 1);
    assert.equal(db.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);

    const source = schemaText("003_paid_voice_operations.sql");
    assert.match(source, /PRIMARY KEY\(principal, operation_id\)/);
    assert.match(source, /FOREIGN KEY\(request_id\) REFERENCES paid_voice_reservations/);
    assert.match(source, /FOREIGN KEY\(grant_id\) REFERENCES paid_voice_grants/);
    assert.doesNotMatch(source, /audio|bearer|voice_id|minimax|raw_text/i);
  } finally {
    db.close();
  }
});

sqliteTest("a generated request ID collision rolls back reservation, grant and operation together", async () => {
  const db = makeMemoryDb();
  try {
    const principal = await principalFor("offline-user-a");
    const day = new Date(NOW_MS).toISOString().slice(0, 10);
    db.prepare(
      "INSERT INTO paid_voice_reservations (request_id, principal, day_utc, slot) VALUES (?1, ?2, ?3, 1)",
    ).run("request_collision_0001", principal, day);
    const h = makeHarness({ db, makeRequestId: () => "request_collision_0001" });
    await assert.rejects(
      h.invoke(input({ operationId: "operation_request_collision" })),
      /operation_store_unavailable/,
    );
    assert.equal(h.providerArgs.length, 0);
    assert.equal(countRows(db, "paid_voice_reservations"), 1);
    assert.equal(countRows(db, "paid_voice_grants"), 0);
    assert.equal(countRows(db, "paid_voice_operations"), 0);
  } finally {
    db.close();
  }
});

sqliteTest("a generated grant ID collision rolls back the fresh reservation and operation", async () => {
  const db = makeMemoryDb();
  try {
    const principal = await principalFor("offline-user-a");
    const day = new Date(NOW_MS).toISOString().slice(0, 10);
    db.prepare(
      "INSERT INTO paid_voice_reservations (request_id, principal, day_utc, slot) VALUES (?1, ?2, ?3, 1)",
    ).run("request_seed_00000001", principal, day);
    db.prepare(
      "INSERT INTO paid_voice_grants (grant_id, request_id, principal, state) VALUES (?1, ?2, ?3, 'issued')",
    ).run("grant_collision_0001", "request_seed_00000001", principal);
    const h = makeHarness({ db, makeGrantId: () => "grant_collision_0001" });
    await assert.rejects(
      h.invoke(input({ operationId: "operation_grant_collision" })),
      /operation_store_unavailable/,
    );
    assert.equal(h.providerArgs.length, 0);
    assert.equal(countRows(db, "paid_voice_reservations"), 1);
    assert.equal(countRows(db, "paid_voice_grants"), 1);
    assert.equal(countRows(db, "paid_voice_operations"), 0);
    assert.equal(db.prepare("SELECT state FROM paid_voice_grants WHERE grant_id=?1").get("grant_collision_0001").state, "issued");
  } finally {
    db.close();
  }
});

sqliteTest("one completed SQLite operation replays its opaque result across a reopened process", async t => {
  const { dbPath } = await makeFileDb(t);
  let db = openPaidSqlite(dbPath);
  const firstHarness = makeHarness({ db });
  const first = await firstHarness.invoke(input());
  assert.deepEqual(first, {
    status: "completed",
    replayed: false,
    providerAttempts: 1,
    resultRef: "result_voice_0001",
  });
  assert.equal(firstHarness.providerArgs.length, 1);
  assert.equal(countRows(db, "paid_voice_reservations"), 1);
  assert.equal(countRows(db, "paid_voice_grants"), 1);
  assert.equal(countRows(db, "paid_voice_operations"), 1);
  db.close();

  db = openPaidSqlite(dbPath);
  try {
    const secondHarness = makeHarness({ db });
    const replay = await secondHarness.invoke(input());
    assert.deepEqual(replay, {
      status: "completed",
      replayed: true,
      providerAttempts: 0,
      resultRef: "result_voice_0001",
    });
    assert.equal(secondHarness.providerArgs.length, 0);
    assert.equal(countRows(db, "paid_voice_reservations"), 1);
    assert.equal(countRows(db, "paid_voice_grants"), 1);
    assert.equal(countRows(db, "paid_voice_operations"), 1);
  } finally {
    db.close();
  }
});

sqliteTest("a concurrent duplicate blocked at provider_pending never reaches the fake provider twice", async () => {
  const db = makeMemoryDb();
  let releaseProvider;
  let signalStarted;
  const providerStarted = new Promise(resolve => { signalStarted = resolve; });
  const providerGate = new Promise(resolve => { releaseProvider = resolve; });
  try {
    const h = makeHarness({
      db,
      synthesize: async () => {
        signalStarted();
        await providerGate;
        return { resultRef: "result_voice_0002" };
      },
    });
    const first = h.invoke(input());
    await providerStarted;
    await assert.rejects(h.invoke(input()), /operation_outcome_unknown/);
    releaseProvider();
    const completed = await first;
    const replay = await h.invoke(input());
    assert.equal(completed.providerAttempts, 1);
    assert.equal(replay.replayed, true);
    assert.equal(replay.providerAttempts, 0);
    assert.equal(h.providerArgs.length, 1);
    assert.equal(countRows(db, "paid_voice_reservations"), 1);
    assert.equal(countRows(db, "paid_voice_grants"), 1);
  } finally {
    db.close();
  }
});

sqliteTest("distinct operations with identical text remain distinct and each consumes one grant", async () => {
  const db = makeMemoryDb();
  try {
    const h = makeHarness({ db });
    const text = "two deliberate identical texts";
    await h.invoke(input({ operationId: "operation_identical_a", text }));
    await h.invoke(input({ operationId: "operation_identical_b", text }));
    assert.equal(h.providerArgs.length, 2);
    assert.equal(countRows(db, "paid_voice_reservations"), 2);
    assert.equal(countRows(db, "paid_voice_grants"), 2);
    assert.equal(countRows(db, "paid_voice_operations"), 2);
    const grants = db.prepare("SELECT state FROM paid_voice_grants").all();
    assert.deepEqual(grants.map(row => row.state), ["consumed", "consumed"]);
  } finally {
    db.close();
  }
});

sqliteTest("same operation with different text is a conflict and cannot reserve or call the provider again", async () => {
  const db = makeMemoryDb();
  try {
    const h = makeHarness({ db });
    await h.invoke(input({ operationId: "operation_sqlite_conflict", text: "first exact text" }));
    await assert.rejects(
      h.invoke(input({ operationId: "operation_sqlite_conflict", text: "different exact text" })),
      /operation_conflict/,
    );
    assert.equal(h.providerArgs.length, 1);
    assert.equal(countRows(db, "paid_voice_reservations"), 1);
    assert.equal(countRows(db, "paid_voice_grants"), 1);
    assert.equal(countRows(db, "paid_voice_operations"), 1);
  } finally {
    db.close();
  }
});

sqliteTest("the same operation ID under different principals is isolated by owner", async () => {
  const db = makeMemoryDb();
  try {
    const h = makeHarness({ db });
    await h.invoke(input({ subject: "offline-user-a", operationId: "operation_shared_owner" }));
    await h.invoke(input({ subject: "offline-user-b", operationId: "operation_shared_owner" }));
    assert.equal(h.providerArgs.length, 2);
    assert.equal(countRows(db, "paid_voice_reservations"), 2);
    assert.equal(countRows(db, "paid_voice_grants"), 2);
    assert.equal(countRows(db, "paid_voice_operations"), 2);
    const rows = db.prepare("SELECT DISTINCT principal FROM paid_voice_operations").all();
    assert.equal(rows.length, 2);
  } finally {
    db.close();
  }
});

sqliteTest("daily limit and UTC-day rollover are enforced in the real SQLite transaction", async () => {
  const db = makeMemoryDb();
  const nowRef = { value: NOW_MS };
  try {
    const h = makeHarness({ db, nowRef, maximumDailyCalls: 2 });
    await h.invoke(input({ operationId: "operation_day_a_1" }));
    await h.invoke(input({ operationId: "operation_day_a_2" }));
    await assert.rejects(h.invoke(input({ operationId: "operation_day_a_3" })), /budget_denied/);
    assert.equal(h.providerArgs.length, 2);

    nowRef.value = NOW_MS + DAY_MS;
    await h.invoke(input({ operationId: "operation_day_b_1" }));
    assert.equal(h.providerArgs.length, 3);
    const slots = db.prepare(
      "SELECT day_utc, slot FROM paid_voice_reservations ORDER BY day_utc, slot",
    ).all();
    assert.deepEqual(slots.map(row => [row.day_utc, row.slot]), [
      ["2026-10-23", 1],
      ["2026-10-23", 2],
      ["2026-10-24", 1],
    ]);
  } finally {
    db.close();
  }
});

sqliteTest("an expired completed operation fails closed without another provider attempt", async () => {
  const db = makeMemoryDb();
  const nowRef = { value: NOW_MS };
  try {
    const h = makeHarness({ db, nowRef });
    await h.invoke(input());
    nowRef.value = NOW_MS + V1_OPERATION_DEFAULT_TTL_MS;
    await assert.rejects(h.invoke(input()), /operation_expired/);
    assert.equal(h.providerArgs.length, 1);
    assert.equal(countRows(db, "paid_voice_reservations"), 1);
    assert.equal(countRows(db, "paid_voice_grants"), 1);
    assert.equal(countRows(db, "paid_voice_operations"), 1);
  } finally {
    db.close();
  }
});

sqliteTest("restart after admission but before provider start remains in progress with zero provider calls", async t => {
  const { dbPath } = await makeFileDb(t);
  const principal = await principalFor("offline-user-a");
  const operationId = "operation_crash_after_admit";
  const text = "admitted then process restarted";
  const binding = buildOperationBinding({ principal, operationId, text, issuedAt: NOW_MS });

  let db = openPaidSqlite(dbPath);
  try {
    const client = createLocalAtomicClient(db);
    const store = createD1TransactionalOperationStore({
      client,
      clock: () => NOW_MS,
      maximumDailyCalls: 3,
    });
    assert.equal((await store.admit(binding)).status, "admitted");
  } finally {
    db.close();
  }

  db = openPaidSqlite(dbPath);
  try {
    const h = makeHarness({ db });
    await assert.rejects(h.invoke(input({ operationId, text })), /operation_in_progress/);
    assert.equal(h.providerArgs.length, 0);
    assert.equal(countRows(db, "paid_voice_reservations"), 1);
    assert.equal(countRows(db, "paid_voice_grants"), 1);
    assert.equal(countRows(db, "paid_voice_operations"), 1);
  } finally {
    db.close();
  }
});

sqliteTest("unknown provider outcome is stored once and never refunded or recalled", async () => {
  const db = makeMemoryDb();
  try {
    const h = makeHarness({
      db,
      maximumDailyCalls: 1,
      synthesize: async () => { throw new Error("Bearer must-not-leak"); },
    });
    await assert.rejects(h.invoke(input()), error => {
      assert.equal(error.message, "provider_outcome_unknown");
      assert.doesNotMatch(error.message, /Bearer|must-not-leak/);
      return true;
    });
    const principal = await principalFor("offline-user-a");
    const row = db.prepare(
      "SELECT state, result_ref FROM paid_voice_operations WHERE principal=?1 AND operation_id=?2",
    ).get(principal, "operation_sqlite_0001");
    assert.deepEqual({ ...row }, { state: "unknown", result_ref: null });
    await assert.rejects(h.invoke(input()), /operation_outcome_unknown/);
    await assert.rejects(h.invoke(input({ operationId: "operation_after_unknown" })), /budget_denied/);
    assert.equal(h.providerArgs.length, 1);
    assert.equal(countRows(db, "paid_voice_grants"), 1);
  } finally {
    db.close();
  }
});

sqliteTest("completion-store failure leaves unknown state and does not recall the provider", async () => {
  const db = makeMemoryDb();
  try {
    const client = createLocalAtomicClient(db);
    const actual = createD1TransactionalOperationStore({
      client,
      clock: () => NOW_MS,
      maximumDailyCalls: 3,
    });
    const failingStore = Object.freeze({
      admit: args => actual.admit(args),
      markProviderPending: args => actual.markProviderPending(args),
      markCompleted: async () => { throw new Error("d1 completion response lost"); },
      markUnknown: args => actual.markUnknown(args),
    });
    let providerCalls = 0;
    const invoke = createV1TransactionalOperationRunner({
      resolveVerifiedPrincipal,
      operationStore: failingStore,
      synthesize: async () => {
        providerCalls += 1;
        return { resultRef: "result_voice_0007" };
      },
      clock: () => NOW_MS,
    });
    await assert.rejects(invoke(input()), /provider_outcome_unknown/);
    const principal = await principalFor("offline-user-a");
    const state = db.prepare(
      "SELECT state, result_ref FROM paid_voice_operations WHERE principal=?1 AND operation_id=?2",
    ).get(principal, "operation_sqlite_0001");
    assert.deepEqual({ ...state }, { state: "unknown", result_ref: null });
    await assert.rejects(invoke(input()), /operation_outcome_unknown/);
    assert.equal(providerCalls, 1);
  } finally {
    db.close();
  }
});

sqliteTest("a batch failure before grant consumption blocks the provider with zero writes", async () => {
  const db = makeMemoryDb();
  try {
    const local = createLocalAtomicClient(db);
    const failingClient = Object.freeze({
      atomicBatch: true,
      query: local.query,
      batch: async () => { throw new Error("d1_timeout"); },
    });
    const h = makeHarness({ db, client: failingClient });
    await assert.rejects(h.invoke(input()), /operation_store_unavailable/);
    assert.equal(h.providerArgs.length, 0);
    assert.equal(countRows(db, "paid_voice_reservations"), 0);
    assert.equal(countRows(db, "paid_voice_grants"), 0);
    assert.equal(countRows(db, "paid_voice_operations"), 0);
  } finally {
    db.close();
  }
});

sqliteTest("malformed or partial batch responses fail closed before the provider", async () => {
  const badBatches = [
    async () => null,
    async () => [],
    async () => [[], [], {}, []],
    async () => [[], [], [], [{ grant_id: "grant_partial_0001" }]],
    async () => [[{ request_id: "request_partial_01", slot: 1 }], [], [], []],
  ];
  for (const batch of badBatches) {
    const db = makeMemoryDb();
    try {
      const local = createLocalAtomicClient(db);
      const client = Object.freeze({ atomicBatch: true, query: local.query, batch });
      const h = makeHarness({ db, client });
      await assert.rejects(h.invoke(input()), /operation_store_invalid/);
      assert.equal(h.providerArgs.length, 0);
      assert.equal(countRows(db, "paid_voice_operations"), 0);
    } finally {
      db.close();
    }
  }
});

sqliteTest("caller-supplied identity, billing and provider controls are rejected before SQLite work", async () => {
  const db = makeMemoryDb();
  try {
    const h = makeHarness({ db });
    const forbidden = [
      { principal: "caller_principal" },
      { approval: true },
      { grantId: "grant_caller_0001" },
      { requestId: "request_caller_0001" },
      { modelId: "caller-model" },
      { voiceId: "caller-voice" },
      { textDigest: "A".repeat(43) },
    ];
    for (const extra of forbidden) {
      await assert.rejects(h.invoke({ ...input(), ...extra }), /invalid_input/);
    }
    await assert.rejects(h.invoke(input({ operationId: "short" })), /invalid_input/);
    await assert.rejects(h.invoke(input({ text: "   " })), /invalid_input/);
    assert.equal(h.providerArgs.length, 0);
    assert.equal(countRows(db, "paid_voice_reservations"), 0);
    assert.equal(countRows(db, "paid_voice_grants"), 0);
    assert.equal(countRows(db, "paid_voice_operations"), 0);
  } finally {
    db.close();
  }
});

sqliteTest("malformed, multirow or failed operation reads stop before any atomic write", async () => {
  const cases = [
    { query: async () => ({ principal: "wrong_shape" }), error: /operation_store_invalid/ },
    { query: async () => [{}, {}], error: /operation_store_invalid/ },
    { query: async () => { throw new Error("d1_read_failed"); }, error: /operation_store_unavailable/ },
  ];
  for (const item of cases) {
    const db = makeMemoryDb();
    try {
      let batchCalls = 0;
      const client = Object.freeze({
        atomicBatch: true,
        query: item.query,
        batch: async () => { batchCalls += 1; return []; },
      });
      const h = makeHarness({ db, client });
      await assert.rejects(h.invoke(input()), item.error);
      assert.equal(batchCalls, 0);
      assert.equal(h.providerArgs.length, 0);
      assert.equal(countRows(db, "paid_voice_operations"), 0);
    } finally {
      db.close();
    }
  }
});

sqliteTest("partial durable rows cannot replay and ownership transitions fail closed", async () => {
  const db = makeMemoryDb();
  try {
    const h = makeHarness({ db });
    await h.invoke(input());
    const principal = await principalFor("offline-user-a");
    const row = db.prepare(
      "SELECT request_id, grant_id FROM paid_voice_operations WHERE principal=?1 AND operation_id=?2",
    ).get(principal, "operation_sqlite_0001");
    db.exec("PRAGMA foreign_keys=OFF");
    db.prepare("DELETE FROM paid_voice_grants WHERE grant_id=?1").run(row.grant_id);
    db.exec("PRAGMA foreign_keys=ON");
    await assert.rejects(h.invoke(input()), /operation_store_invalid/);
    assert.equal(h.providerArgs.length, 1);

    const binding = buildOperationBinding({
      principal,
      operationId: "operation_transition_guard",
      text: "legal state transition check",
      issuedAt: NOW_MS,
    });
    const admitted = await h.store.admit(binding);
    assert.equal(admitted.status, "admitted");
    await assert.rejects(
      h.store.markCompleted({
        principal,
        operationId: "operation_transition_guard",
        requestId: admitted.record.requestId,
        resultRef: "result_voice_0003",
      }),
      /operation_state_invalid/,
    );
    await h.store.markProviderPending({
      principal,
      operationId: "operation_transition_guard",
      requestId: admitted.record.requestId,
    });
    await h.store.markCompleted({
      principal,
      operationId: "operation_transition_guard",
      requestId: admitted.record.requestId,
      resultRef: "result_voice_0003",
    });
    await assert.rejects(
      h.store.markUnknown({
        principal,
        operationId: "operation_transition_guard",
        requestId: admitted.record.requestId,
      }),
      /operation_state_invalid/,
    );
  } finally {
    db.close();
  }
});

sqliteTest("a public URL or malformed provider result becomes unknown, never a replayable success", async () => {
  const db = makeMemoryDb();
  try {
    const h = makeHarness({
      db,
      synthesize: async () => ({ resultRef: "https://public.invalid/audio.wav" }),
    });
    await assert.rejects(h.invoke(input()), /provider_outcome_unknown/);
    const principal = await principalFor("offline-user-a");
    const row = db.prepare(
      "SELECT state, result_ref FROM paid_voice_operations WHERE principal=?1 AND operation_id=?2",
    ).get(principal, "operation_sqlite_0001");
    assert.deepEqual({ ...row }, { state: "unknown", result_ref: null });
    await assert.rejects(h.invoke(input()), /operation_outcome_unknown/);
    assert.equal(h.providerArgs.length, 1);
  } finally {
    db.close();
  }
});

test("the store refuses clients that do not explicitly guarantee an atomic batch", () => {
  assert.throws(
    () => createD1TransactionalOperationStore({
      client: { query: async () => [], batch: async () => [] },
    }),
    /atomic_batch_contract_unavailable/,
  );
});

sqliteTest("twelve worker-thread attempts with limit three commit exactly three reservations", async t => {
  const { dbPath } = await makeFileDb(t);
  const db = openPaidSqlite(dbPath, { wal: false });
  try {
    const principal = await principalFor("offline-user-a");
    const jobs = Array.from({ length: 12 }, (_, index) => ({
      principal,
      operationId: "operation_worker_" + String(index + 1).padStart(2, "0"),
      text: "worker concurrent text " + index,
    }));
    const results = await runWorkers({ dbPath, jobs, maximumDailyCalls: 3 });
    assert.deepEqual(results.map(result => result.ok), Array(12).fill(true));
    const admitted = results.filter(result => result.status === "admitted");
    const denied = results.filter(result => result.status === "daily_limit");
    assert.equal(admitted.length, 3);
    assert.equal(denied.length, 9);
    assert.deepEqual(admitted.map(result => result.slot).sort((a, b) => a - b), [1, 2, 3]);
    assert.equal(countRows(db, "paid_voice_reservations"), 3);
    assert.equal(countRows(db, "paid_voice_grants"), 3);
    assert.equal(countRows(db, "paid_voice_operations"), 3);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM paid_voice_grants WHERE state='consumed'").get().count, 3);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    db.close();
  }
});

sqliteTest("worker-thread duplicates of one operation commit once and never reserve twice", async t => {
  const { dbPath } = await makeFileDb(t);
  const db = openPaidSqlite(dbPath, { wal: false });
  try {
    const principal = await principalFor("offline-user-a");
    const jobs = Array.from({ length: 5 }, () => ({
      principal,
      operationId: "operation_worker_duplicate",
      text: "exactly the same operation",
    }));
    const results = await runWorkers({ dbPath, jobs, maximumDailyCalls: 3 });
    assert.deepEqual(results.map(result => result.ok), Array(5).fill(true));
    assert.equal(results.filter(result => result.status === "admitted").length, 1);
    assert.equal(results.filter(result => result.status === "replay").length, 4);
    assert.equal(countRows(db, "paid_voice_reservations"), 1);
    assert.equal(countRows(db, "paid_voice_grants"), 1);
    assert.equal(countRows(db, "paid_voice_operations"), 1);
  } finally {
    db.close();
  }
});

test("new modules remain unmounted and do not add SQLite or provider dependencies", () => {
  const server = readFileSync(new URL("../server.js", import.meta.url), "utf8");
  const staging = readFileSync(new URL("../src/staging-authenticated-mcp.js", import.meta.url), "utf8");
  const store = readFileSync(new URL("../src/d1-transactional-operation-store.js", import.meta.url), "utf8");
  const runner = readFileSync(new URL("../src/v1-transactional-operation-runner.js", import.meta.url), "utf8");
  const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");
  assert.doesNotMatch(server, /d1-transactional-operation-store|v1-transactional-operation-runner/);
  assert.doesNotMatch(staging, /d1-transactional-operation-store|v1-transactional-operation-runner/);
  assert.doesNotMatch(store, /node:sqlite|fetch\s*\(|minimax-adapter/);
  assert.doesNotMatch(runner, /node:sqlite|fetch\s*\(|minimax-adapter/);
  assert.doesNotMatch(packageJson, /node:sqlite|better-sqlite|sqlite3/);
});
