/**
 * Voice V1 P2 offline explicit-confirm to private WAV journey.
 *
 * A real local HTTP server, Node24 node:sqlite with 001/002/004/005, synthetic
 * text/keys, a fake synthesizer and a test-only private result backend. This is
 * not Cloudflare D1, not Render, not MiniMax and not a human browser gesture.
 */
process.env.NODE_ENV = "test";

import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { deriveCanonicalPrincipal } from "../src/canonical-principal.js";
import { makeInlineToneFixture } from "../src/inline-fixture.js";
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
  PRIVATE_TEXT_SEALED_MARKER,
  createPrivateTextSealer,
} from "../src/v1-p2-private-text-sealer.js";
import { textDigest } from "../src/v1-p2-operation-contract.js";
import {
  P2_PREPARE_TOOL,
  P2_STATUS_TOOL,
} from "../src/v1-p2-nonbillable-mcp.js";
import { V1_FIXED_MODEL_ID } from "../src/v1-offline-paid-pipeline.js";
import {
  OFFLINE_CONFIRM_TEST_FLAG,
  createV1P2OfflineConfirmRuntime,
} from "../src/v1-p2-offline-confirm-runtime.js";

// server.js must be imported only after the test-mode assignment above. A
// static import would be evaluated first and start the deployable listener.
const { createShenShuHttpServer } = await import("../server.js");

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
const SESSION_SECRET = "offline-explicit-confirm-session-secret-0123456789abcdef";
const SUBJECT = "auth0|offline-confirm-owner";
const OTHER_SUBJECT = "auth0|offline-confirm-other";
const CLIENT_ID = "c".repeat(32);
const VOICE_ID = "voice_offline_fixture_001";
const AUDIENCE = STAGING_RESOURCE_ORIGIN + "/paid-mcp";
const FIXTURE = Buffer.from(makeInlineToneFixture().audioBase64, "base64");
const MASTER_KEY_BYTES = Buffer.from(
  Array.from({ length: 32 }, (_, index) => index + 7),
);
const MASTER_KEY = MASTER_KEY_BYTES.toString("base64");
const OTHER_MASTER_KEY = Buffer.from(
  Array.from({ length: 32 }, (_, index) => index + 71),
).toString("base64");
const PRINCIPAL = deriveCanonicalPrincipal({
  issuer: AUTH0_ISSUER,
  subject: SUBJECT,
});
const OTHER_PRINCIPAL = deriveCanonicalPrincipal({
  issuer: AUTH0_ISSUER,
  subject: OTHER_SUBJECT,
});
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
  kid: "offline-confirm-key",
  alg: "RS256",
  use: "sig",
};

function resetClock() {
  currentMs = NOW_MS;
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
    [OFFLINE_CONFIRM_TEST_FLAG]: "1",
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
          deleted += 1;
        }
      }
      return { deleted };
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

async function makeWorld({
  maximumDailyCalls = 1,
  operationTtlMs,
  resultTtlSeconds = 60,
  synthesize,
  failPut = false,
  include005 = true,
  masterKey = MASTER_KEY,
  fixture,
  backend,
  calls,
  textSealer,
  privateResultStore,
  provider,
  env = baseEnv(),
} = {}) {
  fixture ??= await makeFixture({ include005 });
  backend ??= makeResultBackend({ failPut });
  calls ??= [];
  textSealer ??= createPrivateTextSealer({
    masterKey: Buffer.from(masterKey, "base64"),
  });
  privateResultStore ??= createP2PrivateResultStore({
    backend,
    ttlSeconds: resultTtlSeconds,
    clock: () => new Date(currentMs),
  });
  provider ??= async args => {
    calls.push({ ...args });
    return synthesize ? synthesize(args) : { audio: Buffer.from(FIXTURE) };
  };
  const runtime = await createV1P2OfflineConfirmRuntime({
    env,
    client: fixture.client,
    textSealer,
    privateResultStore,
    synthesize: provider,
    voiceId: VOICE_ID,
    sessionSecret: SESSION_SECRET,
    clock: () => new Date(currentMs),
    maximumDailyCalls,
    ...(operationTtlMs === undefined ? {} : { operationTtlMs }),
  });
  const base = await listen(runtime.server);
  return {
    env,
    fixture,
    backend,
    calls,
    textSealer,
    privateResultStore,
    provider,
    runtime,
    base,
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
      clientInfo: { name: "offline-confirm-test", version: "1.0" },
    },
  });
  assert.equal(response.status, 200, await response.text().catch(() => ""));
}

async function listTools(base, token, id = 2) {
  const response = await rpc(base, token, {
    jsonrpc: "2.0",
    id,
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

async function pending(base, cookie) {
  return fetch(base + "/player/pending", {
    headers: cookie ? { cookie } : {},
  });
}

async function rawRequest(url, {
  method = "GET",
  headers = {},
  body,
} = {}) {
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

function assertSealedRow(db, handle, text, textSealer) {
  const row = storedRow(db, handle);
  assert.equal(row.text, PRIVATE_TEXT_SEALED_MARKER);
  assert.equal(row.text_bytes, Buffer.byteLength(text, "utf8"));
  assert.equal(String(row.sealed_text).includes(text), false);
  assert.equal(String(row.sealed_text).includes(textDigest(text)), false);
  const envelope = JSON.parse(row.sealed_text);
  assert.deepEqual(Object.keys(envelope).sort(), [
    "alg", "ciphertext", "keyId", "nonce", "purpose", "tag", "v",
  ]);
  assert.equal(envelope.alg, "A256GCM");
  const binding = {
    principal: row.principal,
    handle: row.handle,
    operationId: row.operation_id,
    action: row.action,
    origin: row.origin,
    textBytes: row.text_bytes,
    expiresAt: row.expires_at,
  };
  assert.notEqual(row.text_digest, textDigest(text));
  assert.equal(
    row.text_digest,
    textSealer.digestBinding(binding, textDigest(text)),
  );
  assert.equal(textSealer.open({
    ...binding,
    sealedText: row.sealed_text,
    digestBinding: row.text_digest,
  }).text, text);
  return row;
}

function flipBase64url(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const last = value.at(-1);
  const next = alphabet[(alphabet.indexOf(last) + 1) % alphabet.length];
  return value.slice(0, -1) + next;
}

test("protected MCP to owner confirm produces one sealed admission and one private WAV",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const w = await makeWorld();
    try {
      const missing = await rpc(w.base, null, {
        jsonrpc: "2.0", id: 1, method: "tools/list", params: {},
      });
      assert.equal(missing.status, 401);
      const wrongScope = await rpc(w.base, signedToken({ scope: "openid" }), {
        jsonrpc: "2.0", id: 2, method: "tools/list", params: {},
      });
      assert.equal(wrongScope.status, 403);
      const wrongAudience = await rpc(
        w.base,
        signedToken({ audience: "https://elsewhere.example/paid-mcp" }),
        { jsonrpc: "2.0", id: 3, method: "tools/list", params: {} },
      );
      assert.equal(wrongAudience.status, 401);
      assert.deepEqual(rowCounts(w.fixture.db), {
        operations: 0,
        reservations: 0,
        grants: 0,
      });

      const token = signedToken();
      await initialize(w.base, token);
      const tools = await listTools(w.base, token);
      assert.deepEqual(
        tools.map(tool => tool.name).sort(),
        ["verify_shenshu_login", P2_PREPARE_TOOL, P2_STATUS_TOOL].sort(),
      );
      assert.ok(!tools.some(tool =>
        /confirm|synth|grant|quota|provider/i.test(tool.name)));

      const text = "沈述离线确认：只生成一次，只有本人能听。";
      const prepared = await callTool(w.base, token, P2_PREPARE_TOOL, { text });
      assert.equal(
        prepared.result?.structuredContent?.status,
        "pending_confirmation",
      );
      assert.equal(prepared.result.structuredContent.billable, false);
      assert.equal(JSON.stringify(prepared).includes(text), false);
      const handle = prepared.result.structuredContent.handle;
      const expiresAt = prepared.result.structuredContent.expiresAt;

      const status = await callTool(w.base, token, P2_STATUS_TOOL, { handle });
      assert.equal(
        status.result?.structuredContent?.status,
        "pending_confirmation",
      );
      assert.equal(JSON.stringify(status).includes("audioBase64"), false);

      const ownerPage = await pending(w.base, sessionCookie(PRINCIPAL));
      assert.equal(ownerPage.status, 200);
      const pageHtml = await ownerPage.text();
      assert.ok(pageHtml.includes(text));
      assert.ok(pageHtml.includes(new Date(expiresAt).toISOString()));
      assert.match(pageHtml, /action="\/player\/confirm"/);
      assert.match(pageHtml, /确认生成/);
      assert.match(
        ownerPage.headers.get("content-security-policy") ?? "",
        /form-action 'self'/,
      );
      assert.doesNotMatch(pageHtml, /<script|http-equiv="refresh"|autosubmit/i);
      const form = formFromPage(pageHtml);
      assert.equal(form.handle, handle);
      assert.match(form.csrf, /^v1\.\d+\.[A-Za-z0-9_-]{43}$/);

      const confirmed = await confirm(w.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
      });
      assert.equal(confirmed.status, 303, await confirmed.text());
      assert.equal(
        confirmed.headers.get("location"),
        "/player/pending?result=completed",
      );

      const row = assertSealedRow(w.fixture.db, handle, text, w.textSealer);
      assert.equal(row.state, "completed");
      assert.equal(row.request_id, row.operation_id);
      assert.equal(row.grant_id, "grant_" + row.operation_id);
      assert.equal(row.day_utc, "2026-10-27");
      assert.deepEqual(rowCounts(w.fixture.db), {
        operations: 1,
        reservations: 1,
        grants: 1,
      });
      const grant = w.fixture.db.prepare(
        "SELECT request_id, state FROM paid_voice_grants",
      ).get();
      assert.deepEqual({ ...grant }, {
        request_id: row.operation_id,
        state: "consumed",
      });
      const reservation = w.fixture.db.prepare(
        "SELECT principal, day_utc, slot FROM paid_voice_reservations",
      ).get();
      assert.deepEqual({ ...reservation }, {
        principal: PRINCIPAL,
        day_utc: "2026-10-27",
        slot: 1,
      });

      assert.equal(w.calls.length, 1);
      assert.deepEqual(Object.keys(w.calls[0]).sort(),
        ["modelId", "text", "voiceId"]);
      assert.equal(w.calls[0].text, text);
      assert.equal(w.calls[0].modelId, V1_FIXED_MODEL_ID);
      assert.equal(w.calls[0].voiceId, VOICE_ID);
      assert.equal(w.backend.rows.size, 1);
      const stored = w.backend.rows.get(PRINCIPAL);
      assert.equal(stored.mimeType, "audio/wav");
      assert.equal(stored.audio.equals(FIXTURE), true);

      const completed = await callTool(w.base, token, P2_STATUS_TOOL, { handle });
      assert.equal(completed.result?.structuredContent?.status, "completed");
      assert.equal(completed.result.structuredContent.ready, true);
      assert.equal(JSON.stringify(completed).includes("audioBase64"), false);
      assert.equal(JSON.stringify(completed).includes(FIXTURE.toString("base64")), false);

      const afterPage = await pending(w.base, sessionCookie(PRINCIPAL));
      assert.equal(afterPage.status, 200);
      assert.doesNotMatch(await afterPage.text(), new RegExp(text));

      assert.equal((await audio(w.base)).status, 401);
      const otherAudio = await audio(w.base, {
        cookie: sessionCookie(OTHER_PRINCIPAL),
      });
      assert.equal(otherAudio.status, 503);
      assert.deepEqual(await otherAudio.json(), { error: "audio_unavailable" });
      const ownerAudio = await audio(w.base, {
        cookie: sessionCookie(PRINCIPAL),
      });
      assert.equal(ownerAudio.status, 200);
      assert.equal(ownerAudio.headers.get("content-type"), "audio/wav");
      assert.equal(
        ownerAudio.headers.get("cache-control"),
        "private, no-store, max-age=0",
      );
      assert.equal(ownerAudio.headers.get("content-disposition"), "inline");
      assert.equal(ownerAudio.headers.get("vary"), "Cookie");
      const wav = Buffer.from(await ownerAudio.arrayBuffer());
      assert.equal(wav.equals(FIXTURE), true);
      assert.equal(wav.toString("ascii", 0, 4), "RIFF");
      assert.equal(wav.toString("ascii", 8, 12), "WAVE");
      const head = await audio(w.base, {
        cookie: sessionCookie(PRINCIPAL),
        method: "HEAD",
      });
      assert.equal(head.status, 200);
      assert.equal(head.headers.get("content-type"), "audio/wav");
      assert.equal(Number(head.headers.get("content-length")), FIXTURE.length);
      assert.equal((await head.arrayBuffer()).byteLength, 0);

      const replay = await confirm(w.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
      });
      assert.equal(replay.status, 303);
      assert.equal(w.calls.length, 1);
      assert.deepEqual(rowCounts(w.fixture.db), {
        operations: 1,
        reservations: 1,
        grants: 1,
      });
    } finally {
      await w.close();
      w.fixture.db.close();
    }
  });

test("session, Origin, fetch metadata, CSRF and form shape fail before admission",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const w = await makeWorld();
    try {
      const token = signedToken();
      await initialize(w.base, token);
      const prepared = await callTool(w.base, token, P2_PREPARE_TOOL, {
        text: "negative confirm matrix",
      });
      const handle = prepared.result.structuredContent.handle;
      const page = await pending(w.base, sessionCookie(PRINCIPAL));
      const form = formFromPage(await page.text());

      assert.equal((await confirm(w.base, {
        cookie: sessionCookie(PRINCIPAL, { secret: "z".repeat(48) }),
        ...form,
      })).status, 401);
      assert.equal((await confirm(w.base, {
        cookie: sessionCookie(PRINCIPAL, { ttlSeconds: -10 }),
        ...form,
      })).status, 401);
      assert.equal((await confirm(w.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
        origin: "https://evil.example",
      })).status, 403);
      assert.equal((await confirm(w.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
        site: "cross-site",
      })).status, 403);
      assert.equal((await confirm(w.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
        mode: "cors",
      })).status, 403);
      assert.equal((await confirm(w.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
        contentType: "application/json",
      })).status, 415);
      assert.equal((await confirm(w.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
        csrf: "v1.1." + "x".repeat(43),
      })).status, 403);
      assert.equal((await confirm(w.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
        handle: "h".repeat(43),
      })).status, 404);
      assert.equal((await confirm(w.base, {
        cookie: sessionCookie(OTHER_PRINCIPAL),
        ...form,
      })).status, 404);
      assert.equal((await confirm(w.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
        body: "csrf=" + encodeURIComponent(form.csrf) +
          "&handle=" + encodeURIComponent(form.handle) +
          "&text=extra",
      })).status, 400);
      assert.equal((await confirm(w.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
        body: "csrf=" + encodeURIComponent(form.csrf) +
          "&handle=" + encodeURIComponent(form.handle) +
          "&handle=" + encodeURIComponent(form.handle),
      })).status, 400);
      assert.equal((await confirm(w.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
        body: "x".repeat(5000),
      })).status, 413);
      const getConfirm = await fetch(w.base + "/player/confirm", {
        headers: { cookie: sessionCookie(PRINCIPAL) },
      });
      assert.equal(getConfirm.status, 405);

      assert.equal(w.calls.length, 0);
      assert.deepEqual(rowCounts(w.fixture.db), {
        operations: 1,
        reservations: 0,
        grants: 0,
      });
      assert.equal(storedRow(w.fixture.db, handle).state, "pending_confirmation");
    } finally {
      await w.close();
      w.fixture.db.close();
    }
  });

test("concurrent double submit yields one provider attempt and one safe response",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const w = await makeWorld();
    try {
      const token = signedToken();
      await initialize(w.base, token);
      const prepared = await callTool(w.base, token, P2_PREPARE_TOOL, {
        text: "double click must bill once",
      });
      const form = formFromPage(
        await (await pending(w.base, sessionCookie(PRINCIPAL))).text(),
      );
      const cookie = sessionCookie(PRINCIPAL);
      const responses = await Promise.all([
        confirm(w.base, { cookie, ...form }),
        confirm(w.base, { cookie, ...form }),
      ]);
      const statuses = responses.map(response => response.status).sort();
      assert.equal(statuses.filter(status => status === 303).length >= 1, true);
      assert.equal(
        statuses.every(status => status === 303 || status === 409),
        true,
      );
      assert.equal(w.calls.length, 1);
      assert.deepEqual(rowCounts(w.fixture.db), {
        operations: 1,
        reservations: 1,
        grants: 1,
      });
      assert.equal(storedRow(w.fixture.db,
        prepared.result.structuredContent.handle).state, "completed");
    } finally {
      await w.close();
      w.fixture.db.close();
    }
  });

test("restart replays completed and serves the same private WAV without a second provider",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const first = await makeWorld();
    let handle;
    try {
      const token = signedToken();
      await initialize(first.base, token);
      const prepared = await callTool(first.base, token, P2_PREPARE_TOOL, {
        text: "restart keeps private audio",
      });
      handle = prepared.result.structuredContent.handle;
      const form = formFromPage(
        await (await pending(first.base, sessionCookie(PRINCIPAL))).text(),
      );
      assert.equal((await confirm(first.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
      })).status, 303);
    } finally {
      await first.close();
    }

    const second = await makeWorld({
      fixture: first.fixture,
      backend: first.backend,
      calls: first.calls,
      textSealer: first.textSealer,
      privateResultStore: first.privateResultStore,
      provider: first.provider,
    });
    try {
      const token = signedToken();
      await initialize(second.base, token);
      const status = await callTool(
        second.base, token, P2_STATUS_TOOL, { handle },
      );
      assert.equal(status.result?.structuredContent?.status, "completed");
      const response = await audio(second.base, {
        cookie: sessionCookie(PRINCIPAL),
      });
      assert.equal(response.status, 200);
      assert.equal(Buffer.from(await response.arrayBuffer()).equals(FIXTURE), true);
      assert.equal(first.calls.length, 1);
      assert.deepEqual(rowCounts(first.fixture.db), {
        operations: 1,
        reservations: 1,
        grants: 1,
      });
    } finally {
      await second.close();
      first.fixture.db.close();
    }
  });

test("private WAV is owner-only, short-lived and deleted after expiry",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const w = await makeWorld({ resultTtlSeconds: 30 });
    try {
      const token = signedToken();
      await initialize(w.base, token);
      await callTool(w.base, token, P2_PREPARE_TOOL, {
        text: "private WAV expiry",
      });
      const form = formFromPage(
        await (await pending(w.base, sessionCookie(PRINCIPAL))).text(),
      );
      assert.equal((await confirm(w.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
      })).status, 303);
      assert.equal(w.backend.rows.size, 1);
      assert.equal((await audio(w.base)).status, 401);
      assert.equal((await audio(w.base, {
        cookie: sessionCookie(OTHER_PRINCIPAL),
      })).status, 503);
      const ownerHead = await audio(w.base, {
        cookie: sessionCookie(PRINCIPAL),
        method: "HEAD",
      });
      assert.equal(ownerHead.status, 200);
      assert.equal(ownerHead.headers.get("content-type"), "audio/wav");

      currentMs += 30_000;
      const expired = await audio(w.base, {
        cookie: sessionCookie(PRINCIPAL),
      });
      assert.equal(expired.status, 503);
      assert.deepEqual(await expired.json(), { error: "audio_unavailable" });
      assert.equal(w.backend.rows.size, 0);
      assert.equal(w.backend.calls.includes("deleteExpired"), true);
      assert.equal((await audio(w.base, {
        cookie: sessionCookie(PRINCIPAL),
        method: "HEAD",
      })).status, 503);
    } finally {
      await w.close();
      w.fixture.db.close();
    }
  });

test("provider error, timeout, bad WAV and private-store failure end unknown without retry or refund",
  { skip: sqliteSkip }, async () => {
    const scenarios = [
      {
        name: "provider throws",
        options: {
          synthesize: async () => {
            throw new Error("token=must-not-leak");
          },
        },
      },
      {
        name: "provider timeout",
        options: {
          synthesize: async () => {
            await new Promise((resolve, reject) => {
              setTimeout(() => reject(Object.assign(new Error("fixture timeout"), {
                name: "TimeoutError",
              })), 5);
            });
          },
        },
      },
      {
        name: "bad WAV",
        options: {
          synthesize: async () => ({ audio: Buffer.from("not-a-wav") }),
        },
      },
      {
        name: "private store write failure",
        options: { failPut: true },
      },
    ];
    for (const scenario of scenarios) {
      resetClock();
      const w = await makeWorld(scenario.options);
      try {
        const token = signedToken();
        await initialize(w.base, token);
        const prepared = await callTool(w.base, token, P2_PREPARE_TOOL, {
          text: scenario.name,
        });
        const handle = prepared.result.structuredContent.handle;
        const form = formFromPage(
          await (await pending(w.base, sessionCookie(PRINCIPAL))).text(),
        );
        const first = await confirm(w.base, {
          cookie: sessionCookie(PRINCIPAL),
          ...form,
        });
        assert.equal(first.status, 409, scenario.name);
        assert.deepEqual(await first.json(), {
          error: "provider_outcome_unknown",
        });
        assert.equal(w.calls.length, 1, scenario.name);
        assert.equal(w.backend.rows.size, 0, scenario.name);
        assert.equal(storedRow(w.fixture.db, handle).state, "unknown");
        const counts = rowCounts(w.fixture.db);
        assert.equal(counts.reservations, 1, scenario.name);
        assert.equal(counts.grants, 1, scenario.name);
        assert.equal(
          w.fixture.db.prepare("SELECT state FROM paid_voice_grants").get().state,
          "consumed",
          scenario.name,
        );

        const second = await confirm(w.base, {
          cookie: sessionCookie(PRINCIPAL),
          ...form,
        });
        assert.equal(second.status, 409, scenario.name);
        assert.equal(w.calls.length, 1, scenario.name);
        assert.equal((await audio(w.base, {
          cookie: sessionCookie(PRINCIPAL),
        })).status, 503, scenario.name);
      } finally {
        await w.close();
        w.fixture.db.close();
      }
    }
  });

test("quota denial keeps pending work unadmitted and the next UTC day admits a new proposal",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const w = await makeWorld({ maximumDailyCalls: 1 });
    try {
      let token = signedToken();
      await initialize(w.base, token);
      const first = await callTool(w.base, token, P2_PREPARE_TOOL, {
        text: "day one admitted",
      });
      const firstForm = formFromPage(
        await (await pending(w.base, sessionCookie(PRINCIPAL))).text(),
      );
      assert.equal((await confirm(w.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...firstForm,
      })).status, 303);
      const firstHandle = first.result.structuredContent.handle;
      assert.equal(storedRow(w.fixture.db, firstHandle).state, "completed");

      const second = await callTool(w.base, token, P2_PREPARE_TOOL, {
        text: "day one quota blocked",
      });
      const secondHandle = second.result.structuredContent.handle;
      const secondForm = formFromPage(
        await (await pending(w.base, sessionCookie(PRINCIPAL))).text(),
      );
      const denied = await confirm(w.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...secondForm,
      });
      assert.equal(denied.status, 409);
      assert.deepEqual(await denied.json(), {
        error: "confirmation_in_progress",
      });
      assert.equal(w.calls.length, 1);
      assert.deepEqual(rowCounts(w.fixture.db), {
        operations: 2,
        reservations: 1,
        grants: 1,
      });
      assert.equal(storedRow(w.fixture.db, secondHandle).state,
        "pending_confirmation");

      currentMs = Date.parse("2026-10-28T00:05:00.000Z");
      token = signedToken();
      await initialize(w.base, token);
      const third = await callTool(w.base, token, P2_PREPARE_TOOL, {
        text: "day two admitted",
      });
      const thirdForm = formFromPage(
        await (await pending(w.base, sessionCookie(PRINCIPAL))).text(),
      );
      assert.equal((await confirm(w.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...thirdForm,
      })).status, 303);
      assert.equal(w.calls.length, 2);
      assert.deepEqual(rowCounts(w.fixture.db), {
        operations: 3,
        reservations: 2,
        grants: 2,
      });
      assert.equal(storedRow(w.fixture.db,
        third.result.structuredContent.handle).day_utc, "2026-10-28");
      assert.equal(w.backend.rows.size, 1);
    } finally {
      await w.close();
      w.fixture.db.close();
    }
  });

test("stale CSRF, expired proposal and tampered text fail before any provider call",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const w = await makeWorld({ operationTtlMs: 10 * 60 * 1000 });
    try {
      const token = signedToken();
      await initialize(w.base, token);
      const prepared = await callTool(w.base, token, P2_PREPARE_TOOL, {
        text: "expiry and csrf boundary",
      });
      const form = formFromPage(
        await (await pending(w.base, sessionCookie(PRINCIPAL))).text(),
      );

      currentMs += 6 * 60 * 1000;
      const stale = await confirm(w.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
      });
      assert.equal(stale.status, 403);
      assert.deepEqual(await stale.json(), { error: "confirmation_forbidden" });
      assert.equal(w.calls.length, 0);

      currentMs += 5 * 60 * 1000;
      const expired = await confirm(w.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
      });
      assert.equal(expired.status, 410);
      assert.deepEqual(await expired.json(), { error: "proposal_expired" });
      assert.equal(w.calls.length, 0);

      resetClock();
      const tamperWorld = await makeWorld();
      try {
        const tamperToken = signedToken();
        await initialize(tamperWorld.base, tamperToken);
        const tampered = await callTool(tamperWorld.base, tamperToken,
          P2_PREPARE_TOOL, { text: "tampered binding" });
        const tamperHandle = tampered.result.structuredContent.handle;
        const tamperForm = formFromPage(
          await (await pending(tamperWorld.base,
            sessionCookie(PRINCIPAL))).text(),
        );
        const row = storedRow(tamperWorld.fixture.db, tamperHandle);
        tamperWorld.fixture.db.prepare(
          "UPDATE paid_voice_confirmation_operations SET text_digest = ? " +
          "WHERE handle = ?",
        ).run(flipBase64url(row.text_digest), tamperHandle);
        assert.equal((await pending(tamperWorld.base,
          sessionCookie(PRINCIPAL))).status, 503);
        const blocked = await confirm(tamperWorld.base, {
          cookie: sessionCookie(PRINCIPAL),
          ...tamperForm,
        });
        assert.equal(blocked.status, 503);
        assert.equal(JSON.stringify(await blocked.json())
          .includes("tampered binding"), false);
        assert.equal(tamperWorld.calls.length, 0);
      } finally {
        await tamperWorld.close();
        tamperWorld.fixture.db.close();
      }
    } finally {
      await w.close();
      w.fixture.db.close();
    }
  });

test("missing 005 and a wrong sealed key fail closed without plaintext or provider work",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const no005 = await makeFixture({ include005: false });
    try {
      await assert.rejects(createV1P2OfflineConfirmRuntime({
        env: baseEnv(),
        client: no005.client,
        textSealer: createPrivateTextSealer({ masterKey: MASTER_KEY_BYTES }),
        privateResultStore: createP2PrivateResultStore({
          backend: makeResultBackend(),
          ttlSeconds: 60,
          clock: () => new Date(currentMs),
        }),
        synthesize: async () => ({ audio: Buffer.from(FIXTURE) }),
        voiceId: VOICE_ID,
        sessionSecret: SESSION_SECRET,
        clock: () => new Date(currentMs),
      }), /offline_confirm_runtime_schema_unqualified|schema_unqualified/);
    } finally {
      no005.db.close();
    }

    resetClock();
    const first = await makeWorld();
    let handle;
    try {
      const token = signedToken();
      await initialize(first.base, token);
      const prepared = await callTool(first.base, token, P2_PREPARE_TOOL, {
        text: "wrong key must not reveal this",
      });
      handle = prepared.result.structuredContent.handle;
    } finally {
      await first.close();
    }

    const wrongKey = await makeWorld({
      fixture: first.fixture,
      backend: first.backend,
      calls: first.calls,
      masterKey: OTHER_MASTER_KEY,
      privateResultStore: first.privateResultStore,
      provider: first.provider,
    });
    try {
      assert.equal((await pending(wrongKey.base,
        sessionCookie(PRINCIPAL))).status, 503);
      const pageBody = await (await pending(wrongKey.base,
        sessionCookie(PRINCIPAL))).text();
      assert.doesNotMatch(pageBody, /wrong key must not reveal this/);
      const blocked = await confirm(wrongKey.base, {
        cookie: sessionCookie(PRINCIPAL),
        csrf: "v1.1." + "x".repeat(43),
        handle,
      });
      assert.equal(blocked.status, 503);
      assert.equal(wrongKey.calls.length, 0);
      assert.equal(storedRow(first.fixture.db, handle).text,
        PRIVATE_TEXT_SEALED_MARKER);
    } finally {
      await wrongKey.close();
    }

    const restored = await makeWorld({
      fixture: first.fixture,
      backend: first.backend,
      calls: first.calls,
      textSealer: first.textSealer,
      privateResultStore: first.privateResultStore,
      provider: first.provider,
    });
    try {
      const token = signedToken();
      await initialize(restored.base, token);
      const form = formFromPage(
        await (await pending(restored.base, sessionCookie(PRINCIPAL))).text(),
      );
      assert.equal((await confirm(restored.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
      })).status, 303);
      assert.equal(restored.calls.length, 1);
      const response = await audio(restored.base, {
        cookie: sessionCookie(PRINCIPAL),
      });
      assert.equal(response.status, 200);
      assert.equal(Buffer.from(await response.arrayBuffer()).equals(FIXTURE), true);
      assert.deepEqual(rowCounts(first.fixture.db), {
        operations: 1,
        reservations: 1,
        grants: 1,
      });
    } finally {
      await restored.close();
      first.fixture.db.close();
    }
  });

test("atomic trigger refusal fails closed before the fake provider",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const w = await makeWorld();
    try {
      const token = signedToken();
      await initialize(w.base, token);
      const prepared = await callTool(w.base, token, P2_PREPARE_TOOL, {
        text: "trigger refusal",
      });
      const handle = prepared.result.structuredContent.handle;
      const form = formFromPage(
        await (await pending(w.base, sessionCookie(PRINCIPAL))).text(),
      );
      w.fixture.db.exec("DROP TRIGGER paid_voice_confirmation_admit;");
      const response = await confirm(w.base, {
        cookie: sessionCookie(PRINCIPAL),
        ...form,
      });
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        error: "confirmation_unavailable",
      });
      assert.equal(w.calls.length, 0);
      assert.deepEqual(rowCounts(w.fixture.db), {
        operations: 1,
        reservations: 0,
        grants: 0,
      });
      assert.equal(storedRow(w.fixture.db, handle).state, "pending_confirmation");
      assert.equal(w.backend.rows.size, 0);
    } finally {
      await w.close();
      w.fixture.db.close();
    }
  });

test("deployable server keeps confirm closed while public MCP and P1 audio stay intact",
  async () => {
    resetClock();
    let pendingCalls = 0;
    const closure = {
      broker: {
        async initiate() {
          throw new Error("unexpected_initiate");
        },
        async status() {
          throw new Error("unexpected_status");
        },
      },
      pendingHandler: {
        async handle(req, res, url) {
          pendingCalls += 1;
          res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
          res.end("pending-only:" + url.pathname);
          return true;
        },
      },
    };
    const server = createShenShuHttpServer({
      env: baseEnv(),
      nonbillableClosure: closure,
    });
    const base = await listen(server);
    try {
      for (const method of ["GET", "POST"]) {
        const response = await fetch(base + "/player/confirm", {
          method,
          headers: method === "POST"
            ? { "content-type": "application/x-www-form-urlencoded" }
            : {},
          body: method === "POST" ? "handle=" + "h".repeat(43) : undefined,
        });
        assert.equal(response.status, 404, method + " /player/confirm");
      }
      assert.equal(pendingCalls, 0);

      const pendingResponse = await fetch(base + "/player/pending", {
        headers: { cookie: realSessionCookie(PRINCIPAL) },
      });
      assert.equal(pendingResponse.status, 200);
      assert.equal(await pendingResponse.text(), "pending-only:/player/pending");
      assert.equal(pendingCalls, 1);

      const p1Audio = await fetch(base + "/player/audio", {
        headers: { cookie: realSessionCookie(PRINCIPAL) },
      });
      assert.equal(p1Audio.status, 200);
      assert.equal(p1Audio.headers.get("content-type"), "audio/wav");
      const fixed = Buffer.from(await p1Audio.arrayBuffer());
      assert.equal(fixed.toString("ascii", 0, 4), "RIFF");
      assert.equal(fixed.toString("ascii", 8, 12), "WAVE");

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
            clientInfo: { name: "offline-preservation", version: "1.0" },
          },
        }),
      });
      assert.equal(init.status, 200);
      assert.ok((await init.json()).result?.serverInfo);
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
      const names = (await listing.json()).result?.tools?.map(tool => tool.name) ?? [];
      assert.equal(names.includes("preview_shenshu_voice"), true);
      assert.equal(names.some(name =>
        /speak_shenshu|prepare_shenshu_voice|confirm/i.test(name)), false);
    } finally {
      server.closeAllConnections?.();
      await new Promise(resolve => server.close(resolve));
    }
  });

test("offline confirm runtime requires both test mode and the explicit test flag",
  async () => {
    await assert.rejects(createV1P2OfflineConfirmRuntime({
      env: { ...baseEnv(), NODE_ENV: "production" },
    }), /offline_confirm_runtime_unavailable/);
    await assert.rejects(createV1P2OfflineConfirmRuntime({
      env: without(baseEnv(), OFFLINE_CONFIRM_TEST_FLAG),
    }), /offline_confirm_runtime_unavailable/);
  });

test("offline receipt records evidence, boundaries and the remaining real blockers",
  async () => {
    const receipt = await readFile(new URL(
      "../docs/v1-closure/V1-P2-EXPLICIT-CONFIRM-PRIVATE-WAV-OFFLINE-20261028.md",
      import.meta.url,
    ), "utf8");
    for (const marker of [
      "COMPLETE",
      "Node",
      "24.19.0",
      "0 fail",
      "0 skipped",
      "2/9",
      "PR #146",
      "Deployment: NO",
      "MiniMax",
      "sealed:v1",
      "/player/confirm",
      "private",
      "234913cd-8901-4607-8147-31c4a4317111",
    ]) {
      assert.equal(receipt.includes(marker), true, marker);
    }
    assert.match(receipt, /not a human click/i);
    assert.match(receipt, /not paid qualification/i);

    const runtimeSource = await readFile(new URL(
      "../src/v1-p2-offline-confirm-runtime.js",
      import.meta.url,
    ), "utf8");
    assert.doesNotMatch(runtimeSource,
      /minimax-adapter|cloudflare-d1-http|globalThis\.fetch/);
    const deployableSource = await readFile(new URL(
      "../server.js",
      import.meta.url,
    ), "utf8");
    assert.doesNotMatch(deployableSource, /v1-p2-offline-confirm-runtime/);
  });
