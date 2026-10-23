# Voice V1 bounded continuous construction — transport idempotency safety gate (2026-10-23)

Authority: ShenShu total control, `nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md`, `continuity/v1-closure-baselines-2026-10-22.md`, and `docs/v1-closure/V1-CLOSURE-PLAN.md` in this repository. Target `nuonuo310/ShenShu-Voice-MCP` ONLY.

**Status: AUTHORIZE OFFLINE CONTRACT ANALYSIS, BOUNDED IMPLEMENTATION/TESTS AND DRAFT PR ONLY. NOT AUTHORIZED: real D1, migrations, paid provider, deployment, connector refresh or merge.**

## Frozen V1 outcome
Strict V1 is 2/9; B1 iPhone host audio silent, B2 real D1 and paid wiring, B3 fail-closed/private delivery, B4 one explicit paid E2E remain open. Do not change DONE LINE or add emotion TTS, auto voice, segmentation, favorites, history or commercial multi-user scope. S1/S2 PR #86 and S3 PR #89 remain Draft. Parent S3 head `7f74a5f3e1345c20e9ee0575a52bb84c566c2e64`; authority branch is based on exactly that SHA. Review PR #89 total-control review and `docs/v1-closure/S3-D1-QUALIFICATION-DECISION.md`.

## Opening Gate
Verify remote/origin, local worktree map/clean status, current HEAD/base, all stacked open PRs, relevant CI, and canonical code in `src/v1-offline-paid-pipeline.js`, `src/durable-paid-admission.js`, `src/d1-http-paid-store.js`, `src/d1-paid-store.js`, `db/d1/`, `src/staging-authenticated-mcp.js`, `server.js` and tests. Preserve other worktrees; never reset, stash, clean, move or rewrite predecessors. Stop on material identity drift.

## Core security problem and approved semantics
Current server creates a fresh requestId per invocation. A repeated ChatGPT tool request may therefore obtain a new reservation/grant and trigger a second provider attempt. The local text SHA256 digest is NOT durably bound to D1. This is a V1 blocker; do not mislabel it as a future optimization.

Design an explicit **one logical user action -> at most one chargeable provider attempt** contract across duplicate transport deliveries, concurrent instances, timeout and uncertain response. The key must be generated/bound by a trusted server-side ingress or a narrowly validated client-generated operation ID with authenticated principal, fixed text digest and bounded validity; never accept arbitrary caller approval, grant, principal, model or voice. A bare identical text string across separate intentional user actions is NOT a safe dedupe key. Persist binding atomically with reservation and one-use grant; no process-local-only map as production truth. Distinguish request replay returning an existing completed result from an ambiguous outcome: do not re-call MiniMax when outcome is unknown. No automatic refund/retry after a potentially billable attempt. Preserve max daily attempts, grant consumption and public MOCK isolation.

**Architecture stop:** The existing D1 schema lacks durable text digest/operation binding. Do not silently add DDL or change production contracts. First propose smallest schema/protocol choice and analyze alternate approaches. If a correct implementation requires DB migration, new public MCP args, new privileged endpoint or changes to frozen tool registration, stop with TOTAL CONTROL DECISION REQUIRED and present precise minimal diff, schema/index, trust ownership and rollout/rollback plan. In-scope pure JS contracts, in-memory SQLite fixtures, adapter hardening and tests may be completed without crossing that boundary.

## Allowed autonomous execution
New task branch from exact authority commit. Modify only relevant `src/`, `test/`, `docs/` (and offline test fixtures) as needed. Implement fail-closed idempotency contract modules and offline tests only if no frozen interface/schema crossing. Ordinary failures self-fix and rerun. Test same-operation sequential/concurrent replay, distinct intentional operations with identical text, cross-principal/key collisions, text mismatch, lost response after possible provider attempt, partial D1 responses, expiry, UTC-day boundary, replay after process restart using shared durable-store fixture, daily limit, and no second provider call. Verify exact source-level provider call count and no secret exposure. Keep provider injected fake, D1 in-memory only. Run targeted and full `node --test`, JS syntax, `git diff --check`, and source compatibility tests.

## Forbidden / STOP
No real Cloudflare API/D1 read/write/DDL/migration, credential access, MiniMax calls, real billing, Render/Auth0 updates, staging/production deployment, connector refresh, GitHub Actions dispatch, PR merge/rebase/rewrite, production MCP registration or public route exposure. If exact source and schema constraints preclude robust idempotency without crossing frozen boundaries, do not fake a PASS: finish decision packet and stop.

## Write endpoint / receipt
Commit/push only a dedicated implementation branch; create ONE Draft PR stacked on `docs/voice-v1-idempotency-gate-20261023`. Report `docs/v1-closure/V1-IDEMPOTENCY-DECISION-20261023.md` with exact SHA, changed files, tests, validated/unknown security guarantees, smallest authorization needed next, and V1 strict 2/9/blocker status. Final COMPLETE / BLOCKED / TOTAL CONTROL DECISION REQUIRED. All real D1, provider, secret, deploy, refresh and merge counters expected zero.
