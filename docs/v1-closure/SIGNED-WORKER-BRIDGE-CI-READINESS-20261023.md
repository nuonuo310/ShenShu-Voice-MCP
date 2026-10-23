# Voice V1 signed Worker bridge and Linux SQLite CI readiness (2026-10-23)

**STATUS: OFFLINE IMPLEMENTATION AND CI COMPLETE; CLOUD NOT OBSERVED. STRICT V1
REMAINS 2/9. B1-B4 REMAIN OPEN.**

This package implements a dormant Render-to-Worker signed bridge, adversarial
authentication tests and a separate Linux Node 24 SQLite CI job. It does not
create or deploy a Worker, D1 database or Access application, query or change
real D1, apply a migration, read a credential or voice ID, modify Render/Auth0 or
an MCP route, enable a paid tool, call MiniMax, or merge anything.

## Authority and fixed base

- Authority commit: `bda3f50fd9d2298ee07095532e7690d9a272dcc9`.
- Authority package:
  `docs/construction-envelopes/2026-10-23-voice-v1-signed-worker-bridge-ci.md`.
- Task branch: `work/voice-v1-signed-bridge-ci-gate-20261023`.
- Implementation commit: `3e298da8590580bc0688132fbc685a23dcbc7441`.
- Draft PR: [#101](https://github.com/nuonuo310/ShenShu-Voice-MCP/pull/101),
  based on `docs/voice-v1-signed-bridge-ci-gate-20261023`.

The Opening Gate verified the exact `nuonuo310/ShenShu-Voice-MCP` origin,
`nuonuo310 <2584974449@qq.com>` identity, one clean worktree, and the authority
branch tip. The dependency chain remained intact: PR #99 head
`79742e84fb7d5dad21bf52e24054ce938882b73b`, then PR #100 authority head
`bda3f50fd9d2298ee07095532e7690d9a272dcc9`, then this Draft PR #101. No reset,
stash, clean, move, rebase, rewrite, merge or manual Actions dispatch was used.

## Delivered changes

| File | Change |
| --- | --- |
| `worker/signed-d1-worker-bridge.js` | New dormant signer/verifier bridge; bounded raw-body read, exact URL binding, HMAC verification before D1, and a minimal reconstructed request for the candidate. |
| `test/signed-worker-bridge.test.js` | New 11-test offline suite covering signer shape, authentication failures, D1-spy zero-call proofs, concurrency, replay, ambiguity, rotation and leak checks. |
| `worker/private-d1-worker-candidate.js` | Header documentation corrected: a signed bridge or equivalent verified deployment boundary is required; Access is no longer described as a prerequisite. |
| `.github/workflows/ci.yml` | Added separate `sqlite-node24` Linux job while preserving the Node 20 test and smoke job. |
| This evidence document | Exact implementation/CI counts, evidence tiers, limitations and next cloud gate. |

No package dependency, D1 schema, migration, fixed SQL, MCP tool, public MCP
route, Render/Auth0 path, provider interface or paid tool was changed. The bridge
is not imported by `server.js` or the staging MCP route; a test asserts that it
remains dormant.

## Signed bridge contract

The Render-side helper accepts an already verified opaque principal binding and
emits only schema-exact fields:

- admission: `version`, `principal`, `operation_id`, fixed `action`,
  `text_digest`, `text_bytes` and bounded `ttl_ms`;
- status: `version`, `principal`, `operation_id`;
- transitions: `version`, `principal`, `operation_id`, `request_id`, plus an
  opaque `result_ref` only for completion.

Extra properties such as bearer text, plaintext voice text, model/voice IDs,
SQL or approval material cannot be serialized into the signed body. The signer
returns no secret and logs nothing.

The Worker-side bridge:

- derives host and path only from `new URL(request.url)` and ignores Host,
  forwarded-host or Access-like headers;
- requires HTTPS, POST, exact `application/json`, no query, fragment or URL
  userinfo;
- rejects a declared content length above 2,048 bytes before reading, reads the
  original stream once with a hard 2,048-byte bound, cancels immediately above
  the bound and rejects a content-length mismatch;
- verifies HMAC-SHA256 over the exact raw bytes plus version, method, host,
  path, content type, timestamp, nonce, key ID and SHA-256 body digest;
- admits only a one- or two-key current/previous rotation window with the
  existing 30-second clock skew;
- returns one generic `403 {"error":"not_authorized"}` for all pre-auth
  failures;
- rebuilds a request containing only the verified bytes and fixed content type,
  then invokes the existing D1 candidate with its allow-all hook. No caller auth
  header reaches the D1 adapter.

The existing `operation_id` one-way state machine remains the durable replay
anchor. There is no durable nonce table. An exact signed replay can reach a D1
read and return the existing operation, but it cannot create a second
reservation, grant or provider attempt. A later one-way transition replay after
its state has advanced fails with `409` and performs no second mutation.

## Offline verification

Local runtime was Node `v24.19.0`.

- targeted signed-bridge suite: **11/11 PASS**;
- full `node --test`: **329/329 PASS**, zero fail or skip;
- Node 20-equivalent `node --no-experimental-sqlite --test`: **291 pass, 0
  fail, 38 explicit skips**;
- JavaScript syntax checks: PASS;
- `node test/smoke-server.mjs`: PASS;
- `git diff --check`: PASS.

The 11 tests prove, with fake keys and local SQLite or a throwing D1 spy:

- unsigned, forged, expired, future, wrong-host, wrong-path, wrong-method,
  wrong-content-type, query-confused and body-tampered requests receive `403`
  with zero D1 `prepare` or `batch` calls;
- oversized streams are cancelled and content-length mismatches fail closed;
- missing, weak, three-key or otherwise malformed verifier configuration fails
  at construction;
- a valid signed admission reaches D1, and a signed owner status recovers it;
- a validly signed malformed JSON body is rejected before D1;
- cross-principal reuse of the same operation ID remains owner isolated;
- same-principal/different-digest reuse conflicts without a second reservation;
- concurrent identical signed replay creates exactly one reservation, grant and
  operation, and a later exact replay is read-only at the operation level;
- a commit whose response is deliberately lost returns `503`; signed owner
  status recovers the committed row and retry returns replay without duplicate;
- current and previous keys both work while an unavailable third key is denied
  before D1;
- signer bodies, responses and source expose no secret, plaintext text,
  signature, digest, grant or bearer material, and the source has no logger.

## Linux CI evidence

PR-triggered CI run
[`39987794248`](https://github.com/nuonuo310/ShenShu-Voice-MCP/actions/runs/39987794248)
completed successfully on implementation head
`3e298da8590580bc0688132fbc685a23dcbc7441`.

| Job | Runtime | Actual result |
| --- | --- | --- |
| `test` | Node `v20.20.2`, Ubuntu Linux | **329 tests, 291 pass, 0 fail, 38 explicit skips**; smoke PASS |
| `sqlite-node24` | Node `v24.21.0`, Ubuntu Linux | **329 tests, 329 pass, 0 fail, 0 skips**; `node:sqlite` runtime probe PASS |

The 38 Node 20 skips are the explicit `node:sqlite`-unavailable cases, not
passes. The Node 24 job executes those cases, including the new signed-bridge
SQLite tests. The job has a five-minute timeout, read-only repository
permissions, no secrets, no cloud credentials and no manual dispatch.

## Evidence tiers and limitations

| Claim | Tier | Boundary |
| --- | --- | --- |
| Cloudflare native `DB.batch()` is one SQL transaction | Documented API guarantee | Not observed on this account or schema |
| HMAC verification occurs before any D1 prepare/read/batch | Local evidence | Fake keys; invalid cases use a throwing D1 spy |
| Four admission statements commit or roll back together under SQLite | Local evidence and Linux CI | SQLite contract simulation, not Cloudflare D1 |
| Concurrent replay/limits and commit-then-lost-response behavior | Local evidence and Linux CI | Single-host SQLite; no real network ambiguity |
| Real Worker routing, Web Crypto, CPU limits and D1 latency | **Not observed** | Zero Worker/D1 operations |
| Render can reach the Worker and treats timeout as ambiguous | **Not observed** | No Render or Worker deployment |
| Public endpoint abuse cannot exhaust Free quota | **Not claimed** | No anti-abuse or paid rate-limit implementation |
| Cloudflare account is Free/no-card and eligible | **Not verified** | No account API, dashboard or payment access |
| MiniMax provider attempt is exactly once | **Not claimed** | Provider calls: 0 |

Additional security limits:

- a Worker compromise exposes the HMAC key and can mint signed requests; an
  attacker with arbitrary Worker execution could already attempt D1 directly;
- timestamp correctness depends on the runtime clock;
- unauthenticated traffic can consume a small bounded read and CPU before
  `403`; a public `workers.dev` endpoint remains publicly reachable and can
  consume Free request/CPU quota even though it cannot create an unsigned D1
  mutation;
- exact transport replay remains accepted by the nonceless protocol; the durable
  operation state machine, not the signature, prevents a second mutation;
- local SQLite and Node 24 CI do not prove Cloudflare's exact `RETURNING`, D1
  result, timeout, rollback or concurrent behavior.

## No-card and public endpoint risk

No payment details were entered, no plan was selected or upgraded, no paid tool
was enabled, and no cost was accepted. This package also did not verify the
Cloudflare account's current plan or payment-method state. Any future deployment
must begin with an operator attestation that the account remains Free/no-card.

The recommended signed request does not require Cloudflare Access or Zero Trust
onboarding, avoiding the previously observed payment-details gate. That is an
architecture choice, not proof that the account or a future dashboard flow is
card-free. The Worker would be reachable at a public hostname; signature checks
protect data mutation, not availability or quota. Total control must accept that
risk, approve a free mitigation, or keep the Worker undeployed. Any request for
payment details, a paid plan, Access onboarding or paid rate limiting is STOP.

## Next independently approved cloud gate

Before any deployment, require a separate package and explicit approval for:

1. Operator Free/no-card attestation and acceptance of public endpoint quota
   risk; no card fallback.
2. One dedicated non-production D1 database, exact account/database IDs,
   read-only preflight and additive `003` migration review; no production rows.
3. A test-only Worker and test-only HMAC key, with secrets provisioned outside
   logs and evidence, and a hard nonbillable request/write budget.
4. Real negative tests for unsigned, forged, expired, future, host/path/body
   confusion and oversized requests, with postflight proof of zero D1 writes.
5. Real duplicate/concurrent limit, exact-schema rollback, timeout ambiguity,
   key rotation, Web Crypto and CPU/latency qualification.
6. A separately reviewed Render caller with bounded outbound timeout, no
   automatic retry after ambiguity and no provider call from this task.
7. Private result delivery and one explicitly approved real MiniMax E2E remain
   separate gates; this package supplies neither.

Rollback remains disabling the route and revoking the test key. Do not delete or
rewrite committed operation rows merely to make evidence appear clean.

## Real-operation counters

- Workers, Durable Objects or Access resources created/deployed: 0
- Real D1 reads/writes/queries/migrations: 0
- Cloudflare API calls: 0
- MiniMax or billable provider calls: 0
- Cloudflare/Auth0/provider keys, tokens or voice IDs read/logged: 0
- Render/Auth0/connector changes: 0
- Paid tools or plan changes: 0
- Manual GitHub Actions dispatches: 0 (standard PR-triggered CI only)
- Merges/rebase/rewrites: 0

Read-only GitHub PR/CI metadata was fetched with the existing credential helper;
credential values were not printed, returned in evidence or written to disk by
this task.

## V1 status

Strict V1 remains **2/9** (gates 1 and 8 only). The formal blocker count is not
reduced.

- **B1:** iPhone generated/bridge audio remains reported silent; no
  user-confirmed audible result.
- **B2:** real D1 paid admission remains unqualified. Offline signed
  authentication and Linux SQLite CI reduce implementation uncertainty but do
  not supply Cloudflare execution evidence.
- **B3:** real fail-closed/private delivery remains undone; durable private
  result storage and authenticated retrieval are absent.
- **B4:** zero authorized real MiniMax end-to-end calls.

## Disposition

**COMPLETE for the authorized offline signed-bridge and Linux SQLite CI scope.**
Both required CI jobs passed and the Draft PR is based on the authority branch.
No cloud PASS, account-card-free proof, Render connectivity, public-endpoint
availability or provider evidence is claimed. Any next step that creates cloud
resources, changes the bridge architecture, requires payment details, or changes
a frozen interface/schema must return to total control before execution.
