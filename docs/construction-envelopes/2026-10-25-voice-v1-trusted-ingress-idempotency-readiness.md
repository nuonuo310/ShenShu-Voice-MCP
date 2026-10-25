# Voice V1 — trusted principal, stable operation_id and secure signer ingress readiness (2026-10-25)

Authority: ShenShu total control. Read `nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md`, `continuity/v1-closure-baselines-2026-10-22.md`, `docs/v1-closure/V1-CLOSURE-PLAN.md`.

**AUTHORIZED: READ-ONLY INVESTIGATION, OFFLINE DESIGN, NARROW TEST/IMPLEMENTATION PROPOSAL, LOCAL VERIFICATION, CI, DRAFT PR. NO REAL SECRETS, CLOUD MUTATION, ROUTE, REAL D1 REQUEST, DEPLOY, MINIMAX, MERGE.**

## Baseline
Repo `nuonuo310/ShenShu-Voice-MCP`, authority parent PR #118 head `ed9fba65014a455e303698ba7d54d63bc8752c0b`, CI run `40123120802` SUCCESS, Draft/unmerged. 360/360 Node24. The offline signer `src/offline-hmac-signer.js` and CLI are synthetic-only and do not provide real trusted ingress.

Cloud account `5a1af7ea0ef8f8aea6365306d775a894`; dedicated qualification Worker `shenshu-voice-v1-qualification-20261024`, deployed dormant version `2320fd44-294c-4789-91bd-c20694254eca`; dedicated D1 `234913cd-8901-4607-8147-31c4a4317111`. User-observed production and version URLs disabled, no routes, 0 invocations. Manifest in repo `workers_dev:false`, `preview_urls:false`, not redeployed. Old `shenshu-voice-budget-test` and Asteria Workers forbidden. Strict V1 2/9, B1–B4 open.

## Opening gate
Verify exact origin/worktree/branch/HEAD and Draft PR stack, CI, and continuity authority. Read `src/offline-hmac-signer.js`, `src/offline-hmac-signer-cli.js`, `src/worker-signed-request.js`, `src/v1-transport-idempotency.js`, `worker/qualification-entry.js`, `worker/signed-d1-worker-bridge.js`, `src/d1-operation-sql.js`, `docs/v1-closure/HMAC-ROUTE-WINDOW-READINESS-20261024.md`, `docs/v1-closure/OFFLINE-SIGNER-READINESS-20261024.md`. Do not reset/stash/clean/rebase/move existing worktrees.

## Core questions
1. Identify the **actual trusted principal source** in current Auth0/Render/MCP flow, and distinguish verified JWT principal from client-supplied principal. Trace exact entrypoint to server-side signer, never trust a body principal, approval, grant, model, voice or requestId. Do not read real Auth0 secrets or tokens.
2. Design stable `operation_id` ingress across ChatGPT MCP transport retry, reconnection and process restart. Decide whether client-provided opaque operation_id can be trusted as an idempotency key only after principal binding and strict validation, or whether a server-issued durable intent is required. Include lost response, same-key/different-payload, concurrent requests, cross-principal and UTC day boundary. Do not claim a transport guarantee not observed.
3. Define safe, operator-controlled HMAC secret lifecycle: CSPRNG 32 bytes, 43-char base64url, no-echo input, no command-line args/history, no file/Git/PR/log/screenshot leaks, no real secret creation in this package. Clarify signer-to-Worker key equality, one-key-per-version limit and revoke/disable order. No new paid services.
4. Determine whether a minimal dormant, offline-only trusted signer adapter can be implemented without production route changes. Prefer focused tests and explicit fail-closed contracts. If the design needs live principal proof or irreversible schema change, STOP with TOTAL CONTROL DECISION REQUIRED rather than implementing an assumption.
5. Prepare an exact future operator authorization packet for first nonbillable cloud request: account/Worker/D1 identity, actual workers.dev subdomain verification, current deployed version, disabled Version/Preview URLs, request budget 24 HTTP / 18 D1-touching / 10 admission / 32 row writes / 512 rows read / 64 statements / 256 KiB / 20 min / 0 provider. Keep each gate (secret, deploy, route, request, revoke) independently authorized.

## Boundaries
May read source/docs, run offline tests, create task-specific docs/tests and narrowly scoped dormant code if justified, push one Draft PR. No real credential read/generation, Cloudflare API or D1 access, Worker redeploy, route/Preview enable, Render/Auth0 changes, public MCP modification, production paid route activation, MiniMax/provider, payment/upgrade, manual Actions dispatch or merge. No duplicate general simulation sprint. If a trusted source cannot be demonstrated from code, explicitly mark unproven.

## Deliverables
Write `docs/v1-closure/TRUSTED-INGRESS-IDEMPOTENCY-DECISION-20261025.md`: trust-boundary diagram, actual call path, operation_id decision and counterexamples, secret lifecycle, test evidence, blocker inventory, next exact approval. If code changes are justified, only isolated dormant adapter/tests; Node24 CI must run SQLite without skips. Report COMPLETE / BLOCKED / TOTAL CONTROL DECISION REQUIRED with exact HEAD/PR/CI and all real cloud/provider counters 0. V1 stays 2/9.
