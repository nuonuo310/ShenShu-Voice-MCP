/**
 * Operator-only remote Cloudflare D1 probe. NO paid TTS, no MCP endpoint,
 * no secrets in the repository, no auto deploy, and no retries.
 *
 * Requirements: operator's local Wrangler session already authenticated,
 * dedicated test database exists and carries db/d1/001_voice_reservations.sql.
 * Explicit --execute-remote required. The default is a zero-write plan.
 *
 * This probes remote D1 database SQL concurrency, NOT deployed Worker bindings,
 * OAuth or production billing safety.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { D1_RESERVE_SQL } from "../src/d1-budget-store.js";

const run = promisify(execFile);
const DB_NAME = "shenshu-voice-budget-test";
const flag = process.argv.includes("--execute-remote");
const attempts = 8;
const limit = 3;
const subject = "probe_" + randomUUID().replaceAll("-", "");
const day = new Date().toISOString().slice(0, 10);
const prefix = "r_" + randomUUID().replaceAll("-", "").slice(0, 20);

function literal(value) {
  // Only locally generated ASCII-safe test identities are interpolated;
  // no user-supplied SQL is accepted.
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(value)) throw Error("unsafe_probe_identifier");
  return "'" + value + "'";
}
function sqlFor(id) {
  // Cloudflare Wrangler --command accepts SQL with literals rather than
  // bound parameters. Replace *only* known positional placeholders in a
  // copy of the application SQL; preserve original statement semantics.
  return D1_RESERVE_SQL
    .replaceAll("?1", literal(id))
    .replaceAll("?2", literal(subject))
    .replaceAll("?3", literal(day))
    .replaceAll("?4", String(limit));
}
function queryCount() {
  return "SELECT request_id, slot FROM paid_voice_reservations WHERE principal=" +
    literal(subject) + " AND day_utc=" + literal(day) + " ORDER BY slot";
}
async function remote(sql) {
  // Never print stdout/stderr from Wrangler; they may include account context.
  // One invocation, no retry. Requires explicit operator opt-in.
  const { stdout } = await run("npx", [
    "--no-install", "wrangler", "d1", "execute", DB_NAME,
    "--remote", "--json", "--command", sql,
  ], { timeout: 60_000, maxBuffer: 2_000_000 });
  let records;
  try { records = JSON.parse(stdout); }
  catch { throw Error("unexpected_wrangler_json"); }
  if (!Array.isArray(records) || records.some(x => x?.success === false)) {
    throw Error("remote_d1_query_failed");
  }
  return records.flatMap(x => Array.isArray(x.results) ? x.results : []);
}
if (!flag) {
  console.log("DRY RUN ONLY: no Cloudflare request was made.");
  console.log("Requires operator-authenticated Wrangler + dedicated test database.");
  console.log("With --execute-remote: 8 parallel reservations, daily limit 3, isolated principal, then read-only verification.");
  process.exit(0);
}
const outcomes = await Promise.allSettled(Array.from({ length: attempts }, (_, i) =>
  remote(sqlFor(prefix + "_" + String(i).padStart(2, "0")))
));
const admitted = outcomes.filter(x => x.status === "fulfilled" && x.value.length === 1).length;
const denied = outcomes.filter(x => x.status === "fulfilled" && x.value.length === 0).length;
const uncertain = outcomes.filter(x => x.status === "rejected").length;
let rows;
try { rows = await remote(queryCount()); }
catch { throw Error("remote_verification_unavailable"); }
const slots = rows.map(x => x.slot);
const valid = rows.length <= limit && rows.length === admitted &&
  new Set(slots).size === rows.length &&
  slots.every(n => Number.isInteger(n) && n >= 1 && n <= limit);
console.log(JSON.stringify({ attempts, limit, admitted, denied, uncertain,
  rows: rows.length, valid, remoteCloudD1Test: true }, null, 2));
if (!valid || admitted < 1) process.exitCode = 1;
