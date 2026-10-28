import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { deriveCanonicalPrincipal } from "../src/canonical-principal.js";
import {
  AUTH0_ISSUER,
  STAGING_RESOURCE_ORIGIN,
} from "../src/protected-resource-identity.js";
import {
  PRIVATE_TEXT_MASTER_KEY_ENV,
  STAGING_SEALED_PLAYER_FLAG,
  createV1P2StagingSealedClosureCandidate,
} from "../src/v1-p2-staging-sealed-closure.js";
import { PRIVATE_TEXT_SEALED_MARKER } from "../src/v1-p2-private-text-sealer.js";

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

const SESSION_SECRET = "sealed-composition-session-secret-0123456789abcdef";
const PRINCIPAL = deriveCanonicalPrincipal({
  issuer: AUTH0_ISSUER,
  subject: "auth0|sealed-composition-owner",
});
const MASTER_KEY = Buffer.from(
  Array.from({ length: 32 }, (_, index) => index + 31),
).toString("base64");
const MIGRATIONS = [
  new URL("../db/d1/001_paid_voice_reservations.sql", import.meta.url),
  new URL("../db/d1/002_paid_voice_grants.sql", import.meta.url),
  new URL("../db/d1/004_paid_voice_confirmation_operations.sql", import.meta.url),
  new URL(
    "../db/d1/005_paid_voice_confirmation_private_text_sealing.sql",
    import.meta.url,
  ),
];

function env(overrides = {}) {
  return {
    SHENSHU_STAGING_RESOURCE_MODE: "1",
    SHENSHU_STAGING_ORIGIN: STAGING_RESOURCE_ORIGIN,
    SHENSHU_AUTH_MCP_ENABLED: "1",
    SHENSHU_PLAYER_ENABLED: "1",
    SHENSHU_NONBILLABLE_PLAYER_ENABLED: "1",
    [STAGING_SEALED_PLAYER_FLAG]: "1",
    [PRIVATE_TEXT_MASTER_KEY_ENV]: MASTER_KEY,
    SHENSHU_PLAYER_SESSION_SECRET: SESSION_SECRET,
    ...overrides,
  };
}

function resolver() {
  return async () => Object.freeze({
    verified: true,
    subject: PRINCIPAL,
  });
}

async function localSqlite({ include005 = true } = {}) {
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

test("sealed staging composition is null by default and a boolean flag alone never falls back",
  async () => {
    assert.equal(await createV1P2StagingSealedClosureCandidate({
      env: {},
      mcpResolveVerifiedPrincipal: resolver(),
    }), null);

    let factoryCalls = 0;
    const booleanOnly = env({
      [PRIVATE_TEXT_MASTER_KEY_ENV]: undefined,
      SHENSHU_PLAYER_SESSION_SECRET: undefined,
    });
    assert.equal(await createV1P2StagingSealedClosureCandidate({
      env: booleanOnly,
      createD1Client() {
        factoryCalls++;
        throw new Error("must_not_be_called");
      },
      mcpResolveVerifiedPrincipal: resolver(),
    }), null);
    assert.equal(factoryCalls, 0);

    assert.equal(await createV1P2StagingSealedClosureCandidate({
      env: env({
        SHENSHU_STAGING_RESOURCE_MODE: "0",
      }),
      createD1Client() {
        factoryCalls++;
        return {};
      },
      mcpResolveVerifiedPrincipal: resolver(),
    }), null);
    assert.equal(factoryCalls, 0);

    for (const badKey of ["short", Buffer.alloc(32).toString("base64")]) {
      assert.equal(await createV1P2StagingSealedClosureCandidate({
        env: env({ [PRIVATE_TEXT_MASTER_KEY_ENV]: badKey }),
        createD1Client() {
          factoryCalls++;
          return {};
        },
        mcpResolveVerifiedPrincipal: resolver(),
      }), null);
    }
    assert.equal(factoryCalls, 0);
  });

test("missing D1 configuration or missing 005 schema fails closed",
  { skip: sqliteSkip }, async () => {
    const noConfig = { ...env() };
    delete noConfig.CF_D1_ACCOUNT_ID;
    delete noConfig.CF_D1_DATABASE_ID;
    delete noConfig.CF_D1_API_TOKEN;
    assert.equal(await createV1P2StagingSealedClosureCandidate({
      env: noConfig,
      mcpResolveVerifiedPrincipal: resolver(),
    }), null);

    const fixture = await localSqlite({ include005: false });
    assert.equal(await createV1P2StagingSealedClosureCandidate({
      env: env(),
      createD1Client: () => fixture.client,
      mcpResolveVerifiedPrincipal: resolver(),
    }), null);
    fixture.db.close();
  });

test("valid staging composition uses the sealed store and creates no plaintext row",
  { skip: sqliteSkip }, async () => {
    const fixture = await localSqlite();
    let factoryCalls = 0;
    const closure = await createV1P2StagingSealedClosureCandidate({
      env: env(),
      createD1Client(seenEnv) {
        factoryCalls++;
        assert.equal(seenEnv.env[STAGING_SEALED_PLAYER_FLAG], "1");
        return fixture.client;
      },
      mcpResolveVerifiedPrincipal: resolver(),
      operationTtlMs: 60_000,
    });
    assert.equal(factoryCalls, 1);
    assert.ok(closure);
    assert.deepEqual(Object.keys(closure.broker).sort(), ["initiate", "status"]);
    assert.equal(typeof closure.pendingHandler.handle, "function");

    const prepared = await closure.broker.initiate({
      trustedRequest: { headers: {} },
      text: "密封组合候选",
    });
    assert.equal(prepared.billable, false);
    const status = await closure.broker.status({
      trustedRequest: { headers: {} },
      handle: prepared.handle,
    });
    assert.equal(status.status, "pending_confirmation");

    const row = fixture.db.prepare(
      "SELECT text, text_digest, text_bytes, sealed_text " +
      "FROM paid_voice_confirmation_operations",
    ).get();
    assert.equal(row.text, PRIVATE_TEXT_SEALED_MARKER);
    assert.equal(row.text_bytes, Buffer.byteLength("密封组合候选", "utf8"));
    assert.equal(row.sealed_text.includes("密封组合候选"), false);
    assert.equal(row.sealed_text.includes(row.text_digest), false);
    assert.equal(
      fixture.db.prepare(
        "SELECT COUNT(*) AS reservations FROM paid_voice_reservations",
      ).get().reservations,
      0,
    );
    fixture.db.close();
  });
