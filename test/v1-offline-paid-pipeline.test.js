import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { MAX_WAV_BYTES } from "../src/contract.js";
import { createD1HttpPaidStore } from "../src/d1-http-paid-store.js";
import { makeInlineToneFixture } from "../src/inline-fixture.js";
import { createVerifiedIdentityResolver } from "../src/verified-identity.js";
import {
  createV1OfflinePaidPipeline,
  V1_FIXED_MODEL_ID,
} from "../src/v1-offline-paid-pipeline.js";

const fixture = makeInlineToneFixture();
const fixtureBytes = Buffer.from(fixture.audioBase64, "base64");
const fixedVoiceId = "voice_offline_fixed_001";
const now = 1900000000;
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "v1-paid-offline-key",
  alg: "RS256",
  use: "sig",
};

function makeResolver(clock = () => now * 1000) {
  return createVerifiedIdentityResolver({
    issuer: "https://issuer.invalid",
    audience: "https://staging.invalid/paid-mcp",
    publicJwks: [publicJwk],
    clock,
    requiredScopes: ["voice:speak"],
  });
}

function token(overrides = {}) {
  const header = Buffer.from(JSON.stringify({
    alg: "RS256",
    typ: "JWT",
    kid: publicJwk.kid,
  })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({
    iss: "https://issuer.invalid",
    aud: "https://staging.invalid/paid-mcp",
    sub: "offline-user-17",
    scope: "voice:speak",
    iat: now - 10,
    exp: now + 300,
    ...overrides,
  })).toString("base64url");
  const data = header + "." + claims;
  return data + "." + sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url");
}

function trustedRequest(overrides = {}) {
  return { headers: { authorization: "Bearer " + token(overrides) } };
}

class MemoryPaidStore {
  constructor() {
    this.reservations = new Map();
    this.requestIds = new Map();
    this.grants = new Map();
    this.calls = [];
  }

  async reserveAtomic({ subject, day, requestId, limit }) {
    this.calls.push("reserve");
    if (this.requestIds.has(requestId)) return { reserved: false };
    const used = new Set();
    for (const row of this.reservations.values()) {
      if (row.subject === subject && row.day === day) used.add(row.slot);
    }
    let slot = 0;
    for (let candidate = 1; candidate <= limit; candidate++) {
      if (!used.has(candidate)) { slot = candidate; break; }
    }
    if (!slot) return { reserved: false };
    this.reservations.set(requestId, { requestId, subject, day, slot });
    this.requestIds.set(requestId, subject);
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
    if (!grant || grant.requestId !== requestId || grant.subject !== subject || grant.state !== "issued") {
      return { consumed: false };
    }
    grant.state = "consumed";
    return { consumed: true };
  }
}

function makePipeline({
  store = new MemoryPaidStore(),
  synthesize,
  maximumDailyCalls = 3,
  clock = () => new Date(now * 1000),
  makeRequestId,
  makeGrantId,
  resolveVerifiedPrincipal = makeResolver(),
} = {}) {
  const calls = Array.isArray(store.calls) ? store.calls : [];
  const providerArgs = [];
  const provider = synthesize ?? (async () => ({ audio: Buffer.from(fixtureBytes) }));
  const wrappedSynthesize = async args => {
    calls.push("synthesize");
    providerArgs.push(args);
    return provider(args);
  };
  const invoke = createV1OfflinePaidPipeline({
    resolveVerifiedPrincipal,
    store,
    synthesize: wrappedSynthesize,
    voiceId: fixedVoiceId,
    maximumDailyCalls,
    clock,
    ...(makeRequestId ? { makeRequestId } : {}),
    ...(makeGrantId ? { makeGrantId } : {}),
  });
  return { invoke, store, calls, providerArgs };
}

function makeInput(overrides = {}) {
  return { trustedRequest: trustedRequest(), text: "offline v1 paid integration", ...overrides };
}

test("offline V1 pipeline composes verified identity, atomic reservation, one-use grant and one fixed provider attempt", async () => {
  const { invoke, store, calls, providerArgs } = makePipeline();
  const result = await invoke(makeInput());

  assert.deepEqual(calls, ["reserve", "issue", "consume", "synthesize"]);
  assert.equal(store.reservations.size, 1);
  assert.equal(store.grants.size, 1);
  assert.equal([...store.grants.values()][0].state, "consumed");
  assert.equal(providerArgs.length, 1);
  assert.deepEqual(Object.keys(providerArgs[0]).sort(), ["modelId", "text", "voiceId"]);
  assert.equal(providerArgs[0].text, "offline v1 paid integration");
  assert.equal(providerArgs[0].modelId, V1_FIXED_MODEL_ID);
  assert.equal(providerArgs[0].voiceId, fixedVoiceId);
  assert.equal(result.offlineFakeProvider, true);
  assert.equal(result.providerAttempts, 1);
  assert.equal(result.delivery, "inline-base64-experimental");
  assert.equal(result.record.source, "minimax");
  assert.equal(result.record.generated, true);
  assert.equal(result.record.audioUrl, undefined);
  assert.equal(result.record.audioMimeType, "audio/wav");
  assert.deepEqual(Buffer.from(result.record.audioBase64, "base64"), fixtureBytes);
});

test("client-supplied principal, approval, grant, request ID, model or voice are rejected before admission", async () => {
  const forbidden = [
    { principal: "client_principal" },
    { approval: true },
    { oneTime: true },
    { requestId: "client_request_01" },
    { modelId: "caller-model" },
    { voiceId: "caller-voice" },
    { grantId: "client_grant_01" },
  ];
  for (const extra of forbidden) {
    const { invoke, store } = makePipeline();
    await assert.rejects(invoke(makeInput(extra)), /invalid_input/);
    assert.deepEqual(store.calls, []);
  }
});

test("invalid or missing OAuth is denied before any store or provider side effect", async () => {
  const { invoke, store } = makePipeline();
  await assert.rejects(invoke(makeInput({ trustedRequest: { headers: {} } })), /not_authorized/);
  assert.deepEqual(store.calls, []);
});

test("concurrent offline calls respect one atomic daily slot and only one reaches the provider", async () => {
  const { invoke, store, calls } = makePipeline({ maximumDailyCalls: 1 });
  const settled = await Promise.allSettled([
    invoke(makeInput()),
    invoke(makeInput({ text: "second concurrent request" })),
  ]);
  assert.equal(settled.filter(item => item.status === "fulfilled").length, 1);
  assert.equal(settled.filter(item => item.status === "rejected").length, 1);
  assert.equal(store.reservations.size, 1);
  assert.equal(calls.filter(item => item === "reserve").length, 2);
  assert.equal(calls.filter(item => item === "synthesize").length, 1);
});

test("replaying the same server request ID cannot consume a second provider attempt", async () => {
  const { invoke, store, calls } = makePipeline({
    maximumDailyCalls: 3,
    makeRequestId: () => "req_offline_replay_001",
  });
  await invoke(makeInput());
  await assert.rejects(invoke(makeInput()), /budget_denied/);
  assert.equal(store.reservations.size, 1);
  assert.equal(calls.filter(item => item === "consume").length, 1);
  assert.equal(calls.filter(item => item === "synthesize").length, 1);
});

test("daily limit is per verified principal and resets only on a new UTC day", async () => {
  let current = new Date(now * 1000);
  const { invoke, calls } = makePipeline({
    maximumDailyCalls: 1,
    clock: () => new Date(current.valueOf()),
  });
  await invoke(makeInput());
  await assert.rejects(invoke(makeInput({ text: "same day" })), /budget_denied/);
  current = new Date((now + 24 * 60 * 60) * 1000);
  await invoke(makeInput({ text: "next day" }));
  assert.equal(calls.filter(item => item === "synthesize").length, 2);
});

test("grant issue/consume mismatch fails closed and never reaches the provider", async () => {
  const store = new MemoryPaidStore();
  store.grants.set("grant_offline_collision", {
    grantId: "grant_offline_collision",
    requestId: "unrelated_request",
    subject: "unrelated_user",
    state: "issued",
  });
  const { invoke, calls } = makePipeline({
    store,
    makeGrantId: () => "grant_offline_collision",
  });
  await assert.rejects(invoke(makeInput()), /grant_denied/);
  assert.equal(calls.filter(item => item === "consume").length, 0);
  assert.equal(calls.filter(item => item === "synthesize").length, 0);
});

test("a consume mismatch after issue also fails closed before the provider", async () => {
  const store = new MemoryPaidStore();
  store.consume = async function consumeMismatch() {
    this.calls.push("consume");
    return { consumed: false };
  };
  const { invoke, calls } = makePipeline({ store });
  await assert.rejects(invoke(makeInput()), /grant_denied/);
  assert.deepEqual(calls, ["reserve", "issue", "consume"]);
});

test("an uncertain provider outcome is attempted once, fails closed and is not refunded or retried", async () => {
  const { invoke, store, calls } = makePipeline({
    synthesize: async () => {
      throw new Error("upstream token=must-not-leak");
    },
  });
  await assert.rejects(invoke(makeInput()), error => {
    assert.equal(error.message, "provider_outcome_unknown");
    assert.doesNotMatch(error.message, /token|must-not-leak/);
    return true;
  });
  assert.deepEqual(calls, ["reserve", "issue", "consume", "synthesize"]);
  assert.equal(store.reservations.size, 1);
  assert.equal([...store.grants.values()][0].state, "consumed");
});

test("invalid or oversized provider audio fails closed after one attempt", async () => {
  const invalid = makePipeline({ synthesize: async () => ({ audio: Buffer.from("not-a-wav") }) });
  await assert.rejects(invalid.invoke(makeInput()), /invalid_audio/);
  assert.equal(invalid.calls.filter(item => item === "synthesize").length, 1);

  const oversized = makePipeline({
    synthesize: async () => ({ audio: Buffer.alloc(MAX_WAV_BYTES + 1) }),
  });
  await assert.rejects(oversized.invoke(makeInput()), /invalid_audio/);
  assert.equal(oversized.calls.filter(item => item === "synthesize").length, 1);
});

test("successful result never exposes the bearer, principal, fixed voice ID or caller model", async () => {
  const { invoke } = makePipeline();
  const result = await invoke(makeInput());
  const json = JSON.stringify(result);
  assert.doesNotMatch(json, /Bearer|offline-user-17|voice_offline_fixed_001|caller-model/);
  assert.equal("audioUrl" in result.record, false);
  assert.equal("principal" in result, false);
  assert.equal("requestId" in result, false);
});

test("offline paid pipeline is not mounted on the public MCP server", async () => {
  const publicServer = await readFile(new URL("../server.js", import.meta.url), "utf8");
  assert.doesNotMatch(publicServer, /v1-offline-paid-pipeline|createV1OfflinePaidPipeline/);
});

test("the reviewed D1 HTTP store contract plugs into the pipeline with an injected fake client", async () => {
  const queries = [];
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes("WITH RECURSIVE")) return [{ request_id: params[0], slot: 1 }];
      if (sql.includes("INSERT OR IGNORE INTO paid_voice_grants")) return [{ grant_id: params[0] }];
      if (sql.includes("UPDATE paid_voice_grants")) return [{ grant_id: params[0] }];
      throw new Error("unexpected_fake_d1_query");
    },
  };
  const store = createD1HttpPaidStore({ client });
  const { invoke, calls } = makePipeline({ store, maximumDailyCalls: 1 });
  const result = await invoke(makeInput());
  assert.equal(result.providerAttempts, 1);
  assert.deepEqual(calls, ["synthesize"]);
  assert.equal(queries.length, 3);
  assert.match(queries[0].sql, /WITH RECURSIVE/);
  assert.match(queries[1].sql, /INSERT OR IGNORE INTO paid_voice_grants/);
  assert.match(queries[2].sql, /UPDATE paid_voice_grants/);
});

test("ambiguous D1 responses fail closed before any provider attempt", async () => {
  for (const result of [null, {bad: "shape"}, [
    { request_id: "duplicate_row_001", slot: 1 },
    { request_id: "duplicate_row_002", slot: 2 },
  ]]) {
    const client = { query: async () => result };
    const store = createD1HttpPaidStore({ client });
    const { invoke, calls } = makePipeline({ store });
    await assert.rejects(invoke(makeInput()), /d1_result_invalid/);
    assert.equal(calls.filter(item => item === "synthesize").length, 0);
  }
});

test("D1 transport failure at any phase is single-attempt and blocks the provider", async () => {
  for (const [phase, expectedQueries] of [["reserve", 1], ["issue", 2], ["consume", 3]]) {
    let queries = 0;
    const client = {
      async query(sql, params) {
        queries++;
        if (sql.includes("WITH RECURSIVE")) {
          if (phase === "reserve") throw new Error("d1_unavailable");
          return [{ request_id: params[0], slot: 1 }];
        }
        if (sql.includes("INSERT OR IGNORE INTO paid_voice_grants")) {
          if (phase === "issue") throw new Error("d1_unavailable");
          return [{ grant_id: params[0] }];
        }
        if (sql.includes("UPDATE paid_voice_grants")) {
          if (phase === "consume") throw new Error("d1_unavailable");
          return [{ grant_id: params[0] }];
        }
        throw new Error("unexpected_query");
      },
    };
    const store = createD1HttpPaidStore({ client });
    const { invoke, calls } = makePipeline({ store });
    await assert.rejects(invoke(makeInput()), /d1_unavailable/);
    assert.equal(queries, expectedQueries);
    assert.equal(calls.filter(item => item === "synthesize").length, 0);
  }
});
