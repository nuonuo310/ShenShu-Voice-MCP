# Voice V1 D1 Gate 0 amendment — blocked sqlite_version() function (2026-10-24)

Authority: ShenShu total control. Parent reserved-table amendment PR #107 head `11a166281733cc4c1e92a42bd9b6ffdb67556cbb`. Schema freeze PR #106 head `433e5bd74d27b4b3e7d13a48384556a21a943ddc`. This amendment clarifies evidence acceptance only; it does not change any SQL migration bytes or grant DDL permission beyond the user's existing conditional authorization.

## User-observed D1 Studio evidence
Target remains dedicated qualification D1 `shenshu-voice-v1-qualification-20261024` UUID `234913cd-8901-4607-8147-31c4a4317111` as observed on creation. On 2026-10-24 Studio returned:
- `sqlite_master` one `_cf_KV` table; business-object filtered query 0 rows.
- `PRAGMA foreign_keys` -> 1.
- `PRAGMA foreign_key_check` -> 0 rows.
- `SELECT sqlite_version();` -> `not authorized to use function: sqlite_version at offset 7: SQLITE_ERROR`.
This is an authorization restriction on the SQL function, **not** evidence of schema corruption or a failed migration. No 001/002/003 DDL was attempted.

## Primary Cloudflare references
- https://developers.cloudflare.com/d1/sql-api/sql-statements/ : D1 supports a subset of SQLite functions and a documented subset of compatible PRAGMA/schema inspection statements; it does not promise every SQLite built-in function is callable.
- https://developers.cloudflare.com/d1/sql-api/foreign-keys/ : D1 enables FK enforcement and executes queries in implicit transactions.
- https://developers.cloudflare.com/d1/platform/alpha-migration/ : newly created D1 databases use the post-alpha architecture; `wrangler d1 info` may report D1 backend version if needed, but this is **not the SQLite library version** and must not be mislabeled as such.

## Narrow total-control decision
- Mark `sqlite_version()` as **UNAVAILABLE IN THIS D1 STUDIO CONTEXT**, not PASS and not schema failure.
- Remove the requirement to obtain a SQLite library version by probing alternate unapproved SQL functions. The frozen schema uses ordinary D1-supported CREATE TABLE, CREATE INDEX, FK and CHECK semantics, rehearsed offline on Node 24 SQLite; this is a compatibility argument, not real D1 DDL proof.
- Accept Gate 0's schema preflight based on reserved `_cf_KV` exception, zero business objects, FK enabled and no violations **subject to a fresh target name/UUID/account identity check and exact object inventory immediately before first DDL**.
- Account ID and current target identity have not been independently reverified after the user's Studio query screenshots; do not assume full Gate 0 complete.
- If any unexpected table/index, new binding, changed target, payment/upgrade prompt, foreign_keys != 1 or FK violations, STOP. No retry/cleanup/DROP.
- Frozen 001/002/003 blob hashes and contents from PR #106 unchanged. No migration 004.
- This document does NOT itself execute or authorize a live query or DDL. User has previously approved sequential 001/002/003 only after safety gates; the assistant must explicitly release Gate A separately after target verification.

Strict V1 remains 2/9; B1 iPhone audio silent, B2 real atomic D1 unqualified, B3 private delivery unqualified, B4 no MiniMax E2E. Zero real Cloudflare API/DDL/DML/Worker/provider/secret/deploy/merge actions in this amendment.
