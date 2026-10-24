import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

let DatabaseSync = null;
try {
  ({ DatabaseSync } = await import("node:sqlite"));
} catch {}

const sqliteTest = (name, fn) => test(name, {
  skip: typeof DatabaseSync === "function" ? false : "node:sqlite requires Node 22 or newer",
}, fn);

const FROZEN_MIGRATIONS = Object.freeze([
  Object.freeze({
    path: "db/d1/001_paid_voice_reservations.sql",
    blob: "2fab14e22c42ebbe658c319ad11357dd6c57595d",
    bytes: 432,
    sha256: "7AD3281045AF6A0FD74E47B72257784F6A1F3701BC6A0EEC6FD885301FDD4677",
  }),
  Object.freeze({
    path: "db/d1/002_paid_voice_grants.sql",
    blob: "44b062d39025400fa37c568f570665f018166eb4",
    bytes: 478,
    sha256: "40E5EC398948CA97C74D5371152465661AE2855CCB123B19C1E930729ECB526A",
  }),
  Object.freeze({
    path: "db/d1/003_paid_voice_operations.sql",
    blob: "a0e000670a7fbf463989d5ab9157d8b73c9308c6",
    bytes: 1357,
    sha256: "F5A0FB97587F4A2BA696D5331E14FAE425C50B2664B88B07D7E9A1695A4764A8",
  }),
]);

const PRINCIPAL = "owner_schema_0001";
const OTHER_PRINCIPAL = "owner_schema_0002";
const REQUEST_ID = "request_schema_0001";
const GRANT_ID = "grant_schema_0001";
const OPERATION_ID = "operation_schema_0001";
const ISSUED_AT = 1_760_000_000_000;
const MAX_TTL_MS = 900_000;
const DIGEST = "A".repeat(43);

function canonicalBytes(relativePath) {
  const raw = readFileSync(new URL(`../${relativePath}`, import.meta.url));
  return Buffer.from(raw.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function gitBlobId(bytes) {
  return createHash("sha1")
    .update(Buffer.from(`blob ${bytes.length}\0`, "utf8"))
    .update(bytes)
    .digest("hex");
}

function migrationSql(relativePath) {
  return canonicalBytes(relativePath).toString("utf8");
}

function openDb() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}

function applyExactMigrations(db) {
  for (const migration of FROZEN_MIGRATIONS) {
    db.exec(migrationSql(migration.path));
  }
}

function userObjects(db) {
  return db.prepare(
    "SELECT type,name,tbl_name FROM sqlite_master " +
    "WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY type,name",
  ).all().map(row => ({ ...row }));
}

function autoIndexNames(db, table) {
  return db.prepare(`PRAGMA index_list('${table}')`).all()
    .filter(row => row.name.startsWith("sqlite_autoindex_"))
    .map(row => row.name)
    .sort();
}

function tableColumns(db, table) {
  return db.prepare(`PRAGMA table_info('${table}')`).all()
    .map(row => ({ name: row.name, type: row.type, notnull: row.notnull, pk: row.pk }));
}

function assertSchemaFrozen(db) {
  assert.equal(db.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
  assert.deepEqual(userObjects(db), [
    { type: "index", name: "paid_voice_grants_principal_state", tbl_name: "paid_voice_grants" },
    { type: "index", name: "paid_voice_operations_state_expiry", tbl_name: "paid_voice_operations" },
    { type: "table", name: "paid_voice_grants", tbl_name: "paid_voice_grants" },
    { type: "table", name: "paid_voice_operations", tbl_name: "paid_voice_operations" },
    { type: "table", name: "paid_voice_reservations", tbl_name: "paid_voice_reservations" },
  ]);
  assert.deepEqual(autoIndexNames(db, "paid_voice_reservations"), [
    "sqlite_autoindex_paid_voice_reservations_1",
    "sqlite_autoindex_paid_voice_reservations_2",
  ]);
  assert.deepEqual(autoIndexNames(db, "paid_voice_grants"), [
    "sqlite_autoindex_paid_voice_grants_1",
    "sqlite_autoindex_paid_voice_grants_2",
  ]);
  assert.deepEqual(autoIndexNames(db, "paid_voice_operations"), [
    "sqlite_autoindex_paid_voice_operations_1",
    "sqlite_autoindex_paid_voice_operations_2",
    "sqlite_autoindex_paid_voice_operations_3",
  ]);
  assert.deepEqual(tableColumns(db, "paid_voice_reservations"), [
    { name: "request_id", type: "TEXT", notnull: 1, pk: 1 },
    { name: "principal", type: "TEXT", notnull: 1, pk: 0 },
    { name: "day_utc", type: "TEXT", notnull: 1, pk: 0 },
    { name: "slot", type: "INTEGER", notnull: 1, pk: 0 },
    { name: "created_at", type: "TEXT", notnull: 1, pk: 0 },
  ]);
  assert.deepEqual(tableColumns(db, "paid_voice_grants"), [
    { name: "grant_id", type: "TEXT", notnull: 1, pk: 1 },
    { name: "request_id", type: "TEXT", notnull: 1, pk: 0 },
    { name: "principal", type: "TEXT", notnull: 1, pk: 0 },
    { name: "state", type: "TEXT", notnull: 1, pk: 0 },
    { name: "created_at", type: "TEXT", notnull: 1, pk: 0 },
    { name: "consumed_at", type: "TEXT", notnull: 0, pk: 0 },
  ]);
  assert.deepEqual(tableColumns(db, "paid_voice_operations"), [
    { name: "principal", type: "TEXT", notnull: 1, pk: 1 },
    { name: "operation_id", type: "TEXT", notnull: 1, pk: 2 },
    { name: "request_id", type: "TEXT", notnull: 1, pk: 0 },
    { name: "grant_id", type: "TEXT", notnull: 1, pk: 0 },
    { name: "action", type: "TEXT", notnull: 1, pk: 0 },
    { name: "text_digest", type: "TEXT", notnull: 1, pk: 0 },
    { name: "text_bytes", type: "INTEGER", notnull: 1, pk: 0 },
    { name: "state", type: "TEXT", notnull: 1, pk: 0 },
    { name: "result_ref", type: "TEXT", notnull: 0, pk: 0 },
    { name: "issued_at", type: "INTEGER", notnull: 1, pk: 0 },
    { name: "expires_at", type: "INTEGER", notnull: 1, pk: 0 },
    { name: "created_at", type: "TEXT", notnull: 1, pk: 0 },
    { name: "updated_at", type: "TEXT", notnull: 1, pk: 0 },
  ]);
  assert.deepEqual(
    db.prepare("PRAGMA foreign_key_list('paid_voice_grants')").all()
      .map(row => [row.from, row.table, row.to]),
    [["request_id", "paid_voice_reservations", "request_id"]],
  );
  assert.deepEqual(
    db.prepare("PRAGMA foreign_key_list('paid_voice_operations')").all()
      .map(row => [row.from, row.table, row.to])
      .sort(),
    [
      ["grant_id", "paid_voice_grants", "grant_id"],
      ["request_id", "paid_voice_reservations", "request_id"],
    ],
  );
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  for (const table of ["paid_voice_reservations", "paid_voice_grants", "paid_voice_operations"]) {
    assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count, 0);
  }
}

function insertReservation(db, {
  requestId = REQUEST_ID,
  principal = PRINCIPAL,
  day = "2026-10-24",
  slot = 1,
} = {}) {
  db.prepare(
    "INSERT INTO paid_voice_reservations (request_id, principal, day_utc, slot) " +
    "VALUES (?1, ?2, ?3, ?4)",
  ).run(requestId, principal, day, slot);
}

function insertGrant(db, {
  grantId = GRANT_ID,
  requestId = REQUEST_ID,
  principal = PRINCIPAL,
  state = "issued",
} = {}) {
  db.prepare(
    "INSERT INTO paid_voice_grants (grant_id, request_id, principal, state) " +
    "VALUES (?1, ?2, ?3, ?4)",
  ).run(grantId, requestId, principal, state);
}

function insertOperation(db, overrides = {}) {
  const row = {
    principal: PRINCIPAL,
    operationId: OPERATION_ID,
    requestId: REQUEST_ID,
    grantId: GRANT_ID,
    action: "generate_shenshu_voice",
    textDigest: DIGEST,
    textBytes: 5,
    state: "admitted",
    resultRef: null,
    issuedAt: ISSUED_AT,
    expiresAt: ISSUED_AT + MAX_TTL_MS,
    ...overrides,
  };
  db.prepare(
    "INSERT INTO paid_voice_operations " +
    "(principal, operation_id, request_id, grant_id, action, text_digest, " +
    "text_bytes, state, result_ref, issued_at, expires_at) " +
    "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
  ).run(
    row.principal,
    row.operationId,
    row.requestId,
    row.grantId,
    row.action,
    row.textDigest,
    row.textBytes,
    row.state,
    row.resultRef,
    row.issuedAt,
    row.expiresAt,
  );
}

function seedBase(db) {
  insertReservation(db);
  insertGrant(db);
}

test("001/002/003 are frozen by ordered Git blob ID and SHA-256", () => {
  assert.deepEqual(FROZEN_MIGRATIONS.map(entry => entry.path), [
    "db/d1/001_paid_voice_reservations.sql",
    "db/d1/002_paid_voice_grants.sql",
    "db/d1/003_paid_voice_operations.sql",
  ]);
  for (const migration of FROZEN_MIGRATIONS) {
    const bytes = canonicalBytes(migration.path);
    assert.equal(bytes.length, migration.bytes, `${migration.path} byte length`);
    assert.equal(sha256(bytes), migration.sha256, `${migration.path} SHA-256`);
    assert.equal(gitBlobId(bytes), migration.blob, `${migration.path} Git blob ID`);
    assert.doesNotMatch(bytes.toString("utf8"), /\r/, `${migration.path} canonical bytes are LF-only`);
  }
  assert.match(migrationSql(FROZEN_MIGRATIONS[0].path), /CREATE TABLE IF NOT EXISTS paid_voice_reservations/);
  assert.match(migrationSql(FROZEN_MIGRATIONS[1].path), /FOREIGN KEY\(request_id\) REFERENCES paid_voice_reservations/);
  assert.match(migrationSql(FROZEN_MIGRATIONS[2].path), /CREATE TABLE IF NOT EXISTS paid_voice_operations/);
});

sqliteTest("exact migrations create only the expected tables, indexes, keys and zero rows", () => {
  const db = openDb();
  try {
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").get().count, 0);
    applyExactMigrations(db);
    assertSchemaFrozen(db);
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE name='paid_voice_reservations_by_owner_day'").get().count,
      0,
    );
    assert.match(
      db.prepare(
        "EXPLAIN QUERY PLAN SELECT COUNT(*) FROM paid_voice_reservations " +
        "WHERE principal=?1 AND day_utc=?2",
      ).all().map(row => row.detail).join(" "),
      /sqlite_autoindex_paid_voice_reservations_2/,
    );
  } finally {
    db.close();
  }
});

sqliteTest("CHECK, FK and uniqueness constraints reject malformed paid-operation rows", () => {
  const violations = [
    ["reservation slot 0", db => insertReservation(db, { slot: 0 })],
    ["reservation slot 21", db => insertReservation(db, { slot: 21 })],
    ["grant state", db => {
      insertReservation(db, { requestId: "request_schema_state", slot: 2 });
      insertGrant(db, {
        grantId: "grant_schema_state",
        requestId: "request_schema_state",
        state: "pending",
      });
    }],
    ["operation action", db => {
      insertOperation(db, { action: "other_action" });
    }],
    ["operation digest length 42", db => {
      insertOperation(db, { textDigest: "A".repeat(42) });
    }],
    ["operation text_bytes 0", db => {
      insertOperation(db, { textBytes: 0 });
    }],
    ["operation text_bytes 801", db => {
      insertOperation(db, { textBytes: 801 });
    }],
    ["operation state", db => {
      insertOperation(db, { state: "failed" });
    }],
    ["completed without result_ref", db => {
      insertOperation(db, { state: "completed", resultRef: null });
    }],
    ["admitted with result_ref", db => {
      insertOperation(db, { resultRef: "result_schema_0001" });
    }],
    ["result_ref length 7", db => {
      insertOperation(db, { state: "completed", resultRef: "A".repeat(7) });
    }],
    ["result_ref length 257", db => {
      insertOperation(db, { state: "completed", resultRef: "A".repeat(257) });
    }],
    ["negative issued_at", db => {
      insertOperation(db, { issuedAt: -1, expiresAt: 1 });
    }],
    ["expires_at equals issued_at", db => {
      insertOperation(db, { expiresAt: ISSUED_AT });
    }],
    ["TTL over 900000 ms", db => {
      insertOperation(db, { expiresAt: ISSUED_AT + MAX_TTL_MS + 1 });
    }],
    ["missing reservation FK", db => {
      insertOperation(db, { requestId: "request_missing_0001" });
    }],
    ["missing grant FK", db => {
      insertOperation(db, { grantId: "grant_missing_0001" });
    }],
    ["duplicate reservation slot", db => {
      insertReservation(db, { requestId: "request_schema_0002", slot: 1 });
    }],
    ["duplicate grant request", db => {
      insertGrant(db, { grantId: "grant_schema_0002" });
    }],
    ["duplicate operation primary key", db => {
      insertOperation(db);
      insertOperation(db);
    }],
  ];
  for (const [name, run] of violations) {
    const db = openDb();
    try {
      applyExactMigrations(db);
      seedBase(db);
      assert.throws(() => run(db), /constraint|unique|foreign key/i, name);
    } finally {
      db.close();
    }
  }
});

sqliteTest("single-column FKs do not prove reservation, grant and operation ownership", () => {
  const db = openDb();
  try {
    applyExactMigrations(db);
    insertReservation(db, { requestId: "request_owner_a_0001", principal: PRINCIPAL, slot: 1 });
    insertReservation(db, { requestId: "request_owner_b_0001", principal: OTHER_PRINCIPAL, slot: 1 });
    insertGrant(db, {
      grantId: "grant_owner_b_0001",
      requestId: "request_owner_b_0001",
      principal: OTHER_PRINCIPAL,
    });
    insertOperation(db, {
      principal: OTHER_PRINCIPAL,
      operationId: "operation_owner_mismatch",
      requestId: "request_owner_a_0001",
      grantId: "grant_owner_b_0001",
    });
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM paid_voice_operations").get().count, 1);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    db.close();
  }
});

sqliteTest("a partial migration failure is preserved; no automatic destructive rollback occurs", () => {
  const db = openDb();
  try {
    db.exec(migrationSql(FROZEN_MIGRATIONS[0].path));
    assert.throws(() => db.exec("CREATE TABLE paid_voice_operations (broken"), /syntax|incomplete/i);
    assert.deepEqual(userObjects(db), [
      { type: "table", name: "paid_voice_reservations", tbl_name: "paid_voice_reservations" },
    ]);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM paid_voice_reservations").get().count, 0);

    db.exec("BEGIN IMMEDIATE");
    assert.throws(() => db.exec("CREATE TABLE paid_voice_operations (broken"), /syntax|incomplete/i);
    db.exec("ROLLBACK");
    assert.deepEqual(userObjects(db), [
      { type: "table", name: "paid_voice_reservations", tbl_name: "paid_voice_reservations" },
    ]);
  } finally {
    db.close();
  }
});

sqliteTest("reapplying identical files is idempotent, but IF NOT EXISTS masks pre-existing drift", () => {
  const clean = openDb();
  try {
    applyExactMigrations(clean);
    const first = JSON.stringify(userObjects(clean));
    applyExactMigrations(clean);
    assert.equal(JSON.stringify(userObjects(clean)), first);
    assertSchemaFrozen(clean);
  } finally {
    clean.close();
  }

  const drifted = openDb();
  try {
    drifted.exec(
      "CREATE TABLE paid_voice_grants (" +
      "grant_id TEXT NOT NULL, request_id TEXT NOT NULL, principal TEXT NOT NULL, " +
      "state TEXT NOT NULL DEFAULT 'issued', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
      "consumed_at TEXT)",
    );
    applyExactMigrations(drifted);
    assert.throws(() => assertSchemaFrozen(drifted), /deepEqual|Expected|actual|expected/i);
  } finally {
    drifted.close();
  }
});
