/**
 * Private-at-rest codec for a nonbillable Voice V1 proposal.
 *
 * AES-256-GCM protects the proposal text. A separate HKDF-derived HMAC key
 * replaces the public bare SHA-256 digest stored by 004. The authenticated
 * envelope is versioned and purpose-bound; AAD binds the owner, handle,
 * operation, origin, byte count and expiry. No key, plaintext or public text
 * digest is written into the envelope.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { checkText, MAX_TEXT_BYTES } from "./contract.js";
import { STAGING_RESOURCE_ORIGIN } from "./protected-resource-identity.js";
import {
  DIGEST_PATTERN,
  HANDLE_PATTERN,
  OPERATION_ID_PATTERN,
  P2_OPERATION_ACTION,
  textDigest,
} from "./v1-p2-operation-contract.js";

export const PRIVATE_TEXT_SEALED_MARKER = "sealed:v1";
export const PRIVATE_TEXT_SEALER_VERSION = 1;
export const PRIVATE_TEXT_SEALER_KEY_ID = "v1";
export const PRIVATE_TEXT_SEALER_PURPOSE =
  "shenshu-voice-v1-pending-proposal";

const ALGORITHM = "A256GCM";
const AAD_VERSION = 1;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const MAX_SEALED_TEXT_LENGTH = 8192;
const HKDF_SALT = "shenshu-voice-v1-private-text-sealing/salt";
const AEAD_INFO = "shenshu-voice-v1-private-text-sealing/aead";
const HMAC_INFO = "shenshu-voice-v1-private-text-sealing/digest";
const ENVELOPE_KEYS = [
  "alg", "ciphertext", "keyId", "nonce", "purpose", "tag", "v",
];

function invalid() {
  throw new Error("sealed_text_invalid");
}

function exactEnvelopeKeys(value) {
  const keys = Object.keys(value).sort();
  return keys.length === ENVELOPE_KEYS.length &&
    keys.every((key, index) => key === ENVELOPE_KEYS[index]);
}

function canonicalBinding(input) {
  const binding = {
    principal: input?.principal,
    handle: input?.handle,
    operationId: input?.operationId,
    action: input?.action,
    origin: input?.origin,
    textBytes: input?.textBytes,
    expiresAt: input?.expiresAt,
  };
  if (typeof binding.principal !== "string" ||
      binding.principal.length < 1 || binding.principal.length > 512 ||
      /[\x00-\x1f\x7f]/.test(binding.principal) ||
      !HANDLE_PATTERN.test(binding.handle ?? "") ||
      !OPERATION_ID_PATTERN.test(binding.operationId ?? "") ||
      binding.action !== P2_OPERATION_ACTION ||
      binding.origin !== STAGING_RESOURCE_ORIGIN ||
      !Number.isSafeInteger(binding.textBytes) ||
      binding.textBytes < 1 || binding.textBytes > MAX_TEXT_BYTES ||
      !Number.isSafeInteger(binding.expiresAt) || binding.expiresAt < 0) {
    invalid();
  }
  return Object.freeze(binding);
}

function aadFor(binding) {
  return Buffer.from(JSON.stringify([
    "aad",
    AAD_VERSION,
    PRIVATE_TEXT_SEALER_PURPOSE,
    PRIVATE_TEXT_SEALER_KEY_ID,
    binding.principal,
    binding.handle,
    binding.operationId,
    binding.action,
    binding.origin,
    binding.textBytes,
    binding.expiresAt,
  ]), "utf8");
}

function digestMessage(binding, digest) {
  if (!DIGEST_PATTERN.test(digest ?? "")) invalid();
  return Buffer.from(JSON.stringify([
    "digest",
    AAD_VERSION,
    PRIVATE_TEXT_SEALER_PURPOSE,
    PRIVATE_TEXT_SEALER_KEY_ID,
    binding.principal,
    binding.handle,
    binding.operationId,
    binding.action,
    binding.origin,
    binding.textBytes,
    binding.expiresAt,
    digest,
  ]), "utf8");
}

function decodeBase64url(value, expectedBytes) {
  if (typeof value !== "string" ||
      !/^[A-Za-z0-9_-]+$/.test(value)) invalid();
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length !== expectedBytes ||
      decoded.toString("base64url") !== value) {
    invalid();
  }
  return decoded;
}

function safeEqualEncoded(actual, expected) {
  if (!DIGEST_PATTERN.test(actual ?? "") ||
      !DIGEST_PATTERN.test(expected ?? "")) {
    invalid();
  }
  const left = Buffer.from(actual, "ascii");
  const right = Buffer.from(expected, "ascii");
  if (left.length !== right.length || !timingSafeEqual(left, right)) invalid();
}

export function createPrivateTextSealer({ masterKey } = {}) {
  if (!Buffer.isBuffer(masterKey) || masterKey.length !== KEY_BYTES) {
    throw new Error("private_text_sealer_unavailable");
  }
  const keyMaterial = Buffer.from(masterKey);
  const aeadKey = Buffer.from(hkdfSync(
    "sha256",
    keyMaterial,
    Buffer.from(HKDF_SALT, "utf8"),
    Buffer.from(AEAD_INFO, "utf8"),
    KEY_BYTES,
  ));
  const hmacKey = Buffer.from(hkdfSync(
    "sha256",
    keyMaterial,
    Buffer.from(HKDF_SALT, "utf8"),
    Buffer.from(HMAC_INFO, "utf8"),
    KEY_BYTES,
  ));

  function computeDigestBinding(binding, digest) {
    return createHmac("sha256", hmacKey)
      .update(digestMessage(binding, digest))
      .digest("base64url");
  }

  return Object.freeze({
    keyId: PRIVATE_TEXT_SEALER_KEY_ID,

    digestBinding(input, digest) {
      try {
        return computeDigestBinding(canonicalBinding(input), digest);
      } catch {
        invalid();
      }
    },

    seal(input) {
      try {
        const binding = canonicalBinding(input);
        const text = checkText(input?.text);
        const textBytes = Buffer.byteLength(text, "utf8");
        if (textBytes !== binding.textBytes || textBytes > MAX_TEXT_BYTES) {
          invalid();
        }
        const digest = textDigest(text);
        const nonce = randomBytes(NONCE_BYTES);
        const cipher = createCipheriv("aes-256-gcm", aeadKey, nonce, {
          authTagLength: TAG_BYTES,
        });
        cipher.setAAD(aadFor(binding), { plaintextLength: textBytes });
        const ciphertext = Buffer.concat([
          cipher.update(text, "utf8"),
          cipher.final(),
        ]);
        const tag = cipher.getAuthTag();
        const envelope = {
          v: PRIVATE_TEXT_SEALER_VERSION,
          keyId: PRIVATE_TEXT_SEALER_KEY_ID,
          alg: ALGORITHM,
          purpose: PRIVATE_TEXT_SEALER_PURPOSE,
          nonce: nonce.toString("base64url"),
          ciphertext: ciphertext.toString("base64url"),
          tag: tag.toString("base64url"),
        };
        return Object.freeze({
          sealedText: JSON.stringify(envelope),
          textDigest: digest,
          textBytes,
          digestBinding: computeDigestBinding(binding, digest),
        });
      } catch {
        invalid();
      }
    },

    open(input) {
      try {
        const binding = canonicalBinding(input);
        if (typeof input?.sealedText !== "string" ||
            input.sealedText.length > MAX_SEALED_TEXT_LENGTH) invalid();
        let envelope;
        try {
          envelope = JSON.parse(input.sealedText);
        } catch {
          invalid();
        }
        if (envelope === null || typeof envelope !== "object" ||
            Array.isArray(envelope) || !exactEnvelopeKeys(envelope) ||
            envelope.v !== PRIVATE_TEXT_SEALER_VERSION ||
            envelope.keyId !== PRIVATE_TEXT_SEALER_KEY_ID ||
            envelope.alg !== ALGORITHM ||
            envelope.purpose !== PRIVATE_TEXT_SEALER_PURPOSE) {
          invalid();
        }
        const nonce = decodeBase64url(envelope.nonce, NONCE_BYTES);
        const ciphertext = decodeBase64url(
          envelope.ciphertext,
          binding.textBytes,
        );
        const tag = decodeBase64url(envelope.tag, TAG_BYTES);
        const decipher = createDecipheriv("aes-256-gcm", aeadKey, nonce, {
          authTagLength: TAG_BYTES,
        });
        decipher.setAAD(aadFor(binding), {
          plaintextLength: binding.textBytes,
        });
        decipher.setAuthTag(tag);
        const plaintext = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final(),
        ]);
        const text = plaintext.toString("utf8");
        if (plaintext.length !== binding.textBytes ||
            !Buffer.from(text, "utf8").equals(plaintext) ||
            checkText(text) !== text) {
          invalid();
        }
        const digest = textDigest(text);
        safeEqualEncoded(
          computeDigestBinding(binding, digest),
          input?.digestBinding,
        );
        return Object.freeze({
          text,
          textDigest: digest,
          textBytes: plaintext.length,
        });
      } catch {
        invalid();
      }
    },
  });
}
