import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { createVerifiedIdentityResolver } from "../src/verified-identity.js";
import { createD1HttpPaidStore } from "../src/d1-http-paid-store.js";
import { D1_PAID_SQL } from "../src/d1-paid-store.js";
import {
  AUDITION_CONSENT_ACTION,
  DEFAULT_AUDITION_CONSENT_TTL_MS,
  auditionTextDigest,
  createAuditionConsentCapabilityStore,
} from "../src/audition-consent-capability.js";
import { createOfflineFirstAuditionCandidate } from "../src/first-audition-offline-candidate.js";
import {
  decodeGeneratedAudioForPlayback,
  prepareGeneratedAudioPlayback,
} from "../src/generated-audio-playback-contract.js";
import { makeInlineToneFixture } from "../src/inline-fixture.js";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "offline_key", alg: "RS256", use: "sig" };
const now = 1_900_000_000;
const issuer = "https://offline.invalid";
const audience = "https://offline.invalid/mcp";
const fixedWav = Buffer.from(makeInlineToneFixture().audioBase64, "base64");
const consentSecret = "offline-consent-test-secret-32-bytes-minimum";
const consentNow = Date.parse("2026-10-21T12:00:00.000Z");

function wav(seconds = 0.7) {
  const count = Math.round(32_000 * seconds);
  const bytes = Buffer.alloc(44 + count);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVE", 8);
  bytes.write("fmt ", 12);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(16_000, 24);
  bytes.writeUInt32LE(32_000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(count, 40);
  return bytes;
}

function token(overrides = {}) {
  const header = Buffer.from(JSON.stringify({
    alg: "RS256", typ: "JWT", kid: "offline_key",
  })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({
    iss: issuer,
    aud: audience,
    sub: "user_001",
    iat: now - 10,
    exp: now + 300,
    scope: "voice:speak",
    ...overrides,
  })).toString("base64url");
  const unsigned = header + "." + claims;
  return unsigned + "." + sign("RSA-SHA256", Buffer.from(unsigned), privateKey).toString("base64url");
}

const trustedRequest = (jwt = token()) => ({ headers: { authorization: "Bearer " + jwt } });

function fakeStore(events) {
  const reservations = new Map();
  const slots = new Set();
  const grants = new Map();
  let queue = Promise.resolve();

  const query = (sql, args) => {
    const task = queue.then(() => {
      if (sql === D1_PAID_SQL.reserve) {
        events.push("reserve");
        const [requestId, subject, day, limit] = args;
        if (reservations.has(requestId)) return [];
        for (let slot = 1; slot <= limit; slot++) {
          const slotKey = subject + ":" + day + ":" + slot;
          if (slots.has(slotKey)) continue;
          slots.add(slotKey);
          reservations.set(requestId, { subject, day, slot });
          return [{ request_id: requestId, slot }];
        }
        return [];
      }
      if (sql === D1_PAID_SQL.issue) {
        events.push("issue");
        const [grantId, requestId, subject] = args;
        const reservation = reservations.get(requestId);
        if (!reservation || reservation.subject !== subject || grants.has(grantId)) return [];
        grants.set(grantId, { requestId, subject, state: "issued" });
        return [{ grant_id: grantId }];
      }
      if (sql === D1_PAID_SQL.consume) {
        events.push("consume");
        const [grantId, requestId, subject] = args;
        const grant = grants.get(grantId);
        if (!grant || grant.requestId !== requestId || grant.subject !== subject ||
            grant.state !== "issued") return [];
        grant.state = "consumed";
        return [{ grant_id: grantId }];
      }
      throw new Error("unexpected_sql");
    });
    queue = task.then(() => {}, () => {});
    return task;
  };

  return createD1HttpPaidStore({ client: { query } });
}

function harness({
  consentMode = "issue",
  requestIds = null,
  grantIds = null,
  fetchMode = "ok",
  timeoutMs = 1_000,
  audio = fixedWav,
  clock = () => new Date("2026-10-21T12:00:00.000Z"),
} = {}) {
  const events = [];
  const consents = [];
  let requestIndex = 0;
  let grantIndex = 0;
  let fetchCalls = 0;
  let captured = null;
  let replayCapability = null;
  let consentTime = consentNow;

  const consentStore = createAuditionConsentCapabilityStore({
    secret: consentSecret,
    clock: () => consentTime,
  });

  const baseVerifier = createVerifiedIdentityResolver({
    issuer,
    audience,
    publicJwks: [jwk],
    requiredScopes: ["voice:speak"],
    clock: () => now * 1_000,
  });
  const resolveVerifiedPrincipal = async (request) => {
    events.push("identity");
    return baseVerifier(request);
  };
  const requestOperatorConsent = async ({ principal, action, textBytes, textDigest, requestId }) => {
    events.push("consent");
    consents.push({ principal, action, textBytes, textDigest, requestId });
    if (consentMode === "missing") return undefined;
    if (consentMode === "deny") return null;
    if (consentMode === "throw") throw new Error("consent_store_unavailable");
    if (consentMode === "boolean") {
      return { allowed: true, oneTime: true, principal };
    }
    if (consentMode === "forged") return "forged.capability";
    if (consentMode === "replay") {
      if (!replayCapability) {
        replayCapability = consentStore.issue({
          principal, action, requestId, textBytes, textDigest,
        }).capability;
      }
      return replayCapability;
    }
    if (consentMode === "expired") {
      const capability = consentStore.issue({
        principal, action, requestId, textBytes, textDigest,
      }).capability;
      consentTime += DEFAULT_AUDITION_CONSENT_TTL_MS + 1;
      return capability;
    }
    if (consentMode === "wrong_binding") {
      return consentStore.issue({
        principal, action, requestId, textBytes: textBytes + 1, textDigest,
      }).capability;
    }
    return consentStore.issue({
      principal, action, requestId, textBytes, textDigest,
    }).capability;
  };
  const makeRequestId = () => {
    if (!requestIds) return randomUUID();
    return requestIds[Math.min(requestIndex++, requestIds.length - 1)];
  };
  const makeGrantId = () => {
    if (!grantIds) return "grant_" + randomUUID().replaceAll("-", "");
    return grantIds[Math.min(grantIndex++, grantIds.length - 1)];
  };
  const fetchImpl = async (_url, options) => {
    events.push("synthesize");
    fetchCalls++;
    captured = {
      headers: options?.headers,
      body: JSON.parse(options?.body ?? "{}"),
    };
    if (fetchMode === "timeout") {
      return await new Promise((_resolve, reject) => {
        const abort = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        if (options.signal.aborted) abort();
        else options.signal.addEventListener("abort", abort, { once: true });
      });
    }
    if (fetchMode === "invalid_upstream") {
      return {
        ok: true,
        json: async () => ({ base_resp: { status_code: 1001 }, data: {} }),
      };
    }
    if (fetchMode === "bad_status") {
      return { ok: false, json: async () => ({}) };
    }
    return {
      ok: true,
      json: async () => ({ base_resp: { status_code: 0 }, data: { audio: audio.toString("hex") } }),
    };
  };

  const candidate = createOfflineFirstAuditionCandidate({
    resolveVerifiedPrincipal,
    requestOperatorConsent,
    consentStore,
    store: fakeStore(events),
    apiKey: "offline-test-key",
    voiceId: "offline-test-voice",
    fetchImpl,
    timeoutMs,
    clock,
    makeRequestId,
    makeGrantId,
  });

  return {
    candidate,
    events,
    consents,
    consentStore,
    resolveVerifiedPrincipal,
    get fetchCalls() { return fetchCalls; },
    get captured() { return captured; },
  };
}

test("verified identity, one-time consent, one-slot D1 and one fake synthesis", async () => {
  const h = harness();
  const result = await h.candidate({ trustedRequest: trustedRequest(), text: "糯糯，哥哥在。" });

  assert.equal(h.fetchCalls, 1);
  assert.deepEqual(h.events, ["identity", "consent", "reserve", "issue", "consume", "synthesize"]);
  assert.equal(h.captured.body.model, "speech-2.8-hd");
  assert.equal(h.captured.body.voice_setting.voice_id, "offline-test-voice");
  assert.equal(result.record.generated, true);
  assert.equal(result.record.source, "minimax");
  assert.equal(result.record.audioMimeType, "audio/wav");
  assert.deepEqual(Buffer.from(result.record.audioBase64, "base64"), fixedWav);
  assert.equal(result.delivery, "inline-base64-experimental");
  assert.equal(JSON.stringify(result).includes("grant_"), false);

  const prepared = prepareGeneratedAudioPlayback(result.record);
  assert.equal(prepared.dataUrl, "data:audio/wav;base64," + result.record.audioBase64);
  assert.equal(prepared.byteLength, fixedWav.length);
  assert.equal(prepared.durationSeconds, 0.7);
  let decodedBytes;
  const playback = await decodeGeneratedAudioForPlayback({
    record: result.record,
    decodeAudioData: async (buffer) => {
      decodedBytes = Buffer.from(buffer);
      return { duration: 0.7 };
    },
    generation: "request-1",
    isCurrent: (generation) => generation === "request-1",
  });
  assert.deepEqual(decodedBytes, fixedWav);
  assert.equal(playback.prepared.durationSeconds, 0.7);
  assert.equal(playback.decoded.duration, 0.7);
});

test("missing or wrong identity never reaches consent, admission or synthesis", async () => {
  const requests = [
    {},
    trustedRequest(token({ aud: "https://wrong.invalid/mcp" })),
    trustedRequest(token({ scope: "profile" })),
    trustedRequest(token({ exp: now - 1 })),
  ];
  for (const request of requests) {
    const h = harness();
    await assert.rejects(h.candidate({ trustedRequest: request, text: "测试" }));
    assert.equal(h.events.includes("consent"), false);
    assert.equal(h.events.includes("reserve"), false);
    assert.equal(h.events.includes("synthesize"), false);
  }
});

test("caller-supplied identity or approval fields are ignored", async () => {
  const h = harness();
  const request = {
    ...trustedRequest(),
    principal: "attacker_principal",
    subject: "attacker_principal",
    approved: true,
    consent: true,
  };
  const result = await h.candidate({ trustedRequest: request, text: "测试", approved: true });

  assert.equal(result.record.generated, true);
  assert.equal(h.consents.length, 1);
  assert.notEqual(h.consents[0].principal, "attacker_principal");
  assert.notEqual(h.consents[0].principal, "user_001");
});

test("missing, denied, forged or non-capability consent stops before D1 and fetch", async () => {
  for (const consentMode of ["missing", "deny", "throw", "boolean", "forged"]) {
    const h = harness({ consentMode });
    await assert.rejects(
      h.candidate({ trustedRequest: trustedRequest(), text: "测试", approved: true }),
      /consent_denied/,
    );
    assert.deepEqual(h.events, ["identity", "consent"]);
    assert.equal(h.fetchCalls, 0);
  }
});

test("expired or wrongly bound capability stops before D1 and fetch", async () => {
  for (const consentMode of ["expired", "wrong_binding"]) {
    const h = harness({ consentMode });
    await assert.rejects(
      h.candidate({ trustedRequest: trustedRequest(), text: "binding-check" }),
      /consent_denied/,
    );
    assert.deepEqual(h.events, ["identity", "consent"]);
    assert.equal(h.fetchCalls, 0);
    const audit = h.consentStore.audit();
    assert.equal(audit.filter((event) => event.type === "issued").length, 1);
    assert.equal(audit.filter((event) => event.type === "consumed").length, 0);
  }
});

test("a replayed capability is denied before a second D1 reservation or fetch", async () => {
  const h = harness({
    consentMode: "replay",
    requestIds: ["request_consent_replay_001"],
  });
  const text = "replay-check";
  await h.candidate({ trustedRequest: trustedRequest(), text });
  await assert.rejects(
    h.candidate({ trustedRequest: trustedRequest(), text }),
    /consent_denied/,
  );

  assert.equal(h.fetchCalls, 1);
  assert.equal(h.events.filter((event) => event === "reserve").length, 1);
  const audit = h.consentStore.audit();
  assert.equal(audit.filter((event) => event.type === "issued").length, 1);
  assert.equal(audit.filter((event) => event.type === "consumed").length, 1);
});

test("concurrent auditions consume separate consent capabilities but only one daily slot", async () => {
  const h = harness();
  const outcomes = await Promise.allSettled([
    h.candidate({ trustedRequest: trustedRequest(), text: "concurrent-one" }),
    h.candidate({ trustedRequest: trustedRequest(), text: "concurrent-two" }),
  ]);

  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter((outcome) =>
    outcome.status === "rejected" && /budget_denied/.test(outcome.reason?.message ?? "")
  ).length, 1);
  assert.equal(h.fetchCalls, 1);
  assert.equal(h.events.filter((event) => event === "reserve").length, 2);
  const audit = h.consentStore.audit();
  assert.equal(audit.filter((event) => event.type === "issued").length, 2);
  assert.equal(audit.filter((event) => event.type === "consumed").length, 2);
});

test("a second distinct audition on the same day is denied after one fetch", async () => {
  const h = harness();
  await h.candidate({ trustedRequest: trustedRequest(), text: "第一次" });
  await assert.rejects(
    h.candidate({ trustedRequest: trustedRequest(), text: "第二次" }),
    /budget_denied/,
  );

  assert.equal(h.fetchCalls, 1);
  assert.equal(h.events.filter((event) => event === "reserve").length, 2);
  assert.equal(h.events.filter((event) => event === "issue").length, 1);
  assert.equal(h.events.filter((event) => event === "consume").length, 1);
});

test("duplicate request IDs fail closed at the durable reservation", async () => {
  const h = harness({ consentMode: "issue", requestIds: ["request_duplicate_001"] });
  await h.candidate({ trustedRequest: trustedRequest(), text: "第一次" });
  await assert.rejects(
    h.candidate({ trustedRequest: trustedRequest(), text: "重复" }),
    /budget_denied/,
  );

  assert.equal(h.fetchCalls, 1);
  assert.equal(h.events.filter((event) => event === "reserve").length, 2);
  assert.equal(h.events.filter((event) => event === "issue").length, 1);
});

test("a replayed grant on a later day blocks the second synthesis", async () => {
  let day = 0;
  const h = harness({
    consentMode: "issue",
    requestIds: ["request_day_one_001", "request_day_two_001"],
    grantIds: ["grant_replay_001"],
    clock: () => new Date(day++ === 0
      ? "2026-10-21T12:00:00.000Z"
      : "2026-10-22T12:00:00.000Z"),
  });

  await h.candidate({ trustedRequest: trustedRequest(), text: "第一次" });
  await assert.rejects(
    h.candidate({ trustedRequest: trustedRequest(), text: "重放" }),
    /grant_denied/,
  );
  assert.equal(h.fetchCalls, 1);
});

test("upstream timeout is one attempt only and the reservation is not refunded", async () => {
  const h = harness({ fetchMode: "timeout", timeoutMs: 20 });
  await assert.rejects(
    h.candidate({ trustedRequest: trustedRequest(), text: "超时" }),
    /upstream_error/,
  );
  assert.equal(h.fetchCalls, 1);

  await assert.rejects(
    h.candidate({ trustedRequest: trustedRequest(), text: "重试" }),
    /budget_denied/,
  );
  assert.equal(h.fetchCalls, 1);
});

test("over-duration audio is rejected after one fake upstream attempt", async () => {
  const h = harness({ audio: wav(61) });
  await assert.rejects(
    h.candidate({ trustedRequest: trustedRequest(), text: "过长" }),
    /upstream_error/,
  );
  assert.equal(h.fetchCalls, 1);
});

test("invalid upstream responses fail closed without retry", async () => {
  for (const fetchMode of ["invalid_upstream", "bad_status"]) {
    const h = harness({ fetchMode });
    await assert.rejects(
      h.candidate({ trustedRequest: trustedRequest(), text: "错误" }),
      /upstream_error/,
    );
    assert.equal(h.fetchCalls, 1);
  }
});

test("candidate refuses real fetch and missing server configuration", () => {
  const consentStore = createAuditionConsentCapabilityStore({
    secret: consentSecret,
    clock: () => consentNow,
  });
  const text = "config-check";
  const base = {
    resolveVerifiedPrincipal: async () => ({ verified: true, subject: "verified_subject_001" }),
    requestOperatorConsent: async ({ principal, action, requestId, textBytes, textDigest }) =>
      consentStore.issue({ principal, action, requestId, textBytes, textDigest }).capability,
    consentStore,
    store: {
      reserveAtomic: async () => ({ reserved: true }),
      issue: async () => ({ issued: true }),
      consume: async () => ({ consumed: true }),
    },
    apiKey: "offline-test-key",
    voiceId: "offline-test-voice",
    fetchImpl: async () => { throw new Error("must_not_run"); },
  };
  assert.throws(
    () => createOfflineFirstAuditionCandidate({ ...base, fetchImpl: globalThis.fetch }),
    /candidate_unavailable/,
  );
  assert.throws(
    () => createOfflineFirstAuditionCandidate({ ...base, apiKey: " " }),
    /candidate_unavailable/,
  );
  assert.throws(
    () => createOfflineFirstAuditionCandidate({ ...base, voiceId: "" }),
    /candidate_unavailable/,
  );
  assert.throws(
    () => createOfflineFirstAuditionCandidate({ ...base, consentStore: undefined }),
    /candidate_unavailable/,
  );
  assert.throws(
    () => createOfflineFirstAuditionCandidate({ ...base, requestOperatorConsent: undefined }),
    /candidate_unavailable/,
  );

  const binding = {
    principal: "verified_subject_001",
    action: AUDITION_CONSENT_ACTION,
    requestId: "request_config_001",
    textBytes: Buffer.byteLength(text, "utf8"),
    textDigest: auditionTextDigest(text),
  };
  const capability = consentStore.issue(binding).capability;
  assert.equal(typeof capability, "string");
});
