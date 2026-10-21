import test from "node:test";
import assert from "node:assert/strict";
import {
  AUDITION_CONSENT_ACTION,
  MAX_AUDITION_CONSENT_TTL_MS,
  auditionTextDigest,
  createAuditionConsentCapabilityStore,
} from "../src/audition-consent-capability.js";

const SECRET = "offline-consent-test-secret-32-bytes-minimum";
const START = Date.parse("2026-10-21T12:00:00.000Z");
const TEXT = "offline consent check";

function binding(overrides = {}) {
  return {
    principal: "opaque_principal_001",
    action: AUDITION_CONSENT_ACTION,
    requestId: "request_consent_001",
    textBytes: Buffer.byteLength(TEXT, "utf8"),
    textDigest: auditionTextDigest(TEXT),
    ...overrides,
  };
}

function fixture({ maxTtlMs, clock } = {}) {
  let now = START;
  const sinkEvents = [];
  const store = createAuditionConsentCapabilityStore({
    secret: SECRET,
    clock: clock ?? (() => now),
    ...(maxTtlMs === undefined ? {} : { maxTtlMs }),
    auditSink: (event) => sinkEvents.push(event),
  });
  return {
    store,
    sinkEvents,
    advance(ms) { now += ms; },
  };
}

test("a fresh capability is bound, consumed exactly once, and audited without its bearer", () => {
  const f = fixture();
  const requested = binding();
  const issued = f.store.issue(requested);
  const consumed = f.store.consume({ capability: issued.capability, ...requested });

  assert.equal(issued.capability.includes("."), true);
  assert.equal(consumed.consumed, true);
  assert.equal(consumed.consentId, issued.consentId);
  assert.equal(consumed.principal, requested.principal);
  assert.equal(consumed.action, AUDITION_CONSENT_ACTION);
  assert.equal(consumed.expiresAt, issued.expiresAt);

  assert.deepEqual(f.store.audit().map((event) => event.type), ["issued", "consumed"]);
  assert.deepEqual(f.sinkEvents.map((event) => event.type), ["issued", "consumed"]);
  assert.equal(f.sinkEvents[0].principal, requested.principal);
  assert.equal(f.sinkEvents[0].requestId, requested.requestId);
  assert.equal(f.sinkEvents[0].textDigest, requested.textDigest);
  assert.equal(JSON.stringify(f.sinkEvents).includes(issued.capability), false);
  assert.equal(auditionTextDigest(TEXT).length, 43);
  assert.notEqual(auditionTextDigest(TEXT + "!"), requested.textDigest);
});

test("a consumed capability cannot be replayed", () => {
  const f = fixture();
  const requested = binding();
  const capability = f.store.issue(requested).capability;
  f.store.consume({ capability, ...requested });

  assert.throws(
    () => f.store.consume({ capability, ...requested }),
    /consent_replay/,
  );
  assert.equal(f.store.audit().filter((event) => event.type === "consumed").length, 1);
});

test("concurrent attempts against one capability allow exactly one success", async () => {
  const f = fixture();
  const requested = binding();
  const capability = f.store.issue(requested).capability;

  const outcomes = await Promise.allSettled(
    Array.from({ length: 16 }, () =>
      Promise.resolve().then(() => f.store.consume({ capability, ...requested }))
    ),
  );

  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  const rejected = outcomes.filter((outcome) => outcome.status === "rejected");
  assert.equal(rejected.length, 15);
  assert.equal(rejected.every((outcome) => /consent_replay/.test(outcome.reason?.message ?? "")), true);
  assert.equal(f.store.audit().filter((event) => event.type === "consumed").length, 1);
});

test("expired capabilities are rejected", () => {
  const f = fixture({ maxTtlMs: 1_000 });
  const requested = binding();
  const capability = f.store.issue(requested).capability;
  f.advance(1_000);

  assert.throws(
    () => f.store.consume({ capability, ...requested }),
    /consent_expired/,
  );
});

test("forged, malformed, missing and oversized capabilities fail closed", () => {
  const f = fixture();
  const requested = binding();
  const capability = f.store.issue(requested).capability;
  const [body, signature] = capability.split(".");
  const bodyIndex = Math.floor(body.length / 2);
  const replacement = body[bodyIndex] === "A" ? "B" : "A";
  const tamperedBody = body.slice(0, bodyIndex) + replacement + body.slice(bodyIndex + 1);

  assert.throws(
    () => f.store.consume({ capability: tamperedBody + "." + signature, ...requested }),
    /consent_invalid/,
  );
  assert.throws(
    () => f.store.consume({ capability: body + "." + signature.slice(0, -1), ...requested }),
    /consent_invalid/,
  );
  assert.throws(
    () => f.store.consume({ ...requested }),
    /consent_missing/,
  );
  assert.throws(
    () => f.store.consume({ capability: "not-a-capability", ...requested }),
    /consent_invalid/,
  );
  assert.throws(
    () => f.store.consume({ capability: "A".repeat(4_097), ...requested }),
    /consent_missing/,
  );
});

test("every binding field must match and failed binding checks do not consume", () => {
  const f = fixture();
  const requested = binding();
  const mismatches = [
    { principal: "other_principal_002" },
    { action: "other_voice_action" },
    { requestId: "request_consent_other" },
    { textBytes: requested.textBytes + 1 },
    { textDigest: auditionTextDigest("different offline text") },
  ];

  for (const mismatch of mismatches) {
    const capability = f.store.issue(requested).capability;
    assert.throws(
      () => f.store.consume({ capability, ...requested, ...mismatch }),
      /consent_binding_mismatch/,
    );
  }

  const capability = f.store.issue(requested).capability;
  assert.equal(f.store.consume({ capability, ...requested }).consumed, true);
});

test("invalid configuration and invalid issue bindings are rejected before issue", () => {
  assert.throws(
    () => createAuditionConsentCapabilityStore({ secret: "x".repeat(31) }),
    /invalid_consent_configuration/,
  );
  assert.throws(
    () => createAuditionConsentCapabilityStore({ secret: "x".repeat(257) }),
    /invalid_consent_configuration/,
  );
  assert.throws(
    () => createAuditionConsentCapabilityStore({ secret: SECRET, maxTtlMs: 999 }),
    /invalid_consent_configuration/,
  );
  assert.throws(
    () => createAuditionConsentCapabilityStore({
      secret: SECRET,
      maxTtlMs: MAX_AUDITION_CONSENT_TTL_MS + 1,
    }),
    /invalid_consent_configuration/,
  );
  assert.throws(
    () => createAuditionConsentCapabilityStore({ secret: SECRET, auditSink: "not-a-function" }),
    /invalid_consent_configuration/,
  );

  const f = fixture();
  for (const invalid of [
    binding({ principal: "short" }),
    binding({ action: "other_voice_action" }),
    binding({ requestId: "short" }),
    binding({ textBytes: 0 }),
    binding({ textBytes: 801 }),
    binding({ textDigest: "not-a-digest" }),
  ]) {
    assert.throws(() => f.store.issue(invalid), /consent_invalid_binding/);
  }
});

test("an invalid clock cannot mint a capability", () => {
  const store = createAuditionConsentCapabilityStore({
    secret: SECRET,
    clock: () => -1,
  });
  assert.throws(() => store.issue(binding()), /consent_clock_error/);
});
