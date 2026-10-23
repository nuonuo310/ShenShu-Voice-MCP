# Voice V1 - D1 atomic architecture decision (2026-10-23)

Status: **TOTAL CONTROL DECISION REQUIRED. RECOMMEND OPTION A, A PRIVATE
WORKER USING THE NATIVE D1 BATCH BINDING. NO CLOUD RESOURCE WAS CREATED OR
QUERIED. STRICT V1 REMAINS 2/9.**

The review used current primary Cloudflare documentation and local,
non-network contract probes only. It did not create or deploy a Worker or
Durable Object, read or write real D1, apply a migration, read a credential,
modify Render/Auth0, register a paid tool, call MiniMax or merge anything.

## Decision

**Recommended: Option A.** Keep the verified OAuth principal and paid workflow
on the Render-hosted MCP server. Have Render call one private, Access-protected
Cloudflare Worker. That Worker uses its native D1 binding to prepare the four
fixed statements and sends them through one `env.DB.batch()` call.

This is the smallest route with an **explicit current Cloudflare API guarantee**
that a batch is a SQL transaction and that a statement failure aborts or rolls
back the whole sequence. The official guarantee is API documentation, not yet
production evidence. A separately approved nonbillable cloud qualification is
still required before paid activation.

Option B, extending the existing REST `/query` client to send a structured
`batch` array, is operationally smaller but is **not selectable under this
envelope** today. The current REST reference accepts a batch-shaped request but
does not state the SQL-transaction and rollback guarantee that the Worker
binding page states. It may be reconsidered only after the exact atomicity test
below is separately approved and passes.

Option C, SQLite-backed Durable Objects, has strong documented transactions but
would replace the D1 data plane rather than wrap it. It remains a fallback, not
the minimum V1 path.

## Authority and opening verification

- Repository: `nuonuo310/ShenShu-Voice-MCP`.
- Origin: `https://github.com/nuonuo310/ShenShu-Voice-MCP.git`.
- Git identity: `nuonuo310 <2584974449@qq.com>`.
- Authority branch: `docs/voice-v1-d1-atomic-architecture-review-20261023`.
- Authority commit: `6588220af1e1d6f791c2fce140d7e3c311ebcfa8`.
- Sole authority package:
  `docs/construction-envelopes/2026-10-23-voice-v1-d1-atomic-architecture-review.md`.
- Task branch: `work/voice-v1-d1-atomic-architecture-review-20261023`, created
  from the exact authority commit.
- Worktree: `ShenShu-Voice-First-Audition`; one registered worktree only.
- Opening tracked state was clean with no untracked files. No reset, stash,
  clean, rebase, move or rewrite was performed.
- Authority parent: `8c3f9d0ecc9ea8a4f1ceb4623c2a652dcff598cc`, exactly PR #93
  head. The authority commit only adds the construction package.
- Authority CI run `39971757076`: `completed/success`.

Open Draft stack verified through the GitHub API:

1. PR #92, docs head `74be323c...`, base `work/voice-v1-idempotency-gate-20261023`.
2. PR #93, work head `8c3f9d0e...`, base PR #92, `mergeable_state=clean`.
3. PR #94, authority docs head `6588220a...`, base PR #93, `mergeable_state=clean`.

PR #93 total-control review accepts only the local SQLite/offline candidate. It
explicitly denies real D1, migration, paid-route registration, deployment,
credential access and MiniMax use. The review also preserves stable
`operation_id` ingress and private result delivery as separate blockers.

## Baseline reviewed

- `src/cloudflare-d1-http.js` supports one parameterized REST query per call.
- `src/d1-http-paid-store.js` makes separate reservation, issue and consume calls.
  Those calls are not a transaction.
- `src/d1-transactional-operation-store.js` requires a client with `query()`,
  `batch()` and an explicit `atomicBatch === true` contract.
- `src/d1-operation-sql.js` contains the fixed strict reservation, strict grant
  issue, operation insert, consume and state-transition SQL.
- `db/d1/003_paid_voice_operations.sql` is additive and binds operation,
  reservation and grant ownership without storing text, audio, URL or secrets.
- The Render `/paid-mcp` path verifies signed Auth0 identity, audience, scope and
  lifetime before any handler can receive a verified principal.
- Existing D1 qualification material is read-only, plan-only or local-fake
  evidence. No real concurrent write qualification has run.

The previous local transaction tests proved the SQL and state machine under
`node:sqlite`. They did not prove Cloudflare execution.

## Primary-source evidence

All Cloudflare pages below were accessed on 2026-10-23. Page update dates are
the dates published by Cloudflare, not the access date.

| Source | Current statement relevant to the decision | Limit |
| --- | --- | --- |
| [D1 Database `batch()`](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch), updated 2026-06-22 | Statements are executed and committed sequentially and non-concurrently. `Batched statements are SQL transactions. If a statement in the sequence fails, then an error is returned for that specific statement, and it aborts or rolls back the entire sequence.` | API contract, not observed production evidence. |
| [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), updated 2026-04-21 | Each D1 database is single-threaded and processes one query at a time. Batch members have individual statement limits and the whole call has a 30-second boundary. | Does not prove application-visible timeout handling. |
| [D1 binding timeout behavior](https://developers.cloudflare.com/d1/observability/debug-d1/#d1-binding-timeout-behavior), updated 2026-10-21 | `run()`, `all()`, `first()` and `batch()` accept neither a timeout option nor an `AbortSignal`. A call may block until completion, an internal limit or Worker termination. | A caller timeout cannot prove rollback or commit. |
| [D1 REST query](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/), accessed 2026-10-23 | The request body may be `{sql, params}` or `{batch: [{sql, params}, ...]}`. | The page describes batch execution but does not state the transaction and whole-batch rollback guarantee. |
| [Durable Object SQLite storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/#transactionsync), updated 2026-09-21 | Storage is transactional, strongly consistent and private to one object. `transactionSync()` rolls back when its callback throws; `transaction()` commits or aborts atomically. | Requires moving the authoritative data into a Durable Object. |
| [Cloudflare Access service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/), updated 2026-10-02 | Access can authenticate automated systems with a Client ID and Client Secret; headers are `CF-Access-Client-Id` and `CF-Access-Client-Secret`; secrets can be rotated, disabled and revoked. | Adds Cloudflare One configuration and a bearer credential held by Render. |
| [Durable Object pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), updated 2026-10-18 | Billing includes compute duration and storage; SQLite-backed objects are available on Workers Free and Paid plans with storage billing dimensions. | The V1 fallback would add new compute/storage and state-migration operations. |

The Worker batch page is strong enough to select an architecture to qualify. It
is not evidence that this account, schema, SQL, network path or deployment will
behave correctly. That remains the purpose of the one-run cloud gate.

## Option comparison

### Option A - private Worker with native D1 batch binding

Shape:

```text
ChatGPT
  -> Render /paid-mcp
       verify Auth0 JWT signature, issuer, audience, scope, expiry
       derive opaque principal
  -> HTTPS service request protected by Cloudflare Access
  -> one-purpose Cloudflare Worker
       strict body validation and fixed SQL only
       env.DB.prepare(...).bind(...) x 4
       env.DB.batch([...]) once
  -> existing D1 database
       reservations, grants, operations
```

Advantages:

- The current primary API documentation explicitly states SQL-transaction and
  whole-batch rollback semantics.
- D1 remains the authoritative store; `001`, `002` and additive `003` stay in
  one database and one constraint graph.
- The Worker can bind the database directly and never receives the existing
  account-wide D1 REST token.
- Four statements are small relative to D1's per-statement and 30-second limits.
- D1's documented single-threaded database processing and unique constraints
  support the intended same-operation and daily-slot serialization.

Costs and risks:

- Adds one Cloudflare Worker deployment, one private hostname/Access application
  and one service-token credential pair held by Render.
- Adds an internal network hop and a second trust boundary.
- Requires a separately authorized nonbillable qualification against real D1.
- Batch results are post-commit. JavaScript cannot inspect intermediate rows and
  roll back after the batch returns. Correctness must come from strict SQL and
  constraints, as the `003` candidate does.
- The binding offers no cancellation signal. A Render timeout is ambiguous, not
  proof of failure.

### Option B - keep Render on Cloudflare REST and send `{batch: [...]}`

Shape:

- extend the existing `createCloudflareD1Http` client with one POST containing a
  structured batch array;
- no new Worker, Access application or service token;
- the existing D1 API token remains on Render.

Advantages:

- smallest code and deployment change;
- existing error, size and timeout handling is already local and reviewable.

Why it is not selected now:

- the current REST reference exposes a batch-shaped body but does not state the
  transaction and rollback guarantee found on the Worker binding page;
- a successful HTTP response containing multiple `D1Result` objects is not, by
  itself, evidence that a mid-batch failure rolled back all preceding statements;
- choosing it would make the atomicity claim depend on undocumented behavior.

Reconsider only if total control authorizes an exact nonbillable rollback probe
against a dedicated D1 database and the result plus current docs unambiguously
establish whole-batch rollback. Until then, three independent `/query` calls or a
single multi-statement REST string are forbidden substitutes.

### Option C - SQLite-backed Durable Object

Shape:

- route each principal or a stable principal shard to one SQLite-backed Durable
  Object;
- put reservation, grant and operation rows in that object's private SQLite;
- wrap the four writes in `transactionSync()` or `transaction()`.

Advantages:

- explicit documented transactional and strongly consistent storage;
- no shared-row race between independent principals;
- useful fallback if native D1 batch cannot be proven in the account.

Costs:

- replaces D1 as the authoritative paid data plane instead of adding a safe D1
  execution path;
- needs object naming/sharding, lifecycle and migration design;
- adds Durable Object compute duration and storage billing;
- a global singleton would serialize all principals and create a hotspot;
- cross-object administrative reporting and backup/restore semantics differ.

This is a fallback, not the minimum V1 architecture.

## Recommended trust and transaction design

### Identity and authentication

1. ChatGPT sends the existing Auth0 bearer token to Render `/paid-mcp`.
2. Render performs the existing exact JWT verification and derives the opaque
   principal. The caller cannot supply a subject, audience, grant, approval,
   model, voice, provider setting or request ID.
3. Render checks the text and `operation_id`, computes text bytes and SHA-256
   digest, and sends those values to the Worker. It does not send raw text.
4. The Worker is not a public MCP endpoint. Its custom hostname is protected by
   a Cloudflare Access application whose only allowed identity is the dedicated
   Render service token. `workers.dev` is disabled and no alternate public route
   is configured.
5. The Worker rejects unknown paths, methods, content types, oversized bodies,
   extra fields and malformed identifiers before preparing SQL.
6. The D1 binding is scoped to one database. The Worker receives no provider key
   and no account-wide D1 REST token.

Access service tokens are bearer credentials. Only Render holds the Client ID
and Secret; the Worker deployment operator holds deployment credentials
separately. Secrets must never enter Git, request bodies, query strings, logs or
PR evidence. The Access token should have a finite lifetime, be rotated through
its supported grace window and be revoked immediately on suspicion.

If Access is unavailable or unacceptable to total control, the only acceptable
fallback is a Worker-verified asymmetric or HMAC-signed request with timestamp,
body binding and replay handling. An unauthenticated public Worker is not an
option.

### Internal request and response

All calls are server-to-server POST requests with `application/json` and no
caller-controlled SQL.

`POST /internal/v1/paid-operations/admit`

```json
{
  "version": 1,
  "principal": "verified opaque principal",
  "operation_id": "client-stable opaque id",
  "action": "generate_shenshu_voice",
  "text_digest": "base64url sha256",
  "text_bytes": 123,
  "ttl_ms": 300000
}
```

The Worker, not Render or ChatGPT, generates request ID, grant ID, current UTC
day and issued/expiry timestamps. The response is a normalized disposition and,
when needed, only the server record fields required for a later state call:

```json
{
  "status": "admitted | replay | conflict | expired | daily_limit",
  "state": "admitted | provider_pending | completed | unknown",
  "operation_id": "...",
  "request_id": "...",
  "slot": 1,
  "expires_at": 123,
  "result_ref": "opaque reference only when completed"
}
```

The Worker does not return the grant ID or authorization material. Additional
POST endpoints perform owner-scoped state reads and the `provider_pending`,
`completed` and `unknown` transitions with the same principal and operation key.

### State machine and transaction boundary

- New owner/operation: one four-statement batch performs strict reservation,
  strict grant issue, operation insert and grant consume.
- Existing operation with the same digest/bytes/action: replay classification;
  never reserve again.
- Existing operation with a different digest/bytes/action: conflict; no write.
- Expired: fail closed; no provider attempt.
- Daily limit: no provider attempt and no refund.
- `admitted`: in-progress; no provider attempt from a duplicate delivery.
- `provider_pending`: unknown outcome; no retry, refund or second provider call.
- `unknown`: permanent fail-closed outcome for that operation; no retry/refund.
- `completed`: return only the already persisted opaque result reference.

Only the four-statement admission batch is a multi-statement transaction.
Provider-pending, completion and unknown transitions are single conditional
updates. The provider call is deliberately outside every database transaction.

The Worker must call the provider-facing Render process only after it has a
confirmed `provider_pending` result. A lost or timed-out pending response means
the provider is not called. A provider success followed by a lost completion
response leaves the operation unknown and must not trigger a second call.

### Ambiguity and at-most-one provider attempt

- A D1 batch rejection is credited as rollback only because the Worker binding
  documents whole-batch rollback.
- A network timeout, Worker termination or malformed proxy response is unknown.
  It is never converted into success, a refund or an automatic retry.
- Render should use a bounded outbound timeout (8 seconds is consistent with the
  existing D1 REST client) and treat expiry as ambiguous.
- A later state read can resolve a committed operation. If no row is visible,
  ChatGPT may retry only with the same transport-stable operation ID; arbitrary
  generation of a new ID can still duplicate intent.
- Unique owner/operation, request and grant constraints make two successful
  admissions impossible even if two requests race.

The database transaction does not make provider delivery exactly-once. The
system guarantees at most one provider attempt by ordering, no automatic retry
and fail-closed ambiguous states. Provider-side idempotency is not assumed.

## Security, observability and operations

- Deny direct public access at Access before Worker execution; keep only the
  exact internal route name and POST methods.
- Enforce a small JSON body cap, strict schema, safe identifier regexes and a
  bounded TTL. Reject extra fields, including caller-supplied principal, grant,
  request ID, approval, model, voice, audio or SQL.
- Apply an edge/WAF rate limit and Worker-side bounded concurrency suitable for
  an internal service. Do not add permissive CORS.
- Log only timestamp, request ID, hashed principal, hashed operation ID,
  disposition, duration and D1 result metadata needed for audit. Never log Access
  headers, bearer tokens, provider keys, text, audio or raw SQL parameters.
- Rotate the Access token and Worker deployment credentials independently.
  Revoke the Render D1 REST token only after a separately approved cutover, not
  during architecture review.
- Prefer a dedicated non-production D1 database for qualification. Any table
  deletion, row cleanup or Worker deletion after a billable or ambiguous attempt
  requires separate approval; preserve evidence instead.

## Local contract verification

New test-only files:

- `test/fixtures/worker-d1-binding-contract.mjs`
- `test/d1-worker-atomic-contract.test.js`

Evidence commit:
`c31accb2ebd4107a4f00573da8906e282147d89b`.

They simulate the Worker binding API over local SQLite and do not add production
Worker code, a deployment, a dependency or network I/O. The probe verifies:

- one query followed by exactly one `DB.batch()` containing four prepared
  statements;
- result mapping to the existing transactional store;
- a generated request-ID collision inside the batch rolls back reservation,
  grant and operation together;
- malformed `D1Result` arrays are rejected rather than accepted as success;
- the local contract contains no `fetch`, REST client, D1 API token or Access
  credential dependency.

Evidence on Node 24.19.0:

- targeted Worker contract: **4/4 PASS**;
- full `node --test`: **300/300 PASS**;
- `node test/smoke-server.mjs`: PASS;
- existing transactional-operation tests remain green.

This proves the local mapping contract only. It does not execute Cloudflare D1 or
Access.

The repository CI uses Node 20, where `node:sqlite` is unavailable and the SQLite
tests self-skip. Before paid activation, a separate reproducible Node 22+ test
job should run these cases on Linux. This package does not edit workflows.

## One-run real-cloud qualification proposal

This must be a separate, explicitly approved nonbillable run. It is not
authorized by this review.

### Preconditions and approvals

1. Approve one dedicated non-production D1 database and its exact account and
   database IDs. Prefer a fresh database; do not mix with production data.
2. Approve additive `003` migration and a read-only schema preflight covering
   columns, checks, unique keys, foreign keys and indexes.
3. Approve one private qualification Worker, its custom hostname, Access
   application/policy and service token, plus a test-only deployment credential.
4. Approve a test Auth0 principal or qualification-only principal mapping. Never
   reuse a real user's paid quota.
5. Approve a hard write budget and the no-cleanup/no-refund policy.
6. Keep provider credentials and paid tool registration absent from the Worker.

### Hard run envelope

- One run ID, one dedicated test principal per scenario, one UTC day.
- No provider or MiniMax call. No paid tool route. No production Render changes.
- Maximum 24 rows written, maximum 12 durable inserted rows, maximum 12
  concurrent requests and a maximum of three admissions per test principal.
- No automatic retry after any non-2xx, timeout or malformed response.
- No row deletion, slot reuse, refund or cleanup during or after the run.
- Stop immediately on wrong account/database identity, schema drift, unexpected
  row counts, provider invocation, credential exposure or unknown response.

### Sequence

1. **P0 schema and identity preflight:** read only the exact D1 database identity,
   existing row counts, `001`/`002` schema, `003` presence and foreign-key/index
   metadata. Any drift or overlap with production is STOP.
2. **P1 rollback proof:** through the qualification-only Worker path, submit the
   four admission statements with a deliberate final constraint failure. Expect
   one batch error and zero reservation/grant/operation rows for that unique
   request. Repeat no more than once.
3. **P2 concurrent limit:** send 12 concurrent distinct operations for the test
   principal with limit 3. Expect exactly 3 admissions, 9 daily-limit outcomes,
   slots 1/2/3, exactly 3 reservations, 3 consumed grants and 3 operations.
4. **P3 duplicate:** send five concurrent copies of one operation ID for a second
   test principal. Expect exactly one admission and four replay/in-progress
   outcomes, with one reservation and no second grant or operation.
5. **P4 timeout ambiguity:** use a qualification-only delay after a committed
   admission so the outbound client times out. Then perform an owner-scoped state
   read. Expect either one durable admitted operation or no durable operation,
   never two, and no provider call or automatic second admission.
6. **P5 one-use and postflight:** attempt a second consume/transition. Expect no
   state change. Read all three tables and foreign-key metadata. Record exact
   counts, IDs, statuses, D1 result metadata and timing without secrets.
7. **P6 disposition:** leave test rows in place. Revoke the test Access token,
   disable the qualification route and prepare a separate deletion/rollback
   request only after evidence is archived.

### Expected qualification conclusions

- Native Worker `batch` commits all four statements or none on the exact schema.
- Concurrent duplicate and limit behavior matches the unique constraints.
- An ambiguous outbound timeout cannot cause a second provider attempt.
- No provider/secret/deployment surface is reachable from a client.
- Node 24 SQLite evidence is reproduced in a cloud-specific run, not inferred.

## Effect on the earlier S3 packet

The prior S3 packet predates the `003` operations table. Its row budget, table
queries and invariant checks must be amended to include operations, grant owner
binding and the four-statement transaction before it is used. Do not execute the
old packet unchanged and do not treat this architecture review as execution
approval.

## Remaining unknowns

1. Real Cloudflare D1 batch behavior for these exact SQL statements, constraints,
   `RETURNING` rows and concurrent batches has not been observed.
2. Whether the REST `{batch}` route is atomic remains unproven by current primary
   documentation and, if desired, needs the exact rollback probe.
3. ChatGPT transport stability for `operation_id` is not proven. This is a
   separate ingress blocker; architecture choice does not close it.
4. Private durable result storage and authenticated retrieval remain separate
   blockers from operation admission.
5. Access plan availability, custom hostname/DNS, token lifetime and cost need
   operator approval.
6. Render outbound timeout behavior and retry policy must be proven end to end;
   current source does not implement the proposed Worker bridge.
7. Node 20 CI still does not execute the SQLite contract.

## Rollout and rollback

Rollout remains dormant and unreachable by ChatGPT until a future paid tool is
separately approved. The recommended deploy order is qualification database,
qualification Worker and Access policy, then tests, then a separate production
design review.

Rollback before any paid attempt: revoke the Access token, disable the private
route, revert the Render caller and leave additive tables and test evidence in
place. Do not drop tables or delete rows as routine rollback. After any
potentially billable attempt, never delete or refund operation/reservation rows
to make a result appear clean. Any destructive cleanup requires a new approval.

## V1 blocker status

Strict V1 remains **2/9** (gates 1 and 8 only). This review reduces architecture
uncertainty for B2 but does not close B2 and does not reduce the formal count.

- **B1:** iPhone generated/bridge audio remains reported silent; no
  user-confirmed audible result.
- **B2:** real D1 paid-namespace qualification and trusted paid wiring remain
  undone. Option A and the one-run qualification need approval.
- **B3:** real fail-closed/private-delivery evidence remains undone; private
  durable result storage is still absent.
- **B4:** zero authorized real MiniMax end-to-end calls.

The next true gates are total-control approval of Option A, the nonbillable
real-D1 qualification, stable operation-key ingress, private delivery plus iPhone
audibility, then one separately approved MiniMax E2E.

## Real-operation counters

- Worker or Durable Object creation/deployment: 0
- Real D1 reads/writes/queries/migrations: 0
- Cloudflare API calls: 0
- MiniMax or billable provider calls: 0
- Real keys, tokens or voice IDs read/logged: 0
- Render/Auth0/connector changes: 0
- GitHub Actions dispatches: 0
- Merges/rebase/rewrites: 0

Read-only GitHub metadata was used for PR topology and authority CI. Read-only
public Cloudflare documentation was fetched; no Cloudflare account API was used.

## Disposition

**TOTAL CONTROL DECISION REQUIRED.** Choose or reject Option A and authorize the
separate one-run nonbillable D1 qualification. The recommended build is a
one-purpose, Access-protected Worker using one native D1 `batch()` over the
existing four strict statements. No real atomicity claim is made until that cloud
evidence exists.
