import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { deriveCanonicalPrincipal } from "../src/canonical-principal.js";
import { makeInlineToneFixture } from "../src/inline-fixture.js";
import {
  AUTH0_ISSUER,
  STAGING_RESOURCE_ORIGIN,
} from "../src/protected-resource-identity.js";
import { createVerifiedIdentityResolver } from "../src/verified-identity.js";
import {
  PRIVATE_PLAYER_AUDIO_PATH,
  PRIVATE_PLAYER_CALLBACK_PATH,
  PRIVATE_PLAYER_LOGIN_COOKIE,
  PRIVATE_PLAYER_LOGIN_PATH,
  PRIVATE_PLAYER_SESSION_COOKIE,
  handlePrivateWebPlayer,
} from "../src/private-web-player.js";
import {
  createP2OneShotPlayerConnection,
} from "../src/p2-one-shot-player-connection.js";
import {
  createP2PlayerAudioLoader,
  createP2PrivateResultStore,
} from "../src/p2-private-result-store.js";

const NOW_MS = Date.parse("2026-10-27T00:00:00.000Z");
const NOW_SECONDS = Math.floor(NOW_MS / 1000);
const SUBJECT = "auth0|p2-player-user";
const OTHER_SUBJECT = "auth0|p2-other-user";
const CLIENT_ID = "b".repeat(32);
const SESSION_SECRET = "offline-p2-player-test-session-secret-0123456789abcdef";
const VOICE_ID = "voice_p2_fixed_001";
const AUDIENCE = STAGING_RESOURCE_ORIGIN + "/paid-mcp";
const OPERATION_ID = "op_p2_connection_0001";
const FIXTURE = Buffer.from(makeInlineToneFixture().audioBase64, "base64");
const TOKEN_URL = new URL("oauth/token", AUTH0_ISSUER).href;
const USERINFO_URL = new URL("userinfo", AUTH0_ISSUER).href;
let currentMs = NOW_MS;

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "p2-offline-key",
  alg: "RS256",
  use: "sig",
};

function resetClock() {
  currentMs = NOW_MS;
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

function signedToken(overrides = {}) {
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
    iat: NOW_SECONDS - 10,
    exp: NOW_SECONDS + 300,
    ...overrides,
  })).toString("base64url");
  const data = header + "." + claims;
  return data + "." + sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url");
}

function trustedRequest(overrides = {}) {
  return { headers: { authorization: "Bearer " + signedToken(overrides) } };
}

const PRINCIPAL = deriveCanonicalPrincipal({ issuer: AUTH0_ISSUER, subject: SUBJECT });
const OTHER_PRINCIPAL = deriveCanonicalPrincipal({ issuer: AUTH0_ISSUER, subject: OTHER_SUBJECT });

class MemoryPaidStore {
  constructor() {
    this.reservations = new Map();
    this.grants = new Map();
    this.calls = [];
  }

  async reserveAtomic({ subject, day, requestId, limit }) {
    this.calls.push("reserve");
    if (this.reservations.has(requestId)) return { reserved: false };
    const used = new Set();
    for (const row of this.reservations.values()) {
      if (row.subject === subject && row.day === day) used.add(row.slot);
    }
    let slot = 0;
    for (let candidate = 1; candidate <= limit; candidate++) {
      if (!used.has(candidate)) { slot = candidate; break; }
    }
    if (!slot) return { reserved: false };
    this.reservations.set(requestId, { requestId, subject, day, slot });
    return { reserved: true, slot };
  }

  async issue({ grantId, requestId, subject }) {
    this.calls.push("issue");
    const reservation = this.reservations.get(requestId);
    if (!reservation || reservation.subject !== subject || this.grants.has(grantId)) {
      return { issued: false };
    }
    this.grants.set(grantId, { grantId, requestId, subject, state: "issued" });
    return { issued: true };
  }

  async consume({ grantId, requestId, subject }) {
    this.calls.push("consume");
    const grant = this.grants.get(grantId);
    if (!grant || grant.requestId !== requestId || grant.subject !== subject ||
        grant.state !== "issued") {
      return { consumed: false };
    }
    grant.state = "consumed";
    return { consumed: true };
  }
}

function makeResultBackend() {
  const rows = new Map();
  const calls = [];
  return {
    rows,
    calls,
    async putLatest(record) {
      calls.push("put");
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
          deleted++;
        }
      }
      return { deleted };
    },
  };
}

function makeConnection({
  synthesize = async () => ({ audio: Buffer.from(FIXTURE) }),
  operationPrincipal = PRINCIPAL,
  operationId = OPERATION_ID,
  maximumDailyCalls = 3,
  ttlSeconds = 60,
  paidStore = new MemoryPaidStore(),
  backend = makeResultBackend(),
  verifier = makeVerifier(),
  makeGrantId,
} = {}) {
  const providerArgs = [];
  const provider = async args => {
    providerArgs.push(args);
    return synthesize(args);
  };
  const privateResultStore = createP2PrivateResultStore({
    backend,
    ttlSeconds,
    clock: () => new Date(currentMs),
  });
  const initiate = createP2OneShotPlayerConnection({
    resolveVerifiedPrincipal: verifier,
    resolveServerOperation: async () => ({
      operationId,
      principal: operationPrincipal,
    }),
    paidStore,
    synthesize: provider,
    privateResultStore,
    voiceId: VOICE_ID,
    maximumDailyCalls,
    clock: () => new Date(currentMs),
    ...(makeGrantId ? { makeGrantId } : {}),
  });
  return {
    initiate,
    paidStore,
    backend,
    privateResultStore,
    providerArgs,
    loader: createP2PlayerAudioLoader({ privateResultStore }),
  };
}

function makeResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: null,
    writeHead(status, headers = {}) {
      this.statusCode = status;
      Object.assign(this.headers, headers);
      return this;
    },
    end(chunk) {
      this.body = chunk === undefined ? null :
        (Buffer.isBuffer(chunk) ? Buffer.from(chunk) : Buffer.from(String(chunk)));
    },
  };
}

function playerEnv(overrides = {}) {
  return {
    SHENSHU_STAGING_RESOURCE_MODE: "1",
    SHENSHU_STAGING_ORIGIN: STAGING_RESOURCE_ORIGIN,
    SHENSHU_PLAYER_ENABLED: "1",
    SHENSHU_PLAYER_AUTH0_CLIENT_ID: CLIENT_ID,
    SHENSHU_PLAYER_SESSION_SECRET: SESSION_SECRET,
    ...overrides,
  };
}

async function playerInvoke(path, {
  method = "GET",
  headers = {},
  env = playerEnv(),
  fetchImpl,
  loadAudio,
  randomBytesImpl = deterministicRandom(),
} = {}) {
  const url = new URL(STAGING_RESOURCE_ORIGIN + path);
  const req = { method, headers, url: url.pathname + url.search };
  const res = makeResponse();
  const handled = await handlePrivateWebPlayer(req, res, url, {
    env,
    clock: () => currentMs,
    randomBytesImpl,
    fetchImpl,
    loadAudio,
  });
  return {
    handled,
    status: res.statusCode,
    headers: res.headers,
    body: res.body,
    text: res.body ? res.body.toString("utf8") : "",
  };
}

function deterministicRandom(seed = 1) {
  let count = 0;
  return size => {
    count++;
    return Buffer.alloc(size, (seed + count) & 0xff);
  };
}

function responseWithBody(value) {
  const bytes = new TextEncoder().encode(value);
  return {
    status: 200,
    ok: true,
    headers: { get() { return null; } },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
  };
}

function fakeAuthFetch({ sub = SUBJECT } = {}) {
  const calls = [];
  async function fetchImpl(url, options = {}) {
    calls.push({ url, options });
    if (url === TOKEN_URL) {
      return responseWithBody(JSON.stringify({
        access_token: "fixture-access-token-p2",
        token_type: "Bearer",
      }));
    }
    if (url === USERINFO_URL) {
      return responseWithBody(JSON.stringify({ sub }));
    }
    throw new Error("unexpected_auth_url");
  }
  return { fetchImpl, calls };
}

function setCookies(headers) {
  const value = headers["Set-Cookie"];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function findCookie(values, name) {
  return values.find(value => value.startsWith(name + "="));
}

function cookiePair(setCookie) {
  return setCookie.slice(0, setCookie.indexOf(";"));
}

function sessionSubject(setCookie) {
  const pair = cookiePair(setCookie);
  const value = pair.slice(pair.indexOf("=") + 1);
  const payload = value.slice(0, value.lastIndexOf("."));
  const parts = payload.split(".");
  assert.equal(parts.length, 3);
  assert.equal(parts[0], "v1");
  return parts[2];
}

async function loginSession(sub = SUBJECT, seed = 1) {
  const randomBytesImpl = deterministicRandom(seed);
  const login = await playerInvoke(PRIVATE_PLAYER_LOGIN_PATH, { randomBytesImpl });
  assert.equal(login.status, 302);
  const loginSet = findCookie(setCookies(login.headers), PRIVATE_PLAYER_LOGIN_COOKIE);
  assert.ok(loginSet);
  const state = new URL(login.headers.Location).searchParams.get("state");
  const auth = fakeAuthFetch({ sub });
  const callback = await playerInvoke(
    PRIVATE_PLAYER_CALLBACK_PATH + "?code=p2-offline-code&state=" + state,
    {
      headers: { cookie: cookiePair(loginSet) },
      fetchImpl: auth.fetchImpl,
      randomBytesImpl,
    },
  );
  assert.equal(callback.status, 303);
  const sessionSet = findCookie(setCookies(callback.headers), PRIVATE_PLAYER_SESSION_COOKIE);
  assert.ok(sessionSet);
  return {
    cookie: cookiePair(sessionSet),
    subject: sessionSubject(sessionSet),
  };
}

test("signed MCP subject and player userinfo bind to the same canonical principal", async () => {
  resetClock();
  const mcp = await makeVerifier()(trustedRequest());
  const session = await loginSession(SUBJECT);
  assert.equal(mcp.subject, PRINCIPAL);
  assert.equal(session.subject, PRINCIPAL);
  assert.notEqual(OTHER_PRINCIPAL, PRINCIPAL);
});

test("one trusted request stores one private WAV and the authenticated player retrieves it", async () => {
  resetClock();
  const h = makeConnection();
  const result = await h.initiate({
    trustedRequest: trustedRequest(),
    text: "P2 offline private player connection",
  });

  assert.equal(result.ready, true);
  assert.equal(Number.isFinite(result.durationSeconds), true);
  assert.equal(h.providerArgs.length, 1);
  assert.equal(h.providerArgs[0].modelId, "speech-2.8-hd");
  assert.equal(h.providerArgs[0].voiceId, VOICE_ID);
  assert.deepEqual(h.paidStore.calls, ["reserve", "issue", "consume"]);
  assert.equal(h.paidStore.reservations.size, 1);
  assert.equal([...h.paidStore.grants.values()][0].state, "consumed");
  assert.equal(h.backend.rows.size, 1);

  const exposed = JSON.stringify(result);
  assert.doesNotMatch(exposed, /Bearer|auth0\|p2-player-user|voice_p2_fixed_001|op_p2_connection_0001|audioBase64/);
  assert.equal("audioBase64" in result, false);
  assert.equal("principal" in result, false);
  assert.equal("operationId" in result, false);

  const session = await loginSession(SUBJECT);
  const loaded = await playerInvoke(PRIVATE_PLAYER_AUDIO_PATH, {
    headers: { cookie: session.cookie },
    loadAudio: h.loader,
  });
  assert.equal(loaded.status, 200);
  assert.deepEqual(loaded.body, FIXTURE);
  assert.equal(loaded.headers["Content-Type"], "audio/wav");
  assert.equal(loaded.headers["Cache-Control"], "private, no-store, max-age=0");
  assert.equal(loaded.headers["Cross-Origin-Resource-Policy"], "same-origin");
  assert.equal(loaded.headers["Access-Control-Allow-Origin"], undefined);
});

test("a different authenticated subject cannot retrieve another user's result", async () => {
  resetClock();
  const h = makeConnection();
  await h.initiate({
    trustedRequest: trustedRequest(),
    text: "only the initiating principal may load this",
  });
  const other = await loginSession(OTHER_SUBJECT, 9);
  assert.equal(other.subject, OTHER_PRINCIPAL);
  const denied = await playerInvoke(PRIVATE_PLAYER_AUDIO_PATH, {
    headers: { cookie: other.cookie },
    loadAudio: h.loader,
  });
  assert.equal(denied.status, 503);
  assert.deepEqual(JSON.parse(denied.text), { error: "audio_unavailable" });
  assert.equal(denied.body.includes(FIXTURE), false);
});

test("same server operation ID is rejected before a second provider attempt", async () => {
  resetClock();
  const h = makeConnection();
  const input = {
    trustedRequest: trustedRequest(),
    text: "retry must not charge twice",
  };
  await h.initiate(input);
  await assert.rejects(h.initiate(input), /budget_denied/);
  assert.equal(h.providerArgs.length, 1);
  assert.deepEqual(h.paidStore.calls, ["reserve", "issue", "consume", "reserve"]);
  assert.equal(h.backend.rows.size, 1);
});

test("operation principal must equal the signed MCP principal before admission", async () => {
  resetClock();
  const h = makeConnection({ operationPrincipal: OTHER_PRINCIPAL });
  await assert.rejects(h.initiate({
    trustedRequest: trustedRequest(),
    text: "principal mismatch",
  }), /principal_mismatch/);
  assert.deepEqual(h.paidStore.calls, []);
  assert.equal(h.providerArgs.length, 0);
  assert.equal(h.backend.rows.size, 0);
});

test("caller-supplied principal, operation ID, model, voice or grant is rejected before admission", async () => {
  resetClock();
  const h = makeConnection();
  const forbidden = [
    { principal: OTHER_PRINCIPAL },
    { operationId: "op_caller_controlled_0001" },
    { modelId: "caller-model" },
    { voiceId: "caller-voice" },
    { grantId: "grant_caller_controlled_0001" },
  ];
  for (const extra of forbidden) {
    await assert.rejects(h.initiate({
      trustedRequest: trustedRequest(),
      text: "caller authority must be ignored",
      ...extra,
    }), /invalid_input/);
  }
  assert.deepEqual(h.paidStore.calls, []);
  assert.equal(h.providerArgs.length, 0);
  assert.equal(h.backend.rows.size, 0);
});

test("uncertain provider outcome and invalid WAV fail closed without a stored result", async () => {
  resetClock();
  const uncertain = makeConnection({
    synthesize: async () => {
      throw new Error("token=must-not-leak");
    },
  });
  await assert.rejects(uncertain.initiate({
    trustedRequest: trustedRequest(),
    text: "uncertain provider result",
  }), /provider_outcome_unknown/);
  assert.equal(uncertain.providerArgs.length, 1);
  assert.equal(uncertain.backend.rows.size, 0);
  assert.equal([...uncertain.paidStore.grants.values()][0].state, "consumed");

  resetClock();
  const invalid = makeConnection({
    synthesize: async () => ({ audio: Buffer.from("not-a-wav") }),
  });
  await assert.rejects(invalid.initiate({
    trustedRequest: trustedRequest(),
    text: "invalid provider audio",
  }), /invalid_audio/);
  assert.equal(invalid.providerArgs.length, 1);
  assert.equal(invalid.backend.rows.size, 0);
});

test("private result expires and is deleted while the player session remains valid", async () => {
  resetClock();
  const h = makeConnection({ ttlSeconds: 30 });
  await h.initiate({
    trustedRequest: trustedRequest(),
    text: "short lived private result",
  });
  const session = await loginSession(SUBJECT);
  currentMs += 31_000;
  const expired = await playerInvoke(PRIVATE_PLAYER_AUDIO_PATH, {
    headers: { cookie: session.cookie },
    loadAudio: h.loader,
  });
  assert.equal(expired.status, 503);
  assert.deepEqual(JSON.parse(expired.text), { error: "audio_unavailable" });
  assert.equal(h.backend.rows.size, 0);
  assert.equal(h.backend.calls.includes("deleteExpired"), true);
});

test("P2 connection modules remain unmounted and add no provider or D1 path", async () => {
  const server = await readFile(new URL("../server.js", import.meta.url), "utf8");
  const connection = await readFile(
    new URL("../src/p2-one-shot-player-connection.js", import.meta.url),
    "utf8",
  );
  const verifier = await readFile(
    new URL("../src/verified-identity.js", import.meta.url),
    "utf8",
  );
  const player = await readFile(
    new URL("../src/private-web-player.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(server, /p2-one-shot-player-connection|p2-private-result-store|createP2OneShotPlayerConnection/);
  assert.doesNotMatch(connection, /fetch\(|MINIMAX_ENDPOINT|apiKey|client_secret|console\./);
  assert.doesNotMatch(connection, /cloudflare|cloudflare-d1-http|d1-http-paid-store/i);
  assert.match(verifier, /deriveCanonicalPrincipal/);
  assert.match(player, /deriveCanonicalPrincipal/);
  assert.doesNotMatch(verifier, /createHash\("sha256"\)\.update\(issuer/);
});
