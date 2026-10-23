# Voice V1 — final read-only cloud qualification preflight

Authority: ShenShu total control. Governing rules `nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md` and `continuity/v1-closure-baselines-2026-10-22.md`. Repository `nuonuo310/ShenShu-Voice-MCP`.

**THIS IS READ-ONLY / PLAN-ONLY. NO REAL D1 WRITE, DDL, CLOUD RESOURCE CREATION, DEPLOYMENT, CREDENTIAL READ, PAYMENT, PROVIDER CALL OR MERGE.**

## Grounded baseline
Parent PR #102 head `4ee57041d66f99e187b83cc96bc465c341218f0e`, based on PR #101 signed bridge candidate `33e5607a5102c66aca043368deb5a7e17374a90a`. Read `docs/v1-closure/REAL-D1-READONLY-PREFLIGHT-20261023.md`, `db/d1/003_paid_voice_operations.sql`, `docs/v1-closure/S3-D1-QUALIFICATION-DECISION.md`, `worker/signed-d1-worker-bridge.js`, `worker/private-d1-worker-candidate.js` and `docs/v1-closure/SIGNED-WORKER-BRIDGE-CI-READINESS-20261023.md`.

User observed Cloudflare dashboard Free quotas and explicitly confirmed their Cloudflare plan is Free, without a card. Existing D1 `shenshu-voice-budget-test` UUID `c39a6895-7028-4f59-a100-1455b92c96c1` has two baseline tables and structural checks from D1 Studio. There is no third operations table. This is user-supplied observation, not a license to mutate cloud state. Render staging `shenshu-voice-mcp-staging.onrender.com` uses Free and auto-deploy off. Existing Worker projects belong to other features; do not modify them.

## Opening gate
Verify exact Git origin, local worktree map and clean state, branch/head/PR topology, current source and CI. Read-only inspect available Cloudflare metadata ONLY if accessible through already authorized nonsecret account views; no API token/secret reads, no D1 queries or schema mutation. If the available tools do not permit read-only Cloudflare inspection, state NOT VERIFIED and provide precise operator dashboard steps rather than guessing. Do not treat `Tables=0` list glitch as actual schema after Studio confirmed two tables.

## Objectives
1. Determine whether existing `shenshu-voice-budget-test` has Worker bindings/other active consumers or historic rows; do not query real D1 in this package. Prefer a dedicated isolated non-production D1 database for qualification if reuse would risk other systems, but **do not create it**. Record name/UUID and resource ownership uncertainties.
2. Audit additive `003_paid_voice_operations.sql` against observed 001/002 constraints: FK references, unique indexes, CHECK, expiry and result_ref invariants, no data loss, pre-existing row considerations. Check the planned D1 Worker batch semantics, strict SQL, expected `RETURNING`, ambiguous timeouts and signed auth before D1.
3. Produce exact future operator approval packet with cloud account identity, database UUID/name, Worker name/route, Free/no-card confirmation, signed test key lifecycle, max requests and D1 row/write budgets, UTC day(s), principal/run ID, no MiniMax, abort conditions, audit and rollback. Reconcile old 8-row S3 packet: full 4-admission scenario creates up to 12 rows (4 reservations+4 grants+4 operations), excluding failed rollback probes. Do not pretend a single SQL statement or D1 rows-written quota is equal to durable row count.
4. Distinguish separate approvals for D1 003 migration, Worker creation/deploy, test HMAC key, actual D1 qualification writes, Render caller activation and paid provider E2E. If the cloud Free plan or permissions demand payment details, STOP; no card workaround.
5. Reassess public workers.dev quota-exhaustion risk, and the unproven stable ChatGPT `operation_id` ingress/private result storage; these remain V1 blockers, not reasons to expand this package.

## Bounded autonomy
Only read-only repository/public docs/available nonsecret cloud metadata, local verification and docs/fixtures if necessary; ordinary repairs to report; one dedicated Draft PR based on this authority. No new Worker implementation or another generic simulation sprint. Report what is observed vs unverified. Do not read credentials, query real D1, dispatch Actions, deploy, merge, reset/stash/clean/move other worktrees.

## Deliverable
`docs/v1-closure/CLOUD-QUALIFICATION-PREFLIGHT-DECISION-20261023.md` with evidence matrix, exact unknowns, migration risk, isolation choice, proposed one-run test budget, cloud authorization gates, and no-card requirement. Final COMPLETE / BLOCKED / TOTAL CONTROL DECISION REQUIRED with exact PR/CI and real-operation counters zero. Strict V1 remains 2/9; B1–B4 remain open.
