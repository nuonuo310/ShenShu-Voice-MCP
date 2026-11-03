/**
 * End-to-end offline proof for the nonbillable MCP-to-player closure.
 *
 * A real HTTP server, protected MCP handler and signed player cookie are used.
 * node:sqlite is only a local semantic fixture for the 004 operation table; it
 * is not Cloudflare D1 and does not prove any cloud deployment.
 */
process.env.NODE_ENV = "test";

import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  AUTH0_ISSUER,
  STAGING_RESOURCE_ORIGIN,
} from "../src/protected-resource-identity.js";
import { deriveCanonicalPrincipal } from "../src/canonical-principal.js";
import { createVerifiedIdentityResolver } from "../src/verified-identity.js";
import {
  createD1P2ConfirmationOperationStore,
} from "../src/d1-p2-confirmation-operation-store.js";
import {
  createV1P2NonbillablePlayerClosure,
} from "../src/v1-p2-nonbillable-player-closure.js";
import {
  PRIVATE_TEXT_SEALED_MARKER,
  createPrivateTextSealer,
} from "../src/v1-p2-private-text-sealer.js";
import { textDigest } from "../src/v1-p2-operation-contract.js";
import {
  P2_PREPARE_TOOL,
  P2_STATUS_TOOL,
} from "../src/v1-p2-nonbillable-mcp.js";
import { PRIVATE_PLAYER_SESSION_COOKIE } from "../src/private-web-player.js";

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

const SESSION_SECRET = "offline-nonbillable-player-secret-0123456789abcdef";
const SEALING_MASTER_KEY = Buffer.from(
  Array.from({ length: 32 }, (_, index) => index + 17),
);
const SUBJECT = "auth0|nonbillable-player-owner";
const OTHER_SUBJECT = "auth0|nonbillable-player-other";
const AUDIENCE = STAGING_RESOURCE_ORIGIN + "/paid-mcp";
const PRINCIPAL = deriveCanonicalPrincipal({ issuer: AUTH0_ISSUER, subject: SUBJECT });
const OTHER_PRINCIPAL = deriveCanonicalPrincipal({
  issuer: AUTH0_ISSUER,
  subject: OTHER_SUBJECT,
});
let currentMs = Date.now();

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "nonbillable-player-key",
  alg: "RS256",
  use: "sig",
};

function resetClock() {
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
  return data + "." + sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url");
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
    SHENSHU_PLAYER_AUTH0_CLIENT_ID: "a".repeat(32),
    SHENSHU_PLAYER_SESSION_SECRET: SESSION_SECRET,
    SHENSHU_NONBILLABLE_PLAYER_ENABLED: "1",
  };
}

function sessionCookie(principal, { ttlSeconds = 3600 } = {}) {
  const expiry = Math.floor(currentMs / 1000) + ttlSeconds;
  const payload = "v1." + String(expiry) + "." + principal;
  const mac = createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return PRIVATE_PLAYER_SESSION_COOKIE + "=" + payload + "." + mac;
}

const MIGRATIONS = [
  new URL("../db/d1/001_paid_voice_reservations.sql", import.meta.url),
  new URL("../db/d1/002_paid_voice_grants.sql", import.meta.url),
  new URL("../db/d1/004_paid_voice_confirmation_operations.sql", import.meta.url),
  new URL(
    "../db/d1/005_paid_voice_confirmation_private_text_sealing.sql",
    import.meta.url,
  ),
];

async function makeStore({ failWrites = false, failReads = false } = {}) {
  const sql = await Promise.all(MIGRATIONS.map(path => readFile(path, "utf8")));
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const migration of sql) db.exec(migration);
  const client = {
    async query(statement, params = []) {
      if ((failWrites && /INSERT|UPDATE|DELETE/i.test(statement)) ||
          (failReads && /SELECT|PRAGMA/i.test(statement))) {
        throw new Error("fixture_store_unavailable");
      }
      return db.prepare(statement).all(...params);
    },
  };
  const textSealer = createPrivateTextSealer({
    masterKey: SEALING_MASTER_KEY,
  });
  return {
    db,
    client,
    textSealer,
    store: createD1P2ConfirmationOperationStore({ client, textSealer }),
  };
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

function makeClosure(store) {
  return createV1P2NonbillablePlayerClosure({
    operationStore: store,
    mcpResolveVerifiedPrincipal: makeVerifier(),
    sessionSecret: SESSION_SECRET,
    clock: () => currentMs,
    operationTtlMs: 60_000,
    maximumProposals: 10,
  });
}

async function startServer({ env = baseEnv(), closure = null } = {}) {
  const server = createShenShuHttpServer({ env, nonbillableClosure: closure });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  return {
    server,
    base: "http://127.0.0.1:" + address.port,
    async close() {
      server.closeAllConnections?.();
      await new Promise(resolve => server.close(resolve));
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
      clientInfo: { name: "closure-test", version: "1.0" },
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
  const body = await response.json();
  return body.result?.tools ?? [];
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

function rowCounts(db) {
  return {
    operations: db.prepare("SELECT COUNT(*) AS c FROM paid_voice_confirmation_operations").get().c,
    reservations: db.prepare("SELECT COUNT(*) AS c FROM paid_voice_reservations").get().c,
    grants: db.prepare("SELECT COUNT(*) AS c FROM paid_voice_grants").get().c,
  };
}

test("signed MCP proposal appears only in the same owner's read-only player page",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const fixture = await makeStore();
    const closure = makeClosure(fixture.store);
    assert.deepEqual(Object.keys(closure.broker).sort(), ["initiate", "status"]);
    assert.equal(typeof closure.broker.confirm, "undefined");
    assert.equal(typeof closure.pendingHandler.handle, "function");
    const running = await startServer({ closure });
    try {
      const token = signedToken();
      await initialize(running.base, token);
      const tools = await listTools(running.base, token);
      assert.deepEqual(tools.map(tool => tool.name), [
        "verify_shenshu_login",
        P2_PREPARE_TOOL,
        P2_STATUS_TOOL,
      ]);
      assert.ok(!tools.some(tool => /confirm|grant|quota|provider/i.test(tool.name)));

      const text = "沈".repeat(266) + "ab";
      assert.equal(Buffer.byteLength(text, "utf8"), 800);
      const prepared = await callTool(running.base, token, P2_PREPARE_TOOL, { text });
      assert.equal(prepared.result?.structuredContent?.status, "pending_confirmation");
      assert.equal(prepared.result?.structuredContent?.billable, false);
      assert.equal(prepared.result?.structuredContent?.text, undefined);
      assert.equal(prepared.result?.structuredContent?.principal, undefined);

      const ownerPage = await pending(running.base, sessionCookie(PRINCIPAL));
      assert.equal(ownerPage.status, 200);
      assert.equal(ownerPage.headers.get("cache-control"), "private, no-store, max-age=0");
      assert.match(ownerPage.headers.get("content-security-policy"), /form-action 'none'/);
      const ownerHtml = await ownerPage.text();
      assert.ok(ownerHtml.includes(text));
      assert.match(ownerHtml, /尚未生成/);
      assert.match(ownerHtml, /只读预览/);
      assert.doesNotMatch(ownerHtml, /<form|<button|<script|http-equiv="refresh"|确认生成/i);

      const otherPage = await pending(running.base, sessionCookie(OTHER_PRINCIPAL));
      assert.equal(otherPage.status, 200);
      assert.doesNotMatch(await otherPage.text(), /糯糯，这是一条只读预览提案。/);

      assert.deepEqual(rowCounts(fixture.db), {
        operations: 1,
        reservations: 0,
        grants: 0,
      });
      const stored = fixture.db.prepare(
        "SELECT text, text_digest, text_bytes, sealed_text " +
        "FROM paid_voice_confirmation_operations",
      ).get();
      assert.equal(stored.text, PRIVATE_TEXT_SEALED_MARKER);
      assert.equal(stored.text_bytes, 800);
      assert.notEqual(stored.text_digest, textDigest(text));
      assert.equal(stored.sealed_text.includes(text), false);
      assert.equal(stored.sealed_text.includes(textDigest(text)), false);
      assert.equal(JSON.stringify(stored).includes(text), false);
    } finally {
      await running.close();
      fixture.db.close();
    }
  });

test("status is owner-scoped and terminal/expiry states never create quota or provider work",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const fixture = await makeStore();
    const closure = makeClosure(fixture.store);
    const running = await startServer({ closure });
    try {
      const ownerToken = signedToken();
      await initialize(running.base, ownerToken);
      const prepared = await callTool(running.base, ownerToken, P2_PREPARE_TOOL, {
        text: "过期前可见",
      });
      const handle = prepared.result.structuredContent.handle;

      const ownStatus = await callTool(running.base, ownerToken, P2_STATUS_TOOL, { handle });
      assert.equal(ownStatus.result.structuredContent.status, "pending_confirmation");
      assert.equal(ownStatus.result.structuredContent.billable, false);

      const otherStatus = await callTool(
        running.base,
        signedToken({ subject: OTHER_SUBJECT }),
        P2_STATUS_TOOL,
        { handle },
      );
      assert.ok(otherStatus.error, "foreign status must fail closed");

      currentMs += 61_000;
      const expired = await callTool(running.base, ownerToken, P2_STATUS_TOOL, { handle });
      assert.equal(expired.result.structuredContent.status, "expired");
      const expiredPage = await pending(running.base, sessionCookie(PRINCIPAL));
      assert.equal(expiredPage.status, 200);
      assert.doesNotMatch(await expiredPage.text(), /过期前可见/);
      assert.deepEqual(rowCounts(fixture.db), {
        operations: 1,
        reservations: 0,
        grants: 0,
      });
    } finally {
      await running.close();
      fixture.db.close();
    }
  });

test("missing, forged and wrong-audience identities fail before any operation row",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const fixture = await makeStore();
    const closure = makeClosure(fixture.store);
    const running = await startServer({ closure });
    try {
      const missing = await rpc(running.base, null, {
        jsonrpc: "2.0", id: 1, method: "tools/list", params: {},
      });
      assert.equal(missing.status, 401);
      const forged = await rpc(running.base, "fake.jwt.signature", {
        jsonrpc: "2.0", id: 2, method: "tools/list", params: {},
      });
      assert.equal(forged.status, 401);
      const wrongAudience = await rpc(
        running.base,
        signedToken({ audience: "https://elsewhere.example/paid-mcp" }),
        { jsonrpc: "2.0", id: 3, method: "tools/list", params: {} },
      );
      assert.equal(wrongAudience.status, 401);
      const wrongIssuer = await rpc(
        running.base,
        signedToken({ issuer: "https://evil.example/" }),
        { jsonrpc: "2.0", id: 5, method: "tools/list", params: {} },
      );
      assert.equal(wrongIssuer.status, 401);
      const wrongScope = await rpc(
        running.base,
        signedToken({ scope: "openid" }),
        { jsonrpc: "2.0", id: 4, method: "tools/list", params: {} },
      );
      assert.equal(wrongScope.status, 403);
      assert.deepEqual(rowCounts(fixture.db), {
        operations: 0,
        reservations: 0,
        grants: 0,
      });
    } finally {
      await running.close();
      fixture.db.close();
    }
  });

test("invalid caller authority, handles and text fail closed with zero paid work",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const fixture = await makeStore();
    const closure = makeClosure(fixture.store);
    const running = await startServer({ closure });
    try {
      const token = signedToken();
      await initialize(running.base, token);
      const authority = await callTool(running.base, token, P2_PREPARE_TOOL, {
        text: "hello",
        principal: PRINCIPAL,
      });
      assert.ok(authority.error);
      const oversized = await callTool(running.base, token, P2_PREPARE_TOOL, {
        text: "a".repeat(801),
      });
      assert.ok(oversized.error);
      const badStatus = await callTool(running.base, token, P2_STATUS_TOOL, {
        handle: "h".repeat(42),
      });
      assert.ok(badStatus.error);
      assert.deepEqual(rowCounts(fixture.db), {
        operations: 0,
        reservations: 0,
        grants: 0,
      });
    } finally {
      await running.close();
      fixture.db.close();
    }
  });

test("owner text is escaped and the pending page is read-only with no confirm route",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const fixture = await makeStore();
    const closure = makeClosure(fixture.store);
    const running = await startServer({ closure });
    try {
      const token = signedToken();
      await initialize(running.base, token);
      const text = '<script>alert("x")</script>';
      await callTool(running.base, token, P2_PREPARE_TOOL, { text });
      const page = await pending(running.base, sessionCookie(PRINCIPAL));
      assert.equal(page.status, 200);
      const html = await page.text();
      assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
      assert.doesNotMatch(html, /<script>/);
      assert.doesNotMatch(html, /<form|<button|confirm/i);

      for (const method of ["GET", "POST"]) {
        const response = await fetch(running.base + "/player/confirm", {
          method,
          headers: method === "POST"
            ? { "content-type": "application/x-www-form-urlencoded" }
            : {},
          body: method === "POST" ? "handle=" + "h".repeat(43) : undefined,
        });
        assert.equal(response.status, 404);
      }
      const head = await fetch(running.base + "/player/pending", {
        method: "HEAD",
        headers: { cookie: sessionCookie(PRINCIPAL) },
      });
      assert.equal(head.status, 405);
      assert.deepEqual(rowCounts(fixture.db), {
        operations: 1,
        reservations: 0,
        grants: 0,
      });
    } finally {
      await running.close();
      fixture.db.close();
    }
  });

test("new broker and pending handler over the same 004 store recover after restart",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const fixture = await makeStore();
    const firstClosure = makeClosure(fixture.store);
    const first = await startServer({ closure: firstClosure });
    let handle;
    try {
      const token = signedToken();
      await initialize(first.base, token);
      const prepared = await callTool(first.base, token, P2_PREPARE_TOOL, {
        text: "重启后仍由本人看到",
      });
      handle = prepared.result.structuredContent.handle;
    } finally {
      await first.close();
    }

    const restartedStore = createD1P2ConfirmationOperationStore({
      client: fixture.client,
      textSealer: fixture.textSealer,
    });
    const secondClosure = makeClosure(restartedStore);
    const second = await startServer({ closure: secondClosure });
    try {
      const token = signedToken();
      await initialize(second.base, token);
      const status = await callTool(second.base, token, P2_STATUS_TOOL, { handle });
      assert.equal(status.result.structuredContent.status, "pending_confirmation");
      const page = await pending(second.base, sessionCookie(PRINCIPAL));
      assert.equal(page.status, 200);
      assert.match(await page.text(), /重启后仍由本人看到/);
      assert.deepEqual(rowCounts(fixture.db), {
        operations: 1,
        reservations: 0,
        grants: 0,
      });
    } finally {
      await second.close();
      fixture.db.close();
    }
  });

test("store and configuration failures return generic errors without memory fallback",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const fixture = await makeStore();
    const failingStore = {
      async createPending() { throw new Error("fixture_write_failure"); },
      async get() { throw new Error("fixture_read_failure"); },
      async listPending() { throw new Error("fixture_read_failure"); },
    };
    const closure = makeClosure(failingStore);
    const running = await startServer({ closure });
    try {
      const token = signedToken();
      await initialize(running.base, token);
      const prepared = await callTool(running.base, token, P2_PREPARE_TOOL, {
        text: "must not fall back",
      });
      assert.ok(prepared.error);
      const page = await pending(running.base, sessionCookie(PRINCIPAL));
      assert.equal(page.status, 503);
      const body = await page.text();
      assert.match(body, /proposal_store_unavailable/);
      assert.doesNotMatch(body, /fixture_read_failure|secret|token/i);
      assert.deepEqual(rowCounts(fixture.db), {
        operations: 0,
        reservations: 0,
        grants: 0,
      });
    } finally {
      await running.close();
      fixture.db.close();
    }
  });

test("public mock and disabled/non-staging paths expose no proposal or pending route",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const fixture = await makeStore();
    const closure = makeClosure(fixture.store);

    const disabledEnv = { ...baseEnv(), SHENSHU_NONBILLABLE_PLAYER_ENABLED: "0" };
    const disabled = await startServer({ env: disabledEnv, closure });
    try {
      const response = await fetch(disabled.base + "/player/pending", {
        headers: { cookie: sessionCookie(PRINCIPAL) },
      });
      assert.equal(response.status, 404);
      const token = signedToken();
      await initialize(disabled.base, token);
      const tools = await listTools(disabled.base, token);
      assert.deepEqual(tools.map(tool => tool.name), ["verify_shenshu_login"]);
    } finally {
      await disabled.close();
    }

    const productionEnv = { ...baseEnv() };
    delete productionEnv.SHENSHU_STAGING_RESOURCE_MODE;
    delete productionEnv.SHENSHU_STAGING_ORIGIN;
    const production = await startServer({ env: productionEnv, closure });
    try {
      const pendingResponse = await fetch(production.base + "/player/pending", {
        headers: { cookie: sessionCookie(PRINCIPAL) },
      });
      assert.equal(pendingResponse.status, 404);
    } finally {
      await production.close();
    }

    const publicServer = await startServer();
    try {
      const response = await fetch(publicServer.base + "/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "tools/list", params: {},
        }),
      });
      assert.equal(response.status, 200);
      const names = (await response.json()).result.tools.map(tool => tool.name);
      assert.ok(names.includes("preview_shenshu_voice"));
      assert.ok(!names.includes(P2_PREPARE_TOOL));
      assert.ok(!names.includes(P2_STATUS_TOOL));
      assert.ok(!names.some(name => /confirm|grant|quota|provider/i.test(name)));

      const noInjectedClosureEnv = { ...baseEnv() };
      const noInjectedClosure = await startServer({ env: noInjectedClosureEnv });
      try {
        const pendingResponse = await fetch(noInjectedClosure.base + "/player/pending", {
          headers: { cookie: sessionCookie(PRINCIPAL) },
        });
        assert.equal(pendingResponse.status, 404);
      } finally {
        await noInjectedClosure.close();
      }
    } finally {
      await publicServer.close();
      fixture.db.close();
    }
  });

test("the existing authenticated fixed WAV remains available and visible text is owner-only",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const fixture = await makeStore();
    const closure = makeClosure(fixture.store);
    const running = await startServer({ closure });
    try {
      const player = await fetch(running.base + "/player");
      assert.equal(player.status, 200);
      assert.match(await player.text(), /href="\/player\/pending"/);
      const unauthorized = await fetch(running.base + "/player/audio");
      assert.equal(unauthorized.status, 401);
      const response = await fetch(running.base + "/player/audio", {
        headers: { cookie: sessionCookie(PRINCIPAL) },
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "audio/wav");
      const audio = Buffer.from(await response.arrayBuffer());
      assert.equal(audio.toString("ascii", 0, 4), "RIFF");
      assert.equal(audio.toString("ascii", 8, 12), "WAVE");
      assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
    } finally {
      await running.close();
      fixture.db.close();
    }
  });

test("the closure receipt records the bounded evidence and remaining gates", async () => {
  const doc = await readFile(
    new URL("../docs/v1-closure/V1-P2-NONBILLABLE-MCP-PLAYER-CLOSURE-20261028.md", import.meta.url),
    "utf8",
  );
  for (const marker of [
    "COMPLETE",
    "332 tests, 332 pass, 0 fail, 0 skipped, 0 todo",
    "TOTAL CONTROL DECISION REQUIRED",
    "2/9",
    "40729121589",
  ]) {
    assert.match(doc, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
