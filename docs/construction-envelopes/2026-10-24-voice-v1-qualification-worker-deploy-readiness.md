# Voice V1 — qualification Worker deployment readiness, offline only (2026-10-24)

Authority: ShenShu total control. Follow `nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md`, `continuity/v1-closure-baselines-2026-10-22.md`, and `docs/v1-closure/V1-CLOSURE-PLAN.md`.

**AUTHORIZATION: OFFLINE implementation, review, tests, deployment manifest/rollback plan, Draft PR. NO real Cloudflare operations, no Worker creation/deployment, no D1 DML, no secrets, no Render changes, no MiniMax, no merge.**

## Verified baseline and exact target
Parent PR #109 head `f23c6f05c6f2a46fcabedfef19ed5e35a4476ae0`; schema freeze PR #106, Gate 0 amendments #107/#108. User-operated Cloudflare D1 Studio initialized the dedicated database `shenshu-voice-v1-qualification-20261024` UUID `234913cd-8901-4607-8147-31c4a4317111` with frozen 001/002/003. Screenshot evidence: 3 business tables, 2 explicit indexes, 7 autoindexes, 0 business rows, `PRAGMA foreign_key_check` 0 rows. This is real schema evidence, NOT atomicity or paid-path qualification. Old `shenshu-voice-budget-test` UUID `c39a6895-7028-4f59-a100-1455b92c96c1` is forbidden. User reports Cloudflare Free/no card. Strict Voice V1 2/9; B1–B4 open.

## Opening gate
Verify origin, clean worktree, exact branch/head and PR stack. Read `docs/v1-closure/REAL-D1-SCHEMA-INITIALIZATION-EVIDENCE-20261024.md`, `worker/signed-d1-worker-bridge.js`, `worker/private-d1-worker-candidate.js`, `src/worker-signed-request.js`, `db/d1/003_paid_voice_operations.sql`, `docs/v1-closure/CLOUD-QUALIFICATION-PREFLIGHT-DECISION-20261023.md` and CI. Do not reset, stash, clean, move or rewrite other worktrees.

## Goal
Prepare a **dormant, separately deployable qualification-only Worker artifact** that can be independently audited before any cloud activation. Prefer minimal `worker/qualification-entry.js` and an explicitly nonproduction Wrangler template, with no production `server.js`, public MCP or Render changes. No provider code/import, no audio, no user text, no public paid tool. Require fail-closed behavior if DB binding, HMAC verifier, expected host/path or test-only configuration is missing. Ensure D1 access is impossible before signature verification. Bind only to the dedicated UUID and use a unique test Worker name, e.g. `shenshu-voice-v1-qualification-20261024` (proposed, not created). Reject unsigned/forged/wrong-host/replayed or malformed calls and unauthorized operation transitions; preserve existing known nonce limitation and operation_id trust boundary. Public workers.dev request-quota exhaustion remains an availability risk.

## Concrete deliverables
1. Minimal Worker entrypoint and static deployment manifest/template with explicit DB binding name and exact UUID. Never include real HMAC secret; use documented secret names only, and never hardcode production account ID or keys.
2. Test-only activation guard and deterministic local request harness: invalid auth must produce generic 403 with **zero D1 prepare/batch**; no misconfiguration may silently fall back to old/shared D1; no provider path.
3. Offline tests for Cloudflare runtime compatibility and binding/route correctness, using local fake D1 and actual SQLite where feasible; Node 24 Linux CI must execute SQLite tests (no skip). Existing Node 20 job remains.
4. Operator-ready but UNEXECUTED plan: verify Free/no-card and account identity, create only named Worker, provision one new test HMAC key, attach only new qualification D1, hard caps, route enable/disable, request counters, abort conditions, rollback, key revocation and no cleanup of ambiguous D1 rows. Identify exact code/manifest hashes and separate approval points.
5. Reconcile the PR #104 proposed budget: max 24 Worker HTTP requests, 18 D1-touching, 10 admission, 32 D1 row-write units, 512 rows read, 64 statements, 256 KiB delta, 20-minute window, 0 provider calls. These are PLANNED ceilings, not permission to run.

## Hard STOP
No Cloudflare API, Worker creation/deployment, D1 read/write/migration, credential or payment-method access, Render/Auth0/connector modifications, public MCP registration, MiniMax/provider calls, GitHub Actions manual dispatch, merge or any production change. Do not operate or bind the old database or any existing Asteria Worker. If deployability requires modifying frozen trust contracts or introducing a new paid/Access dependency, STOP with a minimal total-control decision.

## Receipt
Write `docs/v1-closure/QUALIFICATION-WORKER-DEPLOY-READINESS-20261024.md` with exact files/HEAD/CI, test evidence, config/identity gates, no-card risk, public endpoint exposure, known operation_id/replay limitations, separate execution approvals and all cloud/provider counters 0. Commit/push dedicated branch and one Draft PR stacked on this authority. Final COMPLETE / BLOCKED / TOTAL CONTROL DECISION REQUIRED. V1 remains 2/9; no B1–B4 closure from offline evidence.
