import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { STAGING_RESOURCE_ORIGIN } from "../src/protected-resource-identity.js";
import {
  PRIVATE_TEXT_SEALED_MARKER,
  PRIVATE_TEXT_SEALER_KEY_ID,
  PRIVATE_TEXT_SEALER_PURPOSE,
  PRIVATE_TEXT_SEALER_VERSION,
  createPrivateTextSealer,
} from "../src/v1-p2-private-text-sealer.js";
import {
  P2_OPERATION_ACTION,
  textDigest,
} from "../src/v1-p2-operation-contract.js";

const MASTER_KEY = Buffer.from("sealed-text-test-master-key-0001");
const OTHER_MASTER_KEY = Buffer.from("sealed-text-test-master-key-0002");
const TEXT = "沈".repeat(266) + "ab";
const EXPIRES_AT = Date.parse("2026-10-29T00:15:00.000Z");
const BINDING = Object.freeze({
  principal: "auth0|sealed-private-text-owner",
  handle: "H".repeat(43),
  operationId: "op_sealed_private_text_0001",
  action: P2_OPERATION_ACTION,
  origin: STAGING_RESOURCE_ORIGIN,
  textBytes: 800,
  expiresAt: EXPIRES_AT,
});

function sealer(key = MASTER_KEY) {
  return createPrivateTextSealer({ masterKey: key });
}

function sealedResult(input = BINDING, text = TEXT, key = MASTER_KEY) {
  return sealer(key).seal({ text, ...input });
}

function changedEnvelope(sealedText, change) {
  const envelope = JSON.parse(sealedText);
  change(envelope);
  return JSON.stringify(envelope);
}

test("AES-GCM envelope round-trips exact Unicode and the full 800-byte limit", () => {
  assert.equal(Buffer.byteLength(TEXT, "utf8"), 800);
  const result = sealedResult();
  const envelope = JSON.parse(result.sealedText);

  assert.equal(result.textBytes, 800);
  assert.equal(result.textDigest, textDigest(TEXT));
  assert.equal(Buffer.byteLength(result.sealedText, "utf8") > 800, true);
  assert.equal(PRIVATE_TEXT_SEALED_MARKER, "sealed:v1");
  assert.deepEqual(Object.keys(envelope).sort(), [
    "alg", "ciphertext", "keyId", "nonce", "purpose", "tag", "v",
  ]);
  assert.equal(envelope.v, PRIVATE_TEXT_SEALER_VERSION);
  assert.equal(envelope.keyId, PRIVATE_TEXT_SEALER_KEY_ID);
  assert.equal(envelope.purpose, PRIVATE_TEXT_SEALER_PURPOSE);
  assert.equal(envelope.nonce.length, 16);
  assert.equal(envelope.tag.length, 22);
  assert.equal(result.sealedText.includes(TEXT), false);
  assert.equal(result.sealedText.includes(result.textDigest), false);
  assert.equal(result.sealedText.includes(
    createHash("sha256").update(TEXT, "utf8").digest("base64url"),
  ), false);

  const opened = sealer().open({
    sealedText: result.sealedText,
    digestBinding: result.digestBinding,
    ...BINDING,
  });
  assert.equal(opened.text, TEXT);
  assert.equal(opened.textBytes, 800);
  assert.equal(opened.textDigest, result.textDigest);
});

test("nonce is random and digest binding is keyed, deterministic and context-bound", () => {
  const first = sealedResult();
  const second = sealedResult();
  assert.notEqual(
    JSON.parse(first.sealedText).nonce,
    JSON.parse(second.sealedText).nonce,
  );
  assert.notEqual(first.sealedText, second.sealedText);
  assert.match(first.digestBinding, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first.digestBinding, first.textDigest);

  const service = sealer();
  assert.equal(
    service.digestBinding(BINDING, first.textDigest),
    service.digestBinding(BINDING, first.textDigest),
  );
  assert.notEqual(
    service.digestBinding(BINDING, first.textDigest),
    service.digestBinding({ ...BINDING, handle: "I".repeat(43) }, first.textDigest),
  );
  assert.notEqual(
    sealer(OTHER_MASTER_KEY).digestBinding(BINDING, first.textDigest),
    first.digestBinding,
  );
});

test("wrong key, key id, version, algorithm and purpose all fail closed", () => {
  const result = sealedResult();
  assert.throws(() => createPrivateTextSealer({}), /private_text_sealer_unavailable/);
  assert.throws(
    () => createPrivateTextSealer({ masterKey: Buffer.alloc(31, 1) }),
    /private_text_sealer_unavailable/,
  );

  const tampered = [
    changedEnvelope(result.sealedText, value => { value.keyId = "v2"; }),
    changedEnvelope(result.sealedText, value => { value.v = 2; }),
    changedEnvelope(result.sealedText, value => { value.alg = "A128GCM"; }),
    changedEnvelope(result.sealedText, value => { value.purpose = "other"; }),
  ];
  for (const sealedText of tampered) {
    assert.throws(
      () => sealer().open({
        sealedText,
        digestBinding: result.digestBinding,
        ...BINDING,
      }),
      /sealed_text_invalid/,
    );
  }
  assert.throws(
    () => sealer(OTHER_MASTER_KEY).open({
      sealedText: result.sealedText,
      digestBinding: result.digestBinding,
      ...BINDING,
    }),
    /sealed_text_invalid/,
  );
});

test("ciphertext, tag, nonce, malformed envelope and digest HMAC tampering fail closed", () => {
  const result = sealedResult();
  const flip = value => value[0] === "A" ? "B" : "A";
  const tampered = [
    changedEnvelope(result.sealedText, value => {
      value.ciphertext = flip(value.ciphertext[0]) + value.ciphertext.slice(1);
    }),
    changedEnvelope(result.sealedText, value => {
      value.tag = flip(value.tag[0]) + value.tag.slice(1);
    }),
    changedEnvelope(result.sealedText, value => {
      value.nonce = flip(value.nonce[0]) + value.nonce.slice(1);
    }),
    changedEnvelope(result.sealedText, value => { value.extra = "x"; }),
    JSON.stringify({ short: true }),
    "not-json",
  ];
  for (const sealedText of tampered) {
    assert.throws(
      () => sealer().open({
        sealedText,
        digestBinding: result.digestBinding,
        ...BINDING,
      }),
      /sealed_text_invalid/,
    );
  }
  assert.throws(
    () => sealer().open({
      sealedText: result.sealedText,
      digestBinding: "A".repeat(43),
      ...BINDING,
    }),
    /sealed_text_invalid/,
  );
});

test("principal, handle, operation, origin, byte count, expiry and action are authenticated", () => {
  const result = sealedResult();
  const bindings = [
    { ...BINDING, principal: "auth0|another-owner" },
    { ...BINDING, handle: "I".repeat(43) },
    { ...BINDING, operationId: "op_sealed_private_text_0002" },
    { ...BINDING, origin: "https://elsewhere.example" },
    { ...BINDING, textBytes: 799 },
    { ...BINDING, expiresAt: EXPIRES_AT + 1 },
    { ...BINDING, action: "other_action" },
  ];
  for (const binding of bindings) {
    assert.throws(
      () => sealer().open({
        sealedText: result.sealedText,
        digestBinding: result.digestBinding,
        ...binding,
      }),
      /sealed_text_invalid/,
    );
  }
});

test("oversized, empty and control-character text is rejected before sealing", () => {
  const service = sealer();
  for (const input of [
    { text: "a".repeat(801), ...BINDING, textBytes: 801 },
    { text: "", ...BINDING, textBytes: 0 },
    { text: "line\u0000break", ...BINDING, textBytes: 10 },
  ]) {
    assert.throws(() => service.seal(input), /sealed_text_invalid/);
  }
});
