# Voice V1 — qualification D1 schema freeze and migration authorization packet

Total control: ShenShu. Follow `nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md`, `continuity/v1-closure-baselines-2026-10-22.md`, and this repo's `docs/v1-closure/V1-CLOSURE-PLAN.md`.

**AUTHORIZED: offline schema review, exact-file hash manifest, local migration rehearsal, read-only checks and Draft PR. NOT AUTHORIZED: real D1 DDL/migration, any cloud query/write, Worker deploy, secrets, Render/Auth0, provider calls, billing, merge.**

## Fixed target, not an execution permission
User created a NEW dedicated qualification D1 on Cloudflare Free, observed in dashboard screenshot 2026-10-24:
- Name: `shenshu-voice-v1-qualification-20261024`
- UUID: `234913cd-8901-4607-8147-31c4a4317111`
- Overview initial: 0 tables, 0 queries, 0 rows written (last 24h), 12.29 KB storage. Snapshot, not a live guarantee.
- Old `shenshu-voice-budget-test` UUID `c39a6895-7028-4f59-a100-1455b92c96c1` is FORBIDDEN as target; preserve all its rows and optional consumers.
- Account ID is not yet independently established; do not infer it from old screenshots or log secret tokens.
- Cloudflare Free/no-card is user-attested; any payment/upgrade/Access prompt is STOP.

Parent PR #104 head `20ad300d778a988d6597a9cc1ce4eb9193f36db3`, CI #345 success. Parent PR #103 and #102 evidence; PR #101 signed Worker offline candidate. V1 strictly 2/9; B1–B4 open.

## Opening gate
Verify repo origin `nuonuo310/ShenShu-Voice-MCP`, worktree cleanliness/branch/head, PR dependencies and exact parent SHA. Read `db/d1/001_paid_voice_reservations.sql`, `002_paid_voice_grants.sql`, `003_paid_voice_operations.sql`, `docs/v1-closure/CLOUD-QUALIFICATION-PREFLIGHT-DECISION-20261023.md`, `docs/v1-closure/REAL-D1-READONLY-PREFLIGHT-20261023.md` and relevant tests. Never reset/stash/clean/move/rebase existing worktrees. If branch drift or ambiguous target, STOP.

## Required bounded continuous work
1. Produce an immutable migration manifest with exact Git blob IDs, SHA-256 of the raw bytes and ordered contents for 001, 002, 003. Do not copy live-old-only `paid_voice_reservations_by_owner_day` index without a separate explicit design choice. Decide whether it is required for V1 qualification; if yes, propose a distinct 004 additive migration, not an untracked silent SQL change.
2. Review schema constraints and D1 compatibility: table creation order, unique indexes, FK dependencies, `CHECK`, `result_ref` bounds, operation TTL, `IF NOT EXISTS` masking drift, and grant/reservation ownership. Explicitly flag that PR #104 documents owner consistency is enforced by fixed Worker SQL, not entirely by FK.
3. Locally rehearse exact 001/002/003 bytes against fresh SQLite, verify three expected tables and expected indexes, foreign keys, `PRAGMA foreign_key_check`, `PRAGMA foreign_keys`, and negative constraints; prove no data is present after init. Check behavior on deliberate partial failure, but do not suggest automatic destructive rollback.
4. Prepare an **operator-ready but unexecuted** D1 Studio initialization packet with exact database UUID/name, single-step-per-gate SQL, read-only preflight, no-blind-retry, postflight object counts/DDL/row checks, abort/rollback. Distinguish a read-only preflight from DDL approval. No D1 SQL execution in this package.
5. Account identity and Cloudflare current table count must be reconfirmed immediately before any future real DDL by operator; if different, STOP. Never create or reuse any other DB, Worker or Access.
6. No paid provider, no real D1 writes or migration, no test HMAC key or Worker provisioning. The eventual one-run cloud transaction budget from PR #104 (24 Worker HTTP, 18 D1-touching, 10 admission, 32 row-write units, zero MiniMax) is NOT authorized by this schema package.

## Autonomy and STOP
May independently review, create docs/tests/fixtures, run local Node/SQLite tests, ordinary repairs, commit/push dedicated branch and one Draft PR based on this authority branch. Changes limited to task-specific `docs/`, `test/` and offline fixture files; do not modify existing 001/002/003, `server.js`, MCP tools, provider, Render, workflows or production code. If the existing DDL needs correction, present an explicit diff and TOTAL CONTROL DECISION REQUIRED; do not silently mutate it. Do not execute real Cloudflare API/D1, deploy, access credentials, pay/upgrade, dispatch Actions manually, merge or delete rows.

## Delivery
Write `docs/v1-closure/D1-QUALIFICATION-SCHEMA-FREEZE-20261024.md` with exact migration manifest/hash, local verification, target identity, expected object set, absent-table checks, risk matrix, exact operator commands (not run), and explicit next authorization. Return COMPLETE / BLOCKED / TOTAL CONTROL DECISION REQUIRED with PR/CI/HEAD, all real cloud/provider/deploy counters zero, V1 2/9 and B1–B4 still open. If hashes or migration contents cannot be reliably established, report uncertainty and STOP before any live instruction.
