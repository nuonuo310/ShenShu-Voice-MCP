# Voice V1 — card-free Render-to-Worker signed-request architecture review

Total control authority: ShenShu, grounded in `nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md` and `continuity/v1-closure-baselines-2026-10-22.md`, this repository's `docs/v1-closure/V1-CLOSURE-PLAN.md`, and PR #97 total-control review.

**STATUS:** AUTHORIZED READ-ONLY DESIGN/RESEARCH, LOCAL NONBILLABLE CONTRACT PROBES, TESTS, REPORT, DRAFT PR ONLY. NO REAL WORKER/D1/ACCESS, DEPLOYMENT, PAYMENT, KEYS, PROVIDER OR MERGE.

## Opening Gate
Repository `nuonuo310/ShenShu-Voice-MCP`. Exact parent PR #97 head `697ca9ab78aacd68a6c586f7222e0a04aab5423a`, based on PR #96 authority `e1ab11d4374cdd77c149dfc30c3f564361aa309c`; CI #335 success, Node 20 SQLite skips explicit. Verify remote, current worktree, HEAD, clean status, PR topology and no concurrent conflicting changes. Review `worker/private-d1-worker-candidate.js`, `docs/v1-closure/PRIVATE-WORKER-OFFLINE-READINESS-20261023.md`, staging Render identity, Cloudflare binding plan and V1 closure. Never reset/stash/clean/move other worktrees. STOP on drift.

## Decision goal
Investigate the smallest **card-free** defensible authentication and authorization channel from Render's already verified OAuth MCP server to a Cloudflare Worker using native D1 `env.DB.batch()`, without requiring Cloudflare One/Access onboarding/payment details. Cloudflare Workers/D1 Free limits alone do not prove account eligibility, cost-free operation or security. Do not mistake publicly reachable Worker URL for a private service. If no credible way to prevent direct unauthenticated or replayed database mutations exists, recommend BLOCKED rather than weakening safety.

Compare:
A. HMAC-SHA256 signed canonical request (timestamp, method, exact path, bounded raw body hash, one-use nonce/operation binding, explicit key ID) with secret exclusively held in Render and Worker; strict skew, replay and rotation contract.
B. Asymmetric signed requests with Worker holding only trusted public verify keys and Render private signer; rotation and cold-start considerations.
C. Other documented free/no-card mechanism only if primary documentation supports complete security guarantees.
Access remains declined due to user no-card requirement. No bearer, signature, token or credential may leak to logs, URLs, MCP results or client.

## Required trust analysis
- OAuth verified principal only on Render; caller cannot submit principal/grant/approval/model/voice or raw SQL directly. The Worker receives a claim only through a verified server-signed request, enforces rigid schema/fixed SQL and requires an explicit deployment-side auth verifier to be installed; fail closed if missing.
- Timestamp alone does not prevent replay; design durable nonce/operation replay treatment across Worker instances and independent requests, leveraging already planned D1 operation ID where appropriate. Explain bootstrap and timing: do not allow unauthenticated nonce-check to mutate D1, and do not create replay races outside atomic admission. Distinguish safe duplicate operation disposition from forged new operation.
- Protect against confused-deputy behavior, cross-principal operation collisions, body canonicalization inconsistencies, content-length abuse, path spoofing, key rotation mismatch, clock drift, unsigned headers and signature validation timing.
- Compare two options' operational, cryptographic and Cloudflare Free cost uncertainties; pick the **minimum V1** if supported.
- Provide a safe, bounded **future cloud qualification**: deploy/credential provisioning and signed/unsigned/forged/replay/expiry/rollback/concurrency negative tests, with explicit approvals, maximum D1 writes, no provider call, and cleanup/rollback. Do not perform any now.
- Analyze Node 20 CI skip issue and recommend a narrow reproducible Node 22+ offline job only when material to acceptance.

## Authorized execution
Only read source/public primary documentation, implement small isolated pure verification/fixture helpers under task-relevant `src/`, `worker/`, `test/` and `docs/` if they strengthen the decision without changing frozen contracts. May perform autonomous local tests, ordinary repairs, commit/push and one Draft PR based on this authority branch. Report concrete security proof levels, docs citations, and what remains uncertain. Do not repeat full Worker implementation or expand product features.

## Hard STOP
No Cloudflare API/D1 reads, writes, migration or Worker/Access creation/deploy; no payment details or plan selection; no provider/MiniMax call; no real credentials or voice ID access; no Render/Auth0/config/connector change; no production MCP/tool registration or public /mcp/CSP/schema/workflow modification; no GitHub Actions dispatch, merge or rewriting predecessors. Current strictly **2/9** V1 gates; B1–B4 OPEN. If signed-request alternative cannot be credibly bounded under Free/no-card, escalate and recommend pause, not unsafe public Worker use.

## Deliverable
Write `docs/v1-closure/WORKER-SIGNED-REQUEST-DECISION-20261023.md`; detail selected design, exact trust boundary, on-wire shape (no real secrets), replay consistency proof path, cloud cost/no-card gates, required separate approvals, and counters for real operations (all zero). Run targeted/full offline tests, syntax and diff checks. Return COMPLETE / BLOCKED / TOTAL CONTROL DECISION REQUIRED with exact head, CI and Draft PR. Preserve DONE LINE unchanged.
