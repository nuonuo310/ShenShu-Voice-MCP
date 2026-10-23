# Voice V1 bounded construction — offline transactional operation admission (2026-10-23)

Authority: ShenShu total control, Continuity continuous-construction rules and `docs/v1-closure/V1-CLOSURE-PLAN.md`. Target: `nuonuo310/ShenShu-Voice-MCP` only.
Status: **AUTHORIZED for additive schema FILE, offline transactional adapter, local SQLite/fake-D1 testing and Draft PR only. NO REAL DATABASE, NO LIVE TOOL OR PAID PROVIDER.**

## Fixed V1 boundaries
Strict V1 2/9; B1 iPhone actual audio silent; B2 paid D1/wiring; B3 private result + fail closed; B4 one explicitly approved MiniMax smoke. No V1 expansion. Exact parent PR #91 head `2ae28223ec58172663a476deaf21f5c186563372`, base/authority PR #90 `f6621f67da73f594088504578e3b2109cb54671f`. PR #91 is Draft/CI #325 success. Read `docs/v1-closure/V1-IDEMPOTENCY-DECISION-20261023.md` and PR #91 total-control review. This package is the only authority for next offline stage.

## Opening Gate
Verify exact origin, current worktree/branch/head/clean status, parent and stacked PR topology, source/schema identity and no concurrent conflicting worktrees. Inspect `src/v1-transport-idempotency.js`, `src/d1-http-paid-store.js`, `src/d1-paid-store.js`, `src/durable-paid-admission.js`, `src/v1-offline-paid-pipeline.js`, `db/d1/001_paid_voice_reservations.sql`, `db/d1/002_paid_voice_grants.sql`, local tests and qualification reports. Check frozen prod status and no assumptions about Cloudflare D1 HTTP transaction semantics. STOP on drift; do not reset/stash/clean/move other worktrees.

## Goal
Develop a minimal independently reviewable offline implementation of approved additive `db/d1/003_paid_voice_operations.sql` and server-owned operation idempotency/admission path that binds (verified principal, operation_id, exact text digest/bytes, action, expiry) durably with reservation and one-use grant. Preserve existing reservation/grant schema and SQL semantics. No real D1 migration. A single logical operation may cause at most one fake provider attempt across sequential/concurrent duplicate transport deliveries and process restart; expired, pending and unknown states fail closed; completed operation can only return a separately authorized private opaque reference if actually persisted. Different intentional operations with identical text remain distinct.

## Safety-first architecture choices
- The recommended `operation_id` is a required opaque key on the **future** paid tool only; design offline contract/tests. No existing MCP route, tool, or public interface modifications. Caller controls only well-formed operation ID and text; verified OAuth principal and grant/quota/provider identity are server-owned. Document limitation: untrusted client may generate a new ID; actual ChatGPT retry stability must be manually proven before paid activation.
- Additive operation table state machine proposed in PR #91: admitted, provider_pending, completed, unknown, with uniqueness on principal+operation_id and request_id/grant_id and FKs to unchanged reservations and grants. Explicit no secrets/plaintext audio in rows.
- Verify transaction behavior against **real SQLite local transactions** and separately simulated D1 HTTP batch contract, not just an in-memory JS map. Important: Cloudflare REST execution is NOT proven transaction-capable. If existing D1 HTTP API cannot guarantee one atomic batch, do not fake it by three independent HTTP calls. Report TOTAL CONTROL DECISION REQUIRED with smallest alternate Worker binding/transaction architecture instead of claiming PASS.
- For duplicate operation read: same principal, same operation ID and same digest may return disposition; mismatch => conflict; provider_pending/unknown/expired => no new provider attempt and no refund. Real failed response/timeout/partial batch => fail closed even if reservation outcome unknown.
- Prove uniqueness of grant/operation owner; transitions conditioned on same principal/request ID and legal prior state; reject malformed/multirow/missing D1 responses, busy/conflict, concurrent arrival and replay after restarted process.
- Preserve future private result policy: no public permanent URL, bearer in query, or raw audio stored in operations. Do not add a storage provider or actual ticket issuance in this package.

## Allowed autonomous execution
New dedicated branch from exact authority commit; modify ONLY `db/d1/003_paid_voice_operations.sql` (new file), relevant `src/` modules (new preferred), task-specific `test/` and `docs/`. May run local SQLite and injected fake D1, ordinary repairs, targeted/full Node tests, syntax/diff checks, collect evidence, commit/push and one Draft PR stacked on `docs/voice-v1-transactional-operations-offline-20261023`. Source-level provenance and changed-file discipline required.

## Hard STOP
NO real Cloudflare API/D1 read/write/DDL/migration, no credential/provider voice ID reads, no MiniMax/paid calls, no Render/Auth0 changes, deployment, connector refresh, GitHub Actions dispatch, merge, paid MCP tool registration, modification of public MOCK, production `server.js`, protected OAuth resource/registration, `package.json`, old reservation/grant migrations or V1 DONE LINE. Any inability to realize atomicity on the intended D1 HTTP path is a total-control decision, not a success.

## Acceptance
- Local full atomic transaction with 12 concurrent attempts limit 3, same-operation replay, same text different operation, cross-principal/owner checks, grant once, UTC-day boundary, failures/partial returns, crash/restart, unknown provider and completion store failure.
- Prove fake provider calls <=1 per operation; failure before grant consume =>0.
- Distinguish local SQLite atomicity from real Cloudflare D1 execution; do not conflate.
- Write `docs/v1-closure/TRANSACTIONAL-OPERATION-OFFLINE-DECISION-20261023.md` with exact HEAD, diff, CI, verified results, unresolved D1 transaction question, ingress evidence gap and approval prerequisites for any real D1.
- Final receipt COMPLETE / BLOCKED / TOTAL CONTROL DECISION REQUIRED; strict 2/9, B1-B4 open; all real Cloudflare/D1/provider/credential/deploy/connector/merge counters 0.
