/**
 * Offline-qualified Qiniu Kodo S3 private audio backend.
 *
 * This module implements the existing private-result backend contract:
 * putLatest / getLatest / deleteExpired. It never returns an object URL, never
 * creates a presigned URL, and never stores WAV bytes or the canonical
 * principal in plaintext. A caller must inject an AWS SDK v3 S3 client, a
 * private bucket, a fixed object prefix, a 32-byte key material buffer and
 * bounded operation/timeout settings. It performs no network work unless the
 * injected client is invoked.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { MAX_WAV_BYTES, validateWav } from "./contract.js";
import { requireCanonicalPrincipal } from "./canonical-principal.js";
import {
  MAX_PRIVATE_RESULT_TTL_SECONDS,
} from "./p2-private-result-store.js";

export const KODO_S3_REGION = "ap-southeast-1";
export const KODO_S3_ENDPOINT = "https://s3.ap-southeast-1.qiniucs.com";
export const KODO_DEFAULT_PREFIX = "shenshu/voice-v1/private-audio/";
export const KODO_DEFAULT_TIMEOUT_MS = 10_000;
export const KODO_MAX_TIMEOUT_MS = 60_000;
export const KODO_DEFAULT_MAX_OPERATIONS = 16;

const ENVELOPE_VERSION = 1;
const ENVELOPE_ALGORITHM = "A256GCM";
const CIPHER_NAME = "aes-256-gcm";
const ENVELOPE_PURPOSE = "shenshu-p2-private-audio-v1";
const MAX_ENVELOPE_BYTES = 4 * 1024 * 1024;
const RECORD_ID = /^voice_[a-f0-9]{32}$/;
const BUCKET_NAME = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const PREFIX_NAME = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,94}\/$/;
const ENVELOPE_KEYS = Object.freeze([
  "alg",
  "audioBytes",
  "ciphertext",
  "createdAt",
  "durationSeconds",
  "expiresAt",
  "mimeType",
  "nonce",
  "ownerTag",
  "purpose",
  "recordId",
  "tag",
  "v",
]);

function validIsoTimestamp(value) {
  return typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function nowDate(value, clock) {
  let candidate = value;
  if (candidate === undefined) {
    try {
      candidate = clock();
    } catch {
      throw new Error("invalid_clock");
    }
  }
  const parsed = candidate instanceof Date
    ? new Date(candidate.valueOf())
    : validIsoTimestamp(candidate)
      ? new Date(candidate)
      : null;
  if (!parsed || Number.isNaN(parsed.valueOf())) throw new Error("invalid_clock");
  return parsed;
}

function validBucket(value) {
  return typeof value === "string" &&
    BUCKET_NAME.test(value) &&
    !value.includes("..") &&
    !/^[0-9.]+$/.test(value);
}

function validPrefix(value) {
  return typeof value === "string" &&
    PREFIX_NAME.test(value) &&
    !value.includes("//") &&
    !value.split("/").includes("..");
}

function validClient(value) {
  return value && typeof value.send === "function";
}

function validMasterKey(value) {
  return Buffer.isBuffer(value) && value.length === 32;
}

function validPositiveInteger(value, maximum) {
  return Number.isSafeInteger(value) && value >= 1 && value <= maximum;
}

function validOperationCap(value) {
  return Number.isSafeInteger(value) && value >= 3 && value <= 32;
}

function validEtag(value) {
  return typeof value === "string" && value.length >= 2 && value.length <= 512;
}

function deriveKeys(masterKey) {
  const salt = Buffer.from("shenshu-p2-kodo-private-audio-v1", "utf8");
  return Object.freeze({
    object: Buffer.from(hkdfSync(
      "sha256", masterKey, salt, Buffer.from("object-key-v1"), 32,
    )),
    owner: Buffer.from(hkdfSync(
      "sha256", masterKey, salt, Buffer.from("owner-tag-v1"), 32,
    )),
    audio: Buffer.from(hkdfSync(
      "sha256", masterKey, salt, Buffer.from("audio-encryption-v1"), 32,
    )),
  });
}

function ownerTagFor(keys, principal) {
  return createHmac("sha256", keys.owner)
    .update("owner\0")
    .update(principal)
    .digest("base64url");
}

function objectKeyFor(keys, prefix, principal) {
  const opaque = createHmac("sha256", keys.object)
    .update("object\0")
    .update(principal)
    .digest("base64url");
  return prefix + opaque;
}

function objectEncryptionKey(keys, principal) {
  return Buffer.from(hkdfSync(
    "sha256",
    keys.audio,
    Buffer.from(ENVELOPE_PURPOSE, "utf8"),
    Buffer.from("owner\0" + principal, "utf8"),
    32,
  ));
}

function canonicalAad(fields) {
  return Buffer.from([
    ENVELOPE_PURPOSE,
    String(fields.v),
    fields.alg,
    fields.ownerTag,
    fields.recordId,
    fields.createdAt,
    fields.expiresAt,
    fields.mimeType,
    String(fields.durationSeconds),
    String(fields.audioBytes),
  ].join("\0"), "utf8");
}

function validateRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error("invalid_result_record");
  }
  const principal = requireCanonicalPrincipal(record.principal);
  if (typeof record.recordId !== "string" ||
      !RECORD_ID.test(record.recordId) ||
      !validIsoTimestamp(record.createdAt) ||
      !validIsoTimestamp(record.expiresAt) ||
      record.mimeType !== "audio/wav" ||
      typeof record.durationSeconds !== "number" ||
      !Number.isFinite(record.durationSeconds) ||
      record.durationSeconds < 0.2 ||
      record.durationSeconds > 60 ||
      !Buffer.isBuffer(record.audio) ||
      record.audio.length < 44 ||
      record.audio.length > MAX_WAV_BYTES) {
    throw new Error("invalid_result_record");
  }
  const createdAt = Date.parse(record.createdAt);
  const expiresAt = Date.parse(record.expiresAt);
  if (expiresAt <= createdAt ||
      expiresAt - createdAt > MAX_PRIVATE_RESULT_TTL_SECONDS * 1000) {
    throw new Error("invalid_result_record");
  }
  const metadata = validateWav(record.audio);
  if (Math.abs(metadata.durationSeconds - record.durationSeconds) > 1e-9) {
    throw new Error("invalid_result_record");
  }
  return Object.freeze({
    principal,
    recordId: record.recordId,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    mimeType: metadata.mimeType,
    durationSeconds: metadata.durationSeconds,
    audio: Buffer.from(record.audio),
  });
}

function encryptRecord(record, keys) {
  const ownerTag = ownerTagFor(keys, record.principal);
  const fields = {
    v: ENVELOPE_VERSION,
    alg: ENVELOPE_ALGORITHM,
    purpose: ENVELOPE_PURPOSE,
    ownerTag,
    recordId: record.recordId,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    mimeType: record.mimeType,
    durationSeconds: record.durationSeconds,
    audioBytes: record.audio.length,
  };
  const nonce = randomBytes(12);
  const cipher = createCipheriv(
    CIPHER_NAME,
    objectEncryptionKey(keys, record.principal),
    nonce,
  );
  cipher.setAAD(canonicalAad(fields));
  const ciphertext = Buffer.concat([cipher.update(record.audio), cipher.final()]);
  const tag = cipher.getAuthTag();
  const envelope = Buffer.from(JSON.stringify({
    ...fields,
    nonce: nonce.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
    tag: tag.toString("base64url"),
  }), "utf8");
  if (envelope.length > MAX_ENVELOPE_BYTES) throw new Error("invalid_result_record");
  return Object.freeze({ envelope, ownerTag, fields });
}

function normalizeMetadata(metadata) {
  const result = {};
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return result;
  }
  for (const [key, value] of Object.entries(metadata)) {
    result[String(key).toLowerCase()] = value;
  }
  return result;
}

function metadataFor(fields) {
  return Object.freeze({
    "shenshu-version": String(fields.v),
    "owner-tag": fields.ownerTag,
    "record-id": fields.recordId,
    "created-at": fields.createdAt,
    "expires-at": fields.expiresAt,
    "mime-type": fields.mimeType,
    "duration-seconds": String(fields.durationSeconds),
    "audio-bytes": String(fields.audioBytes),
  });
}

function metadataMatches(metadata, fields) {
  const actual = normalizeMetadata(metadata);
  const expected = metadataFor(fields);
  return Object.keys(expected).every(key => actual[key] === expected[key]);
}

function parseEnvelope(buffer, principal, keys) {
  let parsed;
  try {
    parsed = JSON.parse(buffer.toString("utf8"));
  } catch {
    throw new Error("invalid_kodo_object");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
      Object.keys(parsed).sort().join("\0") !== ENVELOPE_KEYS.join("\0") ||
      parsed.v !== ENVELOPE_VERSION ||
      parsed.alg !== ENVELOPE_ALGORITHM ||
      parsed.purpose !== ENVELOPE_PURPOSE ||
      typeof parsed.ownerTag !== "string" ||
      typeof parsed.recordId !== "string" ||
      !RECORD_ID.test(parsed.recordId) ||
      !validIsoTimestamp(parsed.createdAt) ||
      !validIsoTimestamp(parsed.expiresAt) ||
      parsed.mimeType !== "audio/wav" ||
      typeof parsed.durationSeconds !== "number" ||
      !Number.isFinite(parsed.durationSeconds) ||
      parsed.durationSeconds < 0.2 ||
      parsed.durationSeconds > 60 ||
      !Number.isSafeInteger(parsed.audioBytes) ||
      parsed.audioBytes < 44 ||
      parsed.audioBytes > MAX_WAV_BYTES ||
      typeof parsed.nonce !== "string" ||
      typeof parsed.ciphertext !== "string" ||
      typeof parsed.tag !== "string") {
    throw new Error("invalid_kodo_object");
  }
  const createdAtMs = Date.parse(parsed.createdAt);
  const expiresAtMs = Date.parse(parsed.expiresAt);
  if (expiresAtMs <= createdAtMs ||
      expiresAtMs - createdAtMs > MAX_PRIVATE_RESULT_TTL_SECONDS * 1000) {
    throw new Error("invalid_kodo_object");
  }
  const expectedOwner = ownerTagFor(keys, principal);
  const suppliedOwner = Buffer.from(parsed.ownerTag, "ascii");
  const expectedOwnerBytes = Buffer.from(expectedOwner, "ascii");
  if (suppliedOwner.length !== expectedOwnerBytes.length ||
      !timingSafeEqual(suppliedOwner, expectedOwnerBytes)) {
    throw new Error("invalid_kodo_object");
  }
  const nonce = Buffer.from(parsed.nonce, "base64url");
  const ciphertext = Buffer.from(parsed.ciphertext, "base64url");
  const tag = Buffer.from(parsed.tag, "base64url");
  if (nonce.length !== 12 || tag.length !== 16 || ciphertext.length !== parsed.audioBytes) {
    throw new Error("invalid_kodo_object");
  }
  let plaintext;
  try {
    const decipher = createDecipheriv(
      CIPHER_NAME,
      objectEncryptionKey(keys, principal),
      nonce,
    );
    decipher.setAAD(canonicalAad(parsed));
    decipher.setAuthTag(tag);
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error("invalid_kodo_object");
  }
  if (plaintext.length !== parsed.audioBytes || plaintext.length > MAX_WAV_BYTES) {
    throw new Error("invalid_kodo_object");
  }
  const wav = validateWav(plaintext);
  if (Math.abs(wav.durationSeconds - parsed.durationSeconds) > 1e-9) {
    throw new Error("invalid_kodo_object");
  }
  return Object.freeze({
    principal,
    recordId: parsed.recordId,
    createdAt: parsed.createdAt,
    expiresAt: parsed.expiresAt,
    mimeType: wav.mimeType,
    durationSeconds: wav.durationSeconds,
    audio: Buffer.from(plaintext),
    fields: parsed,
  });
}

function isNotFound(error) {
  return error?.name === "NoSuchKey" ||
    error?.name === "NotFound" ||
    error?.name === "NoSuchBucket" ||
    error?.$metadata?.httpStatusCode === 404;
}

function isPreconditionFailed(error) {
  return error?.name === "PreconditionFailed" ||
    error?.$metadata?.httpStatusCode === 412;
}

async function readBoundedBody(body) {
  if (Buffer.isBuffer(body)) {
    if (body.length > MAX_ENVELOPE_BYTES) throw new Error("invalid_kodo_object");
    return Buffer.from(body);
  }
  if (body instanceof Uint8Array) {
    if (body.byteLength > MAX_ENVELOPE_BYTES) throw new Error("invalid_kodo_object");
    return Buffer.from(body);
  }
  if (!body) throw new Error("invalid_kodo_object");
  const chunks = [];
  let total = 0;
  if (typeof body[Symbol.asyncIterator] === "function") {
    for await (const chunk of body) {
      const bytes = Buffer.from(chunk);
      total += bytes.length;
      if (total > MAX_ENVELOPE_BYTES) {
        body.destroy?.();
        throw new Error("invalid_kodo_object");
      }
      chunks.push(bytes);
    }
    return Buffer.concat(chunks, total);
  }
  if (typeof body.getReader === "function") {
    const reader = body.getReader();
    try {
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        const bytes = Buffer.from(item.value);
        total += bytes.length;
        if (total > MAX_ENVELOPE_BYTES) {
          await reader.cancel().catch(() => {});
          throw new Error("invalid_kodo_object");
        }
        chunks.push(bytes);
      }
    } finally {
      reader.releaseLock?.();
    }
    return Buffer.concat(chunks, total);
  }
  throw new Error("invalid_kodo_object");
}

function makeDeadline(timeoutMs) {
  return Date.now() + timeoutMs;
}

function signalFor(deadline) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error("kodo_operation_timeout");
  return AbortSignal.timeout(remaining);
}

export function createP2KodoS3Client({
  accessKeyId,
  secretAccessKey,
  sessionToken,
  requestTimeoutMs = KODO_DEFAULT_TIMEOUT_MS,
  requestHandler,
} = {}) {
  if (typeof accessKeyId !== "string" || accessKeyId.length < 8 ||
      typeof secretAccessKey !== "string" || secretAccessKey.length < 16 ||
      !validPositiveInteger(requestTimeoutMs, KODO_MAX_TIMEOUT_MS)) {
    throw new Error("kodo_client_unavailable");
  }
  if (sessionToken !== undefined &&
      (typeof sessionToken !== "string" || sessionToken.length < 8)) {
    throw new Error("kodo_client_unavailable");
  }
  const credentials = {
    accessKeyId,
    secretAccessKey,
    ...(sessionToken === undefined ? {} : { sessionToken }),
  };
  return new S3Client({
    region: KODO_S3_REGION,
    endpoint: KODO_S3_ENDPOINT,
    forcePathStyle: true,
    maxAttempts: 1,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials,
    ...(requestHandler === undefined ? {} : { requestHandler }),
  });
}

export function createP2KodoPrivateAudioBackend({
  s3Client,
  bucket,
  prefix = KODO_DEFAULT_PREFIX,
  masterKey,
  clock = () => new Date(),
  requestTimeoutMs = KODO_DEFAULT_TIMEOUT_MS,
  maxOperations = KODO_DEFAULT_MAX_OPERATIONS,
} = {}) {
  if (!validClient(s3Client) ||
      !validBucket(bucket) ||
      !validPrefix(prefix) ||
      !validMasterKey(masterKey) ||
      typeof clock !== "function" ||
      !validPositiveInteger(requestTimeoutMs, KODO_MAX_TIMEOUT_MS) ||
      !validOperationCap(maxOperations)) {
    throw new Error("kodo_backend_unavailable");
  }
  const keys = deriveKeys(masterKey);
  let continuationToken = null;

  function keyFor(principal) {
    return objectKeyFor(keys, prefix, principal);
  }

  async function deleteObject(key, deadline, etag) {
    if (!validEtag(etag)) return false;
    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
        IfMatch: etag,
      }), { abortSignal: signalFor(deadline) });
      return true;
    } catch (error) {
      if (isNotFound(error) || isPreconditionFailed(error)) return false;
      throw new Error("kodo_delete_failed");
    }
  }

  return Object.freeze({
    async putLatest(record) {
      const checked = validateRecord(record);
      const key = keyFor(checked.principal);
      const encrypted = encryptRecord(checked, keys);
      const deadline = makeDeadline(requestTimeoutMs);
      try {
        await s3Client.send(new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: encrypted.envelope,
          ContentLength: encrypted.envelope.length,
          ContentType: "application/octet-stream",
          CacheControl: "no-store",
          Metadata: metadataFor(encrypted.fields),
        }), { abortSignal: signalFor(deadline) });
      } catch {
        // One SDK send only. An ambiguous PUT is never retried or overwritten.
        throw new Error("kodo_put_failed");
      }
      return Object.freeze({ stored: true });
    },

    async getLatest({ principal, now } = {}) {
      const subject = requireCanonicalPrincipal(principal);
      const current = nowDate(now, clock);
      const key = keyFor(subject);
      const deadline = makeDeadline(requestTimeoutMs);
      let response;
      try {
        response = await s3Client.send(new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        }), { abortSignal: signalFor(deadline) });
      } catch (error) {
        if (isNotFound(error)) return null;
        throw new Error("kodo_get_failed");
      }
      const declared = response?.ContentLength;
      if (declared !== undefined &&
          (!Number.isSafeInteger(declared) || declared < 0 || declared > MAX_ENVELOPE_BYTES)) {
        throw new Error("kodo_get_failed");
      }
      let envelope;
      try {
        envelope = await readBoundedBody(response?.Body);
      } catch {
        throw new Error("kodo_get_failed");
      }
      let parsed;
      try {
        parsed = parseEnvelope(envelope, subject, keys);
      } catch {
        throw new Error("kodo_object_integrity_failed");
      }
      if (!metadataMatches(response?.Metadata, parsed.fields)) {
        throw new Error("kodo_object_integrity_failed");
      }
      if (Date.parse(parsed.expiresAt) <= current.valueOf()) {
        await deleteObject(key, deadline, response?.ETag);
        return null;
      }
      return Object.freeze({
        principal: parsed.principal,
        recordId: parsed.recordId,
        audio: parsed.audio,
        mimeType: parsed.mimeType,
        durationSeconds: parsed.durationSeconds,
        createdAt: parsed.createdAt,
        expiresAt: parsed.expiresAt,
      });
    },

    async deleteExpired({ before } = {}) {
      const cutoff = nowDate(before, clock);
      const deadline = makeDeadline(requestTimeoutMs);
      let operations = 1;
      const maxKeys = Math.max(1, Math.floor((maxOperations - 1) / 2));
      let listing;
      try {
        listing = await s3Client.send(new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          MaxKeys: maxKeys,
          ...(continuationToken === null
            ? {}
            : { ContinuationToken: continuationToken }),
        }), { abortSignal: signalFor(deadline) });
      } catch {
        throw new Error("kodo_list_failed");
      }
      const nextContinuationToken = listing?.NextContinuationToken ?? null;
      let deleted = 0;
      let scanned = 0;
      let truncated = listing?.IsTruncated === true;
      let pageComplete = true;
      for (const item of Array.isArray(listing?.Contents) ? listing.Contents : []) {
        if (typeof item?.Key !== "string" || !item.Key.startsWith(prefix)) continue;
        if (operations + 1 > maxOperations) {
          truncated = true;
          pageComplete = false;
          break;
        }
        operations += 1;
        let head;
        try {
          head = await s3Client.send(new HeadObjectCommand({
            Bucket: bucket,
            Key: item.Key,
          }), { abortSignal: signalFor(deadline) });
        } catch (error) {
          if (isNotFound(error)) continue;
          throw new Error("kodo_head_failed");
        }
        scanned += 1;
        if (!validEtag(head?.ETag)) throw new Error("kodo_head_failed");
        const metadata = normalizeMetadata(head?.Metadata);
        if (metadata["shenshu-version"] !== String(ENVELOPE_VERSION) ||
            !validIsoTimestamp(metadata["expires-at"]) ||
            Date.parse(metadata["expires-at"]) > cutoff.valueOf()) {
          continue;
        }
        if (operations + 1 > maxOperations) {
          truncated = true;
          pageComplete = false;
          break;
        }
        operations += 1;
        if (await deleteObject(item.Key, deadline, head.ETag)) deleted += 1;
      }
      if (pageComplete) {
        if (truncated && nextContinuationToken === null) {
          throw new Error("kodo_list_failed");
        }
        continuationToken = nextContinuationToken;
      }
      return Object.freeze({ deleted, scanned, truncated });
    },
  });
}
