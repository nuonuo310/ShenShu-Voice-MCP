import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildOperationBinding } from "../src/v1-transport-idempotency.js";
import { createD1TransactionalOperationStore } from "../src/d1-transactional-operation-store.js";
import {
  applyPaidSchema,
  countRows,
  localSqliteAvailable,
  openPaidSqlite,
} from "./fixtures/local-sqlite-atomic-client.mjs";
import {
  createWorkerBindingAtomicClient,
  createWorkerD1Binding,
} from "./fixtures/worker-d1-binding-contract.mjs";

const NOW_MS = Date.parse("2026-10-23T12:00:05.000Z");
const DAY = new Date(NOW_MS).toISOString().slice(0, 10);
const PRINCIPAL = "architecture-user";
const sqliteTest = (name, fn) => test(name, {
  skip: localSqliteAvailable ? false : "node:sqlite requires Node 22 or newer",
}, fn);

function makeDb() {
  const db = openPaidSqlite();
  applyPaidSchema(db);
  return db;
}

function makeOperation(operationId = "architecture_operation_0001") {
  return buildOperationBinding({
    principal: PRINCIPAL,
    operationId,
    text: "worker binding atomic architecture",
    issuedAt: NOW_MS,
  });
}

sqliteTest("Worker binding contract uses one four-statement D1 batch", async () => {
  const db = makeDb();
  try {
    const binding = createWorkerD1Binding(db);
    const client = createWorkerBindingAtomicClient(binding);
    const store = createD1TransactionalOperationStore({
      client,
      clock: () => NOW_MS,
      maximumDailyCalls: 3,
    });

    const result = await store.admit(makeOperation());
    assert.equal(result.status, "admitted");
    assert.equal(binding.stats.queryCalls, 1);
    assert.equal(binding.stats.batchCalls, 1);
    assert.deepEqual(binding.stats.batchSizes, [4]);
    assert.equal(binding.stats.prepareCalls, 5);
    assert.equal(countRows(db, "paid_voice_reservations"), 1);
    assert.equal(countRows(db, "paid_voice_grants"), 1);
    assert.equal(countRows(db, "paid_voice_operations"), 1);
    assert.equal(db.prepare(
      "SELECT state FROM paid_voice_grants",
    ).get().state, "consumed");
  } finally {
    db.close();
  }
});

sqliteTest("a collision inside the Worker batch rolls back all four statements", async () => {
  const db = makeDb();
  try {
    db.prepare(
      "INSERT INTO paid_voice_reservations (request_id, principal, day_utc, slot) VALUES (?1, ?2, ?3, 1)",
    ).run("request_collision_worker", PRINCIPAL, DAY);
    const binding = createWorkerD1Binding(db);
    const client = createWorkerBindingAtomicClient(binding);
    const store = createD1TransactionalOperationStore({
      client,
      clock: () => NOW_MS,
      maximumDailyCalls: 3,
      makeRequestId: () => "request_collision_worker",
    });

    await assert.rejects(
      store.admit(makeOperation("architecture_collision_01")),
      /operation_store_unavailable/,
    );
    assert.equal(binding.stats.batchCalls, 1);
    assert.equal(countRows(db, "paid_voice_reservations"), 1);
    assert.equal(countRows(db, "paid_voice_grants"), 0);
    assert.equal(countRows(db, "paid_voice_operations"), 0);
  } finally {
    db.close();
  }
});

sqliteTest("malformed Worker D1Result arrays are rejected, never accepted as success", async () => {
  const db = makeDb();
  try {
    const binding = createWorkerD1Binding(db);
    const malformed = Object.freeze({
      stats: binding.stats,
      prepare: binding.prepare,
      batch: async () => [{ success: true, results: [], meta: {} }],
    });
    const client = createWorkerBindingAtomicClient(malformed);
    const store = createD1TransactionalOperationStore({
      client,
      clock: () => NOW_MS,
      maximumDailyCalls: 3,
    });

    await assert.rejects(
      store.admit(makeOperation("architecture_malformed_01")),
      /operation_store_unavailable/,
    );
    assert.equal(countRows(db, "paid_voice_reservations"), 0);
    assert.equal(countRows(db, "paid_voice_grants"), 0);
    assert.equal(countRows(db, "paid_voice_operations"), 0);
  } finally {
    db.close();
  }
});

test("the local Worker contract has no REST, fetch or service-token dependency", () => {
  const source = readFileSync(
    new URL("./fixtures/worker-d1-binding-contract.mjs", import.meta.url),
    "utf8",
  );
  assert.match(source, /atomicBatch: true/);
  assert.match(source, /binding\.batch\(prepared\)/);
  assert.doesNotMatch(source, /fetch\s*\(|cloudflare-d1-http|CF_D1_API_TOKEN|CF-Access/);
});
