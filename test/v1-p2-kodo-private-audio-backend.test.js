/**
 * Offline Kodo S3 backend qualification.
 *
 * All S3 interaction is through an injected in-memory protocol double or an
 * AWS SDK request handler that captures one signed request without networking.
 * No Qiniu credential, bucket, D1, Render, provider or Call resource is used.
 */
process.env.NODE_ENV = "test";

import test from "node:test";
import assert from "node:assert/strict";
import {
  createHash,
  createHmac,
  generateKeyPairSync,
  sign,
} from "node:crypto";
import { readFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { Readable } from "node:stream";
import { deriveCanonicalPrincipal } from "../src/canonical-principal.js";
import { makeInlineToneFixture } from "../src/inline-fixture.js";
import { validateWav } from "../src/contract.js";
import {
  AUTH0_ISSUER,
  STAGING_RESOURCE_ORIGIN,
} from "../src/protected-resource-identity.js";
import {
  PRIVATE_PLAYER_SESSION_COOKIE,
} from "../src/private-web-player.js";
import {
  createP2PrivateResultStore,
} from "../src/p2-private-result-store.js";
import {
  KODO_DEFAULT_PREFIX,
  KODO_S3_ENDPOINT,
  KODO_S3_REGION,
  createP2KodoPrivateAudioBackend,
  createP2KodoS3Client,
} from "../src/p2-kodo-private-audio-backend.js";
import {
  P2_PREPARE_TOOL,
} from "../src/v1-p2-nonbillable-mcp.js";
import { createPrivateTextSealer } from "../src/v1-p2-private-text-sealer.js";
import { V1_FIXED_MODEL_ID } from "../src/v1-offline-paid-pipeline.js";
import {
  OFFLINE_CONFIRM_TEST_FLAG,
  createV1P2OfflineConfirmRuntime,
} from "../src/v1-p2-offline-confirm-runtime.js";

const sqliteModule = (() => {
  try {
    return typeof process.getBuiltinModule === "function"
      ? process.getBuiltinModule("node:sqlite")
      : null;
  } catch {
    return null;
  }
})();
const DatabaseSync = sqliteModule?.DatabaseSync ?? null;
const sqliteSkip = typeof DatabaseSync === "function"
  ? false
  : "node:sqlite requires Node 24";

const NOW_MS = Date.parse("2026-10-27T00:00:00.000Z");
const SUBJECT = "auth0|kodo-offline-owner";
const OTHER_SUBJECT = "auth0|kodo-offline-other";
const SESSION_SECRET = "offline-kodo-session-secret-0123456789abcdef012345";
const CLIENT_ID = "k".repeat(32);
const VOICE_ID = "voice_kodo_fixture_001";
const FIXTURE = Buffer.from(makeInlineToneFixture().audioBase64, "base64");
const OTHER_AUDIO = Buffer.from(FIXTURE);
OTHER_AUDIO[44] = OTHER_AUDIO[44] ^ 0x01;
const MASTER_KEY = Buffer.from(Array.from({ length: 32 }, (_, index) => index + 11));
const TEXT_MASTER_KEY = Buffer.from(
  Array.from({ length: 32 }, (_, index) => index + 41),
);
const OTHER_MASTER_KEY = Buffer.from(
  Array.from({ length: 32 }, (_, index) => index + 91),
);
const PRINCIPAL = deriveCanonicalPrincipal({
  issuer: AUTH0_ISSUER,
  subject: SUBJECT,
});
const OTHER_PRINCIPAL = deriveCanonicalPrincipal({
  issuer: AUTH0_ISSUER,
  subject: OTHER_SUBJECT,
});
const BUCKET = "shenshu-private-fixture";
const AUDIENCE = STAGING_RESOURCE_ORIGIN + "/paid-mcp";
let currentMs = NOW_MS;

const MIGRATIONS = [
  new URL("../db/d1/001_paid_voice_reservations.sql", import.meta.url),
  new URL("../db/d1/002_paid_voice_grants.sql", import.meta.url),
  new URL("../db/d1/004_paid_voice_confirmation_operations.sql", import.meta.url),
  new URL(
    "../db/d1/005_paid_voice_confirmation_private_text_sealing.sql",
    import.meta.url,
  ),
];
const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const publicJwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "kodo-offline-key",
  alg: "RS256",
  use: "sig",
};

function resetClock() {
  currentMs = NOW_MS;
}

function notFound() {
  return Object.assign(new Error("not found"), {
    name: "NoSuchKey",
    $metadata: { httpStatusCode: 404 },
  });
}

function abortableDelay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    }, { once: true });
  });
}

class FakeS3 {
  constructor() {
    this.objects = new Map();
    this.calls = [];
    this.failure = null;
    this.beforeCommand = null;
    this.afterGet = null;
  }

  failOn(name, { error = new Error("fixture s3 failure"), delayMs = 0 } = {}) {
    this.failure = { name, error, delayMs };
  }

  clearFailure() {
    this.failure = null;
  }

  putRaw(key, {
    body,
    metadata = {},
    contentType = "application/octet-stream",
    etag = '"' + createHash("sha256").update(body).digest("hex") + '"',
  }) {
    this.objects.set(key, {
      body: Buffer.from(body),
      metadata: { ...metadata },
      contentType,
      etag,
    });
  }

  async send(command, options = {}) {
    const name = command.constructor.name;
    const input = command.input ?? {};
    this.calls.push({ name, input, signal: Boolean(options.abortSignal) });
    if (this.beforeCommand?.name === name) {
      const handler = this.beforeCommand.handler;
      this.beforeCommand = null;
      await handler();
    }
    if (this.failure?.name === name) {
      if (this.failure.delayMs > 0) {
        await abortableDelay(this.failure.delayMs, options.abortSignal);
      }
      throw this.failure.error;
    }
    if (name === "PutObjectCommand") {
      if (input.Bucket !== BUCKET || typeof input.Key !== "string") {
        throw new Error("unexpected put");
      }
      this.putRaw(input.Key, {
        body: input.Body,
        metadata: input.Metadata,
        contentType: input.ContentType,
      });
      return { ETag: '"fixture-etag"' };
    }
    if (name === "GetObjectCommand") {
      if (input.Bucket !== BUCKET) throw new Error("unexpected get");
      const row = this.objects.get(input.Key);
      if (!row) throw notFound();
      const response = {
        Body: Readable.from([Buffer.from(row.body)]),
        ContentLength: row.body.length,
        ContentType: row.contentType,
        Metadata: { ...row.metadata },
        ETag: row.etag,
      };
      if (this.afterGet) await this.afterGet(input, row);
      return response;
    }
    throw new Error("unexpected command " + name);
  }
}

function makeRecord(principal, {
  audio = FIXTURE,
  createdAtMs = currentMs,
  ttlSeconds = 60,
  recordId = "voice_" + "a".repeat(32),
} = {}) {
  const metadata = validateWav(audio);
  return Object.freeze({
    principal,
    recordId,
    audio: Buffer.from(audio),
    mimeType: metadata.mimeType,
    durationSeconds: metadata.durationSeconds,
    createdAt: new Date(createdAtMs).toISOString(),
    expiresAt: new Date(createdAtMs + ttlSeconds * 1000).toISOString(),
  });
}

function makeBackend(fake, overrides = {}) {
  return createP2KodoPrivateAudioBackend({
    s3Client: fake,
    bucket: BUCKET,
    prefix: KODO_DEFAULT_PREFIX,
    masterKey: MASTER_KEY,
    clock: () => new Date(currentMs),
    requestTimeoutMs: 2_000,
    maxOperations: 16,
    ...overrides,
  });
}

function makeStore(fake, overrides = {}) {
  return createP2PrivateResultStore({
    backend: makeBackend(fake, overrides),
    ttlSeconds: 60,
    clock: () => new Date(currentMs),
  });
}

test("Kodo client fixes the Singapore HTTPS endpoint and one-attempt policy",
  async () => {
    const client = createP2KodoS3Client({
      accessKeyId: "fixture-access-key",
      secretAccessKey: "fixture-secret-access-key-0123456789",
      requestTimeoutMs: 5_000,
    });
    try {
      assert.equal(await client.config.region(), KODO_S3_REGION);
      const endpoint = await client.config.endpoint();
      assert.equal(endpoint.protocol, "https:");
      assert.equal(endpoint.hostname, new URL(KODO_S3_ENDPOINT).hostname);
      assert.equal(
        typeof client.config.forcePathStyle === "function"
          ? await client.config.forcePathStyle()
          : client.config.forcePathStyle,
        true,
      );
      assert.equal(await client.config.maxAttempts(), 1);
    } finally {
      client.destroy();
    }
    assert.throws(() => createP2KodoS3Client({}), /kodo_client_unavailable/);
    assert.throws(() => createP2KodoS3Client({
      accessKeyId: "fixture-access-key",
      secretAccessKey: "fixture-secret-access-key-0123456789",
      requestTimeoutMs: 60_001,
    }), /kodo_client_unavailable/);
  });

test("backend rejects unsafe bucket, prefix, key and timeout",
  () => {
    const fake = new FakeS3();
    for (const options of [
      { bucket: "Bad Bucket" },
      { bucket: "127.0.0.1" },
      { prefix: "../outside/" },
      { prefix: "shenshu//audio/" },
      { masterKey: Buffer.alloc(31) },
      { requestTimeoutMs: 60_001 },
    ]) {
      assert.throws(() => makeBackend(fake, options), /kodo_backend_unavailable/);
    }
    assert.throws(() => createP2KodoPrivateAudioBackend({}), /kodo_backend_unavailable/);
  });

test("latest-one writes are encrypted, overwrite atomically and hide owner and WAV",
  async () => {
    resetClock();
    const fake = new FakeS3();
    const backend = makeBackend(fake);
    await backend.putLatest(makeRecord(PRINCIPAL));
    assert.equal(fake.objects.size, 1);
    const key = [...fake.objects.keys()][0];
    assert.match(key, new RegExp("^" + KODO_DEFAULT_PREFIX + "[A-Za-z0-9_-]{43}$"));
    assert.equal(key.includes(PRINCIPAL), false);
    const firstBody = Buffer.from(fake.objects.get(key).body);
    await backend.putLatest(makeRecord(PRINCIPAL, {
      audio: OTHER_AUDIO,
      recordId: "voice_" + "b".repeat(32),
    }));
    assert.equal(fake.objects.size, 1);
    assert.equal([...fake.objects.keys()][0], key);
    const stored = fake.objects.get(key);
    assert.equal(stored.body.includes(FIXTURE), false);
    assert.equal(stored.body.includes(OTHER_AUDIO), false);
    assert.equal(stored.body.includes(Buffer.from(PRINCIPAL)), false);
    assert.equal(JSON.stringify(stored.metadata).includes(PRINCIPAL), false);
    assert.notDeepEqual(stored.body, firstBody);
    const result = await backend.getLatest({
      principal: PRINCIPAL,
      now: new Date(currentMs).toISOString(),
    });
    assert.equal(result.audio.equals(OTHER_AUDIO), true);
    assert.equal(result.recordId, "voice_" + "b".repeat(32));
    assert.equal(result.principal, PRINCIPAL);
  });

test("concurrent writes leave one complete decryptable latest object",
  async () => {
    resetClock();
    const fake = new FakeS3();
    const backend = makeBackend(fake);
    await Promise.all([
      backend.putLatest(makeRecord(PRINCIPAL, {
        audio: FIXTURE,
        recordId: "voice_" + "c".repeat(32),
      })),
      backend.putLatest(makeRecord(PRINCIPAL, {
        audio: OTHER_AUDIO,
        recordId: "voice_" + "d".repeat(32),
      })),
    ]);
    assert.equal(fake.objects.size, 1);
    const result = await backend.getLatest({
      principal: PRINCIPAL,
      now: new Date(currentMs).toISOString(),
    });
    assert.equal(result.audio.equals(FIXTURE) || result.audio.equals(OTHER_AUDIO), true);
    assert.ok(["voice_" + "c".repeat(32), "voice_" + "d".repeat(32)]
      .includes(result.recordId));
  });

test("cross-owner and wrong-key reads return no audio and never expose plaintext",
  async () => {
    resetClock();
    const fake = new FakeS3();
    await makeBackend(fake).putLatest(makeRecord(PRINCIPAL));
    assert.equal(await makeBackend(fake).getLatest({
      principal: OTHER_PRINCIPAL,
      now: new Date(currentMs).toISOString(),
    }), null);
    assert.equal(await makeBackend(fake, {
      masterKey: OTHER_MASTER_KEY,
    }).getLatest({
      principal: PRINCIPAL,
      now: new Date(currentMs).toISOString(),
    }), null);
    assert.equal(fake.objects.size, 1);
  });

test("ciphertext, tag, authenticated metadata and object swaps fail closed",
  async () => {
    resetClock();
    const fake = new FakeS3();
    const backend = makeBackend(fake);
    await backend.putLatest(makeRecord(PRINCIPAL));
    const key = [...fake.objects.keys()][0];
    const original = fake.objects.get(key);
    const originalBody = Buffer.from(original.body);
    const originalMetadata = { ...original.metadata };

    async function assertIntegrityFailure(mutator) {
      fake.objects.set(key, {
        body: Buffer.from(originalBody),
        metadata: { ...originalMetadata },
        contentType: "application/octet-stream",
      });
      mutator(fake.objects.get(key));
      await assert.rejects(backend.getLatest({
        principal: PRINCIPAL,
        now: new Date(currentMs).toISOString(),
      }), /kodo_object_integrity_failed/);
    }

    await assertIntegrityFailure(row => {
      const envelope = JSON.parse(row.body.toString("utf8"));
      envelope.ciphertext = (envelope.ciphertext[0] === "A" ? "B" : "A") +
        envelope.ciphertext.slice(1);
      row.body = Buffer.from(JSON.stringify(envelope));
    });
    await assertIntegrityFailure(row => {
      const envelope = JSON.parse(row.body.toString("utf8"));
      envelope.tag = (envelope.tag[0] === "A" ? "B" : "A") + envelope.tag.slice(1);
      row.body = Buffer.from(JSON.stringify(envelope));
    });
    await assertIntegrityFailure(row => {
      row.metadata["expires-at"] = new Date(currentMs + 120_000).toISOString();
    });
    await assertIntegrityFailure(row => {
      row.metadata["owner-tag"] = "A".repeat(43);
    });
    await assertIntegrityFailure(row => {
      delete row.metadata["audio-bytes"];
    });
    await assertIntegrityFailure(row => {
      const envelope = JSON.parse(row.body.toString("utf8"));
      const changed = new Date(currentMs + 120_000).toISOString();
      envelope.expiresAt = changed;
      row.metadata["expires-at"] = changed;
      row.body = Buffer.from(JSON.stringify(envelope));
    });
  });

test("oversized encrypted objects are rejected before unbounded reads",
  async () => {
    resetClock();
    const fake = new FakeS3();
    const backend = makeBackend(fake);
    await backend.putLatest(makeRecord(PRINCIPAL));
    const key = [...fake.objects.keys()][0];
    const metadata = { ...fake.objects.get(key).metadata };
    fake.putRaw(key, {
      body: Buffer.alloc(4 * 1024 * 1024 + 1),
      metadata,
    });
    await assert.rejects(backend.getLatest({
      principal: PRINCIPAL,
      now: new Date(currentMs).toISOString(),
    }), /kodo_get_failed/);
  });

test("expired objects become unreadable without active deletion",
  async () => {
    resetClock();
    const fake = new FakeS3();
    const backend = makeBackend(fake);
    await backend.putLatest(makeRecord(PRINCIPAL));
    assert.equal(fake.objects.size, 1);
    assert.equal(await backend.getLatest({
      principal: PRINCIPAL,
      now: new Date(currentMs + 59_000).toISOString(),
    }) !== null, true);
    assert.equal(await backend.getLatest({
      principal: PRINCIPAL,
      now: new Date(currentMs + 60_000).toISOString(),
    }), null);
    assert.equal(fake.objects.size, 1);
    assert.equal(
      fake.calls.some(call => call.name === "DeleteObjectCommand"),
      false,
    );
  });

test("expired read never deletes a newer concurrent write",
  async () => {
    resetClock();
    const fake = new FakeS3();
    const backend = makeBackend(fake);
    await backend.putLatest(makeRecord(PRINCIPAL, {
      recordId: "voice_" + "1".repeat(32),
    }));
    currentMs += 60_000;
    let replaced = false;
    fake.afterGet = async () => {
      if (replaced) return;
      replaced = true;
      await backend.putLatest(makeRecord(PRINCIPAL, {
        audio: OTHER_AUDIO,
        recordId: "voice_" + "2".repeat(32),
      }));
    };
    assert.equal(await backend.getLatest({
      principal: PRINCIPAL,
      now: new Date(currentMs).toISOString(),
    }), null);
    assert.equal(replaced, true);
    assert.equal(fake.objects.size, 1);
    const newer = await backend.getLatest({
      principal: PRINCIPAL,
      now: new Date(currentMs).toISOString(),
    });
    assert.equal(newer.audio.equals(OTHER_AUDIO), true);
    assert.equal(newer.recordId, "voice_" + "2".repeat(32));
    for (const name of [
      "DeleteObjectCommand",
      "HeadObjectCommand",
      "ListObjectsV2Command",
    ]) {
      assert.equal(fake.calls.some(call => call.name === name), false, name);
    }
  });

test("deleteExpired is lifecycle-only and never enumerates or mutates objects",
  async () => {
    resetClock();
    const fake = new FakeS3();
    const backend = makeBackend(fake);
    await backend.putLatest(makeRecord(PRINCIPAL, {
      recordId: "voice_" + "e".repeat(32),
    }));
    currentMs += 30_000;
    await backend.putLatest(makeRecord(OTHER_PRINCIPAL, {
      recordId: "voice_" + "f".repeat(32),
    }));
    currentMs += 30_001;
    const callsBefore = fake.calls.length;
    const result = await backend.deleteExpired({
      before: new Date(currentMs).toISOString(),
    });
    assert.deepEqual(result, {
      deleted: 0,
      scanned: 0,
      truncated: false,
      physicalRemoval: "bucket_lifecycle_only",
    });
    assert.equal(fake.objects.size, 2);
    assert.equal(fake.calls.length, callsBefore);
    const store = createP2PrivateResultStore({
      backend,
      ttlSeconds: 60,
      clock: () => new Date(currentMs),
    });
    assert.deepEqual(await store.deleteExpired(), {
      deleted: 0,
      physicalRemoval: "bucket_lifecycle_only",
    });
    assert.equal(fake.objects.size, 2);
    assert.equal(fake.calls.length, callsBefore);
  });

test("missing credentials, PUT ambiguity, timeout and GET failures fail closed",
  async () => {
    resetClock();
    const fake = new FakeS3();
    const backend = makeBackend(fake);

    fake.failOn("PutObjectCommand");
    await assert.rejects(backend.putLatest(makeRecord(PRINCIPAL)), /kodo_put_failed/);
    assert.equal(fake.calls.filter(call => call.name === "PutObjectCommand").length, 1);

    fake.clearFailure();
    fake.failOn("PutObjectCommand", { delayMs: 100 });
    const timeoutBackend = makeBackend(fake, { requestTimeoutMs: 20 });
    await assert.rejects(timeoutBackend.putLatest(makeRecord(PRINCIPAL)), /kodo_put_failed/);
    assert.equal(fake.calls.filter(call => call.name === "PutObjectCommand").length, 2);

    fake.clearFailure();
    await backend.putLatest(makeRecord(PRINCIPAL));
    fake.failOn("GetObjectCommand");
    await assert.rejects(backend.getLatest({
      principal: PRINCIPAL,
      now: new Date(currentMs).toISOString(),
    }), /kodo_get_failed/);

    fake.clearFailure();
    currentMs += 60_000;
    assert.equal(await backend.getLatest({
      principal: PRINCIPAL,
      now: new Date(currentMs).toISOString(),
    }), null);
    assert.equal(fake.objects.size, 1);

    fake.clearFailure();
    const lifecycle = await backend.deleteExpired({
      before: new Date(currentMs).toISOString(),
    });
    assert.equal(lifecycle.deleted, 0);
    assert.equal(lifecycle.physicalRemoval, "bucket_lifecycle_only");
  });

test("repeated reads perform exactly one object GET each and no hidden retry",
  async () => {
    resetClock();
    const fake = new FakeS3();
    const store = makeStore(fake);
    await store.save({ principal: PRINCIPAL, audio: FIXTURE });
    const before = fake.calls.filter(call => call.name === "GetObjectCommand").length;
    assert.equal((await store.getLatest({ principal: PRINCIPAL })).audio.equals(FIXTURE), true);
    assert.equal((await store.getLatest({ principal: PRINCIPAL })).audio.equals(FIXTURE), true);
    const reads = fake.calls.filter(call => call.name === "GetObjectCommand").length;
    assert.equal(reads - before, 2);
    assert.equal(fake.objects.size, 1);
  });

test("Kodo source has no reachable DELETE, HEAD or LIST command", async () => {
  const source = await readFile(
    new URL("../src/p2-kodo-private-audio-backend.js", import.meta.url),
    "utf8",
  );
  for (const command of [
    "DeleteObjectCommand",
    "HeadObjectCommand",
    "ListObjectsV2Command",
  ]) {
    assert.equal(source.includes(command), false, command);
  }
  assert.doesNotMatch(source, /\bIfMatch\b/);
  assert.match(source, /bucket_lifecycle_only/);
});

test("the real AWS SDK signs one bounded Kodo request without network",
  async () => {
    resetClock();
    const captured = [];
    const requestHandler = {
      async handle(request) {
        captured.push(request);
        const body = request.body;
        if (body && typeof body[Symbol.asyncIterator] === "function") {
          for await (const _chunk of body) {
            // Drain the signed request body without writing it anywhere.
          }
        }
        return {
          response: {
            statusCode: 200,
            reason: "OK",
            headers: { etag: '"fixture"' },
            body: Readable.from([]),
          },
        };
      },
      updateHttpClientConfig() {},
      httpHandlerConfigs() {
        return {};
      },
    };
    const client = createP2KodoS3Client({
      accessKeyId: "fixture-access-key",
      secretAccessKey: "fixture-secret-access-key-0123456789",
      requestTimeoutMs: 2_000,
      requestHandler,
    });
    try {
      const backend = makeBackend(client);
      await backend.putLatest(makeRecord(PRINCIPAL));
    } finally {
      client.destroy();
    }
    assert.equal(captured.length, 1);
    const request = captured[0];
    assert.equal(request.method, "PUT");
    assert.equal(request.hostname, new URL(KODO_S3_ENDPOINT).hostname);
    assert.match(request.path, new RegExp("^/" + BUCKET + "/" + KODO_DEFAULT_PREFIX));
    assert.match(request.headers.authorization, /^AWS4-HMAC-SHA256 /);
    assert.match(request.headers.authorization, /\/ap-southeast-1\/s3\/aws4_request/);
    assert.equal(typeof request.headers["x-amz-date"], "string");
    assert.equal(typeof request.headers["x-amz-content-sha256"], "string");
    assert.equal("x-amz-acl" in request.headers, false);
    const queryKeys = Object.keys(request.query ?? {}).map(key => key.toLowerCase());
    assert.equal(queryKeys.includes("x-amz-signature"), false);
    assert.equal(queryKeys.includes("x-amz-credential"), false);
    assert.equal(queryKeys.includes("x-amz-expires"), false);
  });

function signedToken() {
  const nowSeconds = Math.floor(currentMs / 1000);
  const header = Buffer.from(JSON.stringify({
    alg: "RS256",
    typ: "JWT",
    kid: publicJwk.kid,
  })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({
    iss: AUTH0_ISSUER,
    aud: AUDIENCE,
    sub: SUBJECT,
    scope: "voice:speak",
    iat: nowSeconds - 10,
    exp: nowSeconds + 300,
  })).toString("base64url");
  const data = header + "." + claims;
  return data + "." + sign("RSA-SHA256", Buffer.from(data), privateKey)
    .toString("base64url");
}

function baseEnv() {
  return {
    NODE_ENV: "test",
    SHENSHU_STAGING_RESOURCE_MODE: "1",
    SHENSHU_STAGING_ORIGIN: STAGING_RESOURCE_ORIGIN,
    SHENSHU_AUTH_MCP_ENABLED: "1",
    SHENSHU_AUTH_STATIC_JWKS_TEST_ONLY: "1",
    SHENSHU_AUTH_PUBLIC_JWKS_JSON: JSON.stringify({ keys: [publicJwk] }),
    SHENSHU_PLAYER_ENABLED: "1",
    SHENSHU_PLAYER_AUTH0_CLIENT_ID: CLIENT_ID,
    SHENSHU_PLAYER_SESSION_SECRET: SESSION_SECRET,
    SHENSHU_NONBILLABLE_PLAYER_ENABLED: "1",
    [OFFLINE_CONFIRM_TEST_FLAG]: "1",
  };
}

function sessionCookie(principal) {
  const expiry = Math.floor(currentMs / 1000) + 3600;
  const payload = "v1." + String(expiry) + "." + principal;
  const mac = createHmac("sha256", SESSION_SECRET).update(payload)
    .digest("base64url");
  return PRIVATE_PLAYER_SESSION_COOKIE + "=" + payload + "." + mac;
}

async function makeFixture() {
  const sql = await Promise.all(MIGRATIONS.map(path => readFile(path, "utf8")));
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const migration of sql) db.exec(migration);
  return {
    db,
    client: {
      async query(statement, params = []) {
        return db.prepare(statement).all(...params);
      },
    },
  };
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return "http://127.0.0.1:" + server.address().port;
}

async function makeWorld({ fixture, fake, providerCalls, backendOptions = {} } = {}) {
  fixture ??= await makeFixture();
  fake ??= new FakeS3();
  providerCalls ??= [];
  const backend = makeBackend(fake, backendOptions);
  const store = createP2PrivateResultStore({
    backend,
    ttlSeconds: 60,
    clock: () => new Date(currentMs),
  });
  const runtime = await createV1P2OfflineConfirmRuntime({
    env: baseEnv(),
    client: fixture.client,
    textSealer: createPrivateTextSealer({ masterKey: TEXT_MASTER_KEY }),
    privateResultStore: store,
    synthesize: async args => {
      providerCalls.push({ ...args });
      return { audio: Buffer.from(FIXTURE) };
    },
    voiceId: VOICE_ID,
    sessionSecret: SESSION_SECRET,
    clock: () => new Date(currentMs),
    maximumDailyCalls: 1,
  });
  const base = await listen(runtime.server);
  return {
    base,
    runtime,
    store,
    async close() {
      runtime.server.closeAllConnections?.();
      await new Promise(resolve => runtime.server.close(resolve));
    },
  };
}

async function rpc(base, token, body) {
  return fetch(base + "/paid-mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(token ? { authorization: "Bearer " + token } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function initialize(base, token) {
  const response = await rpc(base, token, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "kodo-offline-test", version: "1.0" },
    },
  });
  assert.equal(response.status, 200, await response.text().catch(() => ""));
}

async function callTool(base, token, name, args, id = 2) {
  const response = await rpc(base, token, {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: args },
  });
  assert.equal(response.status, 200);
  return response.json();
}

async function rawRequest(url, { method = "GET", headers = {}, body } = {}) {
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: target.hostname,
      port: target.port,
      path: target.pathname + target.search,
      method,
      headers,
    }, response => {
      const chunks = [];
      response.on("data", chunk => chunks.push(chunk));
      response.once("error", reject);
      response.once("end", () => {
        const payload = Buffer.concat(chunks);
        const headerPairs = [];
        for (let index = 0; index < response.rawHeaders.length; index += 2) {
          headerPairs.push([
            response.rawHeaders[index],
            response.rawHeaders[index + 1],
          ]);
        }
        resolve(new Response(payload.length ? payload : null, {
          status: response.statusCode,
          headers: new Headers(headerPairs),
        }));
      });
    });
    request.once("error", reject);
    if (body !== undefined) request.write(body);
    request.end();
  });
}

function formFromPage(html) {
  return {
    csrf: html.match(/name="csrf" value="([^"]+)"/)?.[1],
    handle: html.match(/name="handle" value="([^"]+)"/)?.[1],
  };
}

test("offline MCP -> explicit confirm -> Kodo backend -> owner WAV survives restart",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const fake = new FakeS3();
    const providerCalls = [];
    const fixture = await makeFixture();
    let world = await makeWorld({ fixture, fake, providerCalls });
    try {
      const token = signedToken();
      await initialize(world.base, token);
      const prepared = await callTool(world.base, token, P2_PREPARE_TOOL, {
        text: "Kodo private audio integration",
      });
      assert.equal(
        prepared.result?.structuredContent?.status,
        "pending_confirmation",
      );
      const handle = prepared.result.structuredContent.handle;
      const page = await fetch(world.base + "/player/pending", {
        headers: { cookie: sessionCookie(PRINCIPAL) },
      });
      assert.equal(page.status, 200);
      const form = formFromPage(await page.text());
      assert.equal(form.handle, handle);

      const results = await Promise.all([form, form].map(async input =>
        rawRequest(world.base + "/player/confirm", {
          method: "POST",
          headers: {
            cookie: sessionCookie(PRINCIPAL),
            origin: STAGING_RESOURCE_ORIGIN,
            "sec-fetch-site": "same-origin",
            "sec-fetch-mode": "navigate",
            "content-type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams(input).toString(),
        })));
      const statuses = results.map(response => response.status).sort();
      assert.equal(statuses.includes(303), true);
      assert.equal(statuses.every(status => status === 303 || status === 409), true);
      assert.equal(providerCalls.length, 1);
      assert.equal(providerCalls[0].modelId, V1_FIXED_MODEL_ID);
      assert.equal(providerCalls[0].voiceId, VOICE_ID);
      assert.equal(
        fake.calls.filter(call => call.name === "PutObjectCommand").length,
        1,
      );
      assert.equal(fake.objects.size, 1);
      const object = [...fake.objects.values()][0];
      assert.equal(object.body.includes(FIXTURE), false);
      assert.equal(object.body.includes(Buffer.from(PRINCIPAL)), false);
      assert.equal(JSON.stringify(object.metadata).includes(PRINCIPAL), false);

      const ownerAudio = await fetch(world.base + "/player/audio", {
        headers: { cookie: sessionCookie(PRINCIPAL) },
      });
      assert.equal(ownerAudio.status, 200);
      assert.equal(ownerAudio.headers.get("content-type"), "audio/wav");
      assert.equal(
        ownerAudio.headers.get("cache-control"),
        "private, no-store, max-age=0",
      );
      assert.equal(Buffer.from(await ownerAudio.arrayBuffer()).equals(FIXTURE), true);

      assert.equal((await fetch(world.base + "/player/audio")).status, 401);
      const otherAudio = await fetch(world.base + "/player/audio", {
        headers: { cookie: sessionCookie(OTHER_PRINCIPAL) },
      });
      assert.equal(otherAudio.status, 503);
      assert.deepEqual(await otherAudio.json(), { error: "audio_unavailable" });
      assert.equal(providerCalls.length, 1);

      const replay = await rawRequest(world.base + "/player/confirm", {
        method: "POST",
        headers: {
          cookie: sessionCookie(PRINCIPAL),
          origin: STAGING_RESOURCE_ORIGIN,
          "sec-fetch-site": "same-origin",
          "sec-fetch-mode": "navigate",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(form).toString(),
      });
      assert.equal(replay.status, 303);
      assert.equal(providerCalls.length, 1);
      assert.equal(fake.objects.size, 1);

      await world.close();
      world = null;
      const restarted = await makeWorld({ fixture, fake, providerCalls });
      try {
        const restartedAudio = await fetch(restarted.base + "/player/audio", {
          headers: { cookie: sessionCookie(PRINCIPAL) },
        });
        assert.equal(restartedAudio.status, 200);
        assert.equal(
          Buffer.from(await restartedAudio.arrayBuffer()).equals(FIXTURE),
          true,
        );
        assert.equal(providerCalls.length, 1);

        currentMs += 60_001;
        const expired = await fetch(restarted.base + "/player/audio", {
          headers: { cookie: sessionCookie(PRINCIPAL) },
        });
        assert.equal(expired.status, 503);
        assert.deepEqual(await expired.json(), { error: "audio_unavailable" });
        assert.equal(fake.objects.size, 1);
        for (const name of [
          "DeleteObjectCommand",
          "HeadObjectCommand",
          "ListObjectsV2Command",
        ]) {
          assert.equal(fake.calls.some(call => call.name === name), false, name);
        }
        assert.equal(providerCalls.length, 1);
      } finally {
        await restarted.close();
      }
    } finally {
      if (world) await world.close();
      fixture.db.close();
    }
  });

test("deployable server imports neither Kodo backend nor paid confirm handler",
  async () => {
    const source = await readFile(new URL("../server.js", import.meta.url), "utf8");
    assert.doesNotMatch(source, /p2-kodo-private-audio-backend/);
    assert.doesNotMatch(source, /v1-p2-offline-confirm-runtime/);
  });

test("ambiguous Kodo PUT ends terminal unknown with one provider and no retry",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const fake = new FakeS3();
    fake.failOn("PutObjectCommand");
    const providerCalls = [];
    const fixture = await makeFixture();
    const world = await makeWorld({ fixture, fake, providerCalls });
    try {
      const token = signedToken();
      await initialize(world.base, token);
      const prepared = await callTool(world.base, token, P2_PREPARE_TOOL, {
        text: "Kodo ambiguous put",
      });
      const handle = prepared.result.structuredContent.handle;
      const page = await fetch(world.base + "/player/pending", {
        headers: { cookie: sessionCookie(PRINCIPAL) },
      });
      const form = formFromPage(await page.text());
      const headers = {
        cookie: sessionCookie(PRINCIPAL),
        origin: STAGING_RESOURCE_ORIGIN,
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "navigate",
        "content-type": "application/x-www-form-urlencoded",
      };
      const first = await rawRequest(world.base + "/player/confirm", {
        method: "POST",
        headers,
        body: new URLSearchParams(form).toString(),
      });
      assert.equal(first.status, 409);
      assert.deepEqual(await first.json(), {
        error: "provider_outcome_unknown",
      });
      assert.equal(providerCalls.length, 1);
      assert.equal(
        fake.calls.filter(call => call.name === "PutObjectCommand").length,
        1,
      );
      assert.equal(fake.objects.size, 0);
      assert.equal(
        fixture.db.prepare(
          "SELECT state FROM paid_voice_confirmation_operations WHERE handle = ?",
        ).get(handle).state,
        "unknown",
      );
      const replay = await rawRequest(world.base + "/player/confirm", {
        method: "POST",
        headers,
        body: new URLSearchParams(form).toString(),
      });
      assert.equal(replay.status, 409);
      assert.equal(providerCalls.length, 1);
      assert.equal(
        fake.calls.filter(call => call.name === "PutObjectCommand").length,
        1,
      );
      assert.equal((await fetch(world.base + "/player/audio", {
        headers: { cookie: sessionCookie(PRINCIPAL) },
      })).status, 503);
    } finally {
      await world.close();
      fixture.db.close();
    }
  });

test("Kodo receipt and activation gate record evidence, limits and boundaries",
  async () => {
    const receipt = await readFile(new URL(
      "../docs/v1-closure/V1-P2-KODO-PRIVATE-AUDIO-BACKEND-20261028.md",
      import.meta.url,
    ), "utf8");
    for (const marker of [
      "COMPLETE",
      "285c57bbf9d024dc280adf922fd50ffaf5cf28d5",
      "Node 24.19.0",
      "18 tests",
      "389 tests",
      "2/9",
      "Deployment: NO",
      "SigV4",
      "AES-256-GCM",
      "s3.ap-southeast-1.qiniucs.com",
      "deleteExpired",
    ]) {
      assert.equal(receipt.includes(marker), true, marker);
    }
    const gate = await readFile(new URL(
      "../docs/v1-closure/V1-P2-KODO-REAL-ACTIVATION-GATE-20261028.md",
      import.meta.url,
    ), "utf8");
    // The one real synthetic qualification has now been consumed and STOPPED
    // after a stale ETag DELETE was unexpectedly accepted. The old
    // NOT EXECUTED activation checklist must never mask this result.
    for (const marker of [
      "2026-10-29 真实 A2 终态：STOP",
      "stale_etag_delete_was_accepted_stop_now",
      "不能再按照下文未执行的规划步骤重试",
      "ETag_A",
      "私有",
      "2/9",
      "AK/SK",
      "1 天",
      "不能把此 STOP 说成 PASS",
    ]) {
      assert.equal(gate.includes(marker), true, marker);
    }
    assert.equal(gate.includes("NOT EXECUTED"), false);
    assert.match(gate, /不能保证精确 24 小时删完/);
  });

test("no-CAS repair receipt preserves the lifecycle-only launch boundary",
  async () => {
    const receipt = await readFile(new URL(
      "../docs/v1-closure/V1-P2-KODO-NO-CAS-DELETE-SAFETY-REPAIR-20261029.md",
      import.meta.url,
    ), "utf8");
    for (const marker of [
      "REAL_KODO_CONDITIONAL_DELETE_BLOCKED",
      "app no longer relies on it",
      "bucket_lifecycle_only",
      "DeleteObjectCommand",
      "HeadObjectCommand",
      "ListObjectsV2Command",
      "IfMatch",
      "ShenShuVoiceKodoPrivateAudio",
      "2/9",
      "paid remains OFF",
      "MiniMax 04",
      "Offline PASS is not paid-live qualification",
    ]) {
      assert.equal(receipt.includes(marker), true, marker);
    }
  });
