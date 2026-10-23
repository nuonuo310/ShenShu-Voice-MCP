# Voice V1 cloud qualification preflight decision (2026-10-23)

**STATUS: READ-ONLY PREFLIGHT COMPLETE. DEDICATED QUALIFICATION D1 RECOMMENDED.
NO CLOUD ACTION AUTHORIZED OR PERFORMED. STRICT V1 REMAINS 2/9.**

This package resolves the repository-side questions required before a future
real-cloud qualification. It does not create a D1 database or Worker, query real
D1, apply a migration, read a Cloudflare token, deploy, modify Render/Auth0,
refresh a connector, call MiniMax, dispatch an Action manually or merge.

## Authority and Opening Gate

- Repository/origin: `nuonuo310/ShenShu-Voice-MCP`
  (`https://github.com/nuonuo310/ShenShu-Voice-MCP.git`).
- Git identity: `nuonuo310 <2584974449@qq.com>`.
- Authority branch: `docs/voice-v1-cloud-qualification-preflight-20261023`.
- Authority commit: `8870833554a7a0d60f840cebb832a4e4386a01ed`.
- Sole authority package:
  `docs/construction-envelopes/2026-10-23-voice-v1-cloud-qualification-preflight.md`.
- Task branch: `work/voice-v1-cloud-qualification-preflight-20261023`, created
  from the exact authority commit.
- Worktree: `ShenShu-Voice-First-Audition`; one registered worktree, clean at
  opening and after branch creation. No reset, stash, clean, move, rebase or
  merge was used.

Verified Draft dependency chain:

1. PR #101 head `33e5607a5102c66aca043368deb5a7e17374a90a`, `clean`.
2. PR #102 head `4ee57041d66f99e187b83cc96bc465c341218f0e`, based on PR #101,
   `clean`; PR CI run `39996427643` succeeded.
3. PR #103 head `8870833554a7a0d60f840cebb832a4e4386a01ed`, based on PR #102,
   `clean`; PR CI run `39998206222` succeeded.

The authority commit adds only the construction envelope and parent read-only
preflight report. Local baseline verification at the authority tree is
`329/329 PASS` on Node 24 and `291 pass / 38 explicit skips` on the Node 20
equivalent path. Those are offline repository results, not cloud evidence.

## Evidence matrix

| Claim | Evidence tier | Status |
| --- | --- | --- |
| Cloudflare account plan is Free without a card | User-supplied dashboard observation | **NOT independently verified** |
| Daily Free counter snapshot: 0/100,000 Worker requests, 0/5M D1 reads, 0/100k D1 writes | User-supplied dashboard observation | Snapshot only; not a permanent quota or account attestation |
| `shenshu-voice-budget-test` UUID is `c39a6895-7028-4f59-a100-1455b92c96c1` | User-supplied D1 Studio observation | Name/UUID recorded; account ID and ownership not verified |
| Live database has `paid_voice_reservations` and `paid_voice_grants` | User-observed Studio preflight | Structural subset observed; DDL text was truncated, so not byte-for-byte equality |
| `paid_voice_operations` is absent | User-observed Studio preflight | No `003` table visible before this review |
| Existing database is empty or isolated | **Unknown** | No current row count, historical-row audit, or binding/consumer proof |
| Existing database has no current writer/consumer | **Unknown** | Repository contains an optional live D1 write path; current Render configuration was not inspected |
| `003_paid_voice_operations.sql` has been applied | **No evidence** | Repository-only migration; do not apply in this package |
| Signed Worker bridge verifies HMAC before D1 | Local tests and Linux CI | `11/11` targeted tests; Node 24 CI `329/329`; no real Worker execution |
| Worker has a deployable entrypoint/configuration | **No** | Only pure bridge/candidate modules exist; no route export or Wrangler config |
| Real D1 `batch()`, `RETURNING`, rollback, lock and timeout behavior | **Not observed** | Documented Cloudflare API contract only |
| Stable ChatGPT `operation_id` ingress | **Not proven** | No direct ChatGPT-to-qualification path is being claimed |
| Private durable result delivery | **Absent** | Separate B3 blocker |
| MiniMax/provider behavior | **Not observed** | Zero provider calls |

Because no approved nonsecret Cloudflare account view was available to this
task, account/binding/occupancy claims must remain **NOT VERIFIED**. The supplied
D1 Studio observations are accepted only at their stated scope.

## Real D1 use relationships

### Repository-visible consumer

`src/d1-admission-dry-run.js` is an optional real-D1 write path, not a fake:

- `server.js` imports it and `src/staging-authenticated-mcp.js` registers the
  `verify_shenshu_d1_admission` tool only when the authenticated stage is on and
  `SHENSHU_D1_ADMISSION_DRY_RUN_ENABLED=1` plus D1 environment configuration
  validate;
- it derives a `dryrun_<verifiedSubject>` namespace, uses the existing
  reservation/issue/consume statements and REST client, and reports no private
  IDs;
- each reported successful call creates two durable base-table rows and updates
  the grant: three row-write units, not one;
- the three calls are independent REST requests, not the 003 four-statement
  atomic Worker batch.

Historical repository records state that one authenticated dry-run call was
reported successful after a Render auto-deploy and that earlier live D1 manual
tests created test rows. Therefore the existing database must not be described
as empty or qualified. The exact current row count, historical principal
occupancy and whether the dry-run flag remains enabled are **NOT VERIFIED**.
The 2026-10-23 snapshot of 0 rows written that day does not erase historical
rows or prove isolation.

### Worker and Render relationships

- No Cloudflare Worker binding is represented in this repository. The candidate
  Worker is dormant, has no entrypoint export, no deployment config and no live
  route.
- The authority states that existing Worker projects belong to other features.
  They must not be modified or reused for this qualification.
- The optional Render dry-run can target the existing database only if its
  environment is configured with account ID, database ID and a write-capable
  token. No token, value or current setting was read by this task.
- The authority states that Render staging is Free and auto-deploy is off. The
  current live flag state remains an operator-check item, not a proven fact.

### Cloud-side unknowns and operator checks

Before any future write, an approved operator must record the following without
reading or exposing secret values:

1. Cloudflare account identity, plan `Free`, and absence of a card/payment
   method requirement.
2. Exact D1 name/UUID and whether any Worker has a binding to it.
3. For each existing Worker, the binding names and target database IDs only;
   do not modify those Workers.
4. Whether the Render staging/production services currently expose the D1
   dry-run flag; record only boolean presence/state, never `CF_D1_API_TOKEN`.
5. Current row counts and namespace occupancy through a separately approved
   read-only D1 preflight. Do not infer occupancy from dashboard daily counters.

If those views are unavailable, the safe disposition is to keep cloud work
blocked and use a new dedicated database in a later explicitly approved step.

## Isolation decision

**Recommend a new, dedicated, non-production D1 database for the qualification.**

Reasons:

- the existing database has historical test activity and an optional live REST
  consumer;
- current occupancy and bindings are unknown;
- the 003 table is absent but the existing 001 schema already differs from the
  repository by an observed nonunique `paid_voice_reservations_by_owner_day`
  index;
- a dedicated database gives clean pre/post counts, one migration lineage and
  no possibility of touching a real paid namespace;
- the observed Free plan allows up to 10 databases and showed one in use, so one
  qualification database is within the stated Free allowance, subject to a
  fresh dashboard check and explicit creation approval.

Proposed name for approval only:
`shenshu-voice-v1-qualification-20261024`. The exact UUID must be captured after
creation. This document does not reserve or create it. If it is occupied,
creation must STOP for a new name decision.

Do not reuse and migrate the existing `shenshu-voice-budget-test` merely to
avoid creating a database. If the Free/no-card path cannot create a dedicated
database or a permission prompt is not acceptable, STOP; no card workaround.

## 003 migration risk audit

`db/d1/003_paid_voice_operations.sql` is additive. It creates one table and one
explicit index; it does not alter or delete 001/002 data. The migration still has
material verification requirements.

| Risk | Finding | Required gate |
| --- | --- | --- |
| Existing object collision | `CREATE TABLE IF NOT EXISTS` silently accepts an incompatible pre-existing table | Read-only object-absence/schema preflight; existing `paid_voice_operations` is STOP unless exact schema is reviewed |
| Partial prior migration | `CREATE INDEX IF NOT EXISTS` can hide a missing/incompatible table history | Capture table, explicit index and autoindex definitions before and after; no blind retry |
| Data loss | No `ALTER`, `DROP` or 001/002 writes in 003 | Apply only to the dedicated empty database; preserve all rows afterward |
| Owner binding | PK `(principal, operation_id)` is owner scoped | Do not rewrite operation IDs or principals during evidence collection |
| One operation per reservation/grant | `request_id` and `grant_id` are unique | Preflight duplicates and exact postflight counts |
| Foreign keys | References reservation `request_id` and grant `grant_id`; no cascade | Verify the **Worker binding connection** enforces foreign keys, not only the Studio connection |
| Cross-table owner consistency | The database does not independently force `grant.request_id = operation.request_id` or equal owners | Only the reviewed Worker insert SQL enforces it; no out-of-band writer may use the test DB |
| State machine | DB CHECK allows four states but does not enforce transition order | Verify Worker conditional updates and ensure no provider is reachable |
| `result_ref` invariant | DB allows 8-256 characters for completed rows and requires NULL otherwise; Worker narrows to 8-128 | Use a synthetic reference within the Worker bound; do not claim DB and app bounds are identical |
| Digest/byte invariants | DB checks only 43-character digest and byte range; Worker checks base64url shape and exact body digest | Record Worker validation as app-layer evidence, not a DB cryptographic check |
| Expiry | DB requires positive TTL at most 15 minutes; it does not enforce wall-clock correctness | Use a short TTL and the real Worker clock; record expiry behavior |
| `updated_at` | No trigger; Worker transitions update it explicitly | Verify transition timestamps are not treated as authoritative event history |
| Live schema drift | Existing database shows a nonunique owner/day index absent from repository 001 | For a dedicated DB, freeze whether the reviewed init bundle reproduces that observed index; do not silently claim schema equality |
| Foreign-key snapshot | Studio reported `PRAGMA foreign_keys=1` and no violations | Studio connection evidence does not prove Worker binding behavior |

For a dedicated database, the future reviewed initialization order is 001,
002, an explicit decision on the observed live-only owner/day index, then 003.
The exact SQL bundle and hashes must be frozen in the migration approval. The
absence of the operations table must be proven before 003. No migration statement
is executed by this package.

Post-migration checks must cover `sqlite_master` table/index definitions,
`PRAGMA table_info`, `PRAGMA foreign_key_list`, unique indexes, the four CHECK
invariants, `PRAGMA foreign_keys` through the Worker binding, and an empty
`PRAGMA foreign_key_check`. Any missing or extra object is STOP.

## Worker signature isolation

The reviewed boundary is the latest HMAC bridge, not Cloudflare Access:

- a new one-purpose qualification Worker would expose only the five fixed
  internal operation routes;
- the bridge requires HTTPS POST, exact host/path/content type, no query/fragment,
  bounded raw body of at most 2 KiB, exact HMAC-SHA256 body digest, key ID,
  timestamp and nonce;
- a current/previous two-key window is supported, but the first run should use
  one new test key only;
- all verification failures return one generic `403` before any D1 call;
- the bridge reconstructs a minimal body-only request for the candidate; caller
  authentication headers and raw text cannot reach D1;
- no nonce table exists. Exact replay is bounded by the durable operation state
  machine, not by the signature;
- the Worker candidate submits the fixed four-statement admission in one native
  `batch()` and validates every `RETURNING` owner/state field.

There is no approved Worker entrypoint, route, binding or deployment artifact in
the repository. Creating one is a separate implementation/deployment approval,
not part of this read-only package. The future qualification Worker must not
import Render/Auth0, MiniMax or a provider client.

### Test-key lifecycle

1. Generate a new 32-byte random HMAC secret outside the repository; assign a
   dated test-only key ID such as `v1cloud_test_20261024`.
2. Provision the secret directly as the qualification Worker secret and in the
   ephemeral operator runner environment. Never place it in Git, PR text, CI
   logs, command history or evidence.
3. Use only that key for the bounded run; no existing Render token or production
   secret is read or copied.
4. Revoke/delete the qualification key immediately after evidence export. Keep
   the Worker route disabled unless a separate retention approval exists.

### Public endpoint risk

A Workers Free route would be publicly reachable through `workers.dev`. HMAC
prevents unsigned mutation but does not provide private networking, request
authentication privacy, rate limiting or quota-exhaustion protection. An attacker
can still consume Free request/CPU quota. The run must have a short window,
monitor request counts, abort on unexpected traffic and disable the route
immediately afterward. Do not add Access, a paid plan or a payment method to
mitigate this in this package; any such requirement is STOP.

Stable ChatGPT `operation_id` delivery and private durable result storage remain
unproven V1 blockers. Direct signed test calls cannot close either.

## Free/no-card qualification

The user has supplied a Free-plan/no-card attestation and dashboard observations.
The following are accepted only as user-supplied evidence:

- Workers Free: 0/100,000 requests today at the observed snapshot;
- D1 Free: 1/10 databases, 0/5M rows read, 0/100k rows written and 45.06 KB/5 GB
  storage at the observed snapshot.

This task did not inspect the Cloudflare account, billing page, payment methods or
API credentials. Before any future creation, the operator must refresh and record
those observations with timestamps and exact account identity. Any payment-method,
card, paid-plan, Access, custom-domain or permission prompt is a hard STOP. Do not
attempt a card workaround. Free-plan availability does not by itself prove the
dashboard will not request payment.

## Proposed single-run qualification budget

The following is the **only** proposed first-run budget. It is not authorized by
this report.

Proposed identifiers, frozen only if the actual UTC run date remains
2026-10-24; otherwise the whole packet must be reissued with a new date:

- run ID: `v1cloud_20261024_a`
- principal A: `dryrun_v1cloud_20261024_a`
- principal B: `dryrun_v1cloud_20261024_b`
- rollback principal C: `dryrun_v1cloud_20261024_c`
- shared operation: `v1ops_20261024_shared`
- additional A operations: `v1ops_20261024_pa2`, `v1ops_20261024_pa3`
- rollback operation: `v1ops_20261024_pc1`
- one UTC day only: the actual approved run date; no logical rollover test
- Worker daily limit: 3 per principal

### Bounded cases

1. Send unsigned, forged, expired and wrong-key requests. Expect generic `403`
   and zero D1 prepare/read/batch calls.
2. Concurrently admit `shared`, `pa2` and `pa3` for principal A. Expect slots 1,
   2 and 3, exactly three reservations, three consumed grants and three admitted
   operations.
3. Attempt a fourth unique operation for principal A. Expect `429 daily_limit`
   and zero new durable rows.
4. Admit the same `shared` operation ID for principal B and deliberately lose the
   response after commit. Expect either one durable B operation after a signed
   owner-status read, or an explicit ambiguity; never two. A signed replay must
   return the existing operation without another mutation.
5. Re-send an exact signed A admission and a same-principal/different-digest
   request. Expect replay and conflict respectively, with no new durable rows.
6. With a pre-approved test-only fault injection, run one collision/rollback
   probe for principal C and verify zero C rows. If the fault injection is not
   separately approved, omit it and record real rollback as unqualified rather
   than simulating PASS.
7. Apply synthetic state transitions only: provider-pending then completed with a
   synthetic opaque result reference for one A operation, and unknown for another.
   No provider client or MiniMax credential is present.
8. Read fixed owner-scoped postflight queries and metadata counts. Do not expose
   bearer text, private text, key material or a real principal.

### Hard budget caps

| Dimension | Cap or expected bound |
| --- | --- |
| Cloudflare databases created | 1 dedicated qualification DB, separate approval |
| Workers created/deployed | 1 qualification Worker, separate approval |
| HMAC keys | 1 new test key, then revoke |
| UTC days | 1 |
| Worker HTTP requests | **24 maximum** |
| Admission-route requests (including replay, conflict, limit and rollback cases) | **10 maximum** |
| D1-touching authenticated requests | **18 maximum** |
| Accepted admissions | **4 exact** |
| New durable rows | **12 exact** (4 reservations + 4 grants + 4 operations) |
| Successful-admission row-write units | **16 expected** (the grant consume update is an additional row write) |
| State-transition row-write units | **3 maximum** |
| Rollback-probe attempted row-write units | **4 worst-case** |
| Total D1 row-write budget | **32 maximum** (expected up to 23; margin included) |
| D1 rows read | **512 maximum** |
| D1 statement executions | **64 maximum** |
| Storage delta | **256 KiB maximum** |
| Provider/MiniMax calls | **0** |
| Run duration | **20 minutes maximum** |

The 12 durable rows and 23 expected row-write units are deliberately different
numbers. Do not equate durable row count, SQL statement count and the D1
`rows written` quota. Rollback-probe metering is treated conservatively because
Cloudflare's exact quota accounting for a rolled-back batch is not established by
this package. Schema initialization and 003 DDL have a separate approval and no
DML; this document does not claim DDL is unmetered.

Any counter exceeding its cap, unexpected principal, extra row, duplicate slot,
unexpected D1 access, malformed result, non-4xx ambiguity, timeout without a
recoverable state read, secret leak or provider attempt is **STOP**. No retry,
cleanup, refund or compensating write is permitted to make the result appear
clean.

## Separate authorization gates

A generic "continue" is not permission for any of these gates.

1. **Account and isolation gate:** refreshed Free/no-card attestation, account
   identity, exact dedicated database name/UUID, and confirmation no existing
   Worker or Render consumer will be modified.
2. **Database creation gate:** create only the approved dedicated D1 database;
   no other resource and no card.
3. **Schema gate:** approve and apply the exact hashed initialization plus 003
   bundle, with object-absence preflight, zero-row baseline and post-migration
   checks. Do not apply 003 to the shared existing database without a new explicit
   reuse decision.
4. **Worker gate:** create/deploy only the named qualification Worker, HMAC route
   and D1 binding. No Access, paid feature, provider binding or production route.
5. **Test-key gate:** create/provision the one test key and confirm no production
   secret is read.
6. **Write-run gate:** approve the exact identifiers, UTC date, 24-total-request,
   18-D1-touching-request, 10-admission-route and 32-row-write caps, plus the
   fault-injection scope and abort owner.
7. **Render activation gate:** wiring the dormant bridge into Render is later and
   separate; it is not needed for this direct signed qualification.
8. **Private delivery and provider gate:** durable private result storage,
   authenticated retrieval and one capped MiniMax E2E remain separate decisions.

Cleanup of qualification rows or the Worker is also separate after evidence is
archived. Preserve ambiguous rows. Never delete them to manufacture a clean
result.

## V1 status and next real gate

Strict V1 remains **2/9** (gates 1 and 8 only). B1-B4 remain open:

- **B1:** iPhone generated/bridge audio silence remains without a confirmed
  audible result.
- **B2:** real D1 atomic admission remains unqualified; this report only fixes
  the isolation and approval packet.
- **B3:** fail-closed/private durable result delivery remains absent.
- **B4:** zero authorized real MiniMax end-to-end calls.

The next real action is not a cloud write. It is total-control approval, followed
by the account/isolation gate above. Only after a dedicated Free/no-card database
and a separately reviewed Worker artifact exist can the bounded qualification be
authorized.

## Real-operation counters

- Workers, Durable Objects or Access resources created/deployed: 0
- Real D1 reads/writes/queries/migrations: 0
- Cloudflare API calls: 0
- Cloudflare/Auth0/provider keys, tokens or voice IDs read/logged: 0
- Render/Auth0/connector changes: 0
- MiniMax or billable provider calls: 0
- Paid tools, plans, cards or cost changes: 0
- Manual GitHub Actions dispatches: 0 (standard PR-triggered CI only)
- Merges/rebase/rewrites: 0

## Delivery note

This report is the only implementation artifact on its dedicated Draft PR.

- Draft PR: #104, based on
  `docs/voice-v1-cloud-qualification-preflight-20261023`.
- First report commit: `712ebdb8e21d33a5b951920a4f0f6ffd23695e0d`.
- First standard PR-triggered CI run: `40000502006`, **success**.
  - `sqlite-node24`: 329 tests, 329 passed, 0 failed, 0 skipped.
  - Node 20 path `test`: 329 tests, 291 passed, 38 explicit skips, 0 failed.
- Delivery-note amendment head: `e1f535250a7b544270535caacdf16e58735a00f0`.
- Delivery-note amendment CI run: `40000724252`, **success**.
  - `sqlite-node24`: 329 tests, 329 passed, 0 failed, 0 skipped.
  - Node 20 path `test`: 329 tests, 291 passed, 38 explicit skips, 0 failed.

This evidence-note commit only records the completed results above. Its own PR
head and CI result are recorded in the Draft PR body. No manual Actions dispatch
is used.

## Disposition

**COMPLETE for the authorized read-only preflight.** The repository evidence
supports a dedicated qualification database and rejects silent reuse of the
existing shared database as the default. Cloud creation, migration, deployment,
test-key provisioning and real D1 writes remain separately unauthorized. No
cloud PASS, Free/no-card proof, stable ChatGPT operation-key proof or provider
evidence is claimed.
