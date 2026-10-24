# Voice V1 — deployed Worker route/preview isolation review (2026-10-24)

Total control: ShenShu. Governing `nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md`, `continuity/v1-closure-baselines-2026-10-22.md`, and V1 closure plan.

**OFFLINE/READ-ONLY ONLY. DO NOT ENABLE ANY ROUTE, SECRET, REQUEST, D1 WRITE, DEPLOYMENT OR PROVIDER.**

## Real cloud evidence from user
User explicitly approved creation/deployment of a dormant qualification-only Worker. Windows PowerShell verified local branch `work/voice-v1-qualification-worker-deploy-readiness-20261024` HEAD `f2be0699f5e480c0489856e7ad15877cfa0a3eb0`, clean worktree, correct origin. Wrangler 4.152.0 installed in separate tools folder. `wrangler whoami` showed account ID `5a1af7ea0ef8f8aea6365306d775a894`, matching dashboard account. Missing optional OAuth scopes did not block deployment; no token refresh was authorized. Dry-run built 42.03 KiB / gzip 9.58 KiB, exact D1 binding. Name collision read returned Worker not found (10007).

Operator then ran once:
`wrangler deploy --config .\\wrangler.qualification.json --strict`
Result: uploaded Worker `shenshu-voice-v1-qualification-20261024`, `No targets deployed`, version `2320fd44-294c-4789-91bd-c20694254eca`. User dashboard screenshot shows Ready, workers.dev Disabled, domains 0, no custom domain/routes, no Worker/queue triggers, one `DB` binding to dedicated qualification D1, 0 invocations and 0 errors. This is **user-observed dashboard and CLI evidence**, not an independent Cloudflare API attestation. No HMAC secret or activation tuple configured. Preview URL exposure has not been independently established.

Dedicated D1 `shenshu-voice-v1-qualification-20261024`, UUID `234913cd-8901-4607-8147-31c4a4317111`, has user-observed 3 business tables, 2 explicit indexes, 7 autoindexes, zero business rows and no FK violations. Old D1 `shenshu-voice-budget-test` UUID `c39a6895-7028-4f59-a100-1455b92c96c1` is FORBIDDEN.

## Opening gate
Read-only verify exact repo, clean worktree, PR #111 and its stack, current HEAD and latest CI, `worker/qualification-entry.js`, `wrangler.qualification.json`, `worker/signed-d1-worker-bridge.js`, Cloudflare official docs for preview URLs, workers.dev, deployments, route disable and rollback. Do not read Cloudflare credentials or query live Worker/D1 unless a previously authorized nonsecret read-only view exists; if unavailable, record unverified.

## Work to perform
1. Preserve operator-reported deployment evidence with exact Worker name, account ID, D1 UUID, version ID, CLI command, no-target result and screenshot observations. Separate observed from inferred.
2. Verify with official Cloudflare primary sources whether Preview URLs / Version URLs are enabled by default, how to disable them and whether disabling requires a new deployment. Distinguish `workers_dev: false` from preview settings; do not claim full isolation until verified.
3. Review existing dormant activation guard, missing-secret behavior, HMAC-before-D1 ordering, and possibility of unauthorized public requests consuming Free quota. Identify any need for a manifest-only change, but do not silently modify deployment configuration or perform deploy.
4. Recommend the minimal, reversible, Free/no-card route strategy for later bounded signed qualification. Require one new test-only HMAC key, exact hostname binding, explicit short-lived enablement and revocation, no Access/Zero Trust payment path.
5. Prepare a gated operator packet: exact current Worker/DB/account/version identity, route/preview disable steps, zero-request preflight, expected outcomes, STOP and rollback, and separate future approvals for any config update, test secret, route activation, D1 request run.
6. No additional generic offline implementation sprint; this is a narrow security/readiness review. V1 strict 2/9, B1–B4 open.

## Scope / STOP
May read repo and public official docs, create report/fixtures only if needed, push a dedicated branch and one Draft PR. No Cloudflare API mutation, Worker redeploy, route/preview toggle, HMAC secret, D1 query/write, provider/MiniMax, Render/Auth0/connector, payment, manual Actions dispatch, merge, or touching existing Asteria Workers. If preview security cannot be established without cloud access, say so and STOP at decision gate.

## Deliverable
`docs/v1-closure/WORKER-ROUTE-PREVIEW-ISOLATION-DECISION-20261024.md` with verified primary-source citations/URLs, operator evidence, remaining uncertainties, proposed minimal reversible route lifecycle, separate authorization gates and exact no-cloud-action counters. Final COMPLETE / BLOCKED / TOTAL CONTROL DECISION REQUIRED. No V1 gate increment.
