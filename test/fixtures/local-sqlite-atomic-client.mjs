import { readFileSync } from "node:fs";

let DatabaseSync = null;
try {
  ({ DatabaseSync } = await import("node:sqlite"));
} catch {}

export const localSqliteAvailable = typeof DatabaseSync === "function";

function schema(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

export function openPaidSqlite(path = ":memory:", { wal = true } = {}) {
  if (!localSqliteAvailable) throw new Error("node_sqlite_unavailable");
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 10000");
  if (wal) db.exec("PRAGMA journal_mode = WAL");
  return db;
}

export function applyPaidSchema(db) {
  if (!db || typeof db.exec !== "function") throw new Error("missing_sqlite_db");
  db.exec(schema("../../db/d1/001_paid_voice_reservations.sql"));
  db.exec(schema("../../db/d1/002_paid_voice_grants.sql"));
  db.exec(schema("../../db/d1/003_paid_voice_operations.sql"));
}

export function createLocalAtomicClient(db) {
  if (!db || typeof db.exec !== "function" || typeof db.prepare !== "function") {
    throw new Error("missing_sqlite_db");
  }
  return Object.freeze({
    atomicBatch: true,
    async query(sql, params = []) {
      return db.prepare(sql).all(...params);
    },
    async batch(statements) {
      if (!Array.isArray(statements) || statements.length < 1) {
        throw new Error("invalid_sqlite_batch");
      }
      let began = false;
      try {
        db.exec("BEGIN IMMEDIATE");
        began = true;
        const results = statements.map(statement => {
          if (!statement || typeof statement.sql !== "string" ||
              !Array.isArray(statement.params)) {
            throw new Error("invalid_sqlite_batch");
          }
          return db.prepare(statement.sql).all(...statement.params);
        });
        db.exec("COMMIT");
        return results;
      } catch (error) {
        let rolledBack = false;
        if (began) {
          try {
            db.exec("ROLLBACK");
            rolledBack = true;
          } catch {}
        }
        const wrapped = new Error("sqlite_transaction_failed");
        wrapped.rolledBack = rolledBack;
        wrapped.sqliteCode = error?.code ?? null;
        throw wrapped;
      }
    },
  });
}

export function countRows(db, table) {
  if (!new Set(["paid_voice_reservations", "paid_voice_grants", "paid_voice_operations"]).has(table)) {
    throw new Error("unknown_table");
  }
  return db.prepare("SELECT COUNT(*) AS count FROM " + table).get().count;
}
