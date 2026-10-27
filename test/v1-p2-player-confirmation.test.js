import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { deriveCanonicalPrincipal } from "../src/canonical-principal.js";
import { makeInlineToneFixture } from "../src/inline-fixture.js";
import {
  AUTH0_ISSUER,
  STAGING_RESOURCE_ORIGIN,
} from "../src/protected-resource-identity.js";
import { createVerifiedIdentityResolver } from "../src/verified-identity.js";
import {
  createP2PrivateResultStore,
} from "../src/p2-private-result-store.js";
import {
  createInMemoryStableOperationStoreForTest,
  createV1P2StableOperationBroker,
  P2_OPERATION_STATES,
} from "../src/v1-p2-stable-operation-identity.js";
import {
  PRIVATE_PLAYER_CONFIRM_PATH,
  PRIVATE_PLAYER_PENDING_PATH,
  createV1P2PlayerConfirmationHandler,
  createV1P2PlayerSessionPrincipalResolver,
} from "../src/v1-p2-player-confirmation.js";
import {
  PRIVATE_PLAYER_SESSION_COOKIE,
} from "../src/private-web-player.js";

const NOW_MS = Date.parse("2026-10-27T00:00:00.000Z");
const NOW_SECONDS = Math.floor(NOW_MS / 1000);
const SESSION_SECRET = "offline-p2-player-confirmation-secret-0123456789abcdef";
const SUBJECT = "auth0|p2-player-confirm-user";
const OTHER_SUBJECT = "auth0|p2-player-confirm-other";
const VOICE_ID = "voice_p2_player_confirm_001";
const AUDIENCE = STAGING_RESOURCE_ORIGIN + "/paid-mcp";
const FIXTURE = Buffer.from(makeInlineToneFixture().audioBase64, "base64");
const PRINCIPAL = deriveCanonicalPrincipal({ issuer: AUTH0_ISSUER, subject: SUBJECT });
const OTHER_PRINCIPAL = deriveCanonicalPrincipal({
  issuer: AUTH0_ISSUER,
  subject: OTHER_SUBJECT,
});
let currentMs = NOW_MS;

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "p2-player-confirmation-key",
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

function signedToken({ subject = SUBJECT, ...overrides } = {}) {
  const header = Buffer.from(JSON.stringify({
    alg: "RS256",
    typ: "JWT",
    kid: publicJwk.kid,
  })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({
    iss: AUTH0_ISSUER,
    aud: AUDIENCE,
    sub: subject,
    scope: "voice:speak",
    iat: NOW_SECONDS - 10,
    exp: NOW_SECONDS + 300,
    ...overrides,
  })).toString("base64url");
  const data = header + "." + claims;
  return data + "." + sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url");
}

function trustedRequest(options = {}) {
  return { headers: { authorization: "Bearer " + signedToken(options) } };
}

function signCookie(payload) {
  return payload + "." +
    createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
}

function sessionCookie(principal, { ttlSeconds = 3600 } = {}) {
  const expiry = Math.floor(currentMs / 1000) + ttlSeconds;
  return PRIVATE_PLAYER_SESSION_COOKIE + "=" +
    signCookie("v1." + String(expiry) + "." + principal);
}

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
      if (!used.has(candidate)) {
        slot = candidate;
        break;
      }
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
    if (!grant ||
        grant.requestId !== requestId ||
        grant.subject !== subject ||
        grant.state !== "issued") {
      return { consumed: false };
    }
    grant.state = "consumed";
    return { consumed: true };
  }
}

function makeResultBackend() {
  const rows = new Map();
  return {
    rows,
    async putLatest(record) {
      rows.set(record.principal, { ...record, audio: Buffer.from(record.audio) });
      return { stored: true };
    },
    async getLatest({ principal }) {
      const row = rows.get(principal);
      return row ? { ...row, audio: Buffer.from(row.audio) } : null;
    },
    async deleteExpired({ before }) {
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

function makeHarness({
  synthesize = async () => ({ audio: Buffer.from(FIXTURE) }),
  operationTtlMs = 60_000,
} = {}) {
  const operationStore = createInMemoryStableOperationStoreForTest();
  const paidStore = new MemoryPaidStore();
  const backend = makeResultBackend();
  const providerArgs = [];
  const provider = async args => {
    providerArgs.push(args);
    return synthesize(args);
  };
  const privateResultStore = createP2PrivateResultStore({
    backend,
    ttlSeconds: 60,
    clock: () => new Date(currentMs),
  });
  const makeMcpBroker = () => createV1P2StableOperationBroker({
    resolveVerifiedPrincipal: makeVerifier(),
    operationStore,
    paidStore,
    synthesize: provider,
    privateResultStore,
    voiceId: VOICE_ID,
    maximumDailyCalls: 3,
    clock: () => new Date(currentMs),
    operationTtlMs,
  });
  const makePlayerBroker = () => createV1P2StableOperationBroker({
    resolveVerifiedPrincipal: createV1P2PlayerSessionPrincipalResolver(),
    operationStore,
    paidStore,
    synthesize: provider,
    privateResultStore,
    voiceId: VOICE_ID,
    maximumDailyCalls: 3,
    clock: () => new Date(currentMs),
    operationTtlMs,
  });
  const makeHandler = () => createV1P2PlayerConfirmationHandler({
    operationStore,
    broker: makePlayerBroker(),
    sessionSecret: SESSION_SECRET,
    clock: () => currentMs,
  });
  return {
    broker: makeMcpBroker(),
    makeMcpBroker,
    makePlayerBroker,
    makeHandler,
    handler: makeHandler(),
    operationStore,
    paidStore,
    backend,
    providerArgs,
    privateResultStore,
  };
}

function makeResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: null,
    headersSent: false,
    writableEnded: false,
    writeHead(status, headers = {}) {
      this.statusCode = status;
      Object.assign(this.headers, headers);
      this.headersSent = true;
      return this;
    },
    end(chunk) {
      this.body = chunk === undefined ? null :
        (Buffer.isBuffer(chunk) ? Buffer.from(chunk) : Buffer.from(String(chunk)));
      this.writableEnded = true;
    },
  };
}

async function invokePath(handler, path, {
  method = "GET",
  headers = {},
  body,
} = {}) {
  const req = {
    method,
    headers,
    url: path,
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(body, "utf8");
    },
  };
  const res = makeResponse();
  const handled = await handler.handle(
    req,
    res,
    new URL(STAGING_RESOURCE_ORIGIN + path),
  );
  return {
    handled,
    status: res.statusCode,
    headers: res.headers,
    body: res.body,
    text: res.body ? res.body.toString("utf8") : "",
  };
}

function formsIn(html) {
  const blocks = html.match(/<form[\s\S]*?<\/form>/g) ?? [];
  return blocks.map(block => ({
    csrf: /name="csrf" value="([^"]+)"/.exec(block)?.[1],
    handle: /name="handle" value="([^"]+)"/.exec(block)?.[1],
  }));
}

function formFor(html, handle) {
  const form = formsIn(html).find(candidate => candidate.handle === handle);
  assert.ok(form, "expected a confirmation form for " + handle);
  assert.match(form.csrf, /^v1\.[0-9]{1,12}\.[A-Za-z0-9_-]{43}$/);
  return form;
}

function confirmHeaders(cookie, overrides = {}) {
  return {
    cookie,
    origin: STAGING_RESOURCE_ORIGIN,
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "navigate",
    "content-type": "application/x-www-form-urlencoded",
    ...overrides,
  };
}

function formBody(form, extra = {}) {
  return new URLSearchParams({
    csrf: form.csrf,
    handle: form.handle,
    ...extra,
  }).toString();
}

async function pendingPage(handler, cookie) {
  return invokePath(handler, PRIVATE_PLAYER_PENDING_PATH, {
    headers: { cookie },
  });
}

async function confirm(handler, cookie, form, overrides = {}) {
  return invokePath(handler, PRIVATE_PLAYER_CONFIRM_PATH, {
    method: "POST",
    headers: confirmHeaders(cookie, overrides.headers),
    body: overrides.body ?? formBody(form),
  });
}

test("MCP initiate/status remain nonbillable and the owner player sees exact proposals", async () => {
  resetClock();
  const h = makeHarness();
  const firstText = "first explicit proposal";
  const retryText = "automatic retry proposal";
  const first = await h.broker.initiate({
    trustedRequest: trustedRequest(),
    text: firstText,
  });
  const retry = await h.broker.initiate({
    trustedRequest: trustedRequest(),
    text: retryText,
  });
  assert.equal(first.billable, false);
  assert.equal(retry.billable, false);
  assert.notEqual(first.handle, retry.handle);
  assert.equal(h.providerArgs.length, 0);
  assert.deepEqual(h.paidStore.calls, []);

  const status = await h.broker.status({
    trustedRequest: trustedRequest(),
    handle: first.handle,
  });
  assert.equal(status.status, P2_OPERATION_STATES.PENDING_CONFIRMATION);
  assert.equal(status.billable, false);
  assert.doesNotMatch(JSON.stringify(status), new RegExp(PRINCIPAL));
  assert.doesNotMatch(JSON.stringify(status), new RegExp(firstText));

  const owner = await pendingPage(h.handler, sessionCookie(PRINCIPAL));
  assert.equal(owner.status, 200);
  assert.match(owner.headers["Content-Security-Policy"], /form-action 'self'/);
  assert.match(owner.headers["Content-Security-Policy"], /default-src 'none'/);
  assert.equal(owner.text.includes(firstText), true);
  assert.equal(owner.text.includes(retryText), true);
  assert.equal(owner.text.includes("消耗 1 次每日语音额度"), true);
  assert.equal(owner.text.includes("可能按既有第三方服务条款产生费用"), true);
  assert.equal(formsIn(owner.text).length, 2);

  const other = await pendingPage(h.handler, sessionCookie(OTHER_PRINCIPAL));
  assert.equal(other.status, 200);
  assert.equal(other.text.includes(firstText), false);
  assert.equal(other.text.includes(retryText), false);
  assert.equal(formsIn(other.text).length, 0);
  assert.equal(h.providerArgs.length, 0);
  assert.deepEqual(h.paidStore.calls, []);
});

test("same canonical principal crosses MCP JWT to player session and one explicit POST bills once", async () => {
  resetClock();
  const h = makeHarness();
  const text = "one owner-visible explicit confirmation";
  const pending = await h.broker.initiate({
    trustedRequest: trustedRequest({ subject: SUBJECT }),
    text,
  });
  const cookie = sessionCookie(PRINCIPAL);
  const page = await pendingPage(h.handler, cookie);
  const form = formFor(page.text, pending.handle);

  const first = await confirm(h.handler, cookie, form);
  assert.equal(first.status, 303);
  assert.equal(first.headers.Location, PRIVATE_PLAYER_PENDING_PATH + "?result=completed");
  assert.equal(h.providerArgs.length, 1);
  assert.deepEqual(h.paidStore.calls, ["reserve", "issue", "consume"]);
  assert.equal(h.backend.rows.has(PRINCIPAL), true);

  const status = await h.broker.status({
    trustedRequest: trustedRequest(),
    handle: pending.handle,
  });
  assert.equal(status.status, "completed");
  assert.equal(status.ready, true);

  const replay = await confirm(h.handler, cookie, form);
  assert.equal(replay.status, 303);
  assert.equal(h.providerArgs.length, 1);
  assert.deepEqual(h.paidStore.calls, ["reserve", "issue", "consume"]);
  const after = await pendingPage(h.handler, cookie);
  assert.equal(after.text.includes(text), false);
});

test("missing, tampered and duplicate player sessions fail closed before billing", async () => {
  resetClock();
  const h = makeHarness();
  const pending = await h.broker.initiate({
    trustedRequest: trustedRequest(),
    text: "session integrity is required",
  });
  const cookie = sessionCookie(PRINCIPAL);
  const form = formFor((await pendingPage(h.handler, cookie)).text, pending.handle);

  const tampered = cookie.slice(0, -1) + (cookie.endsWith("A") ? "B" : "A");
  for (const headers of [
    { cookie: undefined },
    { cookie: tampered },
    { cookie: cookie + "; " + cookie },
    { cookie: sessionCookie(PRINCIPAL, { ttlSeconds: -1 }) },
  ]) {
    const response = await invokePath(h.handler, PRIVATE_PLAYER_CONFIRM_PATH, {
      method: "POST",
      headers: confirmHeaders(headers.cookie),
      body: formBody(form),
    });
    assert.equal(response.status, 401);
    assert.deepEqual(JSON.parse(response.text), { error: "login_required" });
  }
  assert.equal(h.providerArgs.length, 0);
  assert.deepEqual(h.paidStore.calls, []);
});

test("CSRF, Origin, fetch metadata, content type and form shape are fail-closed", async () => {
  resetClock();
  const h = makeHarness();
  const first = await h.broker.initiate({
    trustedRequest: trustedRequest(),
    text: "first proposal token",
  });
  const second = await h.broker.initiate({
    trustedRequest: trustedRequest(),
    text: "second proposal token",
  });
  const other = await h.broker.initiate({
    trustedRequest: trustedRequest({ subject: OTHER_SUBJECT }),
    text: "other user token",
  });
  const cookie = sessionCookie(PRINCIPAL);
  const otherCookie = sessionCookie(OTHER_PRINCIPAL);
  const page = await pendingPage(h.handler, cookie);
  const firstForm = formFor(page.text, first.handle);
  const secondForm = formFor(page.text, second.handle);
  const otherPage = await pendingPage(h.handler, otherCookie);
  const otherForm = formFor(otherPage.text, other.handle);

  const cases = [
    { expected: 403, form: { ...firstForm, csrf: otherForm.csrf } },
    { expected: 403, form: { ...firstForm, csrf: secondForm.csrf } },
    { expected: 403, form: { ...firstForm, csrf: "v1.9999999999." + "A".repeat(43) } },
    { expected: 400, form: { csrf: firstForm.csrf, handle: firstForm.handle }, extra: { text: "caller text" } },
    { expected: 400, form: { csrf: firstForm.csrf, handle: firstForm.handle }, body: "csrf=" + encodeURIComponent(firstForm.csrf) },
    { expected: 403, form: firstForm, headers: { origin: "https://wrong.invalid" } },
    { expected: 403, form: firstForm, headers: { "sec-fetch-site": "cross-site" } },
    { expected: 403, form: firstForm, headers: { "sec-fetch-mode": "cors" } },
    { expected: 415, form: firstForm, headers: { "content-type": "application/json" } },
    { expected: 413, form: firstForm, body: "x=" + "a".repeat(5000) },
  ];
  for (const item of cases) {
    const response = await invokePath(h.handler, PRIVATE_PLAYER_CONFIRM_PATH, {
      method: "POST",
      headers: confirmHeaders(cookie, item.headers),
      body: item.body ?? formBody(item.form, item.extra),
    });
    assert.equal(response.status, item.expected, JSON.stringify(item));
    assert.equal(response.text.includes(PRINCIPAL), false);
  }
  assert.equal(h.providerArgs.length, 0);
  assert.deepEqual(h.paidStore.calls, []);
});

test("foreign, forged and expired handles never reach quota or provider", async () => {
  resetClock();
  const h = makeHarness({ operationTtlMs: 1_000 });
  const pending = await h.broker.initiate({
    trustedRequest: trustedRequest(),
    text: "owner-only expiring proposal",
  });
  const cookie = sessionCookie(PRINCIPAL);
  const form = formFor((await pendingPage(h.handler, cookie)).text, pending.handle);

  const foreign = await confirm(h.handler, sessionCookie(OTHER_PRINCIPAL), form);
  assert.equal(foreign.status, 404);
  const forged = await confirm(h.handler, cookie, {
    ...form,
    handle: "Z".repeat(43),
  });
  assert.equal(forged.status, 404);
  assert.equal(h.providerArgs.length, 0);

  currentMs += 1_001;
  const expired = await confirm(h.handler, cookie, form);
  assert.equal(expired.status, 410);
  assert.deepEqual(JSON.parse(expired.text), { error: "proposal_expired" });
  const page = await pendingPage(h.handler, cookie);
  assert.equal(page.text.includes("owner-only expiring proposal"), false);
  assert.equal(h.providerArgs.length, 0);
  assert.deepEqual(h.paidStore.calls, []);
});

test("CSRF expires independently while the pending operation remains valid", async () => {
  resetClock();
  const h = makeHarness({ operationTtlMs: 15 * 60 * 1000 });
  const pending = await h.broker.initiate({
    trustedRequest: trustedRequest(),
    text: "csrf expires before proposal",
  });
  const cookie = sessionCookie(PRINCIPAL);
  const form = formFor((await pendingPage(h.handler, cookie)).text, pending.handle);
  currentMs += 5 * 60 * 1000 + 1_000;

  const response = await confirm(h.handler, cookie, form);
  assert.equal(response.status, 403);
  assert.deepEqual(JSON.parse(response.text), { error: "confirmation_forbidden" });
  assert.equal(h.providerArgs.length, 0);
  assert.deepEqual(h.paidStore.calls, []);
});

test("concurrent explicit confirmations produce one provider attempt and one safe conflict", async () => {
  resetClock();
  let releaseProvider;
  let markProviderStarted;
  const providerStarted = new Promise(resolve => { markProviderStarted = resolve; });
  const providerRelease = new Promise(resolve => { releaseProvider = resolve; });
  const h = makeHarness({
    synthesize: async () => {
      markProviderStarted();
      await providerRelease;
      return { audio: Buffer.from(FIXTURE) };
    },
  });
  const pending = await h.broker.initiate({
    trustedRequest: trustedRequest(),
    text: "concurrent explicit click",
  });
  const cookie = sessionCookie(PRINCIPAL);
  const form = formFor((await pendingPage(h.handler, cookie)).text, pending.handle);

  const first = confirm(h.handler, cookie, form);
  await providerStarted;
  const second = await confirm(h.handler, cookie, form);
  assert.equal(second.status, 409);
  assert.deepEqual(JSON.parse(second.text), { error: "confirmation_in_progress" });
  assert.equal(h.providerArgs.length, 1);

  releaseProvider();
  const completed = await first;
  assert.equal(completed.status, 303);
  assert.equal(h.providerArgs.length, 1);
  assert.deepEqual(h.paidStore.calls, ["reserve", "issue", "consume"]);
});

test("unknown provider outcome is terminal, unrefunded and never retried by a second POST", async () => {
  resetClock();
  const h = makeHarness({
    synthesize: async () => { throw new Error("provider_network_unknown"); },
  });
  const pending = await h.broker.initiate({
    trustedRequest: trustedRequest(),
    text: "unknown outcome must stay unknown",
  });
  const cookie = sessionCookie(PRINCIPAL);
  const form = formFor((await pendingPage(h.handler, cookie)).text, pending.handle);

  const first = await confirm(h.handler, cookie, form);
  assert.equal(first.status, 409);
  assert.deepEqual(JSON.parse(first.text), { error: "provider_outcome_unknown" });
  assert.equal(h.providerArgs.length, 1);
  assert.deepEqual(h.paidStore.calls, ["reserve", "issue", "consume"]);

  const retry = await confirm(h.handler, cookie, form);
  assert.equal(retry.status, 409);
  assert.equal(h.providerArgs.length, 1);
  assert.deepEqual(h.paidStore.calls, ["reserve", "issue", "consume"]);
  const status = await h.broker.status({
    trustedRequest: trustedRequest(),
    handle: pending.handle,
  });
  assert.equal(status.status, "unknown");
});

test("lost response, reconnect and new handler/broker replay completed with no second provider call", async () => {
  resetClock();
  const h = makeHarness();
  const pending = await h.broker.initiate({
    trustedRequest: trustedRequest(),
    text: "lost response restart replay",
  });
  const cookie = sessionCookie(PRINCIPAL);
  const form = formFor((await pendingPage(h.handler, cookie)).text, pending.handle);
  assert.equal((await confirm(h.handler, cookie, form)).status, 303);
  assert.equal(h.providerArgs.length, 1);

  const restarted = h.makeHandler();
  const replay = await confirm(restarted, cookie, form);
  assert.equal(replay.status, 303);
  assert.equal(h.providerArgs.length, 1);
  assert.deepEqual(h.paidStore.calls, ["reserve", "issue", "consume"]);
});

test("two proposals are independent; only explicit confirmation of each can bill", async () => {
  resetClock();
  const h = makeHarness();
  const first = await h.broker.initiate({
    trustedRequest: trustedRequest(),
    text: "independent first proposal",
  });
  const second = await h.broker.initiate({
    trustedRequest: trustedRequest(),
    text: "independent second proposal",
  });
  const cookie = sessionCookie(PRINCIPAL);
  const page = await pendingPage(h.handler, cookie);
  const firstForm = formFor(page.text, first.handle);
  const secondForm = formFor(page.text, second.handle);

  assert.equal((await confirm(h.handler, cookie, firstForm)).status, 303);
  assert.equal(h.providerArgs.length, 1);
  const remaining = await pendingPage(h.handler, cookie);
  assert.equal(remaining.text.includes("independent first proposal"), false);
  assert.equal(remaining.text.includes("independent second proposal"), true);
  assert.equal(formsIn(remaining.text).length, 1);

  assert.equal((await confirm(h.handler, cookie, secondForm)).status, 303);
  assert.equal(h.providerArgs.length, 2);
  assert.deepEqual(h.paidStore.calls, [
    "reserve", "issue", "consume",
    "reserve", "issue", "consume",
  ]);
});

test("page escapes owner text and contains no script, automatic submit or refresh", async () => {
  resetClock();
  const h = makeHarness();
  const text = '<script>alert("x")</script> & proposal';
  await h.broker.initiate({ trustedRequest: trustedRequest(), text });
  const page = await pendingPage(h.handler, sessionCookie(PRINCIPAL));

  assert.equal(page.status, 200);
  assert.equal(page.text.includes(text), false);
  assert.equal(page.text.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; proposal"), true);
  assert.equal(/<script\b/i.test(page.text), false);
  assert.equal(/http-equiv=["']?refresh/i.test(page.text), false);
  assert.equal(/\bonload\s*=|\bwindow\.|\.submit\s*\(/i.test(page.text), false);
  assert.equal(page.text.includes("确认生成"), true);
  assert.equal(page.text.includes("不自动提交或自动刷新"), true);
  assert.equal(page.text.includes(PRINCIPAL), false);
  assert.equal(page.text.includes("operationId"), false);
});

test("confirmation module stays unmounted, has no cloud/provider I/O and preserves P1 playback", async () => {
  const source = await readFile(
    new URL("../src/v1-p2-player-confirmation.js", import.meta.url),
    "utf8",
  );
  const stable = await readFile(
    new URL("../src/v1-p2-stable-operation-identity.js", import.meta.url),
    "utf8",
  );
  const player = await readFile(
    new URL("../src/private-web-player.js", import.meta.url),
    "utf8",
  );
  const server = await readFile(new URL("../server.js", import.meta.url), "utf8");
  const stagingMcp = await readFile(
    new URL("../src/staging-authenticated-mcp.js", import.meta.url),
    "utf8",
  );
  const ui = await readFile(
    new URL("../ui/private-player.html", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(server, /v1-p2-player-confirmation|v1-p2-stable-operation-identity/);
  assert.doesNotMatch(stagingMcp, /v1-p2-player-confirmation|v1-p2-stable-operation-identity/);
  assert.doesNotMatch(source, /\bfetch\s*\(|cloudflare|d1-http|qiniu|MINIMAX_ENDPOINT|apiKey|console\./i);
  assert.doesNotMatch(stable, /\bfetch\s*\(|cloudflare|d1-http|qiniu|MINIMAX_ENDPOINT|apiKey|console\./i);
  assert.match(player, /const FIXED_WAV=Buffer\.from/);
  assert.match(player, /PRIVATE_PLAYER_AUDIO_PATH="\/player\/audio"/);
  assert.match(ui, /audio\.src="\/player\/audio"/);
  assert.doesNotMatch(ui, /\/player\/confirm/);
});
