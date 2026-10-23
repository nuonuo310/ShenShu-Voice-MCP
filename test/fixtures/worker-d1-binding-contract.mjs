import { createLocalAtomicClient } from "./local-sqlite-atomic-client.mjs";

function invalid(code) {
  throw new Error(code);
}

function validateStatement(sql, params, prepared = false) {
  if (prepared) {
    if (!sql || typeof sql !== "object" || Array.isArray(sql) ||
        sql.__workerPrepared !== true ||
        typeof sql.sql !== "string" ||
        sql.sql.length < 1 || sql.sql.length > 100000 ||
        !Array.isArray(sql.params) || sql.params.length > 100) {
      invalid("worker_d1_statement_invalid");
    }
    return;
  }
  if (typeof sql !== "string" || sql.length < 1 || sql.length > 100000 ||
      !Array.isArray(params) || params.length > 100) {
    invalid("worker_d1_statement_invalid");
  }
}

function unwrap(result) {
  if (!result || typeof result !== "object" || Array.isArray(result) ||
      result.success !== true || !Array.isArray(result.results)) {
    invalid("worker_d1_result_invalid");
  }
  return result.results;
}

/**
 * Test-only simulation of the Cloudflare Worker D1 binding API.
 * It is backed by local SQLite and never performs network I/O.
 */
export function createWorkerD1Binding(db) {
  if (!db || typeof db.prepare !== "function") invalid("missing_sqlite_db");
  const local = createLocalAtomicClient(db);
  const stats = {
    queryCalls: 0,
    prepareCalls: 0,
    batchCalls: 0,
    batchSizes: [],
  };

  function makePrepared(sql, params) {
    validateStatement(sql, params);
    return Object.freeze({
      __workerPrepared: true,
      sql,
      params: Object.freeze([...params]),
      bind(...values) {
        validateStatement(sql, values);
        return makePrepared(sql, values);
      },
      async all() {
        const rows = await local.query(sql, params);
        return Object.freeze({ success: true, results: rows, meta: {} });
      },
    });
  }

  return Object.freeze({
    stats,
    prepare(sql) {
      stats.prepareCalls += 1;
      return makePrepared(sql, []);
    },
    async batch(statements) {
      stats.batchCalls += 1;
      if (!Array.isArray(statements) || statements.length < 1) {
        invalid("worker_d1_batch_invalid");
      }
      stats.batchSizes.push(statements.length);
      const normalized = statements.map(statement => {
        validateStatement(statement, null, true);
        return { sql: statement.sql, params: [...statement.params] };
      });
      const results = await local.batch(normalized);
      return Object.freeze(results.map(rows =>
        Object.freeze({ success: true, results: rows, meta: {} })));
    },
  });
}

/**
 * Offline client adapter matching the transactional store contract.
 * It maps fixed SQL statements to prepared binding statements and one batch.
 */
export function createWorkerBindingAtomicClient(binding) {
  if (!binding || typeof binding.prepare !== "function" ||
      typeof binding.batch !== "function" ||
      !binding.stats || typeof binding.stats !== "object") {
    invalid("missing_worker_d1_binding");
  }
  return Object.freeze({
    atomicBatch: true,
    async query(sql, params = []) {
      validateStatement(sql, params);
      const statement = binding.prepare(sql);
      if (!statement || typeof statement.bind !== "function") {
        invalid("worker_d1_statement_invalid");
      }
      const bound = statement.bind(...params);
      if (!bound || typeof bound.all !== "function") {
        invalid("worker_d1_statement_invalid");
      }
      binding.stats.queryCalls += 1;
      return unwrap(await bound.all());
    },
    async batch(statements) {
      if (!Array.isArray(statements) || statements.length < 1) {
        invalid("worker_d1_batch_invalid");
      }
      const prepared = statements.map(entry => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          invalid("worker_d1_statement_invalid");
        }
        validateStatement(entry.sql, entry.params);
        const statement = binding.prepare(entry.sql);
        if (!statement || typeof statement.bind !== "function") {
          invalid("worker_d1_statement_invalid");
        }
        return statement.bind(...entry.params);
      });
      const results = await binding.batch(prepared);
      if (!Array.isArray(results) || results.length !== prepared.length) {
        invalid("worker_d1_result_invalid");
      }
      return results.map(unwrap);
    },
  });
}
