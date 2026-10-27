import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { deriveCanonicalPrincipal } from "../src/canonical-principal.js";
import { makeInlineToneFixture } from "../src/inline-fixture.js";
import {
  AUTH0_ISSUER,
  STAGING_RESOURCE_ORIGIN,
} from "../src/protected-resource-identity.js";
import { createVerifiedIdentityResolver } from "../src/verified-identity.js";
import {
  createP2PrivateResultStore,
  createP2PlayerAudioLoader,
} from "../src/p2-private-result-store.js";
import {
  createInMemoryStableOperationStoreForTest,
  createV1P2StableOperationBroker,
  P2_OPERATION_STATES,
} from "../src/v1-p2-stable-operation-identity.js";

const NOW_MS = Date.parse("2026-10-27T00:00:00.000Z");
const NOW_SECONDS = Math.floor(NOW_MS / 1000);
const SUBJECT = "auth0|p2-stable-operation-user";
const OTHER_SUBJECT = "auth0|p2-stable-operation-other";
const VOICE_ID = "voice_p2_stable_001";
const AUDIENCE = STAGING_RESOURCE_ORIGIN + "/paid-mcp";
const FIXTURE = Buffer.from(makeInlineToneFixture().audioBase64, "base64");
let currentMs = NOW_MS;

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "p2-stable-operation-key",
  alg: "RS256",
  use: "sig",
};

function resetClock() {
  currentMs = NOW_MS;
}

function makeVerifier() {
  return createVerifiedIdentityResolver({
    issuer: AUTH0_ISSUER,
    audience: AUDIENCE,
    publicJwks: [publicJwk],
    clock: () => currentMs,
    requiredScopes: ["voice:speak"],
  });
}

function signedToken({ subject = SUBJECT, ...overrides } = {}) {
  const header = Buffer.from(JSON.stringify({
    alg: "RS256",
    typ: "JWT",
    kid: publicJwk.kid,
  })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({
    iss: AUTH0_ISSUER,
    aud: AUDIENCE,
    sub: subject,
    scope: "voice:speak",
    iat: NOW_SECONDS - 10,
    exp: NOW_SECONDS + 300,
    ...overrides,
  })).toString("base64url");
  const data = header + "." + claims;
  return data + "." + sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url");
}

function trustedRequest(options = {}) {
  return { headers: { authorization: "Bearer " + signedToken(options) } };
}

const PRINCIPAL = deriveCanonicalPrincipal({ issuer: AUTH0_ISSUER, subject: SUBJECT });
const OTHER_PRINCIPAL = deriveCanonicalPrincipal({ issuer: AUTH0_ISSUER, subject: OTHER_SUBJECT });

class MemoryPaidStore {
  constructor() {
    this.reservations = new Map();
    this.grants = new Map();
    this.calls = [];
  }

  async reserveAtomic({ subject, day, requestId, limit }) {
    this.calls.push("reserve");
    if (this.reservations.has(requestId)) return { reserved: false };
    const used = new Set();
    for (const row of this.reservations.values()) {
      if (row.subject === subject && row.day === day) used.add(row.slot);
    }
    let slot = 0;
    for (let candidate = 1; candidate <= limit; candidate++) {
      if (!used.has(candidate)) {
        slot = candidate;
        break;
      }
    }
    if (!slot) return { reserved: false };
    this.reservations.set(requestId, { requestId, subject, day, slot });
    return { reserved: true, slot };
  }

  async issue({ grantId, requestId, subject }) {
    this.calls.push("issue");
    const reservation = this.reservations.get(requestId);
    if (!reservation || reservation.subject !== subject || this.grants.has(grantId)) {
      return { issued: false };
    }
    this.grants.set(grantId, { grantId, requestId, subject, state: "issued" });
    return { issued: true };
  }

  async consume({ grantId, requestId, subject }) {
    this.calls.push("consume");
    const grant = this.grants.get(grantId);
    if (!grant ||
        grant.requestId !== requestId ||
        grant.subject !== subject ||
        grant.state !== "issued") {
      return { consumed: false };
    }
    grant.state = "consumed";
    return { consumed: true };
  }
}

function makeResultBackend({ failPut = false } = {}) {
  const rows = new Map();
  const calls = [];
  return {
    rows,
    calls,
    async putLatest(record) {
      calls.push("put");
      if (failPut) throw new Error("fixture_put_failure");
      rows.set(record.principal, { ...record, audio: Buffer.from(record.audio) });
      return { stored: true };
    },
    async getLatest({ principal }) {
      calls.push("get");
      const row = rows.get(principal);
      return row ? { ...row, audio: Buffer.from(row.audio) } : null;
    },
    async deleteExpired({ before }) {
      calls.push("deleteExpired");
      let deleted = 0;
      for (const [principal, row] of rows) {
        if (row.expiresAt <= before) {
          rows.delete(principal);
          deleted++;
        }
      }
      return { deleted };
    },
  };
}

function makeHarness({
  synthesize = async () => ({ audio: Buffer.from(FIXTURE) }),
  operationStore = createInMemoryStableOperationStoreForTest(),
  paidStore = new MemoryPaidStore(),
  backend = makeResultBackend(),
  maximumDailyCalls = 3,
  operationTtlMs = 60_000,
} = {}) {
  const providerArgs = [];
  const provider = async args => {
    providerArgs.push(args);
    return synthesize(args);
  };
  const privateResultStore = createP2PrivateResultStore({
    backend,
    ttlSeconds: 60,
    clock: () => new Date(currentMs),
  });
  const makeBroker = () => createV1P2StableOperationBroker({
    resolveVerifiedPrincipal: makeVerifier(),
    operationStore,
    paidStore,
    synthesize: provider,
    privateResultStore,
    voiceId: VOICE_ID,
    maximumDailyCalls,
    clock: () => new Date(currentMs),
    operationTtlMs,
  });
  return {
    broker: makeBroker(),
    makeBroker,
    operationStore,
    paidStore,
    backend,
    privateResultStore,
    providerArgs,
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("initiate is nonbillable and creates a signed-principal/text-bound handle", async () => {
  resetClock();
  const h = makeHarness();
  const result = await h.broker.initiate({
    trustedRequest: trustedRequest(),
    text: "stable operation identity",
  });

  assert.equal(result.status, P2_OPERATION_STATES.PENDING_CONFIRMATION);
  assert.match(result.handle, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(result.billable, false);
  assert.deepEqual(Object.keys(result).sort(), ["billable", "expiresAt", "handle", "status"]);
  assert.deepEqual(h.paidStore.calls, []);
  assert.equal(h.providerArgs.length, 0);

  const status = await h.broker.status({
    trustedRequest: trustedRequest(),
    handle: result.handle,
  });
  assert.equal(status.status, P2_OPERATION_STATES.PENDING_CONFIRMATION);
  assert.equal(status.billable, false);
  assert.deepEqual(h.paidStore.calls, []);
  assert.equal(h.providerArgs.length, 0);
});

test("handle is owner-only across both ChatGPT MCP and player canonical principal", async () => {
  resetClock();
  const h = makeHarness();
  const pending = await h.broker.initiate({
    trustedRequest: trustedRequest(),
    text: "owner-only operation",
  });
  const otherRequest = trustedRequest({ subject: OTHER_SUBJECT });

  await assert.rejects(h.broker.status({
    trustedRequest: otherRequest,
    handle: pending.handle,
  }), /operation_not_found/);
  await assert.rejects(h.broker.confirm({
    trustedRequest: otherRequest,
    handle: pending.handle,
    text: "owner-only operation",
  }), /operation_not_found/);
  assert.deepEqual(h.paidStore.calls, []);
  assert.equal(h.providerArgs.length, 0);

  const invalid = { headers: { authorization: "Bearer invalid" } };
  await assert.rejects(h.broker.status({
    trustedRequest: invalid,
    handle: pending.handle,
  }), /not_authorized/);
  assert.deepEqual(h.paidStore.calls, []);
});

test("confirm performs one paid pipeline and the player resolves the same principal", async () => {
  resetClock();
  const h = makeHarness();
  const text = "confirm exactly once";
  const pending = await h.broker.initiate({ trustedRequest: trustedRequest(), text });
  const completed = await h.broker.confirm({
    trustedRequest: trustedRequest(),
    handle: pending.handle,
    text,
  });

  assert.deepEqual(completed, {
    status: "completed",
    replayed: false,
    providerAttempts: 1,
  });
  assert.deepEqual(h.paidStore.calls, ["reserve", "issue", "consume"]);
  assert.equal(h.providerArgs.length, 1);
  assert.equal(h.providerArgs[0].text, text);
  assert.equal(h.providerArgs[0].voiceId, VOICE_ID);
  assert.equal(h.providerArgs[0].modelId, "speech-2.8-hd");
  assert.deepEqual([...h.paidStore.grants.values()][0].state, "consumed");

  const status = await h.broker.status({
    trustedRequest: trustedRequest(),
    handle: pending.handle,
  });
  assert.deepEqual(status, { status: "completed", ready: true, retryable: false });

  const loader = createP2PlayerAudioLoader({ privateResultStore: h.privateResultStore });
  const loaded = await loader({ verifiedSubject: PRINCIPAL });
  assert.equal(Buffer.compare(loaded, FIXTURE), 0);
  assert.equal(h.backend.rows.size, 1);
});

test("lost confirm response and process restart replay completed state with zero provider calls", async () => {
  resetClock();
  const h = makeHarness();
  const text = "retry after lost confirm response";
  const pending = await h.broker.initiate({ trustedRequest: trustedRequest(), text });
  const input = {
    trustedRequest: trustedRequest(),
    handle: pending.handle,
    text,
  };
  await h.broker.confirm(input);

  const replay = await h.broker.confirm(input);
  assert.deepEqual(replay, {
    status: "completed",
    replayed: true,
    providerAttempts: 0,
  });

  const restarted = h.makeBroker();
  const recovered = await restarted.confirm(input);
  assert.deepEqual(recovered, {
    status: "completed",
    replayed: true,
    providerAttempts: 0,
  });
  assert.equal(h.providerArgs.length, 1);
  assert.deepEqual(h.paidStore.calls, ["reserve", "issue", "consume"]);
  assert.equal([...h.paidStore.grants.values()][0].state, "consumed");
});

test("completed receipt survives the confirmation TTL without another provider call", async () => {
  resetClock();
  const h = makeHarness({ operationTtlMs: 1_000 });
  const text = "terminal receipt remains recoverable";
  const pending = await h.broker.initiate({ trustedRequest: trustedRequest(), text });
  const input = {
    trustedRequest: trustedRequest(),
    handle: pending.handle,
    text,
  };
  await h.broker.confirm(input);
  currentMs += 2_000;

  assert.deepEqual(await h.makeBroker().status({
    trustedRequest: trustedRequest(),
    handle: pending.handle,
  }), { status: "completed", ready: true, retryable: false });
  assert.deepEqual(await h.makeBroker().confirm(input), {
    status: "completed",
    replayed: true,
    providerAttempts: 0,
  });
  assert.equal(h.providerArgs.length, 1);
  assert.deepEqual(h.paidStore.calls, ["reserve", "issue", "consume"]);
});

test("concurrent confirms on one handle allow one claim and one provider attempt", async () => {
  resetClock();
  const entered = deferred();
  const release = deferred();
  const h = makeHarness({
    synthesize: async () => {
      entered.resolve();
      await release.promise;
      return { audio: Buffer.from(FIXTURE) };
    },
  });
  const text = "concurrent confirmation";
  const pending = await h.broker.initiate({ trustedRequest: trustedRequest(), text });
  const input = {
    trustedRequest: trustedRequest(),
    handle: pending.handle,
    text,
  };

  const first = h.broker.confirm(input);
  await entered.promise;
  await assert.rejects(h.makeBroker().confirm(input), /operation_pending/);
  assert.deepEqual(await h.makeBroker().status({
    trustedRequest: trustedRequest(),
    handle: pending.handle,
  }), { status: "outcome_pending", retryable: false });
  release.resolve();
  const completed = await first;
  assert.equal(completed.providerAttempts, 1);
  assert.equal(h.providerArgs.length, 1);
  assert.deepEqual(h.paidStore.calls, ["reserve", "issue", "consume"]);

  const replay = await h.broker.confirm(input);
  assert.equal(replay.providerAttempts, 0);
  assert.equal(h.providerArgs.length, 1);
});

test("uncertain provider outcome is terminal unknown, unrefunded and never retried", async () => {
  resetClock();
  const h = makeHarness({
    synthesize: async () => {
      throw new Error("provider token must not leak");
    },
  });
  const text = "ambiguous paid outcome";
  const pending = await h.broker.initiate({ trustedRequest: trustedRequest(), text });
  const input = {
    trustedRequest: trustedRequest(),
    handle: pending.handle,
    text,
  };

  await assert.rejects(h.broker.confirm(input), /operation_outcome_unknown/);
  assert.equal(h.providerArgs.length, 1);
  assert.deepEqual(h.paidStore.calls, ["reserve", "issue", "consume"]);
  assert.equal([...h.paidStore.grants.values()][0].state, "consumed");
  assert.equal(h.backend.rows.size, 0);

  const status = await h.broker.status({
    trustedRequest: trustedRequest(),
    handle: pending.handle,
  });
  assert.deepEqual(status, { status: "unknown", retryable: false });
  await assert.rejects(h.broker.confirm(input), /operation_outcome_unknown/);
  await assert.rejects(h.makeBroker().confirm(input), /operation_outcome_unknown/);
  assert.equal(h.providerArgs.length, 1);
  assert.deepEqual(h.paidStore.calls, ["reserve", "issue", "consume"]);
});

test("a crash after claim but before provider fails closed with no provider attempt", async () => {
  resetClock();
  const baseStore = createInMemoryStableOperationStoreForTest();
  const operationStore = {
    ...baseStore,
    async markProviderPending() {
      throw new Error("simulated_process_loss");
    },
  };
  const h = makeHarness({ operationStore });
  const text = "claim then crash";
  const pending = await h.broker.initiate({ trustedRequest: trustedRequest(), text });
  const input = {
    trustedRequest: trustedRequest(),
    handle: pending.handle,
    text,
  };

  await assert.rejects(h.broker.confirm(input), /operation_outcome_unknown/);
  assert.equal(h.providerArgs.length, 0);
  assert.deepEqual(h.paidStore.calls, []);
  assert.deepEqual(await h.makeBroker().status({
    trustedRequest: trustedRequest(),
    handle: pending.handle,
  }), { status: "unknown", retryable: false });
  await assert.rejects(h.makeBroker().confirm(input), /operation_outcome_unknown/);
  assert.equal(h.providerArgs.length, 0);
});

test("private result store failure is terminal unknown and is not retried", async () => {
  resetClock();
  const backend = makeResultBackend({ failPut: true });
  const h = makeHarness({ backend });
  const text = "provider succeeded but result persistence failed";
  const pending = await h.broker.initiate({ trustedRequest: trustedRequest(), text });
  const input = {
    trustedRequest: trustedRequest(),
    handle: pending.handle,
    text,
  };

  await assert.rejects(h.broker.confirm(input), /operation_outcome_unknown/);
  assert.equal(h.providerArgs.length, 1);
  assert.deepEqual(h.paidStore.calls, ["reserve", "issue", "consume"]);
  await assert.rejects(h.makeBroker().confirm(input), /operation_outcome_unknown/);
  assert.equal(h.providerArgs.length, 1);
  assert.deepEqual(h.paidStore.calls, ["reserve", "issue", "consume"]);
});

test("expired initiation cannot reach quota or provider", async () => {
  resetClock();
  const h = makeHarness({ operationTtlMs: 1_000 });
  const text = "expires before confirmation";
  const pending = await h.broker.initiate({ trustedRequest: trustedRequest(), text });
  currentMs += 1_001;

  await assert.rejects(h.broker.confirm({
    trustedRequest: trustedRequest(),
    handle: pending.handle,
    text,
  }), /operation_expired/);
  assert.deepEqual(h.paidStore.calls, []);
  assert.equal(h.providerArgs.length, 0);
  assert.deepEqual(await h.broker.status({
    trustedRequest: trustedRequest(),
    handle: pending.handle,
  }), { status: "expired", retryable: false });
});

test("changed text, caller authority and JSON-RPC-like IDs are rejected before billing", async () => {
  resetClock();
  const h = makeHarness();
  const text = "caller cannot choose identity or billing fields";
  const pending = await h.broker.initiate({ trustedRequest: trustedRequest(), text });
  const request = trustedRequest();
  const confirm = { trustedRequest: request, handle: pending.handle, text };

  await assert.rejects(h.broker.confirm({ ...confirm, text: text + " altered" }),
    /operation_binding_mismatch/);
  assert.deepEqual(h.paidStore.calls, []);
  assert.equal(h.providerArgs.length, 0);

  const forbidden = [
    { principal: OTHER_PRINCIPAL },
    { operationId: "op_caller_controlled_0001" },
    { digest: "A".repeat(43) },
    { grantId: "grant_caller_controlled_0001" },
    { requestId: "request_caller_controlled_0001" },
    { jsonrpc: "2.0" },
    { id: "client-json-rpc-request" },
    { modelId: "caller-model" },
    { voiceId: "caller-voice" },
  ];
  for (const extra of forbidden) {
    await assert.rejects(h.broker.initiate({
      trustedRequest: request,
      text,
      ...extra,
    }), /invalid_input/);
    await assert.rejects(h.broker.status({
      trustedRequest: request,
      handle: pending.handle,
      ...extra,
    }), /invalid_input/);
    await assert.rejects(h.broker.confirm({ ...confirm, ...extra }), /invalid_input/);
  }
  assert.deepEqual(h.paidStore.calls, []);
  assert.equal(h.providerArgs.length, 0);
});

test("a completed handle cannot be rebound to different text", async () => {
  resetClock();
  const h = makeHarness();
  const text = "bound completed text";
  const pending = await h.broker.initiate({ trustedRequest: trustedRequest(), text });
  await h.broker.confirm({
    trustedRequest: trustedRequest(),
    handle: pending.handle,
    text,
  });
  await assert.rejects(h.broker.confirm({
    trustedRequest: trustedRequest(),
    handle: pending.handle,
    text: text + " changed",
  }), /operation_binding_mismatch/);
  assert.equal(h.providerArgs.length, 1);
  assert.deepEqual(h.paidStore.calls, ["reserve", "issue", "consume"]);
});

test("lost handle is not recovered from text and identical text creates independent pending handles", async () => {
  resetClock();
  const h = makeHarness();
  const text = "same text is not a transport identity";
  const first = await h.broker.initiate({ trustedRequest: trustedRequest(), text });
  const second = await h.broker.initiate({ trustedRequest: trustedRequest(), text });
  assert.notEqual(first.handle, second.handle);
  assert.equal(first.billable, false);
  assert.equal(second.billable, false);
  assert.deepEqual(h.paidStore.calls, []);
  assert.equal(h.providerArgs.length, 0);

  const forged = "Z".repeat(43);
  await assert.rejects(h.broker.status({
    trustedRequest: trustedRequest(),
    handle: forged,
  }), /operation_not_found/);
  await assert.rejects(h.broker.confirm({
    trustedRequest: trustedRequest(),
    handle: forged,
    text,
  }), /operation_not_found/);
  assert.deepEqual(h.paidStore.calls, []);
});

test("stable operation module remains unmounted and contains no cloud or provider I/O", async () => {
  const server = await readFile(new URL("../server.js", import.meta.url), "utf8");
  const module = await readFile(
    new URL("../src/v1-p2-stable-operation-identity.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(server, /v1-p2-stable-operation-identity|createV1P2StableOperationBroker/);
  assert.doesNotMatch(module, /fetch\(|cloudflare|d1-http|MINIMAX_ENDPOINT|apiKey|client_secret|console\./i);
  assert.match(module, /createPending/);
  assert.match(module, /markProviderPending/);
  assert.match(module, /operation_binding_mismatch/);
});
