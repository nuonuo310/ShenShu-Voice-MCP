import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  D1_P2_CONFIRMATION_SQL,
  createD1P2ConfirmationOperationStore,
} from "../src/d1-p2-confirmation-operation-store.js";
import { STAGING_RESOURCE_ORIGIN } from "../src/protected-resource-identity.js";
import {
  P2_OPERATION_ACTION,
  P2_OPERATION_STATES,
  textDigest,
} from "../src/v1-p2-operation-contract.js";
import {
  PRIVATE_TEXT_SEALED_MARKER,
  createPrivateTextSealer,
} from "../src/v1-p2-private-text-sealer.js";

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

const MASTER_KEY = Buffer.from(Array.from({ length: 32 }, (_, index) => index + 1));
const OTHER_KEY = Buffer.from(Array.from({ length: 32 }, (_, index) => index + 65));
const NOW = Date.parse("2026-10-29T00:00:00.000Z");
const TEXT = "沈".repeat(266) + "ab";
const PRINCIPAL = "auth0|sealed-store-owner";
const OTHER_PRINCIPAL = "auth0|sealed-store-other";
const HANDLE = "A".repeat(43);
const OTHER_HANDLE = "B".repeat(43);
const OPERATION_ID = "op_sealed_store_0001";
const OTHER_OPERATION_ID = "op_sealed_store_0002";
const MIGRATIONS = [
  new URL("../db/d1/001_paid_voice_reservations.sql", import.meta.url),
  new URL("../db/d1/002_paid_voice_grants.sql", import.meta.url),
  new URL("../db/d1/004_paid_voice_confirmation_operations.sql", import.meta.url),
];
const SEALING_MIGRATION =
  new URL("../db/d1/005_paid_voice_confirmation_private_text_sealing.sql", import.meta.url);

function sealer(key = MASTER_KEY) {
  return createPrivateTextSealer({ masterKey: key });
}

function record({
  principal = PRINCIPAL,
  handle = HANDLE,
  operationId = OPERATION_ID,
  text = TEXT,
  expiresAt = NOW + 60_000,
} = {}) {
  return Object.freeze({
    version: 1,
    action: P2_OPERATION_ACTION,
    handle,
    operationId,
    principal,
    text,
    textDigest: textDigest(text),
    textBytes: Buffer.byteLength(text, "utf8"),
    origin: STAGING_RESOURCE_ORIGIN,
    state: P2_OPERATION_STATES.PENDING_CONFIRMATION,
    issuedAt: NOW,
    expiresAt,
  });
}

async function fixture({ include005 = true, key = MASTER_KEY } = {}) {
  const migrations = await Promise.all(MIGRATIONS.map(path => readFile(path, "utf8")));
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const migration of migrations) db.exec(migration);
  if (include005) db.exec(await readFile(SEALING_MIGRATION, "utf8"));
  const calls = [];
  const client = {
    calls,
    async query(statement, params = []) {
      calls.push({ sql: statement, params: [...params] });
      return db.prepare(statement).all(...params);
    },
  };
  const textSealer = sealer(key);
  return {
    db,
    client,
    textSealer,
    store: createD1P2ConfirmationOperationStore({
      client,
      textSealer,
    }),
    legacyStore: createD1P2ConfirmationOperationStore({ client }),
  };
}

function rowFor(db, principal = PRINCIPAL, handle = HANDLE) {
  return db.prepare(
    "SELECT * FROM paid_voice_confirmation_operations WHERE principal = ? AND handle = ?",
  ).get(principal, handle);
}

function counts(db) {
  return {
    reservations: db.prepare(
      "SELECT COUNT(*) AS c FROM paid_voice_reservations",
    ).get().c,
    grants: db.prepare(
      "SELECT COUNT(*) AS c FROM paid_voice_grants",
    ).get().c,
  };
}

test("sealed create/get/list stores only marker, envelope and keyed digest",
  { skip: sqliteSkip }, async () => {
    const f = await fixture();
    const input = record();
    assert.deepEqual(await f.store.createPending(input), { created: true });

    const row = rowFor(f.db);
    const envelope = JSON.parse(row.sealed_text);
    assert.equal(row.text, PRIVATE_TEXT_SEALED_MARKER);
    assert.equal(row.text_bytes, 800);
    assert.equal(row.text_digest.length, 43);
    assert.notEqual(row.text_digest, input.textDigest);
    assert.equal(row.sealed_text.includes(TEXT), false);
    assert.equal(row.sealed_text.includes(input.textDigest), false);
    assert.equal(JSON.stringify(row).includes(TEXT), false);
    assert.deepEqual(Object.keys(envelope).sort(), [
      "alg", "ciphertext", "keyId", "nonce", "purpose", "tag", "v",
    ]);

    const createCall = f.client.calls.find(
      call => call.sql === D1_P2_CONFIRMATION_SQL.insertPendingSealed,
    );
    assert.ok(createCall);
    assert.equal(JSON.stringify(createCall.params).includes(TEXT), false);
    assert.equal(JSON.stringify(createCall.params).includes(input.textDigest), false);

    const loaded = await f.store.get({ principal: PRINCIPAL, handle: HANDLE });
    assert.equal(loaded.text, TEXT);
    assert.equal(loaded.textDigest, input.textDigest);
    assert.equal(loaded.textBytes, 800);
    const listed = await f.store.listPending({ principal: PRINCIPAL, now: NOW });
    assert.equal(listed.length, 1);
    assert.equal(listed[0].text, TEXT);

    const restarted = createD1P2ConfirmationOperationStore({
      client: f.client,
      textSealer: f.textSealer,
    });
    assert.equal(
      (await restarted.get({ principal: PRINCIPAL, handle: HANDLE })).text,
      TEXT,
    );
    assert.deepEqual(await restarted.verifySchema(), {
      ok: true,
      singleStatementAdmission: true,
      foreignKeys: true,
      sealedText: true,
    });
    f.db.close();
  });

test("sealed claim matches the same HMAC and preserves 004 atomic grant admission",
  { skip: sqliteSkip }, async () => {
    const f = await fixture();
    const input = record();
    await f.store.createPending(input);
    const loaded = await f.store.get({ principal: PRINCIPAL, handle: HANDLE });

    const wrongDigest = await f.store.claim({
      principal: PRINCIPAL,
      handle: HANDLE,
      textDigest: textDigest("different text"),
      textBytes: input.textBytes,
      now: NOW,
    });
    assert.deepEqual(wrongDigest, { claimed: false, reason: "binding_mismatch" });
    assert.deepEqual(counts(f.db), { reservations: 0, grants: 0 });

    const claimed = await f.store.claim({
      principal: PRINCIPAL,
      handle: HANDLE,
      textDigest: loaded.textDigest,
      textBytes: loaded.textBytes,
      now: NOW,
    });
    assert.equal(claimed.claimed, true);
    assert.equal(claimed.operationId, OPERATION_ID);
    const row = rowFor(f.db);
    assert.equal(row.state, P2_OPERATION_STATES.PROVIDER_PENDING);
    assert.equal(row.text, PRIVATE_TEXT_SEALED_MARKER);
    assert.equal(row.text_digest, f.textSealer.digestBinding({
      principal: row.principal,
      handle: row.handle,
      operationId: row.operation_id,
      action: row.action,
      origin: row.origin,
      textBytes: row.text_bytes,
      expiresAt: row.expires_at,
    }, loaded.textDigest));
    assert.deepEqual(counts(f.db), { reservations: 1, grants: 1 });
    assert.equal(
      f.db.prepare("SELECT state FROM paid_voice_grants").get().state,
      "consumed",
    );
    assert.deepEqual(await f.store.claim({
      principal: PRINCIPAL,
      handle: HANDLE,
      textDigest: loaded.textDigest,
      textBytes: loaded.textBytes,
      now: NOW + 1,
    }), { claimed: false, reason: "state" });
    assert.equal(D1_P2_CONFIRMATION_SQL.claimSealed.match(/\bUPDATE\b/g).length, 1);
    assert.doesNotMatch(D1_P2_CONFIRMATION_SQL.claimSealed, /;/);
    f.db.close();
  });

test("wrong key, wrong owner and a legacy unsealed row fail closed without plaintext",
  { skip: sqliteSkip }, async () => {
    const f = await fixture({ key: MASTER_KEY });
    await f.store.createPending(record());
    const wrongKeyStore = createD1P2ConfirmationOperationStore({
      client: f.client,
      textSealer: sealer(OTHER_KEY),
    });
    await assert.rejects(
      wrongKeyStore.get({ principal: PRINCIPAL, handle: HANDLE }),
      /operation_store_invalid/,
    );
    await assert.rejects(
      wrongKeyStore.listPending({ principal: PRINCIPAL, now: NOW }),
      /operation_store_invalid/,
    );
    assert.equal(
      await f.store.get({ principal: OTHER_PRINCIPAL, handle: HANDLE }),
      null,
    );
    f.db.close();

    const legacy = await fixture();
    const legacyRecord = record({
      handle: OTHER_HANDLE,
      operationId: OTHER_OPERATION_ID,
    });
    await legacy.legacyStore.createPending(legacyRecord);
    assert.equal(rowFor(legacy.db, PRINCIPAL, OTHER_HANDLE).text, TEXT);
    await assert.rejects(
      legacy.store.get({ principal: PRINCIPAL, handle: OTHER_HANDLE }),
      /operation_store_invalid/,
    );
    await assert.rejects(
      legacy.store.listPending({ principal: PRINCIPAL, now: NOW }),
      /operation_store_invalid/,
    );
    await assert.rejects(legacy.store.claim({
      principal: PRINCIPAL,
      handle: OTHER_HANDLE,
      textDigest: legacyRecord.textDigest,
      textBytes: legacyRecord.textBytes,
      now: NOW,
    }), /operation_store_invalid/);
    assert.deepEqual(counts(legacy.db), { reservations: 0, grants: 0 });
    legacy.db.close();
  });

test("ciphertext, digest, owner, operation, expiry, byte metadata and envelope swaps are rejected",
  { skip: sqliteSkip }, async () => {
    async function tampered(mutate, lookup = {}) {
      const f = await fixture();
      await f.store.createPending(record());
      mutate(f.db);
      await assert.rejects(
        f.store.get({
          principal: lookup.principal ?? PRINCIPAL,
          handle: lookup.handle ?? HANDLE,
        }),
        /operation_store_invalid/,
      );
      f.db.close();
    }

    await tampered(db => {
      const row = rowFor(db);
      const envelope = JSON.parse(row.sealed_text);
      envelope.ciphertext = (envelope.ciphertext[0] === "A" ? "B" : "A") +
        envelope.ciphertext.slice(1);
      db.prepare(
        "UPDATE paid_voice_confirmation_operations SET sealed_text = ?",
      ).run(JSON.stringify(envelope));
    });
    await tampered(db => {
      db.prepare(
        "UPDATE paid_voice_confirmation_operations SET text_digest = ?",
      ).run("A".repeat(43));
    });
    await tampered(db => {
      db.prepare(
        "UPDATE paid_voice_confirmation_operations SET operation_id = ?",
      ).run(OTHER_OPERATION_ID);
    });
    await tampered(db => {
      db.prepare(
        "UPDATE paid_voice_confirmation_operations SET expires_at = ?",
      ).run(NOW + 60_001);
    });
    await tampered(db => {
      db.prepare(
        "UPDATE paid_voice_confirmation_operations SET text_bytes = 799",
      ).run();
    });
    await tampered(db => {
      db.prepare(
        "UPDATE paid_voice_confirmation_operations SET principal = ?",
      ).run(OTHER_PRINCIPAL);
    }, { principal: OTHER_PRINCIPAL });
    await tampered(db => {
      db.prepare(
        "UPDATE paid_voice_confirmation_operations SET sealed_text = 'not-envelope'",
      ).run();
    });

    const swapped = await fixture();
    await swapped.store.createPending(record());
    await swapped.store.createPending(record({
      principal: OTHER_PRINCIPAL,
      handle: OTHER_HANDLE,
      operationId: OTHER_OPERATION_ID,
    }));
    const first = rowFor(swapped.db);
    const second = rowFor(swapped.db, OTHER_PRINCIPAL, OTHER_HANDLE);
    swapped.db.prepare(
      "UPDATE paid_voice_confirmation_operations SET sealed_text = ? WHERE handle = ?",
    ).run(second.sealed_text, HANDLE);
    swapped.db.prepare(
      "UPDATE paid_voice_confirmation_operations SET sealed_text = ? WHERE handle = ?",
    ).run(first.sealed_text, OTHER_HANDLE);
    await assert.rejects(
      swapped.store.get({ principal: PRINCIPAL, handle: HANDLE }),
      /operation_store_invalid/,
    );
    await assert.rejects(
      swapped.store.get({ principal: OTHER_PRINCIPAL, handle: OTHER_HANDLE }),
      /operation_store_invalid/,
    );
    swapped.db.close();
  });

test("expired sealed rows are not listed or claimable; duplicate creation stays closed",
  { skip: sqliteSkip }, async () => {
    const f = await fixture();
    const input = record({ expiresAt: NOW + 1_000 });
    assert.deepEqual(await f.store.createPending(input), { created: true });
    assert.deepEqual(
      await f.store.createPending(input),
      { created: false, reason: "collision" },
    );
    assert.deepEqual(
      await f.store.listPending({ principal: PRINCIPAL, now: NOW + 1_001 }),
      [],
    );
    assert.deepEqual(await f.store.claim({
      principal: PRINCIPAL,
      handle: HANDLE,
      textDigest: input.textDigest,
      textBytes: input.textBytes,
      now: NOW + 1_001,
    }), { claimed: false, reason: "state" });
    assert.deepEqual(counts(f.db), { reservations: 0, grants: 0 });
    assert.equal(
      (await f.store.get({ principal: PRINCIPAL, handle: HANDLE })).expiresAt,
      NOW + 1_000,
    );
    f.db.close();
  });

test("005 schema preflight stops without the additive column and leaves 004 intact",
  { skip: sqliteSkip }, async () => {
    const without = await fixture({ include005: false });
    await assert.rejects(without.store.verifySchema(), /schema_unqualified/);
    await assert.rejects(
      without.store.createPending(record()),
      /operation_store_unavailable/,
    );
    without.db.close();

    const with005 = await fixture();
    const objects = with005.db.prepare(`
      SELECT type, name, sql FROM sqlite_master
      WHERE name IN (
        'paid_voice_confirmation_operations',
        'paid_voice_confirmation_admit',
        'paid_voice_confirmation_operations_pending',
        'paid_voice_confirmation_operations_day'
      )`).all();
    assert.equal(objects.length, 4);
    const trigger = objects.find(row => row.name === "paid_voice_confirmation_admit");
    assert.match(trigger.sql, /RAISE\(ABORT, 'quota_denied'\)/);
    const columns = with005.db.prepare(
      "PRAGMA table_info(paid_voice_confirmation_operations)",
    ).all();
    const sealedColumn = columns.find(column => column.name === "sealed_text");
    assert.equal(sealedColumn.type, "TEXT");
    assert.equal(sealedColumn.notnull, 0);
    assert.equal(sealedColumn.dflt_value, null);
    const migration = await readFile(SEALING_MIGRATION, "utf8");
    assert.match(migration, /ALTER TABLE paid_voice_confirmation_operations/);
    const executable = migration.split(/\r?\n/)
      .filter(line => !line.trim().startsWith("--"))
      .join("\n");
    assert.doesNotMatch(executable, /DROP|DELETE|UPDATE/i);
    assert.equal((executable.match(/ALTER TABLE/g) ?? []).length, 1);
    with005.db.close();
  });
