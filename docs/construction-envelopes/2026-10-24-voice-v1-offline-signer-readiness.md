# Voice V1 — offline one-window HMAC signer readiness (2026-10-24)

Authority: ShenShu total control. Read `nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md`, `continuity/v1-closure-baselines-2026-10-22.md`, and Voice V1 closure plan.

**AUTHORIZED: OFFLINE IMPLEMENTATION, TESTS, CI, EVIDENCE AND ONE DRAFT PR. FORBIDDEN: REAL KEY GENERATION/READ, NETWORK REQUEST, CLOUD CONFIG, DEPLOY, ROUTE, REAL D1, PROVIDER, MERGE. STOP AFTER THIS PACKAGE; USER REQUESTED REST.**

## Baseline
Authority parent PR #116 head `2728b5f8240d916f36155919e4697fedd014a588`; CI #361 success, 349/349 Node24. Cloud account `5a1af7ea0ef8f8aea6365306d775a894`, dormant qualification Worker `shenshu-voice-v1-qualification-20261024`, cloud version `2320fd44-294c-4789-91bd-c20694254eca`, dedicated D1 UUID `234913cd-8901-4607-8147-31c4a4317111`. User dashboard observed Production/Version URLs off, routes/domains 0, 0 requests, one DB binding. Explicit `workers_dev:false`/`preview_urls:false` exists in PR #114 repo manifest but is not redeployed. Strict V1 2/9; B1–B4 open.

## Opening gate
Verify origin, worktree, branch/HEAD, PR chain and CI; read `src/worker-signed-request.js`, `worker/signed-d1-worker-bridge.js`, `worker/qualification-entry.js`, `test/fixtures/hmac-route-window-budget.mjs`, `docs/v1-closure/HMAC-ROUTE-WINDOW-READINESS-20261024.md`. No reset/stash/clean/rebase/merge.

## Deliverable
Build a **standalone, local-only, nonbillable, non-networking signer preparation tool** that prepares a canonical request object for the future 24-request qualification plan. It must not actually send requests or access Cloudflare. Prefer a pure library with a narrowly scoped CLI that consumes a *synthetic test key only in tests* and has a future secure non-echo input design, not a real credential prompt this round. Do not generate, read or persist any real key in this package. No source text, voice/audio, provider calls or real D1 mutation.

Security invariants:
- Reuse existing canonical HMAC signer rather than inventing a second protocol. Bind exact POST/host/path/content-type/raw body hash/timestamp/nonce/key ID.
- Validate exact qualification hostname and fixed path set; forbid Version/Preview/custom/nested host, query/fragment, wrong DB/worker identity, invalid body, request IDs or principal. Never trust a caller-provided principal without a verified future admission source.
- No automatic retry, network fetch, credential logging, shell argument secret, file output of secrets, request body or signed header. Ensure CLI stdout/stderr only emits safe redacted metadata and STOP codes.
- Stable operation_id provenance is not yet proven for future ChatGPT ingress; do not pretend this offline tool solves it.
- Reuse plan-only budget fixture; fail closed before any would-be send when next request would exceed 24 HTTP, 18 D1-touching, 10 admission, 32 row-write, 512 read, 64 statement, 256 KiB, 20-minute, 0 provider ceilings. Do not consume quota or invoke any cloud endpoint in tests.
- Tests include canonical signature determinism with synthetic keys, rejection cases, secret redaction and stdout/stderr, replay/no-retry behavior, zero-network trap, budget exhaustion and CLI no-side-effects. Maintain Node20 + Node24 Linux CI, 0 skipped Node24 SQLite.
- Do not change `server.js`, public MCP, D1 schema, deployed Worker, Wrangler config, Render/Auth0 or provider.
- If a safe CLI cannot be delivered without real key or live endpoint, STOP and document a library-only solution.

## Completion and STOP
Create `docs/v1-closure/OFFLINE-SIGNER-READINESS-20261024.md` with exact files/tests/CI, threat model, usage limited to synthetic offline demonstration, future secret injection and operator approval gaps. One dedicated branch and Draft PR stacked on this authority. Report COMPLETE/BLOCKED/TOTAL CONTROL DECISION REQUIRED. All real cloud/keys/provider/deploy/request counters zero. Do not schedule or start another construction package afterward. User requested rest after this one.
