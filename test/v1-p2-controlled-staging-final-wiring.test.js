/**
 * Voice V1 controlled-staging final wiring candidate qualification.
 *
 * Real local HTTP composes the protected MCP proposal, owner-only explicit
 * confirmation, sealed D1 004+005 atomic claim, fixed MiniMax adapter behind an
 * injected fake transport, and the Kodo lifecycle private-audio backend behind
 * an in-memory S3 protocol double. No real MiniMax, D1, Kodo, Render, IAM,
 * Call or human browser gesture is used. server.js never imports the candidate.
 */
process.env.NODE_ENV = "test";

import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { Readable } from "node:stream";
import { deriveCanonicalPrincipal } from "../src/canonical-principal.js";
import { makeInlineToneFixture } from "../src/inline-fixture.js";
import { MINIMAX_ENDPOINT } from "../src/minimax-adapter.js";
import {
  AUTH0_ISSUER,
  STAGING_RESOURCE_ORIGIN,
} from "../src/protected-resource-identity.js";
import { PRIVATE_PLAYER_SESSION_COOKIE } from "../src/private-web-player.js";
import { P2_PREPARE_TOOL, P2_STATUS_TOOL } from "../src/v1-p2-nonbillable-mcp.js";
import { P2_OPERATION_DEFAULT_TTL_MS } from "../src/v1-p2-operation-contract.js";
import { V1_FIXED_MODEL_ID } from "../src/v1-offline-paid-pipeline.js";
import {
  CONTROLLED_STAGING_APPROVED_SHA_ENV,
  CONTROLLED_STAGING_FINAL_WIRING_FLAG,
  CONTROLLED_STAGING_PAID_CONFIRM_FLAG,
  CONTROLLED_STAGING_PRIVATE_AUDIO_FLAG,
  CONTROLLED_STAGING_REAL_PROVIDER_FLAG,
  KODO_ACCESS_KEY_ENV,
  KODO_BUCKET_ENV,
  KODO_MASTER_KEY_ENV,
  KODO_SECRET_KEY_ENV,
  MINIMAX_API_KEY_ENV,
  MINIMAX_VOICE_ID_ENV,
  PRIVATE_AUDIO_TTL_ENV,
  assessV1P2ControlledStagingConfig,
  createV1P2ControlledStagingCandidate,
} from "../src/v1-p2-controlled-staging-candidate.js";
import { PRIVATE_TEXT_MASTER_KEY_ENV } from "../src/v1-p2-staging-sealed-closure.js";

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

const NOW_MS = Date.parse("2026-10-30T00:00:00.000Z");
const APPROVED_SHA = "a".repeat(40);
const OTHER_SHA = "b".repeat(40);
const SESSION_SECRET = "final-wiring-session-secret-0123456789abcdef012345";
const CLIENT_ID = "w".repeat(32);
const VOICE_ID = "voice_final_wiring_fixture_001";
const API_KEY = "test-only-minimax-key-0123456789abcdef";
const BUCKET = "shenshu-private-fixture";
const SUBJECT = "auth0|final-wiring-owner";
const OTHER_SUBJECT = "auth0|final-wiring-other";
const TEXT_MASTER_KEY = Buffer.from(
  Array.from({ length: 32 }, (_, index) => index + 17),
);
const KODO_MASTER_KEY = Buffer.from(
  Array.from({ length: 32 }, (_, index) => index + 77),
);
const FIXTURE = Buffer.from(makeInlineToneFixture().audioBase64, "base64");
const PRINCIPAL = deriveCanonicalPrincipal({
  issuer: AUTH0_ISSUER,
  subject: SUBJECT,
});
const OTHER_PRINCIPAL = deriveCanonicalPrincipal({
  issuer: AUTH0_ISSUER,
  subject: OTHER_SUBJECT,
});
const AUDIENCE = STAGING_RESOURCE_ORIGIN + "/paid-mcp";
const MIGRATIONS = [
  new URL("../db/d1/001_paid_voice_reservations.sql", import.meta.url),
  new URL("../db/d1/002_paid_voice_grants.sql", import.meta.url),
  new URL("../db/d1/004_paid_voice_confirmation_operations.sql", import.meta.url),
  new URL(
    "../db/d1/005_paid_voice_confirmation_private_text_sealing.sql",
    import.meta.url,
  ),
];

let currentMs = NOW_MS;
const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const publicJwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "final-wiring-key",
  alg: "RS256",
  use: "sig",
};

function resetClock() {
  currentMs = NOW_MS;
}

function alignClockToRealTime() {
  currentMs = Date.now();
}

function signedToken({
  subject = SUBJECT,
  issuer = AUTH0_ISSUER,
  audience = AUDIENCE,
  scope = "voice:speak",
  lifetime = 300,
} = {}) {
  const nowSeconds = Math.floor(currentMs / 1000);
  const header = Buffer.from(JSON.stringify({
    alg: "RS256",
    typ: "JWT",
    kid: publicJwk.kid,
  })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({
    iss: issuer,
    aud: audience,
    sub: subject,
    scope,
    iat: nowSeconds - 10,
    exp: nowSeconds + lifetime,
  })).toString("base64url");
  const data = header + "." + claims;
  return data + "." + sign("RSA-SHA256", Buffer.from(data), privateKey)
    .toString("base64url");
}

function baseEnv(overrides = {}) {
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
    SHENSHU_STAGING_SEALED_PLAYER_ENABLED: "1",
    [CONTROLLED_STAGING_FINAL_WIRING_FLAG]: "1",
    [CONTROLLED_STAGING_PAID_CONFIRM_FLAG]: "1",
    [CONTROLLED_STAGING_REAL_PROVIDER_FLAG]: "1",
    [CONTROLLED_STAGING_PRIVATE_AUDIO_FLAG]: "1",
    [CONTROLLED_STAGING_APPROVED_SHA_ENV]: APPROVED_SHA,
    [KODO_BUCKET_ENV]: BUCKET,
    [KODO_ACCESS_KEY_ENV]: "test-only-kodo-access-key",
    [KODO_SECRET_KEY_ENV]: "test-only-kodo-secret-access-key-0123456789",
    [KODO_MASTER_KEY_ENV]: KODO_MASTER_KEY.toString("base64"),
    [MINIMAX_API_KEY_ENV]: API_KEY,
    [MINIMAX_VOICE_ID_ENV]: VOICE_ID,
    [PRIVATE_AUDIO_TTL_ENV]: "60",
    [PRIVATE_TEXT_MASTER_KEY_ENV]: TEXT_MASTER_KEY.toString("base64"),
    ...overrides,
  };
}

function without(env, key) {
  const copy = { ...env };
  delete copy[key];
  return copy;
}

function sessionCookie(principal, {
  secret = SESSION_SECRET,
  ttlSeconds = 3600,
} = {}) {
  const expiry = Math.floor(currentMs / 1000) + ttlSeconds;
  const payload = "v1." + String(expiry) + "." + principal;
  const mac = createHmac("sha256", secret).update(payload)
    .digest("base64url");
  return PRIVATE_PLAYER_SESSION_COOKIE + "=" + payload + "." + mac;
}

function realSessionCookie(principal) {
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const payload = "v1." + String(expiry) + "." + principal;
  const mac = createHmac("sha256", SESSION_SECRET).update(payload)
    .digest("base64url");
  return PRIVATE_PLAYER_SESSION_COOKIE + "=" + payload + "." + mac;
}

async function makeFixture({ include005 = true } = {}) {
  const paths = include005 ? MIGRATIONS : MIGRATIONS.slice(0, 3);
  const sql = await Promise.all(paths.map(path => readFile(path, "utf8")));
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

class FakeS3 {
  constructor() {
    this.objects = new Map();
    this.calls = [];
    this.failure = null;
  }

  failOn(name, error = new Error("fixture_s3_failure")) {
    this.failure = { name, error };
  }

  clearFailure() {
    this.failure = null;
  }

  async send(command, options = {}) {
    const name = command.constructor.name;
    const input = command.input ?? {};
    this.calls.push({ name, input, signal: Boolean(options.abortSignal) });
    if (this.failure?.name === name) throw this.failure.error;
    if (name === "PutObjectCommand") {
      if (input.Bucket !== BUCKET || typeof input.Key !== "string") {
        throw new Error("unexpected_put");
      }
      this.objects.set(input.Key, {
        body: Buffer.from(input.Body),
        metadata: { ...input.Metadata },
        contentType: input.ContentType,
      });
      return { ETag: "\"fixture-etag\"" };
    }
    if (name === "GetObjectCommand") {
      if (input.Bucket !== BUCKET) throw new Error("unexpected_get");
      const row = this.objects.get(input.Key);
      if (!row) {
        throw Object.assign(new Error("not found"), {
          name: "NoSuchKey",
          $metadata: { httpStatusCode: 404 },
        });
      }
      return {
        Body: Readable.from([Buffer.from(row.body)]),
        ContentLength: row.body.length,
        ContentType: row.contentType,
        Metadata: { ...row.metadata },
        ETag: "\"fixture-etag\"",
      };
    }
    throw new Error("unexpected_command_" + name);
  }
}

function makeProvider({ calls, mode = "ok" } = {}) {
  return async function fakeMiniMaxTransport(url, options = {}) {
    const body = JSON.parse(options.body);
    calls.push({ url, headers: options.headers, body });
    if (url !== MINIMAX_ENDPOINT) throw new Error("unexpected_provider_url");
    if (mode === "throw") throw new Error("fixture_network_failure");
    if (mode === "http_500") {
      return new Response("upstream failure", { status: 500 });
    }
    if (mode === "bad_json") {
      return new Response("not-json", { status: 200 });
    }
    if (mode === "bad_wav") {
      return new Response(JSON.stringify({
        base_resp: { status_code: 0 },
        data: { audio: "00" },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({
      base_resp: { status_code: 0 },
      data: { audio: FIXTURE.toString("hex") },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return "http://127.0.0.1:" + server.address().port;
}

async function makeWorld({
  fixture,
  fake,
  providerCalls,
  providerMode = "ok",
  env = baseEnv(),
  expectedSha = APPROVED_SHA,
  currentSha = APPROVED_SHA,
  d1Client,
  s3Client,
  fetchImpl,
  clock,
  operationTtlMs,
} = {}) {
  fixture ??= await makeFixture();
  fake ??= new FakeS3();
  providerCalls ??= [];
  const provider = fetchImpl ?? makeProvider({
    calls: providerCalls,
    mode: providerMode,
  });
  const candidate = await createV1P2ControlledStagingCandidate({
    env,
    expectedSha,
    currentSha,
    d1Client: d1Client ?? fixture.client,
    s3Client: s3Client ?? fake,
    fetchImpl: provider,
    clock: clock ?? (() => new Date(currentMs)),
    ...(operationTtlMs === undefined ? {} : { operationTtlMs }),
  });
  assert.ok(candidate, "candidate_must_be_ready");
  assert.equal(candidate.code, "final_wiring_ready");
  assert.equal(candidate.paidConfirmMounted, true);
  assert.equal(candidate.staticTestJwks, true);
  const base = await listen(candidate.server);
  return {
    base,
    env,
    fixture,
    fake,
    providerCalls,
    provider,
    candidate,
    async close() {
      candidate.server.closeAllConnections?.();
      await new Promise(resolve => candidate.server.close(resolve));
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
      clientInfo: { name: "final-wiring-test", version: "1.0" },
    },
  });
  assert.equal(response.status, 200, await response.text().catch(() => ""));
}

async function listTools(base, token) {
  const response = await rpc(base, token, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  });
  assert.equal(response.status, 200);
  return (await response.json()).result?.tools ?? [];
}

async function callTool(base, token, name, args, id = 3) {
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

async function pending(base, cookie) {
  return fetch(base + "/player/pending", {
    headers: cookie ? { cookie } : {},
  });
}

async function confirm(base, {
  cookie,
  csrf,
  handle,
  origin = STAGING_RESOURCE_ORIGIN,
  site = "same-origin",
  mode = "navigate",
  contentType = "application/x-www-form-urlencoded",
  body,
} = {}) {
  const headers = {
    "content-type": contentType,
    origin,
    "sec-fetch-site": site,
    "sec-fetch-mode": mode,
    ...(cookie ? { cookie } : {}),
  };
  return rawRequest(base + "/player/confirm", {
    method: "POST",
    headers,
    body: body ?? new URLSearchParams({ csrf, handle }).toString(),
  });
}

async function audio(base, { cookie, method = "GET" } = {}) {
  return fetch(base + "/player/audio", {
    method,
    headers: cookie ? { cookie } : {},
  });
}

function formFromPage(html) {
  return {
    csrf: html.match(/name="csrf" value="([^"]+)"/)?.[1],
    handle: html.match(/name="handle" value="([^"]+)"/)?.[1],
  };
}

function rowCounts(db) {
  return {
    operations: db.prepare(
      "SELECT COUNT(*) AS c FROM paid_voice_confirmation_operations",
    ).get().c,
    reservations: db.prepare(
      "SELECT COUNT(*) AS c FROM paid_voice_reservations",
    ).get().c,
    grants: db.prepare(
      "SELECT COUNT(*) AS c FROM paid_voice_grants",
    ).get().c,
  };
}

function storedRow(db, handle) {
  return db.prepare(
    "SELECT principal, handle, operation_id, action, text, text_digest, " +
    "text_bytes, origin, state, sealed_text, expires_at, day_utc, " +
    "request_id, grant_id FROM paid_voice_confirmation_operations " +
    "WHERE handle = ?",
  ).get(handle);
}

async function prepareProposal(world, token, text) {
  const prepared = await callTool(world.base, token, P2_PREPARE_TOOL, { text });
  assert.equal(
    prepared.result?.structuredContent?.status,
    "pending_confirmation",
  );
  assert.equal(prepared.result.structuredContent.billable, false);
  assert.equal(JSON.stringify(prepared).includes(text), false);
  const handle = prepared.result.structuredContent.handle;
  const page = await pending(world.base, sessionCookie(PRINCIPAL));
  assert.equal(page.status, 200);
  const html = await page.text();
  const form = formFromPage(html);
  assert.equal(form.handle, handle);
  assert.match(form.csrf, /^v1\.\d+\.[A-Za-z0-9_-]{43}$/);
  return { prepared, handle, form, html };
}

function assertNoForbiddenS3(fake) {
  for (const call of fake.calls) {
    assert.equal(
      /Delete|Head|List|Copy|Multipart|Presign/i.test(call.name),
      false,
      call.name,
    );
    for (const key of Object.keys(call.input)) {
      assert.equal(/^IfMatch$/i.test(key), false, key);
      assert.equal(/^ACL$/i.test(key), false, key);
    }
  }
}

test("candidate completes one synthetic paid-to-private journey",
  { skip: sqliteSkip }, async () => {
    resetClock();
    alignClockToRealTime();
    let world = await makeWorld();
    try {
      const noToken = await rpc(world.base, null, {
        jsonrpc: "2.0", id: 1, method: "tools/list", params: {},
      });
      assert.equal(noToken.status, 401);

      const token = signedToken();
      await initialize(world.base, token);
      const tools = await listTools(world.base, token);
      assert.deepEqual(
        tools.map(tool => tool.name).sort(),
        ["verify_shenshu_login", P2_PREPARE_TOOL, P2_STATUS_TOOL].sort(),
      );
      assert.equal(tools.some(tool =>
        /confirm|charge|synth|grant|quota|provider|paid/i.test(tool.name),
      ), false);

      const text = "final wiring synthetic proposal";
      const { prepared, handle, form, html } = await prepareProposal(
        world, token, text,
      );
      assert.ok(html.includes(text));
      assert.match(html, /action="\/player\/confirm"/);
      assert.doesNotMatch(html, /<script|http-equiv="refresh"|autosubmit/i);
      assert.equal(
        prepared.result.structuredContent.expiresAt,
        new Date(currentMs + P2_OPERATION_DEFAULT_TTL_MS).toISOString(),
      );

      const status = await callTool(
        world.base, token, P2_STATUS_TOOL, { handle },
      );
      assert.equal(
        status.result?.structuredContent?.status,
        "pending_confirmation",
      );
      assert.equal(JSON.stringify(status).includes("audioBase64"), false);

      const confirmed = await confirm(world.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
      });
      assert.equal(confirmed.status, 303, await confirmed.text());
      assert.equal(
        confirmed.headers.get("location"),
        "/player/pending?result=completed",
      );

      assert.equal(world.providerCalls.length, 1);
      const provider = world.providerCalls[0];
      assert.equal(provider.url, MINIMAX_ENDPOINT);
      assert.equal(provider.headers.Authorization, "Bearer " + API_KEY);
      assert.equal(provider.body.model, V1_FIXED_MODEL_ID);
      assert.equal(provider.body.text, text);
      assert.equal(provider.body.stream, false);
      assert.equal(provider.body.voice_setting.voice_id, VOICE_ID);
      assert.equal(provider.body.output_format, "hex");

      const putCalls = world.fake.calls.filter(
        call => call.name === "PutObjectCommand",
      );
      assert.equal(putCalls.length, 1);
      assert.equal(world.fake.objects.size, 1);
      assertNoForbiddenS3(world.fake);
      const object = [...world.fake.objects.values()][0];
      assert.equal(object.body.includes(FIXTURE), false);
      assert.equal(object.body.includes(Buffer.from(PRINCIPAL)), false);
      assert.equal(JSON.stringify(object.metadata).includes(PRINCIPAL), false);
      assert.equal(object.contentType, "application/octet-stream");
      assert.equal(putCalls[0].input.Body.includes(Buffer.from(text)), false);

      const row = storedRow(world.fixture.db, handle);
      assert.equal(row.state, "completed");
      assert.equal(row.principal, PRINCIPAL);
      assert.equal(row.request_id, row.operation_id);
      assert.equal(row.grant_id, "grant_" + row.operation_id);
      assert.equal(row.text, "sealed:v1");
      assert.equal(String(row.sealed_text).includes(text), false);
      assert.deepEqual(rowCounts(world.fixture.db), {
        operations: 1,
        reservations: 1,
        grants: 1,
      });
      assert.deepEqual({ ...world.fixture.db.prepare(
        "SELECT request_id, state FROM paid_voice_grants",
      ).get() }, { request_id: row.operation_id, state: "consumed" });
      assert.deepEqual({ ...world.fixture.db.prepare(
        "SELECT principal, day_utc, slot FROM paid_voice_reservations",
      ).get() }, {
        principal: PRINCIPAL,
        day_utc: new Date(currentMs).toISOString().slice(0, 10),
        slot: 1,
      });

      const completed = await callTool(
        world.base, token, P2_STATUS_TOOL, { handle },
      );
      assert.equal(completed.result?.structuredContent?.status, "completed");
      assert.equal(completed.result.structuredContent.ready, true);
      assert.equal(JSON.stringify(completed).includes("audioBase64"), false);
      assert.equal(
        JSON.stringify(completed).includes(FIXTURE.toString("base64")),
        false,
      );
      assert.doesNotMatch(
        await (await pending(world.base, sessionCookie(PRINCIPAL))).text(),
        new RegExp(text),
      );

      assert.equal((await audio(world.base)).status, 401);
      const other = await audio(world.base, {
        cookie: sessionCookie(OTHER_PRINCIPAL),
      });
      assert.equal(other.status, 503);
      assert.deepEqual(await other.json(), { error: "audio_unavailable" });
      const owner = await audio(world.base, {
        cookie: sessionCookie(PRINCIPAL),
      });
      assert.equal(owner.status, 200);
      assert.equal(owner.headers.get("content-type"), "audio/wav");
      assert.equal(
        owner.headers.get("cache-control"),
        "private, no-store, max-age=0",
      );
      assert.equal(
        Buffer.from(await owner.arrayBuffer()).equals(FIXTURE),
        true,
      );
      const head = await audio(world.base, {
        cookie: sessionCookie(PRINCIPAL),
        method: "HEAD",
      });
      assert.equal(head.status, 200);
      assert.equal(Number(head.headers.get("content-length")), FIXTURE.length);
      assert.equal((await head.arrayBuffer()).byteLength, 0);

      const replay = await confirm(world.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
      });
      assert.equal(replay.status, 303);
      assert.equal(world.providerCalls.length, 1);
      assert.equal(
        world.fake.calls.filter(call => call.name === "PutObjectCommand").length,
        1,
      );

      const fixture = world.fixture;
      const fake = world.fake;
      const providerCalls = world.providerCalls;
      await world.close();
      world = null;
      const restarted = await makeWorld({ fixture, fake, providerCalls });
      try {
        const restartedStatus = await callTool(
          restarted.base, token, P2_STATUS_TOOL, { handle },
        );
        assert.equal(
          restartedStatus.result?.structuredContent?.status,
          "completed",
        );
        const restartedAudio = await audio(restarted.base, {
          cookie: sessionCookie(PRINCIPAL),
        });
        assert.equal(restartedAudio.status, 200);
        assert.equal(
          Buffer.from(await restartedAudio.arrayBuffer()).equals(FIXTURE),
          true,
        );
        assert.equal(providerCalls.length, 1);

        currentMs += 61_000;
        const expired = await audio(restarted.base, {
          cookie: sessionCookie(PRINCIPAL),
        });
        assert.equal(expired.status, 503);
        assert.deepEqual(await expired.json(), { error: "audio_unavailable" });
        assert.equal(fake.objects.size, 1);
        assertNoForbiddenS3(fake);
        assert.equal(providerCalls.length, 1);
      } finally {
        await restarted.close();
        fixture.db.close();
      }
    } finally {
      if (world) {
        await world.close();
        world.fixture.db.close();
      }
    }
  });

test("session, Origin, fetch metadata, CSRF and ownership fail before admission",
  { skip: sqliteSkip }, async () => {
    resetClock();
    alignClockToRealTime();
    const world = await makeWorld();
    try {
      const token = signedToken();
      await initialize(world.base, token);
      const { handle, form } = await prepareProposal(
        world, token, "negative confirmation matrix",
      );

      assert.equal((await confirm(world.base, {
        cookie: sessionCookie(PRINCIPAL, { secret: "z".repeat(48) }),
        ...form,
      })).status, 401);
      assert.equal((await confirm(world.base, {
        cookie: sessionCookie(PRINCIPAL, { ttlSeconds: -10 }),
        ...form,
      })).status, 401);
      assert.equal((await confirm(world.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
        origin: "https://evil.example",
      })).status, 403);
      assert.equal((await confirm(world.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
        site: "cross-site",
      })).status, 403);
      assert.equal((await confirm(world.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
        mode: "cors",
      })).status, 403);
      assert.equal((await confirm(world.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
        contentType: "application/json",
      })).status, 415);
      assert.equal((await confirm(world.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
        csrf: "v1.1." + "x".repeat(43),
      })).status, 403);
      assert.equal((await confirm(world.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
        handle: "h".repeat(43),
      })).status, 404);
      assert.equal((await confirm(world.base, {
        cookie: sessionCookie(OTHER_PRINCIPAL),
        ...form,
      })).status, 404);
      assert.equal((await confirm(world.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
        body: new URLSearchParams({ ...form, text: "extra" }).toString(),
      })).status, 400);
      assert.equal((await confirm(world.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
        body: "csrf=" + encodeURIComponent(form.csrf) +
          "&handle=" + encodeURIComponent(form.handle) +
          "&handle=" + encodeURIComponent(form.handle),
      })).status, 400);
      assert.equal((await fetch(world.base + "/player/confirm", {
        headers: { cookie: sessionCookie(PRINCIPAL) },
      })).status, 405);

      assert.equal(world.providerCalls.length, 0);
      assert.equal(world.fake.calls.length, 0);
      assert.deepEqual(rowCounts(world.fixture.db), {
        operations: 1,
        reservations: 0,
        grants: 0,
      });
      assert.equal(storedRow(world.fixture.db, handle).state,
        "pending_confirmation");
    } finally {
      await world.close();
      world.fixture.db.close();
    }
  });

test("concurrent double confirm yields exactly one provider and one private PUT",
  { skip: sqliteSkip }, async () => {
    resetClock();
    alignClockToRealTime();
    const world = await makeWorld();
    try {
      const token = signedToken();
      await initialize(world.base, token);
      const { handle, form } = await prepareProposal(
        world, token, "double click bills once",
      );
      const cookie = sessionCookie(PRINCIPAL);
      const responses = await Promise.all([
        confirm(world.base, { cookie, ...form }),
        confirm(world.base, { cookie, ...form }),
      ]);
      const statuses = responses.map(response => response.status).sort();
      assert.equal(statuses.includes(303), true);
      assert.equal(
        statuses.every(status => status === 303 || status === 409),
        true,
      );
      assert.equal(world.providerCalls.length, 1);
      assert.equal(
        world.fake.calls.filter(call => call.name === "PutObjectCommand").length,
        1,
      );
      assert.deepEqual(rowCounts(world.fixture.db), {
        operations: 1,
        reservations: 1,
        grants: 1,
      });
      assert.equal(storedRow(world.fixture.db, handle).state, "completed");
    } finally {
      await world.close();
      world.fixture.db.close();
    }
  });

test("daily quota denial happens before any second provider attempt",
  { skip: sqliteSkip }, async () => {
    resetClock();
    alignClockToRealTime();
    const world = await makeWorld();
    try {
      const token = signedToken();
      await initialize(world.base, token);
      const first = await prepareProposal(
        world, token, "day one admitted",
      );
      assert.equal((await confirm(world.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...first.form,
      })).status, 303);

      const second = await prepareProposal(
        world, token, "day one quota blocked",
      );
      const denied = await confirm(world.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...second.form,
      });
      assert.equal(denied.status, 409);
      assert.deepEqual(await denied.json(), {
        error: "confirmation_in_progress",
      });
      assert.equal(world.providerCalls.length, 1);
      assert.deepEqual(rowCounts(world.fixture.db), {
        operations: 2,
        reservations: 1,
        grants: 1,
      });
      assert.equal(storedRow(world.fixture.db, second.handle).state,
        "pending_confirmation");
    } finally {
      await world.close();
      world.fixture.db.close();
    }
  });

test("provider failures, bad WAV and ambiguous transport end unknown with no retry",
  { skip: sqliteSkip }, async () => {
    for (const mode of ["http_500", "bad_json", "bad_wav", "throw"]) {
      resetClock();
      alignClockToRealTime();
      const world = await makeWorld({ providerMode: mode });
      try {
        const token = signedToken();
        await initialize(world.base, token);
        const { handle, form } = await prepareProposal(
          world, token, "provider failure " + mode,
        );
        const first = await confirm(world.base, {
          cookie: sessionCookie(PRINCIPAL),
          ...form,
        });
        assert.equal(first.status, 409, mode);
        assert.deepEqual(await first.json(), {
          error: "provider_outcome_unknown",
        }, mode);
        assert.equal(world.providerCalls.length, 1, mode);
        assert.equal(
          world.fake.calls.filter(call => call.name === "PutObjectCommand").length,
          0,
          mode,
        );
        assert.equal(world.fake.objects.size, 0, mode);
        assert.equal(storedRow(world.fixture.db, handle).state, "unknown", mode);
        const counts = rowCounts(world.fixture.db);
        assert.equal(counts.reservations, 1, mode);
        assert.equal(counts.grants, 1, mode);
        assert.equal(
          world.fixture.db.prepare(
            "SELECT state FROM paid_voice_grants",
          ).get().state,
          "consumed",
          mode,
        );

        const replay = await confirm(world.base, {
          cookie: sessionCookie(PRINCIPAL),
          ...form,
        });
        assert.equal(replay.status, 409, mode);
        assert.equal(world.providerCalls.length, 1, mode);
        assert.equal((await audio(world.base, {
          cookie: sessionCookie(PRINCIPAL),
        })).status, 503, mode);
      } finally {
        await world.close();
        world.fixture.db.close();
      }
    }
  });

test("Kodo PUT and GET failures fail closed without DELETE, HEAD or LIST",
  { skip: sqliteSkip }, async () => {
    resetClock();
    alignClockToRealTime();
    const putWorld = await makeWorld();
    try {
      putWorld.fake.failOn("PutObjectCommand");
      const token = signedToken();
      await initialize(putWorld.base, token);
      const { handle, form } = await prepareProposal(
        putWorld, token, "ambiguous private PUT",
      );
      const put = await confirm(putWorld.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
      });
      assert.equal(put.status, 409);
      assert.deepEqual(await put.json(), {
        error: "provider_outcome_unknown",
      });
      assert.equal(putWorld.providerCalls.length, 1);
      assert.equal(
        putWorld.fake.calls.filter(
          call => call.name === "PutObjectCommand",
        ).length,
        1,
      );
      assert.equal(putWorld.fake.objects.size, 0);
      assert.equal(storedRow(putWorld.fixture.db, handle).state, "unknown");
      const replay = await confirm(putWorld.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
      });
      assert.equal(replay.status, 409);
      assert.equal(putWorld.providerCalls.length, 1);
      assert.equal(
        putWorld.fake.calls.filter(
          call => call.name === "PutObjectCommand",
        ).length,
        1,
      );
      assertNoForbiddenS3(putWorld.fake);
    } finally {
      await putWorld.close();
      putWorld.fixture.db.close();
    }

    resetClock();
    alignClockToRealTime();
    const getWorld = await makeWorld();
    try {
      const token = signedToken();
      await initialize(getWorld.base, token);
      const { form } = await prepareProposal(
        getWorld, token, "private GET failure",
      );
      assert.equal((await confirm(getWorld.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
      })).status, 303);
      getWorld.fake.failOn("GetObjectCommand");
      const failed = await audio(getWorld.base, {
        cookie: sessionCookie(PRINCIPAL),
      });
      assert.equal(failed.status, 503);
      assert.deepEqual(await failed.json(), { error: "audio_unavailable" });
      assert.equal(getWorld.fake.objects.size, 1);
      assertNoForbiddenS3(getWorld.fake);
    } finally {
      await getWorld.close();
      getWorld.fixture.db.close();
    }

    resetClock();
    alignClockToRealTime();
    const tamperWorld = await makeWorld();
    try {
      const token = signedToken();
      await initialize(tamperWorld.base, token);
      const { form } = await prepareProposal(
        tamperWorld, token, "tampered private ciphertext",
      );
      assert.equal((await confirm(tamperWorld.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
      })).status, 303);
      const object = [...tamperWorld.fake.objects.values()][0];
      object.body[24] = object.body[24] ^ 0xff;
      const tampered = await audio(tamperWorld.base, {
        cookie: sessionCookie(PRINCIPAL),
      });
      assert.equal(tampered.status, 503);
      const payload = await tampered.text();
      assert.equal(payload.includes("RIFF"), false);
      assert.equal(payload.includes(FIXTURE.toString("base64")), false);
      assert.equal(tamperWorld.fake.objects.size, 1);
      assertNoForbiddenS3(tamperWorld.fake);
    } finally {
      await tamperWorld.close();
      tamperWorld.fixture.db.close();
    }
  });

test("stale CSRF and expired proposal fail before any provider attempt",
  { skip: sqliteSkip }, async () => {
    resetClock();
    alignClockToRealTime();
    const world = await makeWorld({ operationTtlMs: 10 * 60 * 1000 });
    try {
      const token = signedToken();
      await initialize(world.base, token);
      const { form } = await prepareProposal(
        world, token, "expiry boundary",
      );
      currentMs += 6 * 60 * 1000;
      const stale = await confirm(world.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
      });
      assert.equal(stale.status, 403);
      assert.deepEqual(await stale.json(), {
        error: "confirmation_forbidden",
      });
      assert.equal(world.providerCalls.length, 0);

      currentMs += 5 * 60 * 1000;
      const expired = await confirm(world.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
      });
      assert.equal(expired.status, 410);
      assert.deepEqual(await expired.json(), { error: "proposal_expired" });
      assert.equal(world.providerCalls.length, 0);
      assert.equal(world.fake.calls.length, 0);
    } finally {
      await world.close();
      world.fixture.db.close();
    }
  });

test("candidate is null unless every independent gate and exact SHA is present",
  { skip: sqliteSkip }, async () => {
    const fixture = await makeFixture();
    const readyEnv = baseEnv();
    const readyArgs = {
      env: readyEnv,
      expectedSha: APPROVED_SHA,
      currentSha: APPROVED_SHA,
      d1Client: fixture.client,
      s3Client: new FakeS3(),
      fetchImpl: makeProvider({ calls: [] }),
      clock: () => new Date(currentMs),
    };
    try {
      assert.equal(
        assessV1P2ControlledStagingConfig(readyEnv, {
          expectedSha: APPROVED_SHA,
          currentSha: APPROVED_SHA,
        }),
        "final_wiring_ready",
      );
      assert.equal(
        assessV1P2ControlledStagingConfig(without(
          readyEnv, CONTROLLED_STAGING_FINAL_WIRING_FLAG,
        ), { expectedSha: APPROVED_SHA, currentSha: APPROVED_SHA }),
        "final_wiring_flag_off",
      );
      assert.equal(
        assessV1P2ControlledStagingConfig(without(
          readyEnv, CONTROLLED_STAGING_PAID_CONFIRM_FLAG,
        ), { expectedSha: APPROVED_SHA, currentSha: APPROVED_SHA }),
        "paid_confirm_flag_off",
      );
      assert.equal(
        assessV1P2ControlledStagingConfig(without(
          readyEnv, CONTROLLED_STAGING_REAL_PROVIDER_FLAG,
        ), { expectedSha: APPROVED_SHA, currentSha: APPROVED_SHA }),
        "real_provider_flag_off",
      );
      assert.equal(
        assessV1P2ControlledStagingConfig(without(
          readyEnv, CONTROLLED_STAGING_PRIVATE_AUDIO_FLAG,
        ), { expectedSha: APPROVED_SHA, currentSha: APPROVED_SHA }),
        "private_audio_flag_off",
      );
      assert.equal(
        assessV1P2ControlledStagingConfig(readyEnv, {
          expectedSha: undefined,
          currentSha: APPROVED_SHA,
        }),
        "staging_sha_required",
      );
      assert.equal(
        assessV1P2ControlledStagingConfig({
          ...readyEnv,
          [CONTROLLED_STAGING_APPROVED_SHA_ENV]: OTHER_SHA,
        }, { expectedSha: APPROVED_SHA, currentSha: APPROVED_SHA }),
        "staging_sha_not_approved",
      );
      assert.equal(
        assessV1P2ControlledStagingConfig(readyEnv, {
          expectedSha: APPROVED_SHA,
          currentSha: OTHER_SHA,
        }),
        "runtime_sha_mismatch",
      );
      assert.equal(
        assessV1P2ControlledStagingConfig(without(
          readyEnv, MINIMAX_API_KEY_ENV,
        ), { expectedSha: APPROVED_SHA, currentSha: APPROVED_SHA }),
        "provider_key_invalid",
      );
      assert.equal(
        assessV1P2ControlledStagingConfig({
          ...readyEnv,
          [MINIMAX_API_KEY_ENV]: "k".repeat(513),
        }, { expectedSha: APPROVED_SHA, currentSha: APPROVED_SHA }),
        "provider_key_invalid",
      );
      assert.equal(
        assessV1P2ControlledStagingConfig({
          ...readyEnv,
          [MINIMAX_VOICE_ID_ENV]: "bad voice",
        }, { expectedSha: APPROVED_SHA, currentSha: APPROVED_SHA }),
        "provider_voice_invalid",
      );
      assert.equal(
        assessV1P2ControlledStagingConfig({
          ...readyEnv,
          [KODO_BUCKET_ENV]: "bad..bucket",
        }, { expectedSha: APPROVED_SHA, currentSha: APPROVED_SHA }),
        "kodo_bucket_invalid",
      );
      assert.equal(
        assessV1P2ControlledStagingConfig({
          ...readyEnv,
          [KODO_MASTER_KEY_ENV]: "not-a-key",
        }, { expectedSha: APPROVED_SHA, currentSha: APPROVED_SHA }),
        "kodo_master_key_invalid",
      );
      assert.equal(
        assessV1P2ControlledStagingConfig({
          ...readyEnv,
          [PRIVATE_AUDIO_TTL_ENV]: "29",
        }, { expectedSha: APPROVED_SHA, currentSha: APPROVED_SHA }),
        "audio_ttl_invalid",
      );
      assert.equal(
        assessV1P2ControlledStagingConfig({
          ...readyEnv,
          [PRIVATE_AUDIO_TTL_ENV]: "301",
        }, { expectedSha: APPROVED_SHA, currentSha: APPROVED_SHA }),
        "audio_ttl_invalid",
      );
      assert.equal(
        assessV1P2ControlledStagingConfig({
          ...readyEnv,
          SHENSHU_STAGING_ORIGIN: "https://evil.example",
        }, { expectedSha: APPROVED_SHA, currentSha: APPROVED_SHA }),
        "staging_identity_invalid",
      );
      assert.ok(await createV1P2ControlledStagingCandidate(readyArgs));
      const missing005 = await makeFixture({ include005: false });
      const nullCases = [
        ["final wiring flag", { ...readyArgs, env: without(
          readyEnv, CONTROLLED_STAGING_FINAL_WIRING_FLAG,
        ) }],
        ["paid confirm flag", { ...readyArgs, env: without(
          readyEnv, CONTROLLED_STAGING_PAID_CONFIRM_FLAG,
        ) }],
        ["real provider flag", { ...readyArgs, env: without(
          readyEnv, CONTROLLED_STAGING_REAL_PROVIDER_FLAG,
        ) }],
        ["private audio flag", { ...readyArgs, env: without(
          readyEnv, CONTROLLED_STAGING_PRIVATE_AUDIO_FLAG,
        ) }],
        ["sealed flag", { ...readyArgs, env: without(
          readyEnv, "SHENSHU_STAGING_SEALED_PLAYER_ENABLED",
        ) }],
        ["nonbillable flag", { ...readyArgs, env: without(
          readyEnv, "SHENSHU_NONBILLABLE_PLAYER_ENABLED",
        ) }],
        ["player flag", { ...readyArgs, env: without(
          readyEnv, "SHENSHU_PLAYER_ENABLED",
        ) }],
        ["auth flag", { ...readyArgs, env: without(
          readyEnv, "SHENSHU_AUTH_MCP_ENABLED",
        ) }],
        ["session secret", { ...readyArgs, env: without(
          readyEnv, "SHENSHU_PLAYER_SESSION_SECRET",
        ) }],
        ["text master key", { ...readyArgs, env: without(
          readyEnv, PRIVATE_TEXT_MASTER_KEY_ENV,
        ) }],
        ["provider key", { ...readyArgs, env: without(
          readyEnv, MINIMAX_API_KEY_ENV,
        ) }],
        ["provider voice", { ...readyArgs, env: without(
          readyEnv, MINIMAX_VOICE_ID_ENV,
        ) }],
        ["kodo bucket", { ...readyArgs, env: without(
          readyEnv, KODO_BUCKET_ENV,
        ) }],
        ["kodo master key", { ...readyArgs, env: without(
          readyEnv, KODO_MASTER_KEY_ENV,
        ) }],
        ["audio ttl", { ...readyArgs, env: {
          ...readyEnv, [PRIVATE_AUDIO_TTL_ENV]: "10",
        } }],
        ["wrong origin", { ...readyArgs, env: {
          ...readyEnv, SHENSHU_STAGING_ORIGIN: "https://evil.example",
        } }],
        ["missing expected SHA", { ...readyArgs, expectedSha: undefined }],
        ["wrong expected SHA", { ...readyArgs, expectedSha: OTHER_SHA }],
        ["runtime SHA mismatch", { ...readyArgs, currentSha: OTHER_SHA }],
        ["production static JWKS misuse", { ...readyArgs, env: {
          ...readyEnv, NODE_ENV: "production",
        } }],
        ["invalid d1 client", { ...readyArgs, d1Client: {} }],
        ["invalid s3 client", { ...readyArgs, s3Client: {} }],
        ["missing 005 schema", { ...readyArgs, d1Client: missing005.client }],
      ];
      try {
        for (const [name, args] of nullCases) {
          assert.equal(
            await createV1P2ControlledStagingCandidate(args),
            null,
            name,
          );
        }
      } finally {
        missing005.db.close();
      }
    } finally {
      fixture.db.close();
    }
  });

test("deployable server keeps confirm closed and P1 public surfaces intact",
  { skip: sqliteSkip }, async () => {
    const { createShenShuHttpServer } = await import("../server.js");
    const server = createShenShuHttpServer({ env: baseEnv() });
    const base = await listen(server);
    try {
      for (const method of ["GET", "POST"]) {
        const response = await fetch(base + "/player/confirm", {
          method,
          headers: method === "POST"
            ? { "content-type": "application/x-www-form-urlencoded" }
            : {},
          body: method === "POST"
            ? "handle=" + "h".repeat(43)
            : undefined,
        });
        assert.equal(response.status, 404, method + " /player/confirm");
      }

      const init = await fetch(base + "/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "final-wiring-preservation", version: "1.0" },
          },
        }),
      });
      assert.equal(init.status, 200);
      const listing = await fetch(base + "/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 2, method: "tools/list", params: {},
        }),
      });
      assert.equal(listing.status, 200);
      const names = (await listing.json()).result?.tools
        ?.map(tool => tool.name) ?? [];
      assert.equal(names.includes("preview_shenshu_voice"), true);
      assert.equal(names.some(name =>
        /speak_shenshu|prepare_shenshu|confirm|paid/i.test(name),
      ), false);

      const p1 = await fetch(base + "/player/audio", {
        headers: { cookie: realSessionCookie(PRINCIPAL) },
      });
      assert.equal(p1.status, 200);
      assert.equal(p1.headers.get("content-type"), "audio/wav");
      const fixed = Buffer.from(await p1.arrayBuffer());
      assert.equal(fixed.toString("ascii", 0, 4), "RIFF");
      assert.equal(fixed.toString("ascii", 8, 12), "WAVE");
    } finally {
      server.closeAllConnections?.();
      await new Promise(resolve => server.close(resolve));
    }

    const source = await readFile(new URL("../server.js", import.meta.url), "utf8");
    assert.doesNotMatch(source, /v1-p2-controlled-staging-candidate/);
    assert.doesNotMatch(source, /p2-kodo-private-audio-backend/);
    assert.doesNotMatch(source, /v1-p2-offline-confirm-runtime/);
    const candidateSource = await readFile(new URL(
      "../src/v1-p2-controlled-staging-candidate.js",
      import.meta.url,
    ), "utf8");
    assert.doesNotMatch(candidateSource,
      /DeleteObjectCommand|HeadObjectCommand|ListObjects|IfMatch|getSignedUrl|presign/i);
  });

test("final wiring receipt records offline limits, exact SHA and 2/9",
  async () => {
    const receipt = await readFile(new URL(
      "../docs/v1-closure/V1-P2-CONTROLLED-STAGING-FINAL-WIRING-20261030.md",
      import.meta.url,
    ), "utf8");
    for (const marker of [
      "COMPLETE",
      "PR #146",
      "2/9",
      "paid OFF",
      "offline",
      "No real MiniMax",
      "No real Kodo",
      "No real D1",
      "No Render",
      "No Call",
      "DELETE",
      "lifecycle",
      "D1 004+005",
      "rollback",
      "29110e145c93be7455e6e1d5ffaec79dca7fc3c7",
    ]) {
      assert.equal(receipt.includes(marker), true, marker);
    }
    assert.match(receipt, /not a paid-live qualification/i);
  });
