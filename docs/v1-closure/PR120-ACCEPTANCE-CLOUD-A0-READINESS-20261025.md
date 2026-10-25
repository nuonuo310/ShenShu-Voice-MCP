# Voice V1 - PR #120 independent acceptance and Cloud A0 readiness (2026-10-25)

**STATUS: COMPLETE FOR THE AUTHORIZED OFFLINE ACCEPTANCE AND READINESS SCOPE.
NO LIVE ACCEPTANCE IS CLAIMED. STRICT V1 REMAINS 2/9; B1-B4 REMAIN OPEN.**

This paper independently reviews PR #120 against the sole authority in PR #121,
distinguishes source-code, offline-test, GitHub-CI, user-reported-cloud and
independently-verified-live evidence, and prepares an unexecuted, zero-request
Cloud Gate A0 packet plus separate A1-A5 approval and rollback packets.

No real secret, Auth0 token, JWKS private material or HMAC key was read,
generated or injected. No Cloudflare API or dashboard mutation, Worker request
or deployment, route/Preview/Version enablement, D1 request, Render/Auth0 change,
MiniMax/provider call, manual Actions dispatch, merge or Asteria-Call edit
occurred.

## Opening gate and fixed authority

- Repository: `nuonuo310/ShenShu-Voice-MCP`.
- Origin: `https://github.com/nuonuo310/ShenShu-Voice-MCP.git`.
- Authority PR: #121, open Draft, `clean`, head
  `7f0a7027ea01a9e54ed72672618e446813753bb5`.
- Authority commit parent: `498e806a582c636f1c0a9e627432e3fd61d2c9c5`,
  exactly PR #120 head.
- Authority document:
  `docs/construction-envelopes/2026-10-25-voice-v1-pr120-acceptance-cloud-a0-readiness.md`,
  blob `0ab27fe7e322f482cf4a1999229de0c7948c1370`, 4,782 bytes.
- PR #121 is one additive documentation commit on PR #120. The authority parent
  is an ancestor and the diff contains no production source change.
- Task worktree:
  `C:\Users\Administrator\.codex\worktrees\voice-v1-pr120-acceptance-cloud-a0-20261025\ShenShu-Voice-MCP`.
- Task branch: `codex/voice-v1-pr120-acceptance-cloud-a0-20261025`, created from
  the exact authority commit without reset, clean, stash, rebase, merge or
  history rewrite.

The pre-existing primary worktree was at PR #120 head `498e806a...` and had one
unrelated, zero-byte untracked file, `$out`. It was not read, modified, removed
or included. The new isolated worktree was clean at opening. No stash exists.

The read-only PR/CI check found this open Draft stack:

| PR | Head | Base | Mergeability | Standard CI |
| --- | --- | --- | --- | --- |
| #118 | `ed9fba65014a455e303698ba7d54d63bc8752c0b` | offline-signer authority branch | open, Draft, `clean` | run `40123120802`, success |
| #119 | `c0a437c9a0fbb36b6819aceed5c22f7f2ce11e8d` | #118 head | open, Draft, `clean` | run `40195360917`, success |
| #120 | `498e806a582c636f1c0a9e627432e3fd61d2c9c5` | #119 head | open, Draft, `clean` | run `40196715043`, success |
| #121 | `7f0a7027ea01a9e54ed72672618e446813753bb5` | #120 head | open, Draft, `clean` | run `40202797312`, success |

Each run has successful `test` (Node 20) and `sqlite-node24` checks and was
triggered by `pull_request`, not manual dispatch. CI is regression evidence for
this repository, not cloud qualification evidence.

The external `nuonuo310/Shenshu-Continuity` repository remained unauthenticated
(HTTP 404 at the read-only API boundary). Its documents are UNVERIFIED and are
not invented or treated as additional authority.

## Independent acceptance decision

**PR #120 is ACCEPTED for its authorized read-only/offline decision scope, with
one nonblocking nomenclature correction. It is not accepted as live trusted
ingress, cloud D1 qualification or paid execution evidence.**

The trusted-ingress decision, operation-ID state machine, key-lifecycle rules
and explicit limitation inventory are supported by the reviewed source and
offline tests. No source or test change is justified by this acceptance: adding
another synthetic signer or duplicate state-machine test would not close any
of the live evidence gaps below and would enlarge the unverified surface.

### Review findings

1. **Nonblocking gate-label drift.** PR #120 labels A1 as artifact/deploy and A2
   as key/provisioning. The controlling PR #121 envelope labels A1 as secret
   generation/injection, A2 as deployment/version, A3 as route enablement, A4
   as the bounded run and A5 as closure/revocation. This paper follows PR #121.
   No cloud gate may rely on the older labels without restating its action.
2. **Principal wording correction.** The verified JWT `sub` does contribute to
   the server-derived principal after signature and claim validation. The
   decision document's sentence that no JWT claim selects the principal should
   be read as: no unverified caller field substitutes for the verified `sub`.
   Issuer, audience, scope, JWKS and key selection remain fixed or server-side.
3. **D1 atomicity remains an assumption, not a test result.** The Worker adapter
   sets `atomicBatch: true` because it invokes the platform `DB.batch()`. Local
   SQLite and an injected four-statement contract pass. Cloudflare D1 rollback
   and batch atomicity were not observed.
4. **A flag-gated diagnostic is not a zero-request path.** If
   `SHENSHU_AUTH_MCP_ENABLED=1` and
   `SHENSHU_D1_ADMISSION_DRY_RUN_ENABLED=1` are both set, the staging MCP tool
   `verify_shenshu_d1_admission` performs real Cloudflare D1 HTTP writes under a
   separate `dryrun_` principal. It is nonbillable and does not consume the
   paid user's quota, but it is still a real D1 request. Cloud A0 must attest
   that this flag and all other protected-route fixtures are disabled, or the
   evidence is BLOCKED. A0 itself must not invoke that tool.

## Claim-to-evidence matrix

Evidence classes are deliberately not merged:

- **Source** means the reviewed code path.
- **Offline** means executable tests in this repository.
- **CI** means the successful GitHub PR checks above.
- **Cloud/reported** means the user- or operator-reported state frozen in the
  authority documents.
- **Live** means independently obtained cloud evidence. There is none in this
  task.

The `Offline/CI` column below is a layout compression of two labeled classes:
the executable test result is offline evidence, while the sentence beginning
`CI` is GitHub PR CI evidence. Neither is cloud or live evidence.

| Claim | Source evidence | Offline/CI evidence | Cloud/reported evidence | Independent live evidence |
| --- | --- | --- | --- | --- |
| Public `/mcp` remains an unauthenticated fixture and cannot authorize paid voice or consume a grant. | `server.js` registers fixture preview tools; `handleProtectedResourceShell()` intercepts only exact `/paid-mcp` and its metadata path. The idempotency runner is not imported there. | `test/authenticated-stage.test.js`, the unmounted-module checks and `test/smoke-server.mjs`; CI success. | Render deployment state is user/operator-reported only. | NOT VERIFIED. |
| A protected principal, if enabled, can only originate from the `/paid-mcp` HTTP bearer header. | `src/protected-resource-shell.js` calls `handleStagingAuthenticatedMcp()` only for `/paid-mcp`; `src/verified-identity.js` reads only `headers.authorization`. | Synthetic RSA-JWT identity and route tests, including missing, forged, wrong-audience and wrong-scope requests; CI success. | No real Auth0 token was presented. | NOT VERIFIED. |
| Auth0 signature, issuer, audience, lifetime and `voice:speak` scope are checked against server-fixed trust anchors. | `src/protected-resource-identity.js`, `src/verified-identity.js`, `src/auth0-jwks-cache.js`; RS256, known `kid` and bounded JWKS fetch. | `test/verified-identity.test.js`, `test/staging-rotating-jwks.test.js`, `test/auth0-jwks-cache.test.js`; CI success. | The live tenant, API audience and JWKS response were not observed. | NOT VERIFIED. |
| No body, tool argument or ordinary caller header can replace the verified principal. | `verifiedSubject` is passed in a server closure; tool input is forced empty; no principal/approval/grant field is accepted. | Negative caller-supplied identity/control tests in both in-memory and SQLite suites; CI success. | None. | NOT VERIFIED for a real Auth0 request. A valid API grant is not a per-user entitlement allowlist. |
| `operation_id` is opaque, strictly shaped and durably keyed by `(principal, operation_id)` with action, text bytes and digest. | `src/v1-transport-idempotency.js`; `db/d1/003_paid_voice_operations.sql`; fixed SQL in `src/d1-operation-sql.js`. | Bindings, malformed records, identical-text/different-ID, same-ID/different-text and cross-principal tests; CI success. | Schema existence is user-observed. No client-generated operation was observed. | NOT VERIFIED. ChatGPT/MCP retry preservation remains unknown. |
| Retry, conflict, concurrent duplicate, lost response, restart and expiry are fail-closed with at most one provider attempt. | Runner persists `provider_pending` before the provider call; completion failure attempts terminal `unknown`; no compensating retry exists. | In-memory and SQLite suites cover replay, concurrent duplicate, crash/restart, lost response, completion-store failure, expiry and UTC rollover; 12 worker-thread attempts commit at most the configured limit; CI success. | None. | NOT VERIFIED in the deployed path. |
| A completed UTC-day operation can replay without a new provider call, while a new distinct operation is subject to the daily limit. | Composite operation key, daily reservation slots and UTC day derived from the bounded clock. | UTC rollover and daily-limit tests in both in-memory and real local SQLite; CI success. | No cloud clock behavior observed. | NOT VERIFIED. |
| Admission, one-use grant consumption, reservation and operation creation are atomically coupled. | `src/d1-transactional-operation-store.js` requires `atomicBatch === true`; `worker/private-d1-worker-candidate.js` submits four fixed statements through native `DB.batch()`. | Local SQLite rollback/collision/malformed-result tests and Worker-binding contract; CI Node 24 with SQLite, zero skips. | User-observed schema has three tables and zero rows. Native cloud batch atomicity is explicitly unobserved. | NOT VERIFIED. This is the D1 assumption, not a proved cloud property. |
| The Render-to-Worker request is HMAC-authenticated with canonical method, host, path, content type, timestamp, nonce and body digest. | `src/worker-signed-request.js`; `worker/signed-d1-worker-bridge.js`; body is bounded and verified before D1 construction. | Forged, stale, confused, oversized and schema-smuggling tests; offline signer plan tests; CI success. | No real HMAC key, Worker secret or signer-to-Worker pair exists in evidence. | NOT VERIFIED. HMAC possession is not a user principal. |
| The qualification Worker is dormant by default and isolated to one expected workers.dev host, fixed routes and one `DB` binding. | `worker/qualification-entry.js`; `wrangler.qualification.json` has `workers_dev:false`, `preview_urls:false` and one fixed D1 binding. | `test/qualification-worker-entry.test.js` checks dormancy, unsafe configuration, exact-host shape, route shape and zero D1 work on denial; CI success. | Deployed version `2320fd44-294c-4789-91bd-c20694254eca`, URL closure and 0 invocations are operator-reported. | NOT VERIFIED. Exact current version, host, URL inventory, triggers and bindings require A0. |
| Private durable audio delivery and real provider execution are absent. | The operation contract returns only an opaque `resultRef`; no result store or provider is mounted. | Unmounted/source-import checks and opaque-result redaction tests; CI success. | No paid/provider state exists. | NOT VERIFIED; B3 and B4 remain open. |

## Exact blockers and unproven trust boundaries

| ID | Blocker | Why current evidence is insufficient | Closure requirement |
| --- | --- | --- | --- |
| T1 | Live Auth0 principal | Only synthetic RSA tokens and fixed code constants exist. Render flags, tenant/JWKS reachability and a real `/paid-mcp` request were not observed. | Separately authorized staging principal observation with no provider. |
| T2 | Render/route state | Repository source does not prove which environment flags or paid route are active in Render. In particular, the real-D1 admission dry-run flag must not be assumed off. | Non-mutating operator evidence for the exact deployment, route and all protected-route flags before any live gate. |
| T3 | Per-user entitlement | A valid Auth0 API grant plus `voice:speak` is the current boundary; no allowlist or spending entitlement is proven. | Separate entitlement design and live authorization evidence before paid use. |
| T4 | Stable client operation ID | No ChatGPT/MCP retry, reconnection or process-restart behavior was measured; a client can generate a new ID after timeout. | Observed client contract and adversarial live test before paid activation. |
| T5 | Trusted signer adapter | No real signer derives a principal from a verified Auth0 request and signs the Worker request. | Reviewed adapter, real key injection and end-to-end synthetic-principal qualification. |
| T6 | Signer-Worker key equality | No HMAC key exists and the two processes were never compared safely. | Non-echoing one-key injection and operator equality attestation without key-derived fingerprints. |
| T7 | Cloud D1 atomicity | Local SQLite and injected batches do not prove Cloudflare D1 transaction/rollback behavior. | Bounded cloud A4 evidence, or a stronger platform contract before reliance. |
| T8 | Cloud identity and route inventory | Worker/version/URL/binding identity is user-reported only; no independent live attestation exists. | Gate A0 zero-request evidence, then separate A1-A5 approvals. |
| T9 | Private durable delivery | The current state machine stops at an opaque `resultRef`; no private audio persistence/delivery exists. | Separate B3 implementation and qualification. |
| T10 | Provider/B4 | Zero authorized MiniMax calls; model/voice equality and billing behavior are unknown. | One separately authorized, capped provider smoke only after all prior gates. |

## Cloud Gate A0: read-only, zero-request evidence packet

**A0 is NOT authorized or executed by this document.** It is a future operator
packet. A0 permits only approved read-only dashboard/account evidence collection.
It permits no `curl` to the Worker, no D1 SQL console execution, no secret value,
no deployment, no route change, no settings mutation and no provider action.

### A0 invariants

- A0 is complete only if application-plane Worker HTTP requests, Worker
  invocations and operator-issued D1 SQL/HTTP requests are all zero.
- Platform metadata reads performed by the dashboard are not application-plane
  requests, but their source and time must be recorded. No claim of zero
  Cloudflare API reads is made if the dashboard itself issues metadata reads.
- A0 never supplies a bearer token, OAuth token, cookie, HMAC key or secret to
  any endpoint.
- Every field is observed at a named UTC timestamp; inferred or remembered
  values are rejected.
- Any mismatch, ambiguity or missing field returns BLOCKED. It is not filled in
  from old documents.

### Required A0 evidence fields

| Area | Required evidence | Redaction and handling | Immediate STOP |
| --- | --- | --- | --- |
| Capture | UTC start/end, operator identity/role, evidence ID, dashboard source, sanitized artifact SHA-256 | Operator identity may be a role, not an email; hash only sanitized artifacts | Evidence time or collector is ambiguous |
| Account | Cloudflare account ID, current plan, Free/no-card status, no upgrade/payment prompt, no permission-expansion request | Do not capture email, card digits, billing address or cookies | Wrong account; any paid/card/upgrade prompt |
| Worker | Exact name `shenshu-voice-v1-qualification-20261024`, Worker ID, deployed version ID, deployment time/source, rollback candidate `2320fd44-294c-4789-91bd-c20694254eca` | IDs and timestamps are evidence; no secret values | Name/ID/version mismatch or concurrent redeployment |
| Binding | Exactly one `DB` binding to D1 name `shenshu-voice-v1-qualification-20261024`, UUID `234913cd-8901-4607-8147-31c4a4317111`; no preview/default/alternate binding | Record binding name/type/UUID only | Extra binding, wrong UUID or old `shenshu-voice-budget-test` |
| Host and URLs | Exact `<worker-name>.<single-account-subdomain-label>.workers.dev` host copied from the dashboard; explicit state of workers.dev, Preview URLs, Version/Deployment URLs and any custom host | Record host and booleans only; do not probe any host | Host inferred; Preview/Version/custom route active or inventory incomplete |
| Routes/triggers | Complete inventory of routes, custom domains, cron triggers and Access applications; expected count zero | Names/hosts and counts only | Unknown route/trigger; any Access/paid setting change |
| Counters | Baseline Worker requests/invocations/errors for the evidence window, expected 0; no application request generated by A0 | Counters/timestamps only; no request identifiers from secrets | Any unexpected request/invocation or unexplained delta |
| D1 metadata | Dashboard-visible database identity, binding count, migration/schema inventory matching frozen 001/002/003 objects; no SQL execution | Object/migration names and counts only; preserve prior user-observed schema as reported evidence | Need for a SQL query; schema drift; any DML/DDL request |
| Secret surface | Confirm no value was displayed or read; if the dashboard exposes names, record only whether A1 is still pending, not values | Never capture/export a secret value or credential | Any request to reveal/copy a secret |
| Restore point | Record exact rollback version and all closed URL surfaces | UUIDs/booleans only | Rollback version unavailable or URL closure uncertain |

The operator must retain sanitized screenshots or read-only exports outside Git.
No evidence artifact may contain an Auth0 token, Cloudflare credential, HMAC key,
authorization header, secret-derived fingerprint, raw D1 row or private audio.

### What A0 can and cannot prove

A0 can establish the current Cloudflare account/Worker/version/binding/host and
closed-URL posture, plus whether observed application counters are zero.

A0 cannot prove a live Auth0 principal, Render enablement, the state of
`SHENSHU_AUTH_MCP_ENABLED`, `SHENSHU_D1_ADMISSION_DRY_RUN_ENABLED` or private
fixture flags, per-user entitlement, client retry stability, signer-to-Worker
key equality, Cloudflare D1 atomicity, private durable delivery, provider
behavior or Voice V1 acceptance. Those remain T1-T10 even if A0 passes.

## Separate future A1-A5 authorization packets

The controlling mapping is from PR #121, not the older A1/A2 labels in PR #120.
No gate inherits approval from another. A continue instruction is not a gate
approval.

| Gate | Action that may be separately authorized | Evidence required before action or continuation | Rollback / STOP |
| --- | --- | --- | --- |
| A1 | Generate one 32-byte CSPRNG test key and inject it only into the exact dormant qualification Worker/signer path, route closed | A0 accepted; generated key ID (nonsecret); non-echoing injection method; no argv/history/file/log exposure; exact resulting version ID; one key pair/version; signer intended recipient recorded | If injection is ambiguous or creates an unintended active version, stop. Remove the test secret and return to the recorded dormant/rollback version under a separately authorized cleanup action; never display the key. |
| A2 | Deploy or adopt only the reviewed Worker artifact/version; no request | Exact source commit/tree and artifact hash; exact deployed version UUID and time; one `DB` binding; all workers.dev/Preview/Version/custom routes still closed; rollback target `2320fd44-294c-4789-91bd-c20694254eca` verified | Any artifact/version/binding drift or open URL is STOP. Revert to the recorded rollback version, keep routes closed, preserve logs and do not send traffic. |
| A3 | Enable exactly one temporary workers.dev host for at most 20 minutes; no other route | A0-A2 accepted; exact host re-attested; no custom/Preview/Version route; no Access/billing/binding change; UTC start, stop owner and automatic closure method recorded | If more than one surface is reachable or closure cannot be proved, do not start. Disable the exact host first and escalate. |
| A4 | Send only the pre-declared nonbillable signed requests through the exact host, with provider calls fixed at zero | A1-A3 accepted and A5 separately pre-approved; named UTC window/observer/stop owner; baseline counters; fixed request plan; hard caps below; no retries or compensating writes | On any unexpected principal, status, row, latency ambiguity, counter overrun or provider path, stop immediately. Disable the route, preserve all rows and evidence, and do not probe again. |
| A5 | Close the route and revoke the test path: disable route first, make Worker dormant, remove signer key, delete test secret | Separate A5 approval before A4; exact host/version/key names; nonsecret completion evidence; expected D1 row preservation plan | If route disablement fails, stop and escalate; do not send another request. After secret deletion, do not probe or recreate the key without fresh approval. Never delete/drop/truncate D1 evidence. |

### A4 hard ceilings (planning limits, never permission)

| Counter | Maximum |
| --- | ---: |
| Worker HTTP requests | 24 |
| D1-touching requests | 18 |
| Admission requests | 10 |
| Accepted admissions | 4 |
| D1 row-write units | 32 |
| Rows read | 512 |
| D1 statements | 64 |
| Storage delta | 256 KiB |
| Wall-clock window | 20 minutes |
| MiniMax/provider calls | 0 |

No gate may raise a cap, add a route, add a binding, refresh Auth0/Render, call a
provider, perform manual Actions dispatch or merge.

## Fail-closed rollback sequence

1. Stop issuing requests and record the UTC stop reason and current counters.
2. Disable the exact temporary route/host first. If that cannot be confirmed,
   stop and escalate; never send a diagnostic request.
3. Make the Worker dormant and restore the recorded rollback version as the
   separately authorized A5 action requires.
4. Remove the signer test key and delete the test-only Worker secret using the
   approved non-echoing path. Record only nonsecret confirmation.
5. Preserve the D1 schema and every observed or ambiguous row. No DELETE, DROP,
   truncate, refund, compensating write, cleanup probe or old-database action.
6. Hash sanitized evidence, record the final version/host/route state and stop.
7. Reopening or re-testing requires a fresh A0-A5 decision; no prior approval is
   reusable.

## Local verification

Local runtime: Node `v24.19.0`, npm `11.17.0`.

- Dependency install used `--ignore-scripts --no-audit --no-fund`; the generated
  lockfile was removed because this repository intentionally has none.
- Full `node --test --test-reporter=tap`: **360/360 PASS**, 0 failed, 0 skipped,
  0 cancelled, 0 todo. This includes the Node 24 SQLite tests without skips.
- Focused identity/idempotency/SQLite/Worker suite across
  `test/v1-transport-idempotency.test.js`,
  `test/v1-transactional-operation-offline.test.js`,
  `test/d1-worker-atomic-contract.test.js`,
  `test/signed-worker-bridge.test.js` and
  `test/qualification-worker-entry.test.js`: **68/68 PASS**, 0 skipped.
- `node test/smoke-server.mjs`: PASS for MCP initialize, fixture tools/list and
  calls, protected metadata and fail-closed paid entry.
- `node --check` on `server.js`, `worker/qualification-entry.js`,
  `src/v1-transport-idempotency.js` and
  `src/d1-transactional-operation-store.js`: PASS.
- `git diff --check`: PASS.

No source, test, Worker, schema or workflow change is included. This task adds
this report only. Standard PR CI and the final committed HEAD are reported in
the Draft PR body to avoid a self-referential document hash.

## Real-operation counters

- Real Auth0 tokens, Auth0 secrets, HMAC keys generated/read/injected/deleted: 0
- Cloudflare API calls, dashboard mutations or credential reads: 0
- Worker requests, deployments, versions, routes, URL surfaces or bindings
  changed: 0
- Real D1 reads, writes, queries, DDL or migrations: 0
- Render, Auth0, connector or public MCP changes: 0
- MiniMax/provider calls, paid tools, cards or billing changes: 0
- Manual GitHub Actions dispatches: 0
- Merges, rebases or history rewrites: 0
- Asteria-Call or Asteria-Voice-Worker edits: 0

Only public GitHub read-only metadata, local Git state and offline tests were
used. No credential value was printed or written.

## V1 disposition and next authorization

Strict Voice V1 remains **2/9** (gates 1 and 8 only). B1-B4 remain open:

- **B1:** no user-confirmed audible iPhone result for generated/bridged audio.
- **B2:** real D1 atomic admission and the deployed Worker path remain
  unqualified.
- **B3:** real fail-closed/private durable result delivery remains absent.
- **B4:** no authorized real MiniMax end-to-end call.

The only next requested authorization is **Cloud Gate A0**, read-only and
zero-request, with an operator, exact evidence retention location, baseline UTC
time and stop owner. A0 does not authorize A1. No live call, route, credential,
deployment or provider action is scheduled or implied.

**COMPLETE for the authorized offline PR #120 acceptance and readiness scope.**
Live acceptance, cloud atomicity, trusted signer equality, private delivery and
paid execution remain unproven.
