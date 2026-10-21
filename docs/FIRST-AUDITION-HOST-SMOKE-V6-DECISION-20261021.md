# First audition host smoke v6 - readiness and decision package - 2026-10-21

Status: **TOTAL CONTROL DECISION REQUIRED. OFFLINE AUDIT, NARROW EVIDENCE FIXES, TESTS AND DRAFT PR COMPLETE. NO DEPLOYMENT, CONNECTOR REFRESH, REAL HOST CALL, DESKTOP OR IPHONE TEST WAS RUN.**

Authority: `docs/construction-envelopes/2026-10-21-first-audition-host-smoke-gate-v6.md`
at commit `b7a5d9d93b37b223b58eeb81c38e4657a3b5004c`.

Implementation commit: `f28fac3103cfbefebef6568a97d84a8f75464a83`.

## Opening gate

| Check | Recorded value |
|---|---|
| Repository | `nuonuo310/ShenShu-Voice-MCP` |
| Resolved worktree | `C:/Users/Administrator/Desktop/00_Desktop_Hub/03_Voice_and_Pet/ShenShu-Voice-First-Audition` |
| Git identity | `nuonuo310 <2584974449@qq.com>` |
| `origin/main` | `1cef5ada7f6af0b912b7d5bba2c42f4f776bb828` |
| Authority branch | `docs/first-audition-host-smoke-gate-v6-20261021` |
| Authority SHA | `b7a5d9d93b37b223b58eeb81c38e4657a3b5004c` |
| Authority delta | One 34-line envelope document over v5; no code or workflow delta |
| Gate-time branch / HEAD | `work/first-audition-protected-probe-v5` / `f981c59b813c587bba21fa364cd868c036b670c8` |
| Gate-time worktree | Clean; one registered worktree at the resolved path; no other worktree moved, reset, cleaned or stashed |
| v5 PR #77 | Open Draft; head `f981c59b813c587bba21fa364cd868c036b670c8`; base v5 authority `9ed082d94e562375fdf4f689ab692ad16e126922` |
| v5 CI #309 | Run `39645064326`; completed success for `f981c59b813c587bba21fa364cd868c036b670c8` |
| v6 authority PR #78 | Open Draft; head `b7a5d9d93b37b223b58eeb81c38e4657a3b5004c`; base v5 implementation branch |
| Task branch | `work/first-audition-host-smoke-gate-v6`, created from exact v6 authority SHA |

The v5 registration, protected resource, UI bridge, readiness report, authentication tests, public composition, Render references and CI definitions were read at the gate. No unexpected tracked change, remote mismatch or concurrent worktree conflict was found.

## Delivered scope

Two narrow evidence defects were repaired inside the authorized `src/`, `ui/` and `test/` scope:

1. The OAuth UI build marker had remained `p2x-decode-v2-20261020`, so a real host screenshot could not distinguish the v5/v6 probe build from older UI. It is now exactly `v6-host-smoke-20261021`.
2. The OAuth generated-probe button could call `applyResponse` and then print `已交付` even if the returned record failed strict generated/NONBILLABLE validation. It now validates the exact generated record and all three nonbillable markers before displaying success.

No protected tool registration was added or removed. No deploy, account, connector, OAuth, JWKS, CSP, D1, provider or public-MCP change was made.

## Exact implementation diff

Base: `b7a5d9d93b37b223b58eeb81c38e4657a3b5004c`.

Implementation head: `f28fac3103cfbefebef6568a97d84a8f75464a83`.

`git show --stat f28fac3103cfbefebef6568a97d84a8f75464a83`: **5 files changed, 126 insertions, 5 deletions**.

| File | Change |
|---|---|
| `src/staging-authenticated-mcp.js` | Replaces the stale OAuth UI marker with the exact v6 build marker |
| `ui/mcp-bubble.html` | Validates the exact generated-shape record and NONBILLABLE tuple before reporting button success |
| `test/host-smoke-gate-v6.test.js` | New marker/resource/flag/public-surface/deployment-source audit tests |
| `test/protected-probe-v5.test.js` | Adds wrong-audience and expired-token rejection plus invalid-result no-success coverage |
| `test/p2x-oauth-bridge-audio-payload.test.js` | Updates the existing marker expectation |

The readiness report is the only additional file in the report commit.

## Source facts

| Area | Source fact | Evidence level |
|---|---|---|
| Public MCP | Public `/mcp` is composed by `createShenShuServer()` and exposes the existing fixed fixtures only; it does not import the v5 generated candidate or the protected probe | Source + offline |
| Main baseline | `origin/main` has no `src/generated-host-delivery-candidate.js` and no `probe_oauth_generated_delivery` registration | Git read-only |
| Protected route | `/paid-mcp` is handled by `src/protected-resource-shell.js`; the staging MCP server starts only after signature, issuer, audience, lifetime and `voice:speak` verification | Source + offline |
| Auth flag | `SHENSHU_AUTH_MCP_ENABLED` must equal `1`; otherwise `/paid-mcp` remains fail-closed or diagnostic-only | Source + offline |
| Fixture flag | The private resource and all private fixture probes, including `probe_oauth_generated_delivery`, exist only when `SHENSHU_PRIVATE_FIXTURE_ENABLED=1` | Source + offline |
| JWKS | Normal runtime uses the repository-pinned Auth0 JWKS cache. Static JSON requires the separately named test-only flag and must not be configured on Render | Source |
| D1 | `createD1AdmissionDryRun` returns `null` unless `SHENSHU_D1_ADMISSION_DRY_RUN_ENABLED=1`; the host smoke does not require that tool and must not set or call it | Source + offline |
| Resource | Protected UI URI remains `ui://shenshu/private-fixture-bubble-v2.html`; OAuth UI build marker is now `v6-host-smoke-20261021` | Source + offline |
| CSP | Protected UI keeps `connectDomains:[]` and only `https://shenshu-voice-mcp.onrender.com` in `resourceDomains` | Source + offline |
| Deployment source | No `render.yaml`, Dockerfile, Procfile, Fly, Wrangler, Vercel or Netlify configuration is tracked | Source + offline |
| GitHub workflows | Only `ci.yml` and manual read-only `d1-readonly-preflight.yml` are tracked; neither deploys the service | Source + offline |
| Production report | Historical docs state that Render auto-deployed prior commits after merges to main and identify `https://shenshu-voice-mcp.onrender.com` as the previously reported public service | Historical document, not live verification |

## Trust and route graph

Intended genuine-host path:

`ChatGPT OAuth connector -> Auth0 issuer/client -> authenticated /paid-mcp -> signature/issuer/audience/scope verifier -> private-fixture flag -> existing preview_private_fixture renders UI resource -> OAuth-only NONBILLABLE TEST button -> app-only tools/call probe_oauth_generated_delivery -> fixed synthetic WAV record -> explicit play click -> Web Audio decode/play`

Separate public path:

`public /mcp -> preview_shenshu_voice / preview_inline_audio / preview_hosted_tone -> public voice-bubble-v1 resource`

The protected probe is app-only and is not a model-visible public tool. The existing `preview_private_fixture` call is needed only to render the protected UI resource before the new button can be clicked.

## Critical isolation finding

The current protected-resource identity is hardcoded:

```js
PAID_RESOURCE = "https://shenshu-voice-mcp.onrender.com/paid-mcp"
AUTH0_ISSUER = "https://dev-nwr87q0tnrbjeapr.us.auth0.com/"
RESOURCE_METADATA_URL = "https://shenshu-voice-mcp.onrender.com/.well-known/oauth-protected-resource/paid-mcp"
```

A separate staging hostname cannot be safely tested with this source unchanged:

- the staging metadata document would still claim the production resource;
- the verifier would require a production-audience token;
- a token minted for staging could not match the hardcoded production audience;
- accepting a production-audience token at staging would collapse production/staging trust isolation;
- ChatGPT resource/audience matching may reject the different connector endpoint for reasons that cannot be determined without a real OAuth attempt.

Therefore a truly isolated staging host requires code parameterization plus a distinct Auth0 API/audience. That is an auth/infrastructure change and is outside v6. A deployment to the existing production hostname would preserve OAuth identity but would touch production, expose the probe to authenticated production connectors during the test window, require connector refresh and require an immediate rollback. It is not a staging isolation strategy.

## Offline validation

| Check | Result |
|---|---|
| Prechange baseline at v6 authority | 216 passed, 0 failed |
| Targeted host-smoke/auth/UI/CSP/public set (13 files) | 52 passed, 0 failed |
| Postchange full `node --test` | 220 passed, 0 failed, 0 skipped |
| `node --check` on changed JS and tests | Pass |
| Extracted `ui/mcp-bubble.html` module syntax | Pass |
| `git diff --check` / staged diff check | Pass |

Targeted command:

`node --test test/host-smoke-gate-v6.test.js test/protected-probe-v5.test.js test/generated-host-delivery-v4.test.js test/generated-web-audio-host-bridge.test.js test/p2x-ui-host-bridge-probe.test.js test/p2x-oauth-bridge-audio-payload.test.js test/p2x-private-fixture-mcp.test.js test/p2x-oauth-https-control.test.js test/p2x-mcp-resource-csp-parity.test.js test/inline-csp.test.js test/authenticated-stage.test.js test/verified-identity.test.js test/staging-rotating-jwks.test.js`

The offline matrix now explicitly covers:

- missing, fake, expired, wrong-scope and wrong-audience tokens rejected before fixture emission;
- protected probe absent when the private-fixture flag is off;
- app-only visibility and protected OAuth security scheme;
- empty-arguments-only invocation;
- exact fixed synthetic WAV provenance with `hostDeliveryTest:true`, `providerInvoked:false`, `billable:false` and no URL;
- public `/mcp` composition excludes the protected probe;
- v6 build marker present only in the OAuth resource;
- OAuth-only button posts `tools/call`, resolves the host response and waits for a subsequent explicit play click;
- invalid NONBILLABLE result cannot display a false success label;
- existing fixed WAV, private fixture, hosted tone, CSP, generated Web Audio and stale/decode failure regressions.

## GitHub delivery

| Item | Recorded value |
|---|---|
| Draft PR | #79, https://github.com/nuonuo310/ShenShu-Voice-MCP/pull/79 |
| PR state | Open Draft |
| PR implementation head | `f28fac3103cfbefebef6568a97d84a8f75464a83` |
| PR base | `docs/first-audition-host-smoke-gate-v6-20261021` at `b7a5d9d93b37b223b58eeb81c38e4657a3b5004c` |
| CI #311 | Run `39649098083`; `CI`; `pull_request`; completed success for `f28fac3103cfbefebef6568a97d84a8f75464a83` |

The report commit is docs-only. Final report-head CI is recorded in the task receipt and PR checks.

## Isolation options

### Option A - recommended minimum safe isolation

Create a new bounded envelope for a small code/config change that derives the protected resource and metadata URL from an allowlisted operator environment, with production values unchanged by default. Provision a distinct Auth0 API/audience and an ephemeral Render staging service, then run the smoke with a new connector.

This is the smallest configuration that keeps staging and production audiences separate. It requires explicit authorization because it changes auth/resource configuration and infrastructure.

### Option B - time-boxed production branch deploy

Manually deploy the audited implementation commit to the existing production Render service without merging, keep the existing production Auth0 audience, refresh the existing test connector, run one desktop and one iPhone smoke, then roll back to main.

This is operationally shorter but is not isolated: it changes production behavior, shares the production trust audience and can expose the app-only probe to other authenticated connectors during the window. It should be chosen only with explicit production-risk acceptance and a named rollback owner.

### Option C - no deploy

Keep v5/v6 as offline review evidence. This is the default under the current envelope and is the only option requiring no new authorization.

Recommendation: **do not deploy Option B implicitly**. Approve Option A if a genuine host/desktop/iPhone smoke is required. If the cost of a separate staging identity is unacceptable, retain Option C and mark real-host delivery BLOCKED rather than treating the offline harness as host evidence.

## Operator checklist for approved Option A

### 1. Exact target and build pin - operator must confirm

| Field | Required value |
|---|---|
| Deploy target | A NEW dedicated Render Web Service; never the existing `shenshu-voice-mcp.onrender.com` service |
| Proposed nonsecret service label | `shenshu-voice-mcp-v6-staging`, only if unoccupied |
| Exact service ID / URL | **UNKNOWN - OPERATOR TO PROVIDE from Render account** |
| Auto deploy | OFF for the test window |
| Branch | `work/first-audition-host-smoke-gate-v6` |
| Commit pin | `f28fac3103cfbefebef6568a97d84a8f75464a83` |
| Runtime | Repository `package.json`, Node 20-compatible Render runtime |
| Region / plan / instance count | **UNKNOWN - OPERATOR TO CONFIRM** |
| Custom domain / disk | None required |
| Health/read-only probe | `GET /` returns `ShenShu Voice MCP P1-MOCK` |

If Render cannot deploy an unmerged commit or pin auto deploy off, stop and use Option C or request a revised deployment design. Do not deploy the v6 branch to production merely because commit pinning is unavailable.

### 2. Environment flags

Set only after the dedicated Auth0 staging audience exists:

| Variable | Required value | Rationale |
|---|---|---|
| `SHENSHU_AUTH_MCP_ENABLED` | `1` | Opens the protected staging MCP handler |
| `SHENSHU_PRIVATE_FIXTURE_ENABLED` | `1` | Registers the fixed private fixture, UI resource and app-only probe |
| `SHENSHU_AUTH_STATIC_JWKS_TEST_ONLY` | Absent | Must never be set outside tests |
| `SHENSHU_AUTH_PUBLIC_JWKS_JSON` | Absent | Must not disable the rotating Auth0 JWKS path |
| `SHENSHU_D1_ADMISSION_DRY_RUN_ENABLED` | Absent or `0` | Keeps the D1 dry-run tool absent |
| MiniMax API key / voice ID variables | Absent | No provider capability in this service |
| D1 account/database/API token variables | Absent | No database capability in this service |

The expected startup diagnostic is:

`oauth_stage_enabled:true`, `dry_run_flag_enabled:false`, `d1_config_accepted:false`, `d1_tool_registered:false`, `paid_voice_enabled:false`.

Any D1 registration, provider key presence or paid flag is a STOP.

### 3. OAuth and connector identity

| Field | Required value |
|---|---|
| Auth0 issuer | Existing public issuer `https://dev-nwr87q0tnrbjeapr.us.auth0.com/` |
| New staging API/audience | `https://<staging-service>/paid-mcp`, exact hostname operator-confirmed |
| Scope | `voice:speak` |
| Client type | Existing or dedicated public SPA client; no client secret |
| Callback | Existing confirmed ChatGPT connector callback `https://chatgpt.com/connector_platform_oauth_redirect` |
| Connector name | New distinct name such as `ShenShu V6 Host Smoke`, not the production connector |
| Connector MCP URL | `https://<staging-service>/paid-mcp` |
| Production connector | Do not edit or refresh it during staging smoke |

The exact Auth0 API/client identifiers and whether the existing SPA client can be authorized for a second API are **UNKNOWN ACCOUNT CONFIGURATION** and require operator confirmation. Do not copy or request any client secret.

### 4. Preflight before chatbot interaction

1. Confirm Render deployment is exactly commit `f28fac3103cfbefebef6568a97d84a8f75464a83` and auto deploy is off.
2. Confirm the startup diagnostic above and verify no provider/D1 variables exist.
3. `GET /` returns the expected P1-MOCK text.
4. `GET /.well-known/oauth-protected-resource/paid-mcp` advertises the staging `/paid-mcp` resource, the pinned Auth0 issuer and `voice:speak`.
5. `POST /paid-mcp` without a token returns 401 with `resource_metadata`, and no `structuredContent` or fixture bytes.
6. Public `tools/list` on `/mcp` contains only the existing public fixtures and never `probe_oauth_generated_delivery`.
7. Do not call `verify_shenshu_d1_admission`, `preview_private_fixture` from a script, MiniMax or any external provider during preflight.

### 5. Desktop smoke order

1. Create the new connector and complete one OAuth login.
2. Confirm model-visible tools do not include the app-only `probe_oauth_generated_delivery`.
3. Invoke existing nonbillable `preview_private_fixture` once to render `ui://shenshu/private-fixture-bubble-v2.html`.
4. Confirm the visible OAuth UI marker is `v6-host-smoke-20261021`.
5. Click `NONBILLABLE TEST · 生成形状 WAV` once and observe `生成形状记录已交付；请点击播放`.
6. Confirm no AudioContext or audio playback starts before a separate main play click.
7. Click the main play control once and confirm an audible fixed synthetic tone.
8. Capture screenshot/video, console/CSP output, network absence of MiniMax/D1 calls and the exact tool-result text.

### 6. iPhone smoke order

1. Keep the same connector and same staging deployment; do not create a second OAuth app.
2. Refresh MCP tools once if the new UI controls do not appear. Do not repeat the model tool call before checking cache/marker.
3. Repeat the protected resource render, v6 marker check, generated-result button click, separate play click and audible check once.
4. Capture the same artifacts with native ChatGPT App version and iPhone OS/runtime recorded.

### 7. Rollback and cleanup

| Trigger | Action |
|---|---|
| Any auth, audience, marker or visibility mismatch | Stop the smoke; delete the staging connector and staging service |
| Any unexpected MiniMax/D1/provider traffic | Stop immediately; capture bounded evidence; no retry; escalate to total control |
| Successful test | Revoke/delete the staging connector, delete the ephemeral Render service and revoke the dedicated Auth0 API/client grant if created |
| Render deployment cannot be isolated | Leave the production service untouched; mark host smoke BLOCKED |
| If Option B is explicitly chosen despite the recommendation | Redeploy the prior known production commit/main, disable the probe flags if not previously set, refresh the connector and verify the probe is absent |

No D1 rows, media objects or provider quotas are created by this smoke, so no data rollback is expected.

## Risk review

| Risk | Handling |
|---|---|
| Tool discovery/caching hides the new app-only tool or old UI | Verify exact connector, refresh tools once, require v6 marker; do not repeat blindly |
| Staging/production audience confusion | Current hardcoded production audience blocks safe isolation; require env parameterization and a distinct Auth0 staging API before deployment |
| OAuth redirect/issuer/JWKS failure | Fail closed; no weakening of issuer/audience/scope/lifetime checks; dynamic JWKS remains the only production path |
| Fixture flag accidentally on in production | Do not deploy to the production service; keep staging isolated |
| Public `/mcp` exposure | Probe is not registered there; preflight tool listing must exclude it |
| App-only tool becomes model-visible | STOP; do not continue the smoke |
| Desktop/iPhone UI version skew | Require `v6-host-smoke-20261021` on both; use one tool refresh only |
| Provider or billing side effect | No MiniMax provider variables or code path; inspect bounded network evidence |
| D1 side effect | D1 dry-run flag absent; do not invoke the admission tool |
| Irreversible production change | Prefer a disposable staging service; require explicit rollback owner if production is ever approved |

## Minimal total-control authorization packet

Approval is requested for exactly one of these paths:

1. **A - Recommended:** authorize a new narrow implementation envelope for allowlisted protected-resource URL parameterization plus a distinct Auth0 staging API/audience, then a disposable Render staging deployment and one desktop plus one iPhone host smoke. No paid provider or D1 access.
2. **B - Production-risk explicit:** authorize one time-boxed manual deployment of `f28fac3103cfbefebef6568a97d84a8f75464a83` to the existing production service, one connector refresh and one desktop plus one iPhone smoke, followed by immediate rollback to `origin/main` or the prior live commit and verification that the probe is absent.
3. **C - Stay offline:** reject deployment and retain v5/v6 as offline evidence only.

To approve A or B, total control must supply or confirm: target service ID/URL, deployment mechanism, exact Auth0 API/audience and public client identity, connector name, operator identity, test window, desktop and iPhone availability, and rollback owner. No secret should be sent in chat or committed.

The current v6 envelope does not authorize any of these options. This report therefore does not claim a host PASS.

## Evidence status

| Evidence level | Status |
|---|---|
| Source audit of v5 registration, flags, protected route, UI marker, CSP and deployment workflows | **PASS (READ-ONLY)** |
| Missing/fake/expired/wrong-scope/wrong-audience rejection | **PASS (LOCAL FAKE JWKS)** |
| Flag-off absence and public `/mcp` invisibility | **PASS (OFFLINE)** |
| Exact fixture provenance, empty arguments and app-only visibility | **PASS (OFFLINE)** |
| UI marker, OAuth-only click framing and explicit Web Audio gesture | **PASS (NODE VM / FAKE HOST)** |
| Old fixed WAV, private fixture, hosted tone and CSP regressions | **PASS (OFFLINE)** |
| Isolated staging OAuth identity available with current source | **NO - BLOCKED BY HARDCODED PRODUCTION RESOURCE** |
| Render staging service provisioned and verified | **NOT RUN** |
| Connector created or refreshed | **NOT RUN** |
| Genuine ChatGPT MCP Apps host generated-record delivery | **NOT RUN** |
| Desktop playback | **NOT RUN** |
| iPhone playback | **NOT RUN** |
| Real OAuth/Auth0 session | **NOT RUN** |

No offline PASS is promoted to a real-host, desktop or iPhone PASS.

## STOP and non-execution counters

The v6 STOP boundary has been reached at the first action that would require deployment, account configuration, connector refresh or a real host call. The actionable decision packet is above.

| Category | Count |
|---|---|
| Provider / MiniMax calls | 0 |
| Paid calls / billing | 0 |
| Real D1 queries, writes or migrations | 0 |
| Provider keys or voice IDs read/logged | 0 |
| Deployments | 0 |
| Render/Cloudflare changes | 0 |
| OAuth/Auth0 settings changes | 0 |
| Connector refreshes or host calls | 0 |
| Actions dispatches | 0 |
| Merges | 0 |

GitHub was contacted only for read-only PR/CI metadata and the authorized branch/Draft PR workflow. All test traffic stayed on in-memory transports or loopback with synthetic WAV bytes and locally generated test keys.

## Required total-control decision

`TOTAL CONTROL DECISION REQUIRED`: choose Option A, Option B or Option C and confirm the missing account-level target fields. Until then, no deployment, connector refresh, host/desktop/iPhone test or infrastructure mutation is authorized, and real-host delivery remains **BLOCKED / NOT RUN**.

This Draft PR is review evidence only. It is not permission to merge, deploy, activate, refresh a production connector or claim physical-device playback.
