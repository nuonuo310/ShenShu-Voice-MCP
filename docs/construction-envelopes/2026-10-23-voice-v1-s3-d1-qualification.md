# Voice V1 S3 continuous construction — D1 paid admission qualification preparation

Authority: `docs/v1-closure/V1-CLOSURE-PLAN.md` and `nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md`. Target `nuonuo310/ShenShu-Voice-MCP` only. **This package authorizes offline qualification preparation and Draft PR only. Real D1 operations, cloud changes, tool activation and paid provider calls are NOT authorized.**

## Fixed V1 target
Nine DONE LINE gates, strict 2/9 fully proven; B1 iPhone silent output remains open; B2 trusted paid admission, B3 fail-closed/private audio and B4 one approved MiniMax E2E remain open. S1/S2 offline candidate PR #86 head `878f4e863d7f32484dc5b03ddae1cfed8937b39a`, deployed to isolated staging for nonbillable diagnostics. iPhone screenshot confirms `ctx running; resume resolved; decode ok 0.70s 48000Hz 1ch; source started`, but user confirms SILENT. Evidence PR #87. Do not repeat same iPhone tests or claim a fix.

## Opening Gate
Verify repository/origin, actual local worktree map and clean status, main SHA, PR #86/#87 and open stacked PR topology. Read `docs/v1-closure/V1-CLOSURE-PLAN.md`, `docs/v1-closure/S1-S2-IMPLEMENTATION-EVIDENCE.md`, `src/v1-offline-paid-pipeline.js`, `src/d1-http-paid-store.js`, `src/d1-paid-store.js`, `src/durable-paid-admission.js`, `db/d1/` migrations, tests, and existing D1 dry-run docs. Inspect canonical D1 SQL for duplicate requests, atomic per-day slot reservation, grant issue/consume, uncertainty semantics and rollback. STOP on identity drift, unexpected tracked changes or incompatible migration; do not reset, stash, clean or move other worktrees.

## Objective and bounded autonomy
Prepare one credible, reproducible S3 **real D1 qualification gate**, but do not execute real D1. Inspect and strengthen offline invariants only where evidence reveals a concrete V1 failure risk. Generate an operator-ready, reversible real-D1 qualification runbook that identifies exact account/database by safe nonsecret metadata, schema migration preconditions, isolation from prior dryrun_ and production rows, nonbillable concurrency/replay/limit/UTC-day probes, expected atomicity and audit evidence, abort criteria, and rollback/no-refund rules. If any required D1 mutation or real schema verification is needed, produce TOTAL CONTROL DECISION REQUIRED and wait for explicit authorization.

Allowed implementation: narrowly relevant `src/`, `test/`, `docs/` only; no schema change without total-control decision. May autonomously run local fake-D1 tests, ordinary fixes/retests, `node --test`, syntax/diff checks and create one dedicated Draft PR. Do not expand to emotion, segmentation, favorites, automatic voice or multi-user production.

## Required proof design
- No trusted principal from tool arguments; signed OAuth principal only.
- Reserve before grant issue, consume grant before provider; no provider attempt on any denied/ambiguous state.
- Atomic concurrency across independent clients, replay/duplicate request, daily limit and UTC day rollover; distinguish test fixture proof from actual Cloudflare D1.
- Fail closed on D1 429/timeout/partial failure and unknown billing; no refund/retry that can double-charge.
- Private generated WAV delivery never public permanent URL or bearer in query.
- Protect existing public MOCK and private staging probe.
- Distinguish real D1 admission qualification from first real MiniMax smoke; this package does not authorize either.

## STOP boundaries
No Cloudflare API/D1 query/migration, no D1 credentials or key reads, no Render/Auth0 changes, no deployments, no connector refresh, no GitHub Actions dispatch, no paid MCP registration, no real MiniMax or other paid calls, no merge or production changes. If exact D1 schema/database/identity cannot be confirmed from safe sources, document missing information; do not guess or create database.

## Output
Write `docs/v1-closure/S3-D1-QUALIFICATION-DECISION.md` with verified current status, smallest real-D1 authorization packet, test plan, risk and rollback, changed files, offline test counts and remaining V1 blocker count. Use dedicated branch from this authority branch, commit/push and open one Draft PR. Final COMPLETE / BLOCKED / TOTAL CONTROL DECISION REQUIRED with SHA, CI, evidence and all real operation counters (expected zero). Ordinary offline failures may be repaired continuously.
