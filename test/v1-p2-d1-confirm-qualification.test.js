/**
 * Voice V1 P2 D1 explicit-confirmation qualification, offline only.
 *
 * node:sqlite is used here ONLY as a local SQLite semantic model. It proves the
 * SQL, trigger, CAS and rollback behavior that the code relies on. It is NOT
 * Cloudflare D1, does not prove D1 latency/concurrency/HTTP behavior, and
 * never counts as real cloud qualification.
 *
 * node:sqlite exists in Node 24.3+ without a flag. On older Node the SQL tests
 * are explicitly skipped rather than replaced with a fake success.
 */
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
import { createP2PrivateResultStore } from "../src/p2-private-result-store.js";
import {
  D1_P2_CONFIRMATION_SQL,
  createD1P2ConfirmationOperationStore,
} from "../src/d1-p2-confirmation-operation-store.js";
import { createV1P2D1Confirmation } from "../src/v1-p2-d1-confirmation.js";
import {
  PRIVATE_PLAYER_CONFIRM_PATH,
  PRIVATE_PLAYER_PENDING_PATH,
} from "../src/v1-p2-player-confirmation.js";
import { PRIVATE_PLAYER_SESSION_COOKIE } from "../src/private-web-player.js";

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
  : "node:sqlite semantic qualification requires Node 24 (run this suite on Node 24)";

const NOW_MS = Date.parse("2026-10-27T00:00:00.000Z");
const SESSION_SECRET = "offline-p2-d1-confirmation-secret-0123456789abcdef";
const SUBJECT = "auth0|p2-d1-confirm-user";
const OTHER_SUBJECT = "auth0|p2-d1-confirm-other";
const VOICE_ID = "voice_p2_d1_confirm_001";
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
  kid: "p2-d1-confirm-key",
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

function signedToken({ subject = SUBJECT } = {}) {
  const nowSeconds = Math.floor(currentMs / 1000);
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
    iat: nowSeconds - 10,
    exp: nowSeconds + 300,
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

function makeResultBackend({ failPut = false } = {}) {
  const rows = new Map();
  return {
    rows,
    async putLatest(record) {
      if (failPut) throw new Error("fixture_put_failure");
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

const MIGRATIONS = [
  new URL("../db/d1/001_paid_voice_reservations.sql", import.meta.url),
  new URL("../db/d1/002_paid_voice_grants.sql", import.meta.url),
  new URL("../db/d1/004_paid_voice_confirmation_operations.sql", import.meta.url),
];
let migrationPromise = null;

function loadMigrations() {
  migrationPromise ??= Promise.all(MIGRATIONS.map(path => readFile(path, "utf8")));
  return migrationPromise;
}

function createLocalSqliteClient(db) {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      const statement = db.prepare(sql);
      return statement.all(...params);
    },
  };
}

async function makeHarness({
  maximumDailyCalls = 3,
  synthesize = async () => ({ audio: Buffer.from(FIXTURE) }),
  backend = makeResultBackend(),
  operationTtlMs = 60_000,
} = {}) {
  const migrations = await loadMigrations();
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const sql of migrations) db.exec(sql);
  const client = createLocalSqliteClient(db);
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
  const makeConfirmation = () => createV1P2D1Confirmation({
    client,
    maximumDailyCalls,
    voiceId: VOICE_ID,
    synthesize: provider,
    privateResultStore,
    mcpResolveVerifiedPrincipal: makeVerifier(),
    sessionSecret: SESSION_SECRET,
    clock: () => new Date(currentMs),
    operationTtlMs,
  });
  return {
    db,
    client,
    confirmation: makeConfirmation(),
    makeConfirmation,
    providerArgs,
    backend,
    privateResultStore,
  };
}

async function initiate(h, text, options = {}) {
  return h.confirmation.broker.initiate({
    trustedRequest: trustedRequest(options),
    text,
  });
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

async function invokePath(handler, path, { method = "GET", headers = {}, body } = {}) {
  const req = {
    method,
    headers,
    url: path,
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(body, "utf8");
    },
  };
  const res = makeResponse();
  const handled = await handler.handle(req, res, new URL(STAGING_RESOURCE_ORIGIN + path));
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
  return invokePath(handler, PRIVATE_PLAYER_PENDING_PATH, { headers: { cookie } });
}

async function confirm(handler, cookie, form, overrides = {}) {
  return invokePath(handler, PRIVATE_PLAYER_CONFIRM_PATH, {
    method: "POST",
    headers: confirmHeaders(cookie, overrides.headers),
    body: overrides.body ?? formBody(form),
  });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function countRows(db) {
  const reservations = db.prepare("SELECT COUNT(*) AS c FROM paid_voice_reservations").get().c;
  const grants = db.prepare("SELECT COUNT(*) AS c FROM paid_voice_grants").get().c;
  const consumed = db.prepare(
    "SELECT COUNT(*) AS c FROM paid_voice_grants WHERE state = 'consumed'",
  ).get().c;
  return { reservations, grants, consumed };
}

test("004 migration is additive and installs the single-statement admission trigger",
  { skip: sqliteSkip }, async () => {
    const h = await makeHarness();
    const schema = await h.confirmation.operationStore.verifySchema();
    assert.deepEqual(schema, {
      ok: true,
      singleStatementAdmission: true,
      foreignKeys: true,
    });
    const objects = h.db.prepare(`
      SELECT type, name, sql FROM sqlite_master
      WHERE name IN (
        'paid_voice_confirmation_operations',
        'paid_voice_confirmation_admit',
        'paid_voice_confirmation_operations_pending',
        'paid_voice_confirmation_operations_day'
      )`).all();
    const byName = new Map(objects.map(row => [row.name, row]));
    assert.equal(byName.get("paid_voice_confirmation_operations")?.type, "table");
    assert.equal(byName.get("paid_voice_confirmation_admit")?.type, "trigger");
    const trigger = byName.get("paid_voice_confirmation_admit")?.sql ?? "";
    assert.match(trigger, /RAISE\(ABORT, 'quota_denied'\)/);
    assert.match(trigger, /paid_voice_reservations/);
    assert.match(trigger, /paid_voice_grants/);
    assert.equal(
      h.db.prepare("SELECT COUNT(*) AS c FROM sqlite_master WHERE name = 'paid_voice_operations'")
        .get().c,
      0,
    );
    const migration = await readFile(MIGRATIONS[2], "utf8");
    assert.doesNotMatch(migration, /ALTER TABLE\s+paid_voice_(reservations|grants)/i);
    assert.match(migration, /CREATE TRIGGER IF NOT EXISTS paid_voice_confirmation_admit/);
  });

test("D1 store requires a single-statement query client and never uses batch",
  { skip: sqliteSkip }, async () => {
    assert.throws(
      () => createD1P2ConfirmationOperationStore({ client: null }),
      /operation_store_unavailable/,
    );
    assert.throws(
      () => createD1P2ConfirmationOperationStore({ client: { batch: async () => [] } }),
      /operation_store_unavailable/,
    );
    const h = await makeHarness();
    assert.equal(typeof h.client.batch, "undefined");
    assert.equal(h.client.calls.length, 0);
    assert.doesNotMatch(D1_P2_CONFIRMATION_SQL.claim, /;/);
    assert.equal((D1_P2_CONFIRMATION_SQL.claim.match(/\bUPDATE\b/g) ?? []).length, 1);
    const source = await readFile(
      new URL("../src/d1-p2-confirmation-operation-store.js", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(source, /\.batch\s*\(/);
  });

test("MCP initiate/status are nonbillable and never create quota rows or expose text",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const h = await makeHarness();
    const text = "The exact proposal text";
    const pending = await initiate(h, text);
    const status = await h.confirmation.broker.status({
      trustedRequest: trustedRequest(),
      handle: pending.handle,
    });
    assert.equal(pending.billable, false);
    assert.deepEqual(Object.keys(pending).sort(), ["billable", "expiresAt", "handle", "status"]);
    assert.equal(status.status, "pending_confirmation");
    assert.equal(h.providerArgs.length, 0);
    const counts = countRows(h.db);
    assert.equal(counts.reservations, 0);
    assert.equal(counts.grants, 0);
    const row = h.db.prepare(
      "SELECT text, state, day_utc, request_id, grant_id FROM paid_voice_confirmation_operations WHERE handle = ?",
    ).get(pending.handle);
    assert.equal(row.text, text);
    assert.equal(row.state, "pending_confirmation");
    assert.equal(row.day_utc, null);
    assert.equal(row.request_id, null);
    assert.equal(row.grant_id, null);
  });

test("owner player explicit confirm performs one admission and one provider attempt",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const h = await makeHarness();
    const text = "Explicit owner text";
    const pending = await initiate(h, text);
    const cookie = sessionCookie(PRINCIPAL);
    const page = await pendingPage(h.confirmation.playerHandler, cookie);
    assert.equal(page.status, 200);
    assert.ok(page.text.includes(text), "pending page must show the exact owner text");
    const form = formFor(page.text, pending.handle);

    const response = await confirm(h.confirmation.playerHandler, cookie, form);
    assert.equal(response.status, 303);
    assert.equal(response.headers.Location, PRIVATE_PLAYER_PENDING_PATH + "?result=completed");
    assert.equal(
      h.client.calls.filter(call => call.sql === D1_P2_CONFIRMATION_SQL.claim).length,
      1,
      "admission must be exactly one D1 statement",
    );
    assert.equal(h.providerArgs.length, 1);
    assert.equal(h.providerArgs[0].text, text);
    assert.equal(h.providerArgs[0].voiceId, VOICE_ID);
    assert.equal(h.providerArgs[0].modelId, "speech-2.8-hd");

    const operation = h.db.prepare(
      "SELECT operation_id, state, day_utc FROM paid_voice_confirmation_operations WHERE handle = ?",
    ).get(pending.handle);
    assert.equal(operation.state, "completed");
    const reservation = h.db.prepare(
      "SELECT request_id, principal, slot FROM paid_voice_reservations",
    ).get();
    assert.equal(reservation.request_id, operation.operation_id);
    assert.equal(reservation.principal, PRINCIPAL);
    assert.equal(reservation.slot, 1);
    const grant = h.db.prepare("SELECT request_id, state FROM paid_voice_grants").get();
    assert.equal(grant.request_id, operation.operation_id);
    assert.equal(grant.state, "consumed");

    const saved = await h.privateResultStore.getLatest({ principal: PRINCIPAL });
    assert.equal(Buffer.compare(saved.audio, FIXTURE), 0);
    const status = await h.confirmation.broker.status({
      trustedRequest: trustedRequest(),
      handle: pending.handle,
    });
    assert.deepEqual(status, { status: "completed", ready: true, retryable: false });
  });

test("missing session, Origin, CSRF, extra form fields and cross-user handles fail before admission",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const h = await makeHarness();
    const text = "Guarded proposal";
    const pending = await initiate(h, text);
    const ownerCookie = sessionCookie(PRINCIPAL);
    const otherCookie = sessionCookie(OTHER_PRINCIPAL);
    const page = await pendingPage(h.confirmation.playerHandler, ownerCookie);
    const form = formFor(page.text, pending.handle);

    const responses = [];
    responses.push(await confirm(h.confirmation.playerHandler, "", form));
    responses.push(await confirm(h.confirmation.playerHandler, ownerCookie, form, {
      headers: { origin: "https://evil.example" },
    }));
    responses.push(await confirm(h.confirmation.playerHandler, ownerCookie, {
      ...form,
      csrf: "v1.9999999999." + "A".repeat(43),
    }));
    responses.push(await confirm(h.confirmation.playerHandler, ownerCookie, form, {
      body: formBody(form, { text: "injected" }),
    }));
    responses.push(await confirm(h.confirmation.playerHandler, otherCookie, form));

    assert.deepEqual(responses.map(response => response.status), [401, 403, 403, 400, 404]);
    assert.equal(h.providerArgs.length, 0);
    const counts = countRows(h.db);
    assert.equal(counts.reservations, 0);
    assert.equal(counts.grants, 0);
    const row = h.db.prepare(
      "SELECT state, day_utc, request_id, grant_id FROM paid_voice_confirmation_operations",
    ).get();
    assert.equal(row.state, "pending_confirmation");
    assert.equal(row.day_utc, null);
    assert.equal(row.request_id, null);
    assert.equal(row.grant_id, null);
  });

test("concurrent explicit confirmations allow one admission and one provider attempt",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const gate = deferred();
    let signalStarted;
    const started = new Promise(resolve => {
      signalStarted = resolve;
    });
    const h = await makeHarness({
      synthesize: async () => {
        signalStarted();
        await gate.promise;
        return { audio: Buffer.from(FIXTURE) };
      },
    });
    const pending = await initiate(h, "Concurrent text");
    const cookie = sessionCookie(PRINCIPAL);
    const page = await pendingPage(h.confirmation.playerHandler, cookie);
    const form = formFor(page.text, pending.handle);

    const first = confirm(h.confirmation.playerHandler, cookie, form);
    await started;
    const second = await confirm(h.confirmation.playerHandler, cookie, form);
    assert.equal(second.status, 409);
    gate.resolve();
    const firstResponse = await first;
    assert.equal(firstResponse.status, 303);
    assert.equal(h.providerArgs.length, 1);
    const counts = countRows(h.db);
    assert.equal(counts.reservations, 1);
    assert.equal(counts.grants, 1);
    assert.equal(counts.consumed, 1);
  });

test("a second click after completion replays completed with no additional provider attempt",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const h = await makeHarness();
    const pending = await initiate(h, "Replay text");
    const cookie = sessionCookie(PRINCIPAL);
    const page = await pendingPage(h.confirmation.playerHandler, cookie);
    const form = formFor(page.text, pending.handle);

    assert.equal((await confirm(h.confirmation.playerHandler, cookie, form)).status, 303);
    assert.equal((await confirm(h.confirmation.playerHandler, cookie, form)).status, 303);
    assert.equal(h.providerArgs.length, 1);
    const counts = countRows(h.db);
    assert.equal(counts.reservations, 1);
    assert.equal(counts.grants, 1);
    assert.equal(counts.consumed, 1);
  });

test("restart replays completed; a committed claim before provider stays outcome-pending",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const h = await makeHarness();
    const cookie = sessionCookie(PRINCIPAL);
    const firstPending = await initiate(h, "Restart replay text");
    const firstPage = await pendingPage(h.confirmation.playerHandler, cookie);
    const firstForm = formFor(firstPage.text, firstPending.handle);
    assert.equal((await confirm(h.confirmation.playerHandler, cookie, firstForm)).status, 303);

    const restarted = h.makeConfirmation();
    assert.equal((await confirm(restarted.playerHandler, cookie, firstForm)).status, 303);
    assert.equal(h.providerArgs.length, 1);

    const crashPending = await initiate(h, "Crash before provider text");
    const crashPage = await pendingPage(h.confirmation.playerHandler, cookie);
    const crashForm = formFor(crashPage.text, crashPending.handle);
    const record = await h.confirmation.operationStore.get({
      principal: PRINCIPAL,
      handle: crashPending.handle,
    });
    const claimed = await h.confirmation.operationStore.claim({
      principal: PRINCIPAL,
      handle: crashPending.handle,
      textDigest: record.textDigest,
      textBytes: record.textBytes,
      now: currentMs,
    });
    assert.equal(claimed.claimed, true);

    const afterRestart = h.makeConfirmation();
    const blocked = await confirm(afterRestart.playerHandler, cookie, crashForm);
    assert.equal(blocked.status, 409);
    assert.equal(h.providerArgs.length, 1);
    const counts = countRows(h.db);
    assert.equal(counts.reservations, 2);
    assert.equal(counts.consumed, 2);
    const crashRow = h.db.prepare(
      "SELECT state FROM paid_voice_confirmation_operations WHERE handle = ?",
    ).get(crashPending.handle);
    assert.equal(crashRow.state, "provider_pending");
  });

test("daily quota is enforced inside the admission statement and resets on the next UTC day",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const h = await makeHarness();
    const cookie = sessionCookie(PRINCIPAL);
    for (let index = 0; index < 3; index++) {
      const pending = await initiate(h, "Quota text " + index);
      const page = await pendingPage(h.confirmation.playerHandler, cookie);
      const form = formFor(page.text, pending.handle);
      assert.equal((await confirm(h.confirmation.playerHandler, cookie, form)).status, 303);
    }
    assert.equal(h.providerArgs.length, 3);
    let counts = countRows(h.db);
    assert.equal(counts.reservations, 3);
    assert.equal(counts.consumed, 3);

    const fourth = await initiate(h, "Quota text 4");
    const fourthPage = await pendingPage(h.confirmation.playerHandler, cookie);
    const fourthForm = formFor(fourthPage.text, fourth.handle);
    const denied = await confirm(h.confirmation.playerHandler, cookie, fourthForm);
    assert.equal(denied.status, 409);
    assert.equal(h.providerArgs.length, 3);
    counts = countRows(h.db);
    assert.equal(counts.reservations, 3);
    assert.equal(counts.grants, 3);
    const fourthRow = h.db.prepare(
      "SELECT state, day_utc, request_id, grant_id FROM paid_voice_confirmation_operations WHERE handle = ?",
    ).get(fourth.handle);
    assert.equal(fourthRow.state, "pending_confirmation");
    assert.equal(fourthRow.day_utc, null);
    assert.equal(fourthRow.request_id, null);
    assert.equal(fourthRow.grant_id, null);

    currentMs += 24 * 60 * 60 * 1000;
    const nextCookie = sessionCookie(PRINCIPAL);
    const next = await initiate(h, "Next day text");
    const nextPage = await pendingPage(h.confirmation.playerHandler, nextCookie);
    const nextForm = formFor(nextPage.text, next.handle);
    assert.equal((await confirm(h.confirmation.playerHandler, nextCookie, nextForm)).status, 303);
    assert.equal(h.providerArgs.length, 4);
    const nextOperation = h.db.prepare(
      "SELECT operation_id FROM paid_voice_confirmation_operations WHERE handle = ?",
    ).get(next.handle);
    const nextReservation = h.db.prepare(
      "SELECT slot, day_utc FROM paid_voice_reservations WHERE request_id = ?",
    ).get(nextOperation.operation_id);
    assert.equal(nextReservation.slot, 1);
    assert.equal(nextReservation.day_utc, new Date(currentMs).toISOString().slice(0, 10));
  });

test("player pending pages are owner-scoped and quota is per canonical principal",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const h = await makeHarness();
    const first = await initiate(h, "Owner A text");
    const ownerCookie = sessionCookie(PRINCIPAL);
    const ownerPage = await pendingPage(h.confirmation.playerHandler, ownerCookie);
    assert.equal((await confirm(h.confirmation.playerHandler, ownerCookie,
      formFor(ownerPage.text, first.handle))).status, 303);

    const second = await initiate(h, "Owner A second text");
    const otherPending = await h.confirmation.broker.initiate({
      trustedRequest: trustedRequest({ subject: OTHER_SUBJECT }),
      text: "Owner B text",
    });
    const otherCookie = sessionCookie(OTHER_PRINCIPAL);
    const aPage = await pendingPage(h.confirmation.playerHandler, ownerCookie);
    const bPage = await pendingPage(h.confirmation.playerHandler, otherCookie);
    assert.ok(aPage.text.includes("Owner A second text"));
    assert.ok(!aPage.text.includes("Owner B text"));
    assert.ok(bPage.text.includes("Owner B text"));
    assert.ok(!bPage.text.includes("Owner A second text"));
    assert.ok(!bPage.text.includes(second.handle));

    const otherForm = formFor(bPage.text, otherPending.handle);
    assert.equal((await confirm(h.confirmation.playerHandler, otherCookie, otherForm)).status, 303);
    const otherReservation = h.db.prepare(
      "SELECT slot FROM paid_voice_reservations WHERE principal = ?",
    ).get(OTHER_PRINCIPAL);
    assert.equal(otherReservation.slot, 1);
  });

test("an expired pending operation is rejected before admission and consumes no quota",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const h = await makeHarness({ operationTtlMs: 1_000 });
    const pending = await initiate(h, "Expired text");
    const cookie = sessionCookie(PRINCIPAL);
    const page = await pendingPage(h.confirmation.playerHandler, cookie);
    const form = formFor(page.text, pending.handle);
    currentMs += 1_001;
    const response = await confirm(h.confirmation.playerHandler, cookie, form);
    assert.equal(response.status, 410);
    assert.equal(h.providerArgs.length, 0);
    const counts = countRows(h.db);
    assert.equal(counts.reservations, 0);
    assert.equal(counts.grants, 0);
    const status = await h.confirmation.broker.status({
      trustedRequest: trustedRequest(),
      handle: pending.handle,
    });
    assert.equal(status.status, "expired");
  });

test("the D1 claim binds the exact text digest and byte count", { skip: sqliteSkip }, async () => {
  resetClock();
  const h = await makeHarness();
  const pending = await initiate(h, "Binding text");
  const record = await h.confirmation.operationStore.get({
    principal: PRINCIPAL,
    handle: pending.handle,
  });
  const wrong = await h.confirmation.operationStore.claim({
    principal: PRINCIPAL,
    handle: pending.handle,
    textDigest: "A".repeat(43),
    textBytes: record.textBytes,
    now: currentMs,
  });
  assert.equal(wrong.claimed, false);
  assert.equal(h.providerArgs.length, 0);
  assert.equal(countRows(h.db).reservations, 0);

  const right = await h.confirmation.operationStore.claim({
    principal: PRINCIPAL,
    handle: pending.handle,
    textDigest: record.textDigest,
    textBytes: record.textBytes,
    now: currentMs,
  });
  assert.equal(right.claimed, true);
  assert.equal(countRows(h.db).reservations, 1);
});

test("unknown provider outcome is terminal unknown, grant consumed and never retried",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const h = await makeHarness({
      synthesize: async () => {
        throw new Error("provider_timeout");
      },
    });
    const pending = await initiate(h, "Provider timeout text");
    const cookie = sessionCookie(PRINCIPAL);
    const page = await pendingPage(h.confirmation.playerHandler, cookie);
    const form = formFor(page.text, pending.handle);
    const first = await confirm(h.confirmation.playerHandler, cookie, form);
    assert.equal(first.status, 409);
    assert.match(first.text, /provider_outcome_unknown/);
    assert.equal(h.providerArgs.length, 1);
    const operation = h.db.prepare(
      "SELECT state FROM paid_voice_confirmation_operations WHERE handle = ?",
    ).get(pending.handle);
    assert.equal(operation.state, "unknown");
    const grant = h.db.prepare("SELECT state FROM paid_voice_grants").get();
    assert.equal(grant.state, "consumed");

    const second = await confirm(h.confirmation.playerHandler, cookie, form);
    assert.equal(second.status, 409);
    assert.equal(h.providerArgs.length, 1);
    assert.equal(countRows(h.db).reservations, 1);
  });

test("private result-store failure is terminal unknown, unrefunded and not retried",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const h = await makeHarness({ backend: makeResultBackend({ failPut: true }) });
    const pending = await initiate(h, "Result store failure text");
    const cookie = sessionCookie(PRINCIPAL);
    const page = await pendingPage(h.confirmation.playerHandler, cookie);
    const form = formFor(page.text, pending.handle);
    const first = await confirm(h.confirmation.playerHandler, cookie, form);
    assert.equal(first.status, 409);
    assert.match(first.text, /provider_outcome_unknown/);
    assert.equal(h.providerArgs.length, 1);
    const operation = h.db.prepare(
      "SELECT state FROM paid_voice_confirmation_operations WHERE handle = ?",
    ).get(pending.handle);
    assert.equal(operation.state, "unknown");

    const second = await confirm(h.confirmation.playerHandler, cookie, form);
    assert.equal(second.status, 409);
    assert.equal(h.providerArgs.length, 1);
    assert.equal(countRows(h.db).consumed, 1);
  });

test("terminal transitions are compare-and-set on the exact operation and handle",
  { skip: sqliteSkip }, async () => {
    resetClock();
    const h = await makeHarness();
    const pending = await initiate(h, "CAS text");
    const record = await h.confirmation.operationStore.get({
      principal: PRINCIPAL,
      handle: pending.handle,
    });
    const claimed = await h.confirmation.operationStore.claim({
      principal: PRINCIPAL,
      handle: pending.handle,
      textDigest: record.textDigest,
      textBytes: record.textBytes,
      now: currentMs,
    });
    assert.equal(claimed.claimed, true);
    const wrongHandle = await h.confirmation.operationStore.markCompleted({
      principal: PRINCIPAL,
      handle: "A".repeat(43),
      operationId: claimed.operationId,
      now: currentMs,
    });
    assert.equal(wrongHandle.updated, false);
    const completed = await h.confirmation.operationStore.markCompleted({
      principal: PRINCIPAL,
      handle: pending.handle,
      operationId: claimed.operationId,
      now: currentMs,
    });
    assert.equal(completed.updated, true);
    const unknownAfterCompleted = await h.confirmation.operationStore.markUnknown({
      principal: PRINCIPAL,
      handle: pending.handle,
      operationId: claimed.operationId,
      now: currentMs,
    });
    assert.equal(unknownAfterCompleted.updated, false);

    const second = await initiate(h, "CAS unknown text");
    const secondRecord = await h.confirmation.operationStore.get({
      principal: PRINCIPAL,
      handle: second.handle,
    });
    const secondClaim = await h.confirmation.operationStore.claim({
      principal: PRINCIPAL,
      handle: second.handle,
      textDigest: secondRecord.textDigest,
      textBytes: secondRecord.textBytes,
      now: currentMs,
    });
    assert.equal(secondClaim.claimed, true);
    const unknown = await h.confirmation.operationStore.markUnknown({
      principal: PRINCIPAL,
      handle: second.handle,
      operationId: secondClaim.operationId,
      now: currentMs,
    });
    assert.equal(unknown.updated, true);
    const completedAfterUnknown = await h.confirmation.operationStore.markCompleted({
      principal: PRINCIPAL,
      handle: second.handle,
      operationId: secondClaim.operationId,
      now: currentMs,
    });
    assert.equal(completedAfterUnknown.updated, false);
  });

test("D1 confirmation code stays unmounted and contains no network, cloud, provider or batch I/O",
  { skip: sqliteSkip }, async () => {
    const server = await readFile(new URL("../server.js", import.meta.url), "utf8");
    const mcp = await readFile(
      new URL("../src/staging-authenticated-mcp.js", import.meta.url),
      "utf8",
    );
    for (const source of [server, mcp]) {
      assert.doesNotMatch(source, /v1-p2-d1-confirmation|d1-p2-confirmation-operation-store/);
      assert.doesNotMatch(source, /v1-p2-player-confirmation|createV1P2StableOperationBroker/);
    }
    const storeSource = await readFile(
      new URL("../src/d1-p2-confirmation-operation-store.js", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(storeSource, /fetch\(|apiToken|MINIMAX|console\.|\.batch\s*\(/);
    const httpSource = await readFile(
      new URL("../src/cloudflare-d1-http.js", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(httpSource, /batch\s*\(/);
    assert.doesNotMatch(D1_P2_CONFIRMATION_SQL.claim, /;/);
    assert.equal((D1_P2_CONFIRMATION_SQL.claim.match(/\bUPDATE\b/g) ?? []).length, 1);
  });

test("D1 qualification closure document records the bounded evidence and remaining gates",
  async () => {
    const doc = await readFile(
      new URL("../docs/v1-closure/V1-P2-D1-CONFIRM-QUALIFICATION-20261027.md", import.meta.url),
      "utf8",
    );
    for (const marker of [
      "COMPLETE",
      "BLOCKED",
      "2/9",
      "A0",
      "A5",
      "004_paid_voice_confirmation_operations.sql",
      "node:sqlite",
      "not Cloudflare D1",
      "quota_denied",
    ]) {
      assert.match(doc, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });
