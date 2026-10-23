import { parentPort, workerData } from "node:worker_threads";
import { buildOperationBinding } from "../../src/v1-transport-idempotency.js";
import { createD1TransactionalOperationStore } from "../../src/d1-transactional-operation-store.js";
import { createLocalAtomicClient, openPaidSqlite } from "./local-sqlite-atomic-client.mjs";

if (workerData?.arrivals && workerData?.release && parentPort) {
  const arrivals = new Int32Array(workerData.arrivals);
  const release = new Int32Array(workerData.release);
  let db;
  try {
    db = openPaidSqlite(workerData.dbPath, { wal: false });
    const client = createLocalAtomicClient(db);
    const store = createD1TransactionalOperationStore({
      client,
      clock: () => workerData.now,
      maximumDailyCalls: workerData.maximumDailyCalls,
    });
    const binding = buildOperationBinding({
      principal: workerData.principal,
      operationId: workerData.operationId,
      text: workerData.text,
      issuedAt: workerData.now,
    });
    Atomics.add(arrivals, 0, 1);
    Atomics.notify(arrivals, 0, 1);
    Atomics.wait(release, 0, 0, 15000);
    const disposition = await store.admit(binding);
    parentPort.postMessage({
      ok: true,
      status: disposition.status,
      state: disposition.state ?? null,
      requestId: disposition.record?.requestId ?? null,
      slot: disposition.record?.slot ?? null,
    });
  } catch (error) {
    parentPort.postMessage({ ok: false, error: error?.message ?? "worker_failed" });
  } finally {
    try { db?.close(); } catch {}
  }
}
