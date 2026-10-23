# Voice V1 — Cloudflare D1 atomicity architecture decision package

Authority: ShenShu total control; read `nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md`, `continuity/v1-closure-baselines-2026-10-22.md` and this repo's `docs/v1-closure/V1-CLOSURE-PLAN.md`.

**AUTHORIZED: read-only architecture investigation, local nonbillable contract probes, decision report, dedicated Draft PR. NOT AUTHORIZED: cloud resources, real D1 queries/migrations, secrets, deployment, paid tool registration, provider call or merge.**

## Opening Gate
Target repo `nuonuo310/ShenShu-Voice-MCP`, baseline PR #93 `work/voice-v1-transactional-operations-offline-20261023` head `8c3f9d0ecc9ea8a4f1ceb4623c2a652dcff598cc`, CI #328 success, Draft. Verify actual remote, worktrees, clean status, branch/head, PR stack and any concurrent changes. Read PR #93 review and `docs/v1-closure/TRANSACTIONAL-OPERATION-OFFLINE-DECISION-20261023.md`, `src/cloudflare-d1-http.js`, `src/d1-transactional-operation-store.js`, `src/d1-operation-sql.js`, `db/d1/003_paid_voice_operations.sql`, tests, Render staging boundaries and existing D1 dry-run evidence. Never reset/stash/clean/move other worktrees; STOP on identity drift.

## Exact decision goal
Determine a credible, minimal, **provably atomic** implementation path for (reservation, one-use grant issue, operation binding, grant consume) on real Cloudflare D1 while the protected ChatGPT MCP server is hosted on Render. Compare:
A. Cloudflare Worker with native D1 binding and documented atomic batch/transaction behavior, invoked only from trusted Render server with explicit auth and fail-closed semantics;
B. an officially supported atomic D1 HTTP API route, only if current primary Cloudflare documentation proves it supports the required transaction;
C. Durable Object SQLite transaction, only as fallback with documented cost/operational tradeoffs.
Do not assume `POST /query` or multiple REST calls are one transaction. Validate native D1 batch rollback semantics and concurrency guarantees against current primary Cloudflare documentation, and distinguish API documentation from actual production evidence. If documentation cannot establish a guarantee, mark unresolved and specify the smallest separately authorized real-cloud nonbillable test.

## Required architecture output
- Trace identity/authentication from ChatGPT OAuth principal to Render trusted server to proposed Worker and D1; reject caller-supplied principal, grant, approval, provider parameters and unauthenticated Worker access.
- Show precise request/response and replay state machine, transaction boundary, operation_id binding, at-most-one provider attempt, ambiguous network timeout handling, UTC day-limit, and nonrefundable uncertain provider outcomes.
- Identify whether Worker adds a new secret or deployment surface, and give least-privilege auth, key handling (never output secrets), no public bypass, logging/redaction, rate limits, and rollback.
- Keep existing public MOCK /mcp and staging OAuth protected routes unchanged. No audio or bearer in query URLs. No live paid tool registration.
- Define one limited real-cloud qualification later: test-only principal/namespace, exact D1 identity/schema preflight, atomic rollback on deliberate failure, concurrent duplicate, daily limit, grant one-use, timeout ambiguity, no provider, capped writes, no retry/cleanup without separate approval. The earlier S3 D1 packet may need updating to account for the new operations table; don't execute it.
- Address Node 20 CI skipping Node 24 node:sqlite cases: recommend a reproducible test job/runner only if needed for confidence, without editing workflows in this package.
- Distinguish operation_id transport stability and private durable result delivery as separate blockers; architecture choice does not close them.

## Bounded autonomous work
Read-only repository and primary public documentation research; local source/test harness for protocol comparison only if useful; fix ordinary issues within new test/docs helper scope; run tests/checks; commit/push dedicated branch and create one Draft PR stacked on `docs/voice-v1-d1-atomic-architecture-review-20261023`. Prefer a concise architecture decision over another speculative implementation sprint. Report evidence links and dates. If evidence is insufficient, say TOTAL CONTROL DECISION REQUIRED with exact unresolved issue; no endless repeats.

## Hard STOP
No Cloudflare API or real D1 reads/writes/DDL, no Worker/Durable Object creation or deployment, no Render/Auth0 or connector changes, no credential reads, no provider/MiniMax calls, no GitHub Actions dispatch, no merges, no production server/tool/OAuth/schema modification, no cross-repo mutation. Do not touch original Call/Worker/Gallery. No V1 scope expansion.

## Receipt
Write `docs/v1-closure/D1-ATOMIC-ARCHITECTURE-DECISION-20261023.md` with verified source citations, option comparison, preferred minimum design, trust and transaction graph, remaining unknowns, one-run real D1 qualification plan and approval boundaries. Return COMPLETE / BLOCKED / TOTAL CONTROL DECISION REQUIRED, exact SHA/CI/PR, V1 strict 2/9 B1–B4 open, and zero counts for cloud/provider/credential/deploy/merge operations.
