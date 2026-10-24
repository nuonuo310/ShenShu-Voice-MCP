import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  OFFLINE_SIGNER_BUDGET_CAPS,
  OFFLINE_SIGNER_FIXED_PATHS,
  OFFLINE_SIGNER_IDENTITY,
  OFFLINE_SIGNER_MODE,
  createOfflineSigner,
  prepareOfflineSignerPlan,
} from "../src/offline-hmac-signer.js";
import {
  createWorkerRequestVerifier,
} from "../src/worker-signed-request.js";
import {
  signWorkerOperationRequest,
} from "../worker/signed-d1-worker-bridge.js";
import {
  HMAC_ROUTE_BUDGET_CAPS,
  HMAC_ROUTE_WINDOW_PLAN,
  summarizeHmacRouteWindowPlan,
} from "./fixtures/hmac-route-window-budget.mjs";

const KEY_ID = "offline_synth_test_20261024";
const SECRET_B64 = Buffer.from(
  Uint8Array.from({ length: 32 }, (_, index) => 17 + index),
).toString("base64url");
const HOST = OFFLINE_SIGNER_IDENTITY.workerName + ".test-account.workers.dev";
const NOW_SECONDS = 1_761_321_600;
const NOW_MS = NOW_SECONDS * 1_000;
const PRINCIPAL_A = "dryrun_v1cloud_20261024_a";
const PRINCIPAL_B = "dryrun_v1cloud_20261024_b";
const DIGEST = "A".repeat(43);
const CONFLICT_DIGEST = "B".repeat(43);
const OPERATION_IDS = Object.freeze({
  shared: "v1ops_20261024_shared",
  pa2: "v1ops_20261024_pa2",
  pa3: "v1ops_20261024_pa3",
  pa4: "v1ops_20261024_pa4",
});
const REQUEST_IDS = Object.freeze({
  shared: "request_20261024_shared",
  pa2: "request_20261024_pa2",
  pa3: "request_20261024_pa3",
});
const ZERO_USAGE = Object.freeze({
  workerHttpRequests: 0,
  d1TouchingRequests: 0,
  admissionRequests: 0,
  acceptedAdmissions: 0,
  rowWriteUnits: 0,
  rowsRead: 0,
  statements: 0,
  storageDeltaBytes: 0,
  durationMs: 0,
  providerCalls: 0,
});

function operationTarget(entry) {
  if (entry.id.startsWith("B") || entry.id.startsWith("S01") ||
      entry.id.startsWith("S06")) {
    return { principal: PRINCIPAL_B, target: "shared" };
  }
  if (entry.id.startsWith("A02") || entry.id.startsWith("S03") ||
      entry.id.startsWith("S07") || entry.id.startsWith("T03")) {
    return { principal: PRINCIPAL_A, target: "pa2" };
  }
  if (entry.id.startsWith("A03") || entry.id.startsWith("S04") ||
      entry.id.startsWith("S05") || entry.id.startsWith("S08")) {
    return { principal: PRINCIPAL_A, target: "pa3" };
  }
  if (entry.id.startsWith("A04")) {
    return { principal: PRINCIPAL_A, target: "pa4" };
  }
  return { principal: PRINCIPAL_A, target: "shared" };
}

function signableOperations() {
  return HMAC_ROUTE_WINDOW_PLAN.operations
    .filter(entry => entry.requestClass === "valid")
    .map((entry, index) => {
      const { principal, target } = operationTarget(entry);
      const operation = {
        slotId: entry.id,
        kind: entry.route,
        principal,
        operationId: OPERATION_IDS[target],
        timestamp: NOW_SECONDS,
        nonce: "offline_nonce_" + String(index + 1).padStart(4, "0") + "_abcdefgh",
        plannedUsage: Object.freeze({
          acceptedAdmission: entry.accepted,
          rowWriteUnits: entry.rowWriteUnits,
          rowsRead: entry.rowsRead,
          statements: entry.statements,
          storageDeltaBytes: entry.storageDeltaBytes,
        }),
      };
      if (entry.route === "admit") {
        operation.textDigest = entry.id.startsWith("A06") ? CONFLICT_DIGEST : DIGEST;
        operation.textBytes = 32;
        operation.ttlMs = 300_000;
      } else if (entry.route !== "status") {
        operation.requestId = REQUEST_IDS[target];
        if (entry.route === "completed") operation.resultRef = "result_20261024_shared";
      }
      return Object.freeze(operation);
    });
}

function priorUsageFromNegativeRequests() {
  let usage = { ...ZERO_USAGE };
  for (const entry of HMAC_ROUTE_WINDOW_PLAN.operations) {
    if (entry.requestClass === "valid") continue;
    usage.workerHttpRequests += 1;
    if (entry.admission) usage.admissionRequests += 1;
  }
  return Object.freeze(usage);
}

function planInput(overrides = {}) {
  return {
    mode: OFFLINE_SIGNER_MODE,
    planId: "offline-signer-plan-20261024",
    keyId: KEY_ID,
    secret: SECRET_B64,
    expectedHost: HOST,
    identity: { ...OFFLINE_SIGNER_IDENTITY },
    priorUsage: priorUsageFromNegativeRequests(),
    operations: signableOperations(),
    ...overrides,
  };
}

function signerFor(overrides = {}) {
  return createOfflineSigner({
    identity: { ...OFFLINE_SIGNER_IDENTITY },
    expectedHost: HOST,
    keyId: KEY_ID,
    secret: SECRET_B64,
    initialUsage: { ...ZERO_USAGE },
    now: () => NOW_MS,
    ...overrides,
  });
}

test("a synthetic 24-slot plan prepares only its 18 signed requests within every cap", async () => {
  const result = await prepareOfflineSignerPlan(planInput());
  const fixture = summarizeHmacRouteWindowPlan();
  assert.equal(result.status, "prepared");
  assert.equal(result.mode, OFFLINE_SIGNER_MODE);
  assert.equal(result.preparedCount, 18);
  assert.equal(result.providerCalls, 0);
  assert.equal(result.usage.workerHttpRequests, fixture.workerHttpRequests);
  assert.equal(result.usage.d1TouchingRequests, fixture.d1TouchingRequests);
  assert.equal(result.usage.admissionRequests, fixture.admissionRequests);
  assert.equal(result.usage.acceptedAdmissions, fixture.acceptedAdmissions);
  assert.equal(result.usage.rowWriteUnits, fixture.rowWriteUnits);
  assert.equal(result.usage.rowsRead, fixture.rowsRead);
  assert.equal(result.usage.statements, fixture.statements);
  assert.equal(result.usage.storageDeltaBytes, fixture.storageDeltaBytes);
  assert.equal(result.usage.providerCalls, 0);
  assert.ok(result.usage.durationMs <= OFFLINE_SIGNER_BUDGET_CAPS.durationMs);
  assert.deepEqual(OFFLINE_SIGNER_BUDGET_CAPS, HMAC_ROUTE_BUDGET_CAPS);
  assert.deepEqual(OFFLINE_SIGNER_FIXED_PATHS, [
    "/internal/v1/paid-operations/admit",
    "/internal/v1/paid-operations/status",
    "/internal/v1/paid-operations/provider-pending",
    "/internal/v1/paid-operations/completed",
    "/internal/v1/paid-operations/unknown",
  ]);
});

test("canonical signatures are deterministic and verify through the existing HMAC contract", async () => {
  const operation = signableOperations()[0];
  const first = await signerFor().prepare(operation);
  const second = await signerFor().prepare(operation);
  assert.equal(first.url, second.url);
  assert.equal(first.body, second.body);
  assert.deepEqual(first.headers, second.headers);
  assert.match(first.headers["x-shenshu-signature"], /^[A-Za-z0-9_-]{43}$/);

  const url = new URL(first.url);
  const verify = createWorkerRequestVerifier({
    keyring: { [KEY_ID]: SECRET_B64 },
    clock: () => NOW_SECONDS,
  });
  const verified = await verify({
    method: first.method,
    host: url.host,
    path: url.pathname,
    contentType: first.headers["content-type"],
    body: new TextEncoder().encode(first.body),
    headers: new Headers(first.headers),
  });
  assert.equal(verified.ok, true);
  assert.equal(verified.keyId, KEY_ID);
  assert.equal(verified.nonce, operation.nonce);
});

test("Version, Preview, nested, custom and port hosts fail before signing", async () => {
  const hosts = [
    "abc123-" + HOST,
    "pr-1-" + HOST,
    OFFLINE_SIGNER_IDENTITY.workerName + ".nested.test-account.workers.dev",
    OFFLINE_SIGNER_IDENTITY.workerName + ".example.com",
    HOST + ":8443",
    HOST.toUpperCase(),
  ];
  for (const expectedHost of hosts) {
    let signCalls = 0;
    await assert.rejects(prepareOfflineSignerPlan(planInput({
      expectedHost,
      signRequest: async () => {
        signCalls += 1;
        throw new Error("must_not_sign");
      },
    })), { message: "offline_signer_config_invalid" }, expectedHost);
    assert.equal(signCalls, 0, expectedHost);
  }
});

test("wrong Worker or D1 identity fails closed before signing", async () => {
  const identities = [
    { ...OFFLINE_SIGNER_IDENTITY, workerName: "asteria-voice-worker" },
    { ...OFFLINE_SIGNER_IDENTITY, d1Name: "shenshu-voice-budget-test" },
    {
      ...OFFLINE_SIGNER_IDENTITY,
      d1Uuid: "c39a6895-7028-4f59-a100-1455b92c96c1",
    },
    { ...OFFLINE_SIGNER_IDENTITY, unexpected: true },
  ];
  for (const identity of identities) {
    let signCalls = 0;
    await assert.rejects(prepareOfflineSignerPlan(planInput({
      identity,
      signRequest: async () => {
        signCalls += 1;
        throw new Error("must_not_sign");
      },
    })), { message: "offline_signer_config_invalid" });
    assert.equal(signCalls, 0);
  }
});

test("caller paths, unsafe principals, malformed fields and extra properties are rejected", async () => {
  const valid = signableOperations();
  const admit = valid.find(operation => operation.kind === "admit");
  const status = valid.find(operation => operation.kind === "status");
  const cases = [
    [{ ...admit, principal: "user_principal_0001" }, "unsafe principal"],
    [{ ...admit, operationId: "short" }, "invalid operation id"],
    [{ ...admit, slotId: "short" }, "invalid slot id"],
    [{ ...admit, nonce: "short" }, "invalid nonce"],
    [{ ...admit, path: "/internal/v1/paid-operations/admit" }, "caller path"],
    [{ ...admit, url: "https://example.invalid" }, "caller url"],
    [{ ...admit, secret: SECRET_B64 }, "secret in operation"],
    [{ ...admit, textDigest: "short" }, "invalid digest"],
    [{ ...admit, textBytes: 0 }, "zero text bytes"],
    [{ ...admit, textBytes: 801 }, "oversized text metadata"],
    [{ ...admit, ttlMs: 999 }, "short ttl"],
    [{ ...admit, ttlMs: 15 * 60 * 1000 + 1 }, "long ttl"],
    [{
      ...admit,
      plannedUsage: { ...admit.plannedUsage, rowWriteUnits: 3 },
    }, "accepted without four writes"],
    [{ ...status, kind: "status/../other" }, "non-fixed route"],
    [{
      ...status,
      plannedUsage: { ...status.plannedUsage, rowWriteUnits: 1 },
    }, "status write"],
    [{
      ...status,
      plannedUsage: { ...status.plannedUsage, acceptedAdmission: true },
    }, "status accepted"],
  ];
  const transition = valid.find(operation => operation.kind === "provider-pending");
  const completed = valid.find(operation => operation.kind === "completed");
  cases.push([{ ...transition, requestId: undefined }, "missing request id"]);
  cases.push([{ ...completed, resultRef: undefined }, "missing result ref"]);

  for (const [operation, name] of cases) {
    let signCalls = 0;
    await assert.rejects(prepareOfflineSignerPlan(planInput({
      operations: [operation],
      priorUsage: { ...ZERO_USAGE },
      signRequest: async () => {
        signCalls += 1;
        throw new Error("must_not_sign");
      },
    })), { message: "offline_signer_request_invalid" }, name);
    assert.equal(signCalls, 0, name);
  }
});

test("synthetic mode, plan and prior usage are exact and fail closed", async () => {
  const calls = [
    [planInput({ mode: "production" }), "offline_signer_input_invalid"],
    [planInput({ planId: "short" }), "offline_signer_input_invalid"],
    [planInput({ operations: [] }), "offline_signer_input_invalid"],
    [planInput({
      priorUsage: { ...priorUsageFromNegativeRequests(), providerCalls: 1 },
    }), "offline_signer_config_invalid"],
    [planInput({ keyId: "real_key_20261024" }), "offline_signer_config_invalid"],
    [planInput({ secret: "short" }), "offline_signer_config_invalid"],
  ];
  for (const [input, expectedCode] of calls) {
    await assert.rejects(prepareOfflineSignerPlan(input), { message: expectedCode });
  }
});

test("duplicate nonces are replay-rejected and signing failures are never retried", async () => {
  const operations = signableOperations();
  let signCalls = 0;
  const signer = signerFor({
    signRequest: async args => {
      signCalls += 1;
      return signWorkerOperationRequest(args);
    },
  });
  const first = await signer.prepare(operations[0]);
  const afterFirst = signer.snapshot();
  await assert.rejects(signer.prepare(operations[0]), {
    message: "offline_signer_replay_rejected",
  });
  assert.equal(signCalls, 1);
  assert.deepEqual(signer.snapshot(), afterFirst);
  assert.equal(first.method, "POST");

  let failedCalls = 0;
  const failing = signerFor({
    signRequest: async () => {
      failedCalls += 1;
      throw new Error("synthetic_signing_failure");
    },
  });
  await assert.rejects(failing.prepare(operations[1]), {
    message: "offline_signer_request_invalid",
  });
  assert.equal(failedCalls, 1);

  let sequenceCalls = 0;
  await assert.rejects(prepareOfflineSignerPlan(planInput({
    signRequest: async args => {
      sequenceCalls += 1;
      if (sequenceCalls === 2) throw new Error("synthetic_second_failure");
      return signWorkerOperationRequest(args);
    },
  })), { message: "offline_signer_request_invalid" });
  assert.equal(sequenceCalls, 2);
});

test("budget and duration exhaustion fail before another signature is attempted", async () => {
  const operations = signableOperations();
  let signCalls = 0;
  const signRequest = async args => {
    signCalls += 1;
    return signWorkerOperationRequest(args);
  };
  const nearHttpCap = signerFor({
    initialUsage: { ...ZERO_USAGE, workerHttpRequests: 23 },
    signRequest,
  });
  await nearHttpCap.prepare(operations[0]);
  await assert.rejects(nearHttpCap.prepare(operations[1]), {
    message: "offline_signer_budget_exhausted",
  });
  assert.equal(signCalls, 1);

  let clock = 0;
  let durationSignCalls = 0;
  const expired = signerFor({
    now: () => clock,
    signRequest: async args => {
      durationSignCalls += 1;
      return signWorkerOperationRequest(args);
    },
  });
  clock = OFFLINE_SIGNER_BUDGET_CAPS.durationMs + 1;
  await assert.rejects(expired.prepare(operations[0]), {
    message: "offline_signer_budget_exhausted",
  });
  assert.equal(durationSignCalls, 0);

  await assert.rejects(prepareOfflineSignerPlan(planInput({
    priorUsage: { ...ZERO_USAGE, workerHttpRequests: 24 },
    operations: [operations[0]],
  })), { message: "offline_signer_budget_exhausted" });
});

test("the library performs zero network calls and has no network or output imports", async () => {
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = () => {
    networkCalls += 1;
    throw new Error("network_forbidden");
  };
  try {
    await prepareOfflineSignerPlan(planInput());
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(networkCalls, 0);

  for (const path of ["../src/offline-hmac-signer.js", "../src/offline-hmac-signer-cli.js"]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|node:(http|https|net|fs|child_process)/);
    assert.doesNotMatch(source, /writeFile|createWriteStream|process\.env|console\./);
  }
});

function runCli(input, args = []) {
  const cli = fileURLToPath(new URL("../src/offline-hmac-signer-cli.js", import.meta.url));
  return spawnSync(process.execPath, [cli, ...args], {
    input,
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 256 * 1024,
  });
}

test("the synthetic only CLI emits redacted counters and no request material", () => {
  const result = runCli(JSON.stringify(planInput()));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, "prepared");
  assert.equal(output.mode, OFFLINE_SIGNER_MODE);
  assert.equal(output.preparedCount, 18);
  assert.equal(output.usage.workerHttpRequests, 24);
  assert.equal(output.usage.d1TouchingRequests, 18);
  assert.equal(output.usage.admissionRequests, 10);
  assert.equal(output.usage.providerCalls, 0);
  for (const forbidden of [
    SECRET_B64,
    "x-shenshu-signature",
    "x-shenshu-nonce",
    "offline_nonce_",
    PRINCIPAL_A,
    OPERATION_IDS.shared,
    DIGEST,
  ]) {
    assert.equal(result.stdout.includes(forbidden), false, forbidden);
    assert.equal(result.stderr.includes(forbidden), false, forbidden);
  }
});

test("CLI budget and argument failures emit only stable STOP codes without side effects", () => {
  const overBudget = planInput({
    priorUsage: { ...ZERO_USAGE, workerHttpRequests: 24 },
    operations: [signableOperations()[0]],
  });
  const blocked = runCli(JSON.stringify(overBudget));
  assert.equal(blocked.status, 2);
  assert.equal(blocked.stdout, "");
  assert.deepEqual(JSON.parse(blocked.stderr), {
    status: "blocked",
    code: "offline_signer_budget_exhausted",
  });
  assert.equal(blocked.stderr.includes(SECRET_B64), false);

  const argumentSecret = runCli("", ["--secret", SECRET_B64]);
  assert.equal(argumentSecret.status, 2);
  assert.equal(argumentSecret.stdout, "");
  assert.deepEqual(JSON.parse(argumentSecret.stderr), {
    status: "blocked",
    code: "offline_signer_input_invalid",
  });
  assert.equal(argumentSecret.stderr.includes(SECRET_B64), false);
});
