/**
 * Offline proof that the normal startup entry wires the sealed nonbillable
 * closure (not only a manually injected test closure) and keeps every failure
 * closed. node:sqlite is a local semantic fixture for D1, not a cloud test.
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
import {
  P2_OPERATION_ACTION,
  textDigest,
} from "../src/v1-p2-operation-contract.js";
import {
  PRIVATE_TEXT_SEALED_MARKER,
  createPrivateTextSealer,
} from "../src/v1-p2-private-text-sealer.js";
import {
  P2_PREPARE_TOOL,
  P2_STATUS_TOOL,
} from "../src/v1-p2-nonbillable-mcp.js";
import { PRIVATE_PLAYER_SESSION_COOKIE } from "../src/private-web-player.js";

const { createShenShuRuntimeServer } = await import("../server.js");

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

const SESSION_SECRET = "sealed-runtime-session-secret-0123456789abcdef";
const MASTER_KEY_BYTES = Buffer.from(
  Array.from({ length: 32 }, (_, index) => index + 41),
);
const MASTER_KEY = MASTER_KEY_BYTES.toString("base64");
const OTHER_MASTER_KEY = Buffer.from(
  Array.from({ length: 32 }, (_, index) => index + 91),
).toString("base64");
const CLIENT_ID = "a".repeat(32);
const SUBJECT = "auth0|sealed-runtime-owner";
const OTHER_SUBJECT = "auth0|sealed-runtime-other";
const AUDIENCE = STAGING_RESOURCE_ORIGIN + "/paid-mcp";
const PRINCIPAL = deriveCanonicalPrincipal({
  issuer: AUTH0_ISSUER,
  subject: SUBJECT,
});
const OTHER_PRINCIPAL = deriveCanonicalPrincipal({
  issuer: AUTH0_ISSUER,
  subject: OTHER_SUBJECT,
});
const SEALED_FLAG = "SHENSHU_STAGING_SEALED_PLAYER_ENABLED";
const MASTER_KEY_ENV = "SHENSHU_PRIVATE_TEXT_MASTER_KEY_BASE64";
const MIGRATIONS = [
  new URL("../db/d1/001_paid_voice_reservations.sql", import.meta.url),
  new URL("../db/d1/002_paid_voice_grants.sql", import.meta.url),
  new URL("../db/d1/004_paid_voice_confirmation_operations.sql", import.meta.url),
  new URL(
    "../db/d1/005_paid_voice_confirmation_private_text_sealing.sql",
    import.meta.url,
  ),
];

let currentMs = Date.now();
const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const publicJwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "sealed-runtime-key",
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
    [SEALED_FLAG]: "1",
    [MASTER_KEY_ENV]: MASTER_KEY,
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

async function makeFixture({ include005 = true } = {}) {
  const paths = include005 ? MIGRATIONS : MIGRATIONS.slice(0, 3);
  const sql = await Promise.all(paths.map(path => readFile(path, "utf8")));
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const migration of sql) db.exec(migration);
  const client = {
    async query(statement, params = []) {
      return db.prepare(statement).all(...params);
    },
  };
  return { db, client };
}

async function startRuntime({
  env = baseEnv(),
  client,
  createD1Client,
} = {}) {
  const runtime = await createShenShuRuntimeServer({
    env,
    fetchImpl: () => {
      throw new Error("network_disabled_in_offline_test");
    },
    createD1Client: createD1Client ?? (() => client),
  });
  await new Promise((resolve, reject) => {
    runtime.server.once("error", reject);
    runtime.server.listen(0, "127.0.0.1", resolve);
  });
  const address = runtime.server.address();
  return {
    runtime,
    server: runtime.server,
    base: "http://127.0.0.1:" + address.port,
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
      clientInfo: { name: "sealed-runtime-test", version: "1.0" },
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
    "text_bytes, origin, state, sealed_text, expires_at " +
    "FROM paid_voice_confirmation_operations WHERE handle = ?",
  ).get(handle);
}

function flipBase64url(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const last = value.at(-1);
  const next = alphabet[(alphabet.indexOf(last) + 1) % alphabet.length];
  return value.slice(0, -1) + next;
}

test("normal startup enables the sealed closure and completes MCP to owner player",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const fixture = await makeFixture();
    const running = await startRuntime({ client: fixture.client });
    try {
      assert.equal(running.runtime.sealedProposalEnabled, true);
      assert.equal(running.runtime.sealedStartupCode, "sealed_ready");
      assert.equal(running.runtime.staticTestJwks, true);

      const token = signedToken();
      await initialize(running.base, token);
      const tools = await listTools(running.base, token);
      assert.deepEqual(
        tools.map(tool => tool.name).sort(),
        ["verify_shenshu_login", P2_PREPARE_TOOL, P2_STATUS_TOOL].sort(),
      );
      assert.ok(!tools.some(tool =>
        /confirm|grant|quota|provider|synth/i.test(tool.name)));

      const text = "沈".repeat(266) + "ab";
      assert.equal(Buffer.byteLength(text, "utf8"), 800);
      const prepared = await callTool(
        running.base, token, P2_PREPARE_TOOL, { text },
      );
      assert.equal(
        prepared.result?.structuredContent?.status,
        "pending_confirmation",
      );
      assert.equal(prepared.result.structuredContent.billable, false);
      assert.equal(prepared.result.structuredContent.text, undefined);
      assert.equal(prepared.result.structuredContent.principal, undefined);
      const handle = prepared.result.structuredContent.handle;
      const expiresAt = prepared.result.structuredContent.expiresAt;

      const status = await callTool(
        running.base, token, P2_STATUS_TOOL, { handle },
      );
      assert.equal(
        status.result?.structuredContent?.status,
        "pending_confirmation",
      );
      assert.equal(status.result.structuredContent.billable, false);
      assert.equal(status.result.structuredContent.expiresAt, expiresAt);

      const ownerPage = await pending(
        running.base, sessionCookie(PRINCIPAL),
      );
      assert.equal(ownerPage.status, 200);
      assert.equal(
        ownerPage.headers.get("cache-control"),
        "private, no-store, max-age=0",
      );
      assert.match(
        ownerPage.headers.get("content-security-policy"),
        /form-action 'none'/,
      );
      const ownerHtml = await ownerPage.text();
      assert.ok(ownerHtml.includes(text));
      assert.ok(ownerHtml.includes(new Date(expiresAt).toISOString()));
      assert.match(ownerHtml, /尚未生成/);
      assert.match(ownerHtml, /只读预览/);
      assert.doesNotMatch(
        ownerHtml,
        /<form|<button|<script|http-equiv="refresh"|确认生成/i,
      );

      const otherPage = await pending(
        running.base, sessionCookie(OTHER_PRINCIPAL),
      );
      assert.equal(otherPage.status, 200);
      assert.doesNotMatch(await otherPage.text(), new RegExp(text));

      const row = storedRow(fixture.db, handle);
      assert.equal(row.text, PRIVATE_TEXT_SEALED_MARKER);
      assert.equal(row.text_bytes, 800);
      assert.equal(row.action, P2_OPERATION_ACTION);
      assert.notEqual(row.text_digest, textDigest(text));
      assert.equal(String(row.sealed_text).includes(text), false);
      assert.equal(String(row.sealed_text).includes(textDigest(text)), false);
      const envelope = JSON.parse(row.sealed_text);
      assert.deepEqual(Object.keys(envelope).sort(), [
        "alg", "ciphertext", "keyId", "nonce", "purpose", "tag", "v",
      ]);
      assert.equal(envelope.alg, "A256GCM");
      assert.equal(envelope.v, 1);
      assert.equal(envelope.keyId, "v1");
      const sealer = createPrivateTextSealer({ masterKey: MASTER_KEY_BYTES });
      const binding = {
        principal: row.principal,
        handle: row.handle,
        operationId: row.operation_id,
        action: row.action,
        origin: row.origin,
        textBytes: row.text_bytes,
        expiresAt: row.expires_at,
      };
      assert.equal(
        row.text_digest,
        sealer.digestBinding(binding, textDigest(text)),
      );
      assert.equal(sealer.open({
        ...binding,
        sealedText: row.sealed_text,
        digestBinding: row.text_digest,
      }).text, text);
      assert.deepEqual(rowCounts(fixture.db), {
        operations: 1,
        reservations: 0,
        grants: 0,
      });

      for (const method of ["GET", "POST"]) {
        const response = await fetch(running.base + "/player/confirm", {
          method,
          headers: method === "POST"
            ? { "content-type": "application/x-www-form-urlencoded" }
            : {},
          body: method === "POST" ? "handle=" + handle : undefined,
        });
        assert.equal(response.status, 404);
      }

      const player = await fetch(running.base + "/player");
      assert.equal(player.status, 200);
      assert.doesNotMatch(
        await player.text(),
        /<form|<button[^>]*>[^<]*(确认|支付|confirm|pay)/i,
      );
      const unauthorizedAudio = await fetch(running.base + "/player/audio");
      assert.equal(unauthorizedAudio.status, 401);
      const audio = await fetch(running.base + "/player/audio", {
        headers: { cookie: sessionCookie(PRINCIPAL) },
      });
      assert.equal(audio.status, 200);
      assert.equal(audio.headers.get("content-type"), "audio/wav");
      const wav = Buffer.from(await audio.arrayBuffer());
      assert.equal(wav.toString("ascii", 0, 4), "RIFF");
      assert.equal(wav.toString("ascii", 8, 12), "WAVE");

      const publicMcp = await fetch(running.base + "/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 9, method: "tools/list", params: {},
        }),
      });
      assert.equal(publicMcp.status, 200);
      const publicNames = (await publicMcp.json()).result.tools
        .map(tool => tool.name);
      assert.ok(publicNames.includes("preview_shenshu_voice"));
      assert.ok(!publicNames.includes(P2_PREPARE_TOOL));
      assert.ok(!publicNames.includes(P2_STATUS_TOOL));
    } finally {
      await running.close();
      fixture.db.close();
    }
  });

test("restarting the normal startup path reopens the same owner and table",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const fixture = await makeFixture();
    const first = await startRuntime({ client: fixture.client });
    let handle;
    let expiresAt;
    try {
      const token = signedToken();
      await initialize(first.base, token);
      const prepared = await callTool(
        first.base, token, P2_PREPARE_TOOL, { text: "重启后同一 owner 可见" },
      );
      handle = prepared.result.structuredContent.handle;
      expiresAt = prepared.result.structuredContent.expiresAt;
    } finally {
      await first.close();
    }

    const second = await startRuntime({ client: fixture.client });
    try {
      assert.equal(second.runtime.sealedProposalEnabled, true);
      const token = signedToken();
      await initialize(second.base, token);
      const status = await callTool(
        second.base, token, P2_STATUS_TOOL, { handle },
      );
      assert.equal(
        status.result?.structuredContent?.status,
        "pending_confirmation",
      );
      const page = await pending(second.base, sessionCookie(PRINCIPAL));
      assert.equal(page.status, 200);
      const html = await page.text();
      assert.ok(html.includes("重启后同一 owner 可见"));
      assert.ok(html.includes(new Date(expiresAt).toISOString()));
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

test("every startup gate fails closed before D1 and never mounts a fallback",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const cases = [
      [{}, "not_staging"],
      [baseEnv({ SHENSHU_STAGING_ORIGIN: "https://elsewhere.example" }),
        "staging_identity_invalid"],
      [baseEnv({
        SHENSHU_STAGING_ORIGIN: "https://shenshu-voice-mcp.onrender.com",
      }), "staging_identity_invalid"],
      [baseEnv({ [SEALED_FLAG]: "0" }), "sealed_flag_off"],
      [baseEnv({ SHENSHU_NONBILLABLE_PLAYER_ENABLED: "0" }),
        "nonbillable_flag_off"],
      [baseEnv({ SHENSHU_PLAYER_ENABLED: "0" }), "player_flag_off"],
      [baseEnv({ SHENSHU_AUTH_MCP_ENABLED: "0" }), "auth_mcp_flag_off"],
      [without(baseEnv(), MASTER_KEY_ENV), "master_key_invalid"],
      [baseEnv({ [MASTER_KEY_ENV]: Buffer.alloc(32).toString("base64") }),
        "master_key_invalid"],
      [baseEnv({ [MASTER_KEY_ENV]: "short" }), "master_key_invalid"],
      [baseEnv({ SHENSHU_PLAYER_SESSION_SECRET: "x".repeat(31) }),
        "session_secret_invalid"],
      [baseEnv({ SHENSHU_PLAYER_SESSION_SECRET: "x".repeat(300) }),
        "session_secret_invalid"],
      [without(baseEnv(), "SHENSHU_PLAYER_SESSION_SECRET"),
        "session_secret_invalid"],
      [without(baseEnv(), "SHENSHU_PLAYER_AUTH0_CLIENT_ID"),
        "player_client_id_invalid"],
    ];
    for (const [env, expected] of cases) {
      let factoryCalls = 0;
      const runtime = await createShenShuRuntimeServer({
        env,
        fetchImpl: () => {
          throw new Error("network_disabled_in_offline_test");
        },
        createD1Client() {
          factoryCalls++;
          throw new Error("must_not_be_called");
        },
      });
      assert.equal(runtime.sealedProposalEnabled, false, expected);
      assert.equal(runtime.sealedStartupCode, expected);
      assert.equal(factoryCalls, 0, expected);
      assert.equal(typeof runtime.server.listen, "function");
      runtime.server.close();
    }

    const badFetch = await createShenShuRuntimeServer({
      env: without(
        without(baseEnv(), "SHENSHU_AUTH_PUBLIC_JWKS_JSON"),
        "SHENSHU_AUTH_STATIC_JWKS_TEST_ONLY",
      ),
      fetchImpl: "not-a-function",
      createD1Client() {
        throw new Error("must_not_be_called");
      },
    });
    assert.equal(badFetch.sealedProposalEnabled, false);
    assert.equal(badFetch.sealedStartupCode, "jwks_cache_invalid");
  });

test("D1 and schema failures disable sealing without touching a cloud client",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const interrupted = await createShenShuRuntimeServer({
      env: baseEnv(),
      fetchImpl: () => {
        throw new Error("network_disabled_in_offline_test");
      },
      createD1Client() {
        throw new Error("interrupted_startup");
      },
    });
    assert.equal(interrupted.sealedProposalEnabled, false);
    assert.equal(interrupted.sealedStartupCode, "sealed_runtime_unavailable");

    const failingClient = {
      async query() {
        throw new Error("d1_unavailable");
      },
    };
    const unreachable = await createShenShuRuntimeServer({
      env: baseEnv(),
      fetchImpl: () => {
        throw new Error("network_disabled_in_offline_test");
      },
      createD1Client: () => failingClient,
    });
    assert.equal(unreachable.sealedProposalEnabled, false);
    assert.equal(unreachable.sealedStartupCode, "sealed_runtime_unavailable");

    const no005 = await makeFixture({ include005: false });
    const missingSchema = await createShenShuRuntimeServer({
      env: baseEnv(),
      fetchImpl: () => {
        throw new Error("network_disabled_in_offline_test");
      },
      createD1Client: () => no005.client,
    });
    assert.equal(missingSchema.sealedProposalEnabled, false);
    assert.equal(
      missingSchema.sealedStartupCode,
      "sealed_runtime_unavailable",
    );
    no005.db.close();

    const missingToken = await createShenShuRuntimeServer({
      env: baseEnv(),
      fetchImpl: () => {
        throw new Error("network_disabled_in_offline_test");
      },
    });
    assert.equal(missingToken.sealedProposalEnabled, false);
    assert.equal(missingToken.sealedStartupCode, "sealed_runtime_unavailable");

    const disabled = await startRuntime({
      env: without(baseEnv(), MASTER_KEY_ENV),
      client: null,
    });
    try {
      assert.equal(disabled.runtime.sealedProposalEnabled, false);
      const pendingResponse = await pending(
        disabled.base, sessionCookie(PRINCIPAL),
      );
      assert.equal(pendingResponse.status, 404);
      const publicMcp = await fetch(disabled.base + "/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "tools/list", params: {},
        }),
      });
      assert.equal(publicMcp.status, 200);
      const names = (await publicMcp.json()).result.tools
        .map(tool => tool.name);
      assert.ok(names.includes("preview_shenshu_voice"));
      assert.ok(!names.includes(P2_PREPARE_TOOL));
    } finally {
      await disabled.close();
    }
  });

test("identity, scope, JWT and session negatives create no operation row",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const fixture = await makeFixture();
    const running = await startRuntime({ client: fixture.client });
    try {
      const missing = await rpc(running.base, null, {
        jsonrpc: "2.0", id: 1, method: "tools/list", params: {},
      });
      assert.equal(missing.status, 401);
      const forged = await rpc(running.base, "fake.jwt.signature", {
        jsonrpc: "2.0", id: 2, method: "tools/list", params: {},
      });
      assert.equal(forged.status, 401);
      const expired = await rpc(
        running.base, signedToken({ lifetime: -300 }), {
          jsonrpc: "2.0", id: 3, method: "tools/list", params: {},
        },
      );
      assert.equal(expired.status, 401);
      const wrongIssuer = await rpc(
        running.base, signedToken({ issuer: "https://evil.example/" }), {
          jsonrpc: "2.0", id: 4, method: "tools/list", params: {},
        },
      );
      assert.equal(wrongIssuer.status, 401);
      const wrongAudience = await rpc(
        running.base,
        signedToken({ audience: "https://elsewhere.example/paid-mcp" }), {
          jsonrpc: "2.0", id: 5, method: "tools/list", params: {},
        },
      );
      assert.equal(wrongAudience.status, 401);
      const wrongScope = await rpc(
        running.base, signedToken({ scope: "openid" }), {
          jsonrpc: "2.0", id: 6, method: "tools/list", params: {},
        },
      );
      assert.equal(wrongScope.status, 403);

      const wrongSecret = await pending(
        running.base,
        sessionCookie(PRINCIPAL, { secret: "z".repeat(48) }),
      );
      assert.equal(wrongSecret.status, 401);
      const expiredCookie = await pending(
        running.base,
        sessionCookie(PRINCIPAL, { ttlSeconds: -10 }),
      );
      assert.equal(expiredCookie.status, 401);
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

test("static test JWKS is ignored without its explicit test-only flag",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const fixture = await makeFixture();
    const env = without(baseEnv(), "SHENSHU_AUTH_STATIC_JWKS_TEST_ONLY");
    const running = await startRuntime({ env, client: fixture.client });
    try {
      assert.equal(running.runtime.sealedProposalEnabled, true);
      assert.equal(running.runtime.staticTestJwks, false);
      const response = await rpc(running.base, signedToken(), {
        jsonrpc: "2.0", id: 1, method: "tools/list", params: {},
      });
      assert.equal(response.status, 401);
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

test("tampered ciphertext, tag, AAD, metadata and digest fail closed",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const fixture = await makeFixture();
    const running = await startRuntime({ client: fixture.client });
    try {
      const token = signedToken();
      await initialize(running.base, token);
      const handles = [];
      for (let index = 0; index < 7; index += 1) {
        const prepared = await callTool(
          running.base, token, P2_PREPARE_TOOL, {
            text: "tamper-" + index + "-" + "x".repeat(10),
          },
        );
        handles.push(prepared.result.structuredContent.handle);
      }
      const update = (sql, ...params) =>
        fixture.db.prepare(sql).run(...params);

      const tagRow = storedRow(fixture.db, handles[0]);
      const tagEnvelope = JSON.parse(tagRow.sealed_text);
      tagEnvelope.tag = flipBase64url(tagEnvelope.tag);
      update(
        "UPDATE paid_voice_confirmation_operations SET sealed_text = ? " +
        "WHERE handle = ?", JSON.stringify(tagEnvelope), handles[0],
      );

      const cipherRow = storedRow(fixture.db, handles[1]);
      const cipherEnvelope = JSON.parse(cipherRow.sealed_text);
      cipherEnvelope.ciphertext = flipBase64url(cipherEnvelope.ciphertext);
      update(
        "UPDATE paid_voice_confirmation_operations SET sealed_text = ? " +
        "WHERE handle = ?", JSON.stringify(cipherEnvelope), handles[1],
      );

      const versionRow = storedRow(fixture.db, handles[2]);
      const versionEnvelope = JSON.parse(versionRow.sealed_text);
      versionEnvelope.v = 2;
      update(
        "UPDATE paid_voice_confirmation_operations SET sealed_text = ? " +
        "WHERE handle = ?", JSON.stringify(versionEnvelope), handles[2],
      );

      update(
        "UPDATE paid_voice_confirmation_operations " +
        "SET expires_at = expires_at + 1000 WHERE handle = ?", handles[3],
      );

      const digestRow = storedRow(fixture.db, handles[4]);
      update(
        "UPDATE paid_voice_confirmation_operations SET text_digest = ? " +
        "WHERE handle = ?", flipBase64url(digestRow.text_digest), handles[4],
      );

      update(
        "UPDATE paid_voice_confirmation_operations SET text = ? " +
        "WHERE handle = ?", "legacy-plaintext", handles[5],
      );

      update(
        "UPDATE paid_voice_confirmation_operations SET sealed_text = NULL " +
        "WHERE handle = ?", handles[6],
      );

      for (const handle of handles) {
        const status = await callTool(
          running.base, token, P2_STATUS_TOOL, { handle },
        );
        assert.ok(status.error, "tampered row must not be readable");
        assert.doesNotMatch(JSON.stringify(status), /tamper-\d|legacy-plaintext/);
      }
      const page = await pending(running.base, sessionCookie(PRINCIPAL));
      assert.equal(page.status, 503);
      const body = await page.text();
      assert.match(body, /proposal_store_unavailable/);
      assert.doesNotMatch(body, /tamper-\d|legacy-plaintext|bearer|secret/i);
      assert.deepEqual(rowCounts(fixture.db), {
        operations: 7,
        reservations: 0,
        grants: 0,
      });
    } finally {
      await running.close();
      fixture.db.close();
    }
  });

test("a different master key cannot open sealed history and the old key can",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const fixture = await makeFixture();
    const first = await startRuntime({ client: fixture.client });
    let handle;
    try {
      const token = signedToken();
      await initialize(first.base, token);
      const prepared = await callTool(
        first.base, token, P2_PREPARE_TOOL, { text: "只允许原密钥解封" },
      );
      handle = prepared.result.structuredContent.handle;
    } finally {
      await first.close();
    }

    const wrongKey = await startRuntime({
      env: baseEnv({ [MASTER_KEY_ENV]: OTHER_MASTER_KEY }),
      client: fixture.client,
    });
    try {
      assert.equal(wrongKey.runtime.sealedProposalEnabled, true);
      const token = signedToken();
      await initialize(wrongKey.base, token);
      const status = await callTool(
        wrongKey.base, token, P2_STATUS_TOOL, { handle },
      );
      assert.ok(status.error);
      const page = await pending(wrongKey.base, sessionCookie(PRINCIPAL));
      assert.equal(page.status, 503);
      assert.doesNotMatch(await page.text(), /只允许原密钥解封/);
    } finally {
      await wrongKey.close();
    }

    const restored = await startRuntime({ client: fixture.client });
    try {
      const token = signedToken();
      await initialize(restored.base, token);
      const status = await callTool(
        restored.base, token, P2_STATUS_TOOL, { handle },
      );
      assert.equal(
        status.result?.structuredContent?.status,
        "pending_confirmation",
      );
      const page = await pending(restored.base, sessionCookie(PRINCIPAL));
      assert.equal(page.status, 200);
      assert.match(await page.text(), /只允许原密钥解封/);
      assert.deepEqual(rowCounts(fixture.db), {
        operations: 1,
        reservations: 0,
        grants: 0,
      });
    } finally {
      await restored.close();
      fixture.db.close();
    }
  });

test("the runtime readiness receipt records the staging qualification gates",
  async () => {
    const doc = await readFile(
      new URL(
        "../docs/v1-closure/V1-P2-SEALED-STAGING-RUNTIME-READINESS-20261028.md",
        import.meta.url,
      ),
      "utf8",
    );
    for (const marker of [
      "COMPLETE",
      "Node 24.19.0",
      "0 fail",
      "0 skipped",
      "2/9",
      "Deployment: NO",
      "PR #146",
      "234913cd-8901-4607-8147-31c4a4317111",
      "c39a6895-7028-4f59-a100-1455b92c96c1",
      "srv-dbcgcsom7kps739tfpo0",
      "srv-dbb2jmu7bikc73bgq2e0",
      "ADD COLUMN sealed_text TEXT",
    ]) {
      assert.match(
        doc,
        new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      );
    }
  });

test("the normal server entry composes the sealed runtime before listening",
  async () => {
    const source = await readFile(
      new URL("../server.js", import.meta.url),
      "utf8",
    );
    assert.match(
      source,
      /const runtime = await createShenShuRuntimeServer\(\{ env: process\.env \}\)/,
    );
    assert.match(source, /runtime\.server\.listen\(port/);
    assert.doesNotMatch(source, /httpServer\.listen\(port/);
    assert.doesNotMatch(source, /httpServer\.listen\(/);
  });
