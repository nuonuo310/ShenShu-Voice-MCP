import { createHash } from "node:crypto";
import { parentPort, workerData } from "node:worker_threads";
import { createPrivateWorkerCandidate } from "../../worker/private-d1-worker-candidate.js";
import { openPaidSqlite } from "./local-sqlite-atomic-client.mjs";
import { createWorkerD1Binding } from "./worker-d1-binding-contract.mjs";

if (workerData?.arrivals && workerData?.release && parentPort) {
  const arrivals = new Int32Array(workerData.arrivals);
  const release = new Int32Array(workerData.release);
  let db;
  try {
    db = openPaidSqlite(workerData.dbPath, { wal: false });
    const binding = createWorkerD1Binding(db);
    const index = String(workerData.index).padStart(4, "0");
    const candidate = createPrivateWorkerCandidate({
      env: { DB: binding },
      authorize: async () => true,
      clock: () => workerData.now,
      maximumDailyCalls: workerData.maximumDailyCalls,
      makeRequestId: () => "request_concurrent_" + index,
      makeGrantId: () => "grant_concurrent_" + index,
    });
    const operationId = "operation_concurrent_" + index;
    const textDigest = createHash("sha256")
      .update("concurrent text " + index, "utf8")
      .digest("base64url");
    const request = new Request(
      "https://private.invalid/internal/v1/paid-operations/admit",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          version: 1,
          principal: workerData.principal,
          operation_id: operationId,
          action: "generate_shenshu_voice",
          text_digest: textDigest,
          text_bytes: 17,
          ttl_ms: 300000,
        }),
      },
    );
    Atomics.add(arrivals, 0, 1);
    Atomics.notify(arrivals, 0, 1);
    Atomics.wait(release, 0, 0, 15000);
    const response = await candidate.fetch(request);
    const payload = await response.json();
    parentPort.postMessage({
      ok: true,
      httpStatus: response.status,
      status: payload.status ?? null,
      state: payload.state ?? null,
      slot: payload.slot ?? null,
    });
  } catch (error) {
    parentPort.postMessage({ ok: false, error: error?.message ?? "worker_failed" });
  } finally {
    try { db?.close(); } catch {}
  }
}
