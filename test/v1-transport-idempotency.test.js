import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createVerifiedIdentityResolver } from "../src/verified-identity.js";
import {
  V1_OPERATION_DEFAULT_TTL_MS,
  V1_OPERATION_MAX_TTL_MS,
  V1_OPERATION_STATES,
  buildOperationBinding,
  classifyOperationReplay,
  createInMemoryDurableOperationStore,
  createOperationBackend,
  createV1IdempotentOperationRunner,
  operationTextDigest,
} from "../src/v1-transport-idempotency.js";

const NOW_MS = Date.parse("2026-10-23T00:00:05.000Z");
const NOW_SECONDS = Math.floor(NOW_MS / 1000);
const DAY_MS = 24 * 60 * 60 * 1000;
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "v1-idempotency-offline-key",
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
    exp: NOW_SECONDS + 600,
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

function makeHarness({
  backend = createOperationBackend(),
  nowRef = { value: NOW_MS },
  maximumDailyCalls = 3,
  synthesize,
  makeRequestId,
  makeGrantId,
  resolver = resolveVerifiedPrincipal,
} = {}) {
  const operationStore = createInMemoryDurableOperationStore({
    backend,
    clock: () => nowRef.value,
    maximumDailyCalls,
    ...(makeRequestId ? { makeRequestId } : {}),
    ...(makeGrantId ? { makeGrantId } : {}),
  });
  const providerArgs = [];
  let resultNumber = 0;
  const provider = synthesize ?? (async () => ({
    resultRef: "result_voice_" + String(++resultNumber).padStart(4, "0"),
  }));
  const invoke = createV1IdempotentOperationRunner({
    resolveVerifiedPrincipal: resolver,
    operationStore,
    synthesize: async args => {
      providerArgs.push(args);
      return provider(args);
    },
    clock: () => nowRef.value,
  });
  return { backend, nowRef, operationStore, providerArgs, invoke };
}

function input({ subject = "offline-user-a", operationId = "operation_0001", text = "idempotent voice text" } = {}) {
  return { trustedRequest: trustedRequest(subject), operationId, text };
}

test("one completed logical operation replays its existing result without another provider attempt", async () => {
  const h = makeHarness();
  const first = await h.invoke(input());
  const replay = await h.invoke(input());

  assert.deepEqual(first, {
    status: "completed",
    replayed: false,
    providerAttempts: 1,
    resultRef: "result_voice_0001",
  });
  assert.deepEqual(replay, {
    status: "completed",
    replayed: true,
    providerAttempts: 0,
    resultRef: "result_voice_0001",
  });
  assert.equal(h.providerArgs.length, 1);
  assert.equal(h.backend.operations.size, 1);
  assert.equal(h.backend.reservations.size, 1);
  assert.equal(h.backend.grants.size, 1);
  assert.equal(h.backend.slots.size, 1);
});

test("concurrent duplicate delivery never reaches the provider twice", async () => {
  let releaseProvider;
  let signalStarted;
  const providerStarted = new Promise(resolve => { signalStarted = resolve; });
  const providerGate = new Promise(resolve => { releaseProvider = resolve; });
  const h = makeHarness({
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
  assert.equal(h.backend.reservations.size, 1);
  assert.equal(h.backend.grants.size, 1);
});

test("distinct intentional operations with identical text are not silently deduplicated", async () => {
  const h = makeHarness();
  const sameText = "two separate deliberate user actions";
  const first = await h.invoke(input({ operationId: "operation_text_a", text: sameText }));
  const second = await h.invoke(input({ operationId: "operation_text_b", text: sameText }));

  assert.equal(first.replayed, false);
  assert.equal(second.replayed, false);
  assert.equal(h.providerArgs.length, 2);
  assert.equal(h.backend.operations.size, 2);
  assert.equal(h.backend.reservations.size, 2);
  assert.equal(h.backend.grants.size, 2);
  const rows = [...h.backend.operations.values()];
  assert.equal(rows[0].textDigest, rows[1].textDigest);
  assert.notEqual(rows[0].requestId, rows[1].requestId);
  assert.notEqual(rows[0].grantId, rows[1].grantId);
});

test("reusing an operation ID with different text is a conflict and cannot reserve or call the provider again", async () => {
  const h = makeHarness();
  await h.invoke(input({ operationId: "operation_conflict_1", text: "first exact text" }));
  await assert.rejects(
    h.invoke(input({ operationId: "operation_conflict_1", text: "different exact text" })),
    /operation_conflict/,
  );

  assert.equal(h.providerArgs.length, 1);
  assert.equal(h.backend.operations.size, 1);
  assert.equal(h.backend.reservations.size, 1);
  assert.equal(h.backend.grants.size, 1);
});

test("the same operation ID under two verified principals is isolated", async () => {
  const h = makeHarness();
  const first = await h.invoke(input({ subject: "offline-user-a", operationId: "operation_shared_id" }));
  const second = await h.invoke(input({ subject: "offline-user-b", operationId: "operation_shared_id" }));

  assert.equal(first.replayed, false);
  assert.equal(second.replayed, false);
  assert.equal(h.providerArgs.length, 2);
  assert.equal(h.backend.operations.size, 2);
  assert.equal(h.backend.reservations.size, 2);
  assert.equal(h.backend.grants.size, 2);
  const rows = [...h.backend.operations.values()];
  assert.notEqual(rows[0].principal, rows[1].principal);
  assert.notEqual(rows[0].requestId, rows[1].requestId);
  assert.notEqual(rows[0].grantId, rows[1].grantId);
});

test("a lost provider response is attempted once, recorded unknown and never refunded or retried", async () => {
  const h = makeHarness({
    maximumDailyCalls: 1,
    synthesize: async () => {
      throw new Error("Bearer must-not-leak\nprovider secret");
    },
  });
  await assert.rejects(h.invoke(input()), error => {
    assert.equal(error.message, "provider_outcome_unknown");
    assert.doesNotMatch(error.message, /Bearer|must-not-leak|secret/i);
    return true;
  });
  const principal = await principalFor("offline-user-a");
  const record = h.operationStore.get({ principal, operationId: "operation_0001" });
  assert.equal(record.state, V1_OPERATION_STATES.UNKNOWN);
  assert.equal(h.backend.slots.size, 1);

  await assert.rejects(h.invoke(input()), /operation_outcome_unknown/);
  await assert.rejects(
    h.invoke(input({ operationId: "operation_after_unknown" })),
    /budget_denied/,
  );
  assert.equal(h.providerArgs.length, 1);
});

test("failure to persist completion leaves the operation unknown and the provider is not recalled", async () => {
  const base = makeHarness();
  const failingStore = {
    admit: args => base.operationStore.admit(args),
    markProviderPending: args => base.operationStore.markProviderPending(args),
    markCompleted: async () => {
      throw new Error("D1 write token=must-not-leak");
    },
    markUnknown: args => base.operationStore.markUnknown(args),
    get: args => base.operationStore.get(args),
  };
  let providerCalls = 0;
  const invoke = createV1IdempotentOperationRunner({
    resolveVerifiedPrincipal,
    operationStore: failingStore,
    synthesize: async () => {
      providerCalls += 1;
      return { resultRef: "result_voice_0009" };
    },
    clock: () => NOW_MS,
  });

  await assert.rejects(invoke(input()), error => {
    assert.equal(error.message, "provider_outcome_unknown");
    assert.doesNotMatch(error.message, /D1|token|must-not-leak/i);
    return true;
  });
  const principal = await principalFor("offline-user-a");
  assert.equal(
    base.operationStore.get({ principal, operationId: "operation_0001" }).state,
    V1_OPERATION_STATES.UNKNOWN,
  );
  await assert.rejects(invoke(input()), /operation_outcome_unknown/);
  assert.equal(providerCalls, 1);
});

test("a malformed or public-URL provider result is treated as unknown, not replayed as success", async () => {
  const h = makeHarness({
    synthesize: async () => ({ resultRef: "https://public.invalid/audio.wav" }),
  });
  await assert.rejects(h.invoke(input()), /provider_outcome_unknown/);
  const principal = await principalFor("offline-user-a");
  const record = h.operationStore.get({ principal, operationId: "operation_0001" });
  assert.equal(record.state, V1_OPERATION_STATES.UNKNOWN);
  assert.equal(record.resultRef, null);
  await assert.rejects(h.invoke(input()), /operation_outcome_unknown/);
  assert.equal(h.providerArgs.length, 1);
});

test("completed replay is bounded by expiry and cannot produce a new provider attempt", async () => {
  const h = makeHarness();
  await h.invoke(input());
  h.nowRef.value = NOW_MS + V1_OPERATION_DEFAULT_TTL_MS;
  await assert.rejects(h.invoke(input()), /operation_expired/);
  assert.equal(h.providerArgs.length, 1);
  assert.equal(h.backend.reservations.size, 1);
  assert.equal(h.backend.grants.size, 1);
});

test("a new UTC day permits a new operation without reusing the prior reservation", async () => {
  const h = makeHarness({ maximumDailyCalls: 1 });
  const first = await h.invoke(input({ operationId: "operation_day_a" }));
  assert.equal(first.replayed, false);
  await assert.rejects(h.invoke(input({ operationId: "operation_day_a_same" })), /budget_denied/);

  h.nowRef.value = NOW_MS + DAY_MS;
  const second = await h.invoke(input({ operationId: "operation_day_b" }));
  assert.equal(second.replayed, false);
  assert.equal(h.providerArgs.length, 2);
  assert.equal(h.backend.reservations.size, 2);
  assert.equal(h.backend.grants.size, 2);
  assert.equal(h.backend.slots.size, 2);
});

test("the daily limit is enforced across distinct operations while a completed replay remains free", async () => {
  const h = makeHarness({ maximumDailyCalls: 2 });
  await h.invoke(input({ operationId: "operation_limit_1" }));
  await h.invoke(input({ operationId: "operation_limit_2" }));
  const replay = await h.invoke(input({ operationId: "operation_limit_1" }));
  assert.equal(replay.replayed, true);
  await assert.rejects(
    h.invoke(input({ operationId: "operation_limit_3" })),
    /budget_denied/,
  );
  assert.equal(h.providerArgs.length, 2);
  assert.equal(h.backend.reservations.size, 2);
  assert.equal(h.backend.grants.size, 2);
  assert.equal(h.backend.slots.size, 2);
});

test("a second process using the same durable backend replays completion without a provider attempt", async () => {
  const firstProcess = makeHarness();
  await firstProcess.invoke(input());

  const sameTime = { value: NOW_MS };
  const secondProcess = makeHarness({ backend: firstProcess.backend, nowRef: sameTime });
  const replay = await secondProcess.invoke(input());

  assert.equal(replay.replayed, true);
  assert.equal(replay.providerAttempts, 0);
  assert.equal(replay.resultRef, "result_voice_0001");
  assert.equal(secondProcess.providerArgs.length, 0);
});

test("a restart after admission but before provider start fails closed as in progress", async () => {
  const principal = await principalFor("offline-user-a");
  const binding = buildOperationBinding({
    principal,
    operationId: "operation_crash_before_provider",
    text: "admitted but not started",
    issuedAt: NOW_MS,
  });
  const firstProcess = makeHarness();
  const admitted = await firstProcess.operationStore.admit(binding);
  assert.equal(admitted.status, "admitted");

  const secondProcess = makeHarness({ backend: firstProcess.backend });
  await assert.rejects(
    secondProcess.invoke(input({ operationId: "operation_crash_before_provider", text: "admitted but not started" })),
    /operation_in_progress/,
  );
  assert.equal(secondProcess.providerArgs.length, 0);
});

test("caller-supplied trust, billing or provider controls are rejected before side effects", async () => {
  const forbidden = [
    { principal: "caller_principal" },
    { approval: true },
    { grantId: "grant_caller_0001" },
    { requestId: "request_caller_0001" },
    { modelId: "caller-model" },
    { voiceId: "caller-voice" },
    { textDigest: operationTextDigest("idempotent voice text") },
    { provider: async () => ({ resultRef: "result_caller_0001" }) },
  ];
  for (const extra of forbidden) {
    const h = makeHarness();
    await assert.rejects(h.invoke({ ...input(), ...extra }), /invalid_input/);
    assert.equal(h.providerArgs.length, 0);
    assert.equal(h.backend.operations.size, 0);
  }
});

test("malformed ingress is rejected before identity, quota or provider work", async () => {
  let resolverCalls = 0;
  const resolver = async request => {
    resolverCalls += 1;
    return resolveVerifiedPrincipal(request);
  };
  const malformed = [
    null,
    [],
    {},
    { trustedRequest: [], operationId: "operation_0001", text: "valid text" },
    { trustedRequest: trustedRequest(), operationId: "short", text: "valid text" },
    { trustedRequest: trustedRequest(), operationId: "bad operation id", text: "valid text" },
    { trustedRequest: trustedRequest(), operationId: "operation_0001", text: " " },
  ];
  for (const value of malformed) {
    const h = makeHarness({ resolver });
    await assert.rejects(h.invoke(value), /invalid_input/);
    assert.equal(h.providerArgs.length, 0);
    assert.equal(h.backend.operations.size, 0);
  }
  assert.equal(resolverCalls, 0);
});

test("identity failures and scope failures are sanitized without changing insufficient-scope semantics", async () => {
  const secretFailure = makeHarness({
    resolver: async () => { throw new Error("Bearer secret=must-not-leak"); },
  });
  await assert.rejects(secretFailure.invoke(input()), error => {
    assert.equal(error.message, "not_authorized");
    assert.doesNotMatch(error.message, /Bearer|secret/i);
    return true;
  });
  assert.equal(secretFailure.providerArgs.length, 0);

  const scopeFailure = makeHarness({
    resolver: async () => { throw new Error("insufficient_scope"); },
  });
  await assert.rejects(scopeFailure.invoke(input()), /insufficient_scope/);
  assert.equal(scopeFailure.providerArgs.length, 0);
});

test("invalid bindings and malformed persisted records fail closed", async () => {
  assert.throws(
    () => buildOperationBinding({ principal: "short", operationId: "operation_0001", text: "x", issuedAt: NOW_MS }),
    /operation_invalid/,
  );
  assert.throws(
    () => buildOperationBinding({
      principal: "principal_0001",
      operationId: "operation_0001",
      text: "x",
      issuedAt: NOW_MS,
      ttlMs: V1_OPERATION_MAX_TTL_MS + 1,
    }),
    /operation_invalid/,
  );
  const h = makeHarness();
  await h.invoke(input());
  const principal = await principalFor("offline-user-a");
  const record = h.operationStore.get({ principal, operationId: "operation_0001" });
  const malformed = [
    { ...record, grantId: "bad" },
    { ...record, action: "different_action" },
    { ...record, day: "not-a-day" },
    { ...record, expiresAt: record.issuedAt + V1_OPERATION_MAX_TTL_MS + 1 },
    { ...record, state: V1_OPERATION_STATES.COMPLETED, resultRef: null },
    { ...record, requestId: undefined },
    null,
  ];
  for (const candidate of malformed) {
    assert.throws(
      () => classifyOperationReplay(candidate, { nowMs: NOW_MS, principal, operationId: "operation_0001" }),
      /operation_store_invalid/,
    );
  }
});

test("partial durable state cannot replay a completed result", async () => {
  for (const missing of ["reservation", "grant", "slot"]) {
    const h = makeHarness();
    await h.invoke(input());
    const principal = await principalFor("offline-user-a");
    const record = h.operationStore.get({ principal, operationId: "operation_0001" });
    const reservation = h.backend.reservations.get(record.requestId);
    if (missing === "reservation") h.backend.reservations.delete(record.requestId);
    if (missing === "grant") h.backend.grants.delete(record.grantId);
    if (missing === "slot") h.backend.slots.delete(principal + "\u0000" + reservation.day + "\u0000" + String(reservation.slot));

    await assert.rejects(h.invoke(input()), /operation_store_invalid/);
    assert.equal(h.providerArgs.length, 1);
  }
});

test("completion cannot skip provider-pending and generated durable ID collisions fail closed", async () => {
  const h = makeHarness({ makeRequestId: () => "request_fixed_0001" });
  const principal = await principalFor("offline-user-a");
  const binding = buildOperationBinding({
    principal,
    operationId: "operation_transition",
    text: "transition guard",
    issuedAt: NOW_MS,
  });
  const admitted = await h.operationStore.admit(binding);
  assert.equal(admitted.status, "admitted");
  await assert.rejects(
    h.operationStore.markCompleted({
      principal,
      operationId: "operation_transition",
      requestId: admitted.record.requestId,
      resultRef: "result_voice_0010",
    }),
    /operation_state_invalid/,
  );

  const second = buildOperationBinding({
    principal,
    operationId: "operation_collision",
    text: "different action",
    issuedAt: NOW_MS + 1,
  });
  await assert.rejects(h.operationStore.admit(second), /operation_store_invalid/);
  assert.equal(h.backend.operations.size, 1);
  assert.equal(h.backend.reservations.size, 1);
  assert.equal(h.backend.grants.size, 1);
});

test("completed results expose only an opaque reference and no principal, text, grant or bearer material", async () => {
  const h = makeHarness({
    synthesize: async () => ({ resultRef: "result_voice_0011" }),
  });
  const result = await h.invoke(input());
  assert.deepEqual(Object.keys(result).sort(), ["providerAttempts", "replayed", "resultRef", "status"]);
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /offline-user|idempotent voice text|grant_|Bearer|authorization/i);
  assert.equal(result.resultRef, "result_voice_0011");
});

test("the contract module remains unmounted and has no provider, D1, HTTP or secret-source imports", async () => {
  const source = await readFile(new URL("../src/v1-transport-idempotency.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /from\s+["'][^"']*(d1|minimax|http|https|cloudflare|process)[^"']*["']/i);
  assert.match(source, /from\s+["']\.\/contract\.js["']/);

  const server = await readFile(new URL("../server.js", import.meta.url), "utf8");
  const staging = await readFile(new URL("../src/staging-authenticated-mcp.js", import.meta.url), "utf8");
  assert.doesNotMatch(server, /v1-transport-idempotency/);
  assert.doesNotMatch(staging, /v1-transport-idempotency/);
});
