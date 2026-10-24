# Voice V1 — HMAC key and temporary route qualification readiness (2026-10-24)

Total control: ShenShu. Follow `nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md`, `continuity/v1-closure-baselines-2026-10-22.md`, `docs/v1-closure/V1-CLOSURE-PLAN.md`.

**AUTHORIZED: OFFLINE REVIEW, FIXTURES, TESTS, DOCUMENTED OPERATOR PLAN, DRAFT PR. FORBIDDEN: CLOUD MUTATION, REAL KEY GENERATION/READ, ROUTE ENABLE, WORKER REDEPLOY, REAL D1 REQUEST, PROVIDER, MERGE.**

## Fixed baseline
Parent PR #114 head `0d00e4076267d7061ba1d0dbdfb6cd23534240a7`, CI #359 success, local operator Wrangler 4.152.0 dry-run successful. Manifest explicitly has `workers_dev:false`, `preview_urls:false`, exactly one D1 `DB` binding to UUID `234913cd-8901-4607-8147-31c4a4317111`. Current cloud deployment remains older version `2320fd44-294c-4789-91bd-c20694254eca`, not redeployed from PR #114. User-observed Cloudflare Domains panel: Production workers.dev Disabled, Preview Version URLs Disabled, no custom routes/domains; no Preview/Deployment URL inventory attestation. Account ID `5a1af7ea0ef8f8aea6365306d775a894`, Free/no-card user confirmed. Worker name `shenshu-voice-v1-qualification-20261024`. Old `shenshu-voice-budget-test` and all Asteria Workers forbidden.

## Opening gate
Verify Git origin, clean worktree, branch/HEAD and Draft PR #111–#114 dependency chain, CI and exact manifest/Worker source. Read `worker/qualification-entry.js`, `worker/signed-d1-worker-bridge.js`, `src/worker-signed-request.js`, `worker/private-d1-worker-candidate.js`, `docs/v1-closure/CLOUD-QUALIFICATION-PREFLIGHT-DECISION-20261023.md`, `docs/v1-closure/WORKER-ROUTE-PREVIEW-ISOLATION-DECISION-20261024.md`. Do not reset/stash/clean/rebase/move other worktrees.

## Objectives
1. Produce a test-only HMAC key lifecycle plan: secure generation by operator, exact required key length/encoding, key ID, secret provisioning to Worker and an ephemeral signer, never paste secrets into chat/Git/PR/log/command history. No actual key created or read in this package.
2. Determine how the expected hostname is established from Cloudflare workers.dev subdomain without assuming account name equals subdomain. Verify activation host regex and HMAC signed host/path/body/timestamp/nonce contract. Assess how to enable/disable workers.dev and whether Version URLs remain disabled; explicitly review risk of public quota exhaustion and short-lived window.
3. Check whether a future secret/activation update creates a new Worker version and can unintentionally open preview/route. Prepare a safe sequence: account/identity check, frozen artifact review, key provisioning, activation while route closed, signed client preparation, route enable, capped probes, immediate disable/revoke. Do not conflate deploy with route activation.
4. Design a deterministic, single-run nonbillable signed request harness/fixtures, with no provider client or text/audio, for the 24 Worker HTTP / 18 D1-touching / 10 admission / 32 D1 row-write units / 512 rows read / 64 statements / 256 KiB / 20-minute caps from PR #104. Explicit STOP on unknown results, no blind retries, no cleanup or compensating writes. Prove budget accounting in offline tests if feasible.
5. Identify any mismatch in the currently dormant Worker implementation or deploy manifest that would prevent safe future test activation. If code changes are necessary, keep them narrow and offline, document diff and retest; do not change production `server.js`, paid MCP tools, Render/Auth0, D1 schema or old database.
6. Deliver an operator-ready but **UNEXECUTED** runbook with distinct explicit approvals for new test key, any Worker config redeploy, route enablement, live signed requests, route disable and key revocation. No cloud action until each authorization.

## STOP and evidence
No Cloudflare API calls, Worker/route/preview changes, HMAC secret creation/reading, D1 query/DML, MiniMax/provider, production/Render/connector change, payment/upgrade, manual Actions dispatch or merge. Do not print or log sensitive values. Public workers.dev can consume Free quota even when HMAC fails; do not claim HMAC solves availability. Keep strict V1 2/9 and B1–B4 open.

## Delivery
Create `docs/v1-closure/HMAC-ROUTE-WINDOW-READINESS-20261024.md`, optional isolated tests/fixtures and narrow code corrections if justified, verify full Node 24 Linux CI, commit/push one dedicated branch and Draft PR based on this authority. Report COMPLETE/BLOCKED/TOTAL CONTROL DECISION REQUIRED with exact HEAD/CI, identified safety risks, planned request/write counters and zero real cloud/provider actions.
