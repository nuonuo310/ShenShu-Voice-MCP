# Voice V1 deployed Worker route and preview isolation decision (2026-10-24)

**STATUS: TOTAL CONTROL DECISION REQUIRED. THE AUTHORIZED READ-ONLY REVIEW IS
COMPLETE, BUT FULL PREVIEW ISOLATION IS NOT INDEPENDENTLY VERIFIED. NO CLOUD
CONFIGURATION, ROUTE, PREVIEW, SECRET, WORKER REQUEST, D1 OPERATION, DEPLOY,
PROVIDER CALL OR MERGE OCCURRED. STRICT V1 REMAINS 2/9; B1-B4 REMAIN OPEN.**

The current dormant artifact is likely unreachable and is fail-closed even if an
unexpected Version/Preview URL exists. That is useful defense in depth, not proof
of complete URL isolation. A nonsecret, zero-request dashboard attestation is the
next decision gate.

## Authority and Opening Gate

- Repository: `nuonuo310/ShenShu-Voice-MCP`
  (`https://github.com/nuonuo310/ShenShu-Voice-MCP.git`).
- Authority branch: `docs/voice-v1-worker-route-security-review-20261024`.
- Authority commit: `1f62594ebc2bddb81dc1e7726d5dd6e2d75bfa90`.
- Authority parent: `f2be0699f5e480c0489856e7ad15877cfa0a3eb0` (PR #111 head).
- Sole authority package:
  `docs/construction-envelopes/2026-10-24-voice-v1-worker-route-preview-review.md`
  (Git-blob SHA-256
  `7a56d0ba4c37ed87251bff91c2bbde601ffe74ff0ffd358103fdf08390b7adcd`).
- Task branch:
  `work/voice-v1-worker-route-preview-isolation-20261024`, created from the exact
  authority commit.
- Opening state: one registered worktree, clean and on the previous task's final
  commit before branch creation; no reset, stash, clean, rebase or history
  rewrite.

The read-only dependency check found PR #112
(`docs: deployed qualification Worker route and preview isolation authority`)
open, Draft and `clean`, head
`1f62594ebc2bddb81dc1e7726d5dd6e2d75bfa90`, base
`work/voice-v1-qualification-worker-deploy-readiness-20261024`. Its latest
standard `pull_request` CI run is `40115425241`, **success**.

PR #111 remains open, Draft and based on the preceding authority branch; its
latest recorded standard CI was `40110965552`, **success**. No manual Actions
dispatch or merge was performed.

## Preserved deployment identity

The following is **operator-observed** CLI/dashboard evidence, not an independent
Cloudflare API attestation:

- Cloudflare account ID: `5a1af7ea0ef8f8aea6365306d775a894`.
- Qualification Worker: `shenshu-voice-v1-qualification-20261024`.
- Current Worker version: `2320fd44-294c-4789-91bd-c20694254eca`.
- Dedicated D1 database: `shenshu-voice-v1-qualification-20261024`, UUID
  `234913cd-8901-4607-8147-31c4a4317111`, one `DB` binding.
- Deployment source commit: `f2be0699f5e480c0489856e7ad15877cfa0a3eb0`.
- Deploy command: `wrangler deploy --config .\wrangler.qualification.json --strict`,
  Wrangler `4.152.0`; result: uploaded version `2320fd44...`, `No targets
  deployed`.
- User-observed dashboard: Worker Ready; `workers.dev` Disabled; domains/routes
  0; no custom domain; no Worker/queue triggers; one dedicated `DB` binding;
  0 invocations and 0 errors.
- User-observed runtime configuration: no HMAC secret and no qualification
  activation tuple configured.

The old D1 `shenshu-voice-budget-test`
(`c39a6895-7028-4f59-a100-1455b92c96c1`) and every existing Asteria Worker
remain forbidden and untouched.

## Frozen code and manifest

Authority commit `1f62594` changes documentation only. Its Worker code and
manifest are byte-identical to deployed source commit `f2be069`:

| File | Git-blob SHA-256 |
| --- | --- |
| `worker/qualification-entry.js` | `17b7a6d9dbc4303bbbf70cdc6ceb579df74547c61959a060db3639d2ea7c398a` |
| `wrangler.qualification.json` | `5ab91711da85ee99a98af29fd749d58a2a3e1b0f1fe58fb9d520630990262b50` |
| `worker/signed-d1-worker-bridge.js` | `cc7383417ab518a09d79918b0c45a9bf46ed8e4594d00aa1e752fad18d07b9aa` |
| `test/qualification-worker-entry.test.js` | `8ec72dd849f362a49a018830af0629085c8317ed1cf0493b07dfb422a8c4941f` |

The manifest contains `workers_dev: false`, one D1 binding and no routes, custom
domains, HMAC key or secret. It **does not** contain an explicit
`preview_urls: false`. That omission is material below.

## Official Cloudflare findings

Only public official Cloudflare documentation was read. No Cloudflare API or
live Worker/D1 endpoint was queried.

| Primary source | Relevant finding | Limit of the finding |
| --- | --- | --- |
| [Version URLs](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/), updated 2026-09-22 | "Version URLs, previously called preview URLs" can expose a specific uploaded version. `wrangler deploy`, `wrangler versions upload` and dashboard code saves can create versions. Every Version URL uses the format `<version-prefix>-<worker-name>.<subdomain>.workers.dev` and is public when enabled. With no Version URL setting, it defaults to the `workers_dev` state. | This is documented default behavior, not observation of this account's setting. |
| Same Version URLs page | If `preview_urls` is omitted, Wrangler "does not change an existing Version URL setting." Explicit `"preview_urls": false` disables routing to Version and aliased Version URLs. | The current manifest omits the field, so it supplies no explicit guarantee. |
| [workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/), updated 2026-09-22 | Disabling `workers.dev` "does not disable Version URLs, Preview URLs, or Deployment URLs." A dashboard-only disable can be re-enabled by a later Wrangler deploy unless the config says `workers_dev = false`. | `workers_dev: false` alone cannot prove all preview surfaces are off. |
| [Previews](https://developers.cloudflare.com/workers/previews/), updated 2026-09-24 | Previews are separate branch/PR environments created or updated by `npx wrangler preview`, with their own Preview URL and immutable Deployment URL. Their URLs are public by default. | No evidence was supplied that `wrangler preview`, Workers Builds or another Preview workflow was used. Actual Preview listings remain unobserved. |
| [Previews resources](https://developers.cloudflare.com/workers/previews/resources/), updated 2026-09-22 | Previews do not automatically inherit production settings; D1 isolation requires a different `database_id`, while a shared ID shares rows. Routes and production triggers target production. | No `previews` block or Preview-specific D1 binding exists in this manifest. A future Preview must not reuse the qualification D1 without a new decision. |
| [Rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/), updated 2026-07-15 | Dashboard/CLI rollback creates a new deployment pointing at a selected version; bindings are not changed; only the 100 most recent versions are eligible. | Rollback does not undo D1 rows or schema. |
| [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), updated 2026-10-02 | Workers Free is the default plan and lists 100,000 requests/day and 10 ms CPU per invocation. | Does not prove this account's billing or no-card state. |
| [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), updated 2026-04-21 | D1 Free lists 5 million rows read/day, 100,000 rows written/day and 5 GB storage. | Does not prove real-cloud atomicity or current row counts. |

## Findings

### 1. Route state

The operator-observed state is no active `workers.dev` route, zero custom
domains/routes and zero invocations. If accurate, there is no current public
production hostname. This is **observed only through the operator**, not through
an independent cloud read in this task.

### 2. Version URL and Preview URL state

The Worker was newly created and deployed with `workers_dev: false`. Under the
documented default for a Worker with no existing Version URL setting, Version
URLs should therefore be disabled. However:

- the actual Version URL setting was not independently observed;
- the manifest omits `preview_urls`, and official documentation says omission
  preserves any existing setting; and
- no Preview list, Deployment URL list or account-level setting was observed.

Cloudflare Previews are a separate feature created by `wrangler preview` or a
Preview workflow. There is no evidence such a command was run, so no Preview is
known to exist. The absence is not independently proven.

**Conclusion: no known reachable Preview/Version URL; default behavior suggests
Version URLs are disabled; full isolation is NOT established.** The correct
description is "conditionally isolated by documented default, unverified," not
"verified fully isolated."

### 3. Default-off runtime behavior

The deployed artifact returns `404 {"error":"not_found"}` when
`QUALIFICATION_WORKER_ENABLED` is absent or not `1`. This happens before bridge
construction and before any D1 client call. The operator reports no HMAC secret
or activation tuple configured.

This is strong defense in depth: an unexpected public URL would not reach D1.
It does not prevent the request from being counted as a Worker invocation or
from consuming CPU/quota.

### 4. HMAC and host isolation

The activation path requires `QUALIFICATION_WORKER_ENABLED=1`, qualification
mode, an exact expected host, a test key and a DB binding. The expected-host
regular expression only accepts exactly
`shenshu-voice-v1-qualification-20261024.<account-subdomain>.workers.dev`.

- A Version URL (`<version-prefix>-<worker>...`) and a Preview URL
  (`<preview-name>-<worker>...`) cannot be configured as `QUALIFICATION_EXPECTED_HOST`;
  doing so yields `503 qualification_unavailable` before the bridge.
- With the exact production host configured, requests arriving on Version or
  Preview hosts fail the pre-HMAC request-shape check with generic
  `403 not_authorized`, before D1.
- A correctly signed request is accepted only on the exact host; unsigned,
  forged, confused and stale requests remain generic 403.

An in-memory local probe on Node `v24.19.0`, using a synthetic account host and a
throwing fake DB, produced:

| Case | Result | D1 prepare/batch |
| --- | --- | --- |
| Dormant Preview host | 404 `not_found` | 0 / 0 |
| Dormant Version host | 404 `not_found` | 0 / 0 |
| Activated Preview host | 403 `not_authorized` | 0 / 0 |
| Activated Version host | 403 `not_authorized` | 0 / 0 |
| Exact host, unsigned | 403 `not_authorized` | 0 / 0 |
| Version host attempted as expected host | 503 `qualification_unavailable` | 0 / 0 |

The probe was local only: no real Worker, D1, secret or network request was used.
It does not replace an independent check of the deployed setting.

### 5. Free quota and availability risk

If any Version/Preview/Deployment URL or production route becomes reachable, an
unauthenticated caller can consume the shared Workers Free request and CPU
allowance, even when the application returns 404. HMAC authentication protects
D1 and mutation semantics, not the request counter or CPU budget.

The account is user-attested Free/no-card; this review did not verify billing
state. Cloudflare Access remains unsuitable without a separate payment/card
decision. No paid rate-limit or abuse mitigation is authorized or present.

### 6. Rollback boundary

The current version `2320fd44-294c-4789-91bd-c20694254eca` must remain the
rollback reference. A version rollback is a new deployment of that version and
does not change bindings or D1 rows. Removing the explicit public route and
revoking the test key are separate operations from code rollback.

## Minimal reversible next action

The next step is **not** route activation and **not** a redeploy. It is a
zero-request, read-only security attestation by the operator, followed only if
needed by the narrowest configuration disablement.

1. **Gate P0 - zero-request read-only attestation.** In the Cloudflare dashboard,
   without opening the Worker URL, record nonsecret screenshots of:
   - account identity and Worker name;
   - current version `2320fd44...` and 0 requests/0 errors;
   - `workers.dev: Disabled`;
   - Version URLs explicitly `Disabled`;
   - no Preview entries and no Deployment URL entries;
   - 0 custom domains, 0 routes and no triggers;
   - one `DB` binding to UUID `234913cd-8901-4607-8147-31c4a4317111`;
   - the names/presence counts, but never values, of qualification secrets.

   This gate performs no Worker invocation and no D1 query.
2. **Gate P1 - disable only if the attestation fails.** If Version URLs are not
   Disabled, or an unexpected Preview exists, authorize only the corresponding
   dashboard disable/delete. Do not enable `workers.dev`, add a secret, deploy a
   new version, change D1 or invoke the Worker. Recheck 0 requests/0 errors.
3. **Gate P2 - future manifest hardening, repository-only.** In a separate,
   reviewed change, add `"preview_urls": false` beside `"workers_dev": false`
   and retain the manifest test. Do not combine that repository change with a
   deploy. Because the current manifest omits the field, the current deployment
   cannot claim an explicit Version URL disable.
4. **Gate P3 - separately authorized route/key window.** Only after P0/P1 pass,
   provision one new test-only HMAC key, bind the exact nonsecret workers.dev
   hostname, and enable the route for a short bounded window. Do not use Access,
   a paid plan, a custom domain, the old D1 or an Asteria Worker. Record any new
   Worker version created by an environment/secret change and retain
   `2320fd44...` as the rollback target.
5. **Gate P4 - bounded signed run.** Apply the existing PR #104 ceilings: 24
   Worker HTTP requests, 18 D1-touching requests, 10 admission requests, 32
   row-write units, 512 rows read, 64 statements, 256 KiB delta, 20 minutes and
   0 provider calls. Disable the route and revoke the test key immediately
   afterward.

## Rollback plan

For the present deployed state, rollback is a no-op because no route, secret or
D1 operation exists.

For a future authorized window, in order:

1. disable `workers.dev` and Version URLs in the dashboard;
2. delete only an explicitly identified accidental Preview, if any;
3. revoke the test HMAC key and remove activation bindings through an approved
   operation;
4. if code drift occurred, use dashboard rollback to deploy version
   `2320fd44-294c-4789-91bd-c20694254eca`; this creates a new deployment and
   does not change D1 bindings;
5. preserve all D1 rows, schema objects, versions and ambiguous outcomes as
   evidence; no DROP, DELETE, truncate, cleanup or compensating write.

If the account asks for a card, paid plan, Access/Zero Trust, custom domain,
upgraded quota, token refresh or permission expansion, STOP for total control.

## Authorization boundary

The immediate authorization needed is **not** a route activation. Total control
must decide whether to authorize the operator's zero-request P0 attestation and,
only if it fails, the P1 disable-only operation. Any later manifest deploy,
secret provisioning, route enablement, real D1 request or provider path still
requires a separate approval.

The current preview conclusion remains **unverified**, so no statement that the
deployed Worker is fully isolated from Preview/Version URLs is permitted.

## Local verification and counters

Local Node `v24.19.0`:

- qualification Worker suite: **9/9 PASS**, 0 failed, 0 skipped;
- full repository suite: **344/344 PASS**, 0 failed, 0 skipped;
- `node --check worker/qualification-entry.js` and `git diff --check`: PASS.

No live Worker HTTP request, real D1 read/write, cloud API mutation, route or
Preview change, secret access, deployment, provider call or merge occurred.

- Workers deployed/version changes: 0
- Route/Preview/workers.dev changes: 0
- Worker HTTP requests: 0
- Real D1 reads/writes/queries/migrations: 0
- Cloudflare API calls: 0
- Cloudflare/Auth0/provider keys, tokens or voice IDs read/logged: 0
- Render/Auth0/connector changes: 0
- MiniMax/provider calls: 0
- Manual GitHub Actions dispatches: 0 (standard PR CI only)
- Merges/rebase/rewrites: 0

Public Cloudflare documentation and read-only GitHub metadata were fetched. No
credential value was printed, returned in evidence or written by this task.

## Delivery evidence

Draft PR #113 is based on the exact authority branch commit `1f62594`. The
read-only review commit is `06da29f0f33a9840208b0d7c5cf762807bdcab0a`. Its first
standard `pull_request`-triggered CI run was `40116282614`, **success**; both
Node 20 `test` and Node 24 `sqlite-node24` jobs completed successfully. No
manual Actions dispatch was used. The final evidence-only amendment head and
CI result are recorded in the Draft PR body so this document does not chase its
own hash.

## V1 disposition

Strict V1 remains **2/9** (gates 1 and 8 only). B1-B4 remain open:

- **B1:** iPhone generated/bridge audio remains without a user-confirmed audible
  result.
- **B2:** real D1 atomic admission and the deployed Worker path remain
  unqualified.
- **B3:** real fail-closed/private durable result delivery remains absent.
- **B4:** zero authorized real MiniMax end-to-end calls.

**TOTAL CONTROL DECISION REQUIRED:** authorize the zero-request P0 attestation
and, conditionally, the disable-only P1 operation. Full Preview isolation cannot
be claimed from the current files or the supplied operator evidence alone.
