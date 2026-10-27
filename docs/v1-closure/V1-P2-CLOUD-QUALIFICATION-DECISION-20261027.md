# Voice V1 P2 - cloud qualification decision: private durable audio STOP (2026-10-27)

**STATUS: TOTAL CONTROL DECISION REQUIRED. The authorized offline review is
complete. A real one-session cloud qualification is BLOCKED because the current
D1 and qualification Worker do not provide a safe private durable audio backend,
and no other private object store is provisioned or authorized. No application
request, Cloudflare API/D1 operation, Worker request, deployment, route change,
Render/Auth0 change, secret generation, provider call, real MCP call, merge or
manual Actions dispatch occurred. Strict Voice V1 remains 2/9; B1-B4 remain
OPEN.**

## Authority and opening gate

- Repository: `nuonuo310/ShenShu-Voice-MCP`.
- Origin: `https://github.com/nuonuo310/ShenShu-Voice-MCP.git`.
- Sole authority: PR #138, commit
  `e806ecf7e08e24f924211eb438a48256e906c282`, file
  `docs/construction-envelopes/2026-10-27-voice-v1-p2-cloud-qualification-gate.md`.
- Parent baseline: PR #137 HEAD
  `f63c99a5a5a4309af2b63a847be2148ec08d3a4f`.
- Opening HEAD was the exact authority commit in one detached, isolated
  worktree. The worktree was clean; there was no stash.
- PR #138 is open, Draft and `clean`, with base branch
  `codex/voice-v1-p2-one-shot-player-connection-20261027`, base SHA
  `f63c99a...`, one added documentation file. Its standard `pull_request` CI run
  `40505769595` is **success** (Node 20 `test` job `122194567829`).
- PR #137 is open, Draft and `clean`, head `f63c99a...`. Its standard
  `pull_request` CI run `40505261988` is **success** (Node 20 `test` job
  `122192828900`).
- CI is repository regression evidence only. It is not cloud D1, Worker, Auth0,
  R2, deployment or provider evidence.

The reviewed authority ancestry contains the P1 private player and the unmounted
P2 composition, but not the historical qualification Worker or transactional
operation adapter. Those live only in earlier unmerged Draft stacks:

- Worker artifact source commit: `f2be0699f5e480c0489856e7ad15877cfa0a3eb0`.
- Deployed Worker version reported by the operator:
  `2320fd44-294c-4789-91bd-c20694254eca`.
- Worker artifact and D1 schema remain outside the authority tree and must not
  be silently re-deployed from this PR.

## Decision

There are two separate trust domains, and they must not be conflated:

1. **D1 is the intended paid-admission authority.** Its reservation SQL is a
   single atomic statement, but full cross-statement cloud atomicity remains
   unproven. It must not hold the private WAV.
2. **A private object store is the audio-result authority.** It must be durable,
   strongly consistent, non-public, same-origin retrievable, TTL-bounded and
   deletable. No such resource exists in the current inventory.

The current D1 schema has no audio table. The current qualification Worker
manifest last reported by the operator has exactly one `DB` binding and no R2,
KV or Durable Object binding.
The P2 result store is intentionally only an injected contract and an offline
test backend; `server.js` does not mount it.

Therefore a live qualification cannot safely begin. Adding another abstract
store would not close the gap. The single product/infrastructure decision is:

> **Authorize or reject one dedicated private Cloudflare R2 bucket as the P2
> durable audio backend, owned by ShenShu total control and provisioned only
> under a new A1/A2 window.**

The recommended exact target is a private bucket named
`shenshu-voice-v1-p2-audio-20261027`, used only by Voice V1 P2 qualification,
with public access disabled and no custom domain or `r2.dev` URL. It is not
created by this document. Enabling R2 may require an account-level product
subscription even when usage remains inside the free tier; if the current
no-card posture prevents enablement, accepting that commercial change is part
of this same decision. If this single decision is rejected, P2 remains BLOCKED
and V1 remains 2/9; D1 must not be repurposed as media storage.

## PASS / BLOCKED evidence matrix

| Domain | Current evidence | Status |
| --- | --- | --- |
| P2 one-shot offline composition | Real paid pipeline composition, fixed model/voice, one provider attempt, fail-closed store failure | **PASS (offline)** |
| Canonical principal | One shared `SHA-256(issuer NUL sub)` derivation used by MCP verifier and player callback | **PASS (offline)** |
| MCP/player principal mismatch | Fails before reservation or provider side effect | **PASS (offline)** |
| Caller authority fields | Caller principal, operation ID, model, voice and grant are rejected | **PASS (offline)** |
| Same-origin private retrieval | `/player/audio` uses the HttpOnly session, `private, no-store`, `Vary: Cookie`, no CORS, no URL bearer | **PASS (offline)** |
| At most one result per principal | Contract and test backend keep only the latest record | **PASS (offline contract only)** |
| TTL 300 seconds | Default 300 s and bounded 30-900 s in the injected contract | **PASS (offline contract only)** |
| D1 reservation/grant SQL | Atomic first-free-slot insert, unique replay key, one-use consume | **PASS (source and offline SQL)** |
| D1 private WAV storage | No table, no backend, and no safe fit for the 2 MiB contract | **BLOCKED / REJECTED** |
| Durable private audio backend | No R2/KV/Durable Object binding or provisioned store | **BLOCKED - unique product decision** |
| Real D1 atomicity/rollback | No same-window cloud evidence; local SQLite is not D1 proof | **BLOCKED** |
| Live Auth0/MCP/player continuity | Shared derivation is proven offline; one real subject across both paths is not observed | **BLOCKED** |
| Stable server-owned operation ID | Resolver is a required injected dependency; no live resolver or transport guarantee is evidenced | **BLOCKED** |
| Exact deployed Worker identity | Version and closure are operator-observed only; current tree has no Worker artifact | **PARTIAL / UNVERIFIED** |
| Exact deployed staging commit | HTML parity and operator report exist; the service exposes no build SHA | **PARTIAL / UNVERIFIED** |
| Real provider/MiniMax | Zero calls by design | **BLOCKED / NOT AUTHORIZED** |

## Cloud identity ledger: reported versus verified

| Item | Exact value | Provenance | Evidence class |
| --- | --- | --- | --- |
| Cloudflare account | `5a1af7ea0ef8f8aea6365306d775a894` | Historical operator dashboard/CLI record | **Reported, not independently API-verified** |
| Qualification Worker | `shenshu-voice-v1-qualification-20261024` | Historical operator record and unmerged artifact | **Reported** |
| Worker version | `2320fd44-294c-4789-91bd-c20694254eca` | Historical operator dashboard/CLI record | **Reported** |
| Worker source | `f2be0699f5e480c0489856e7ad15877cfa0a3eb0` | Historical unmerged Draft stack | **Source identity externally reported; absent from authority HEAD** |
| Worker bindings | Exactly one `DB`; no R2/KV/DO binding | Historical operator screenshot and manifest | **Reported** |
| Worker public surface | `workers.dev` and Version URL reported disabled; zero routes/domains/triggers; zero invocations/errors | Historical operator screenshots | **Reported; exact host and full same-window inventory missing** |
| Qualification D1 | `shenshu-voice-v1-qualification-20261024` | Historical operator record and manifest | **Reported** |
| Qualification D1 UUID | `234913cd-8901-4607-8147-31c4a4317111` | Historical operator record and frozen migrations | **Reported; not re-queried** |
| Qualification D1 schema | 001/002/003, three tables, two explicit indexes, seven autoindexes, zero business rows, empty FK check | Historical user-observed D1 Studio evidence | **User-observed at prior scope; current schema identity not re-attested** |
| Forbidden old D1 | `shenshu-voice-budget-test` / `c39a6895-7028-4f59-a100-1455b92c96c1` | Historical evidence | **Must remain untouched** |
| Staging player origin | `https://shenshu-voice-mcp-staging.onrender.com` | Fixed source constant | **Source-verified; deployment state not independently attested** |
| Auth0 issuer | `https://dev-nwr87q0tnrbjeapr.us.auth0.com/` | Fixed source constant | **Source-verified; tenant live state not re-attested** |
| R2 bucket | `shenshu-voice-v1-p2-audio-20261027` (proposed) | This decision | **Not provisioned / not authorized** |

No credential, token, principal value, HMAC secret or user subject is included in
this ledger.

## D1 is not the P2 audio backend

The decision is based on the official Cloudflare D1 limits and the repository
contract, not on an assumption that a relational database can behave like an
object store.

Official source:
<https://developers.cloudflare.com/d1/platform/limits/>.

| Constraint | Official limit | P2 consequence |
| --- | ---: | --- |
| Maximum string, `BLOB` or table row | 2,000,000 bytes | `MAX_WAV_BYTES` is 2,097,152 bytes, so the largest contract-valid WAV cannot be represented in one D1 row |
| Maximum SQL statement | 100,000 bytes | Audio must be a bound binary value, not inline SQL |
| Maximum bound parameters | 100 | Not the primary issue, but confirms a long-lived media row needs a new adapter |
| Free database storage | 500 MB | Not a substitute for private object semantics |

The existing migrations do not contain an audio column or table. `003` stores
only an opaque `result_ref`; it was not part of the authority tree and it was
never a blob store. Storing the result in D1 would require a new migration,
new SQL, a new credential path and a new qualification of D1 row-size,
read/write accounting and expiry behavior.

A workaround could lower the WAV ceiling below 2,000,000 bytes and store a
single binary row per principal. That workaround is **not accepted** for V1:

- it silently changes the accepted 2 MiB contract;
- it mixes paid-admission rows with user-generated media in the same authority;
- it makes every media read/write part of D1's row and quota accounting;
- it creates no object-store privacy boundary and no native private-object URL
  semantics;
- it would require an unapproved migration and another fake-store abstraction
  before any real qualifier could run.

D1 therefore remains the atomic paid-admission namespace only. The old
`shenshu-voice-budget-test` is excluded for every purpose.

## Required private audio backend contract

The only suitable product already compatible with the Cloudflare account is a
dedicated private R2 bucket. R2 is a proposal, not a claim that a bucket exists.

Official sources:

- <https://developers.cloudflare.com/r2/buckets/public-buckets/>: buckets are
  private by default and require explicit permission to become public.
- <https://developers.cloudflare.com/r2/reference/consistency/>: reads, writes,
  deletes and lists are strongly consistent; for concurrent writes to one key,
  the last completed write wins.
- <https://developers.cloudflare.com/r2/platform/limits/>: object metadata may
  be up to 8,192 bytes and object size is far above this V1 contract.
- <https://developers.cloudflare.com/r2/buckets/object-lifecycles/>: lifecycle
  deletion is not a precise 300-second timer, so V1 must not rely on it for the
  short TTL.
- <https://developers.cloudflare.com/r2/api/tokens/>: an R2 Object Read & Write
  token is bucket-scoped. The dedicated bucket, not a token prefix policy, is
  the credential isolation boundary.

Proposed owner and resource:

- Owner: ShenShu total control, using the operator-controlled Cloudflare account
  whose identity is still subject to A0 reconciliation.
- Backend: Cloudflare R2, private bucket
  `shenshu-voice-v1-p2-audio-20261027`.
- Scope: one qualification prefix, `p2/v1/`; no other bucket or prefix.
- Public access: `r2.dev` disabled, no custom domain, no public bucket policy.
- Client access: none. The browser never receives an R2 URL, presigned URL,
  access key, bucket name or object key.

Application contract:

1. The server accepts only a validated 16 kHz mono PCM WAV no larger than
   2,097,152 bytes.
2. The object key is deterministic and non-user-authored, for example
   `p2/v1/<sha256(p2-audio NUL principal)>/latest.wav`. A fixed key enforces
   at most one current result per principal; the last completed write wins.
3. The object stores `schemaVersion`, UTF-8 canonical `createdAt`, canonical
   `expiresAt` and `contentType` in metadata. No text, bearer, subject or token
   is stored.
4. TTL is exactly 300 seconds for P2 qualification. `getLatest` rejects a record
   at or after `expiresAt` and immediately issues a delete before returning no
   result. `deleteExpired` enumerates only the qualification prefix and deletes
   expired records. There is no automatic retry.
5. A5 explicitly deletes all qualification objects. R2 lifecycle rules are not
   claimed as a 300-second deletion mechanism.
6. The Render server accesses R2 through the S3-compatible API with a
   least-privilege Object Read & Write credential scoped to this exact bucket.
   The bucket contains only this qualification prefix, and application code
   rejects every other key. The credential is server-only and is provisioned
   only under A1. The SDK must use `maxAttempts=1`; no retry wrapper is
   permitted.
7. `/player/audio` remains the only read surface. It checks the signed HttpOnly
   player session, loads the result by the session principal, validates the WAV,
   and returns `private, no-store, max-age=0`, `Vary: Cookie`,
   `Cross-Origin-Resource-Policy: same-origin`, `audio/wav`, `nosniff` and
   `Content-Disposition: inline`. There is no query bearer, redirect, public URL
   or CORS allowance.
8. A missing, expired or cross-principal record is indistinguishable to the
   caller as `audio_unavailable` and never reveals another principal's key.

This contract is the minimum missing implementation. It is intentionally not
written before the R2 product decision because doing so would create an
unprovisioned adapter with no executable backend.

## Identity and operation-ID trust boundaries

### Canonical identity continuity

```text
Auth0 access token on protected MCP path
  -> fixed issuer/audience/JWKS, RS256, lifetime, voice:speak
  -> verified sub
  -> base64url(SHA-256(issuer + NUL + sub))[0..43]
                              ==
Player Auth0 code + PKCE
  -> userinfo sub from the same issuer
  -> the exact same canonical principal
  -> HMAC-signed HttpOnly session cookie
```

The MCP path never accepts a principal from headers, body, tool arguments or
unsigned claims. The player callback never accepts a principal cookie without
its server HMAC. The player discards the access token after the userinfo lookup.

A live qualification must observe one real Auth0 user across both paths and
record only a boolean `principal_match: true`, never the subject or principal.
A mismatch must fail before D1 reservation, HMAC signing or provider work. Until
that observation exists, live continuity is BLOCKED.

### Stable server-owned operation ID

The P2 composition requires `resolveServerOperation(trustedRequest)` to return
both an opaque `operationId` and the expected canonical principal. Its caller
can supply only `{trustedRequest, text}`; principal, operation ID, model, voice,
grant and replay keys are rejected.

The future resolver must:

1. run only after Auth0 signature and claim verification;
2. generate or recover the operation ID on the server, never from a client
   principal, grant, model, voice or billing field;
3. bind the durable key `(principal, operationId)` to an action, exact text
   digest, byte count and bounded expiry;
4. persist the admission and one-use grant atomically with the operation state;
5. return the existing opaque result for a completed replay, and return
   in-progress/unknown/conflict without a provider call for every other
   duplicate state;
6. never retry or refund an uncertain provider or storage outcome.

The current authority tree contains the dependency injection point and the
reservation/grant store, but not a live resolver, not the historical
transactional operation adapter and not the `003` migration. No claim is made
that ChatGPT preserves a server-owned operation ID across reconnects. That
behavior is an A4 evidence item, not an offline assumption.

The HMAC signer is service authentication only. It may sign the already
verified principal, operation ID, action, text digest/bytes, TTL, exact host,
path and nonce. It must never receive or sign a client-asserted principal,
bearer, grant or model. HMAC success does not authenticate a user by itself.

## One executable future live qualification session

Nothing in this section is authorized now. It is the complete future session,
to be released one gate at a time only after the private-backend decision.

### A0 - zero-application-request identity delta

Re-use the prior human evidence. Do not restart the full A0. One bounded
read-only recapture, with no Worker request and no D1 SQL, must fill only the
missing fields:

1. UTC start/end, operator, STOP owner, evidence ID and SHA-256 of every
   sanitized artifact.
2. Current account Free/no-card posture. Do not record billing identifiers.
3. Exact Worker name, Worker ID, version UUID, deploy time/source, exact
   `workers.dev` host, all Version/Deployment URL states, all custom routes,
   Access applications, Cron/Queue/Email triggers, and invocation/error counters
   for the same interval.
4. Exact D1 display name, UUID, one `DB` binding snapshot, absence of alternate
   or Preview bindings, and current business-table/index/FK identity. Use an
   existing nonsecret schema artifact; do not run SQL under A0.
5. A negative attestation that no secret value was displayed, copied, read or
   logged.
6. Nonsecret Render player flag posture and the operator-reported deployed SHA.
   No Render mutation or credential read.

A0 is accepted only if every item shares the same capture window. No application
request, Cloudflare API query, D1 query or credential access is allowed. Any
missing, contradictory or time-mismatched field is STOP.

### A1 - private backend and secret provision

Only after an explicit backend approval:

- create the exact private R2 bucket, with public access and `r2.dev` disabled
  and no custom domain;
- create one least-privilege R2 S3 credential restricted to the exact dedicated
  bucket; application code restricts keys to `p2/v1/`;
- create exactly one 32-byte test HMAC key for the qualification Worker;
- inject both values through a no-echo mechanism, never argv, shell history,
  logs, files, screenshots, PR text or chat;
- record only nonsecret key IDs, credential scopes, target version and a
  negative exposure attestation.

Any second key, broad account token, unrelated bucket permission or ambiguous
injection method is STOP.

### A2 - deploy/adopt the exact reviewed build

Adopt the already deployed qualification Worker only after reconciling its exact
artifact hash, version, one `DB` binding and closed URL state. If the approved
R2 implementation requires a new Worker or Render build, use only a separately
reviewed immutable artifact and record its full source commit/tree and build
identity. Do not redeploy from this documentation branch. The previous Worker
version `2320fd44-294c-4789-91bd-c20694254eca` remains the rollback reference.

No route is enabled at A2. No provider path is connected.

### A3 - one temporary route

Enable exactly one temporary `workers.dev` host for the qualification Worker,
for at most 20 minutes. No custom domain, Version URL, Preview URL, second host,
Access bypass or billing change is permitted. Record the exact host, UTC start,
automatic close method and STOP owner. A5 must already be approved and executable
before A4 starts.

### A4 - fixed nonbillable qualification

A4 uses one real Auth0 test principal, zero MiniMax/provider attempts, zero
automatic retries and the existing P1 fixture for storage-only checks. It proves
D1 admission semantics, canonical identity continuity and the private audio
transport; it does not re-run P1 audibility.

Hard ceilings, which are limits and never permission:

- 24 Worker HTTP requests;
- 18 D1-touching requests;
- 10 admission attempts;
- 4 accepted admissions;
- 32 row-write units;
- 512 rows read;
- 64 D1 statements;
- 256 KiB D1 storage delta;
- 20 minutes;
- 0 MiniMax/provider attempts;
- 0 automatic retries.

Private fixture audio has a separate authorization and does not consume any D1
row or byte ceiling. Proposed separate audio caps for this one session: at most
4 PUTs, 6 GET/HEADs, 3 DELETEs and 8 MiB total transfer, with at most one
current object per principal and no public request.

Suggested fixed request plan:

| Phase | Maximum requests | Expected D1 behavior | Expected outcome |
| --- | ---: | --- | --- |
| Negative HTTP shape/HMAC/host/path/nonce cases | 6 Worker HTTP, 0 D1 | None | Generic denial before D1 |
| Accepted server-owned operations 1-3 | 3 admissions | Each atomically reserves, issues, admits and consumes | 3 accepted; provider 0 |
| Concurrent duplicate and replay of an accepted operation | 2 admissions | Read/compare, no second write or grant | In-progress/replayed denial; provider 0 |
| Same operation with a different digest | 1 admission | Conflict before provider | Conflict; provider 0 |
| Fourth distinct operation on a three-call day | 1 admission | Limit check only | Denied; provider 0 |
| Principal mismatch | 1 admission, 0 D1 | Rejected before reservation | Denied; provider 0 |
| Expired operation and status checks | 4 Worker HTTP (2 admissions + 2 D1-touching reads) | No new write | Expired/in-progress; provider 0 |
| Postflight counter/row read | 1 D1-touching read | Read only | Evidence captured |
| Total | 19 Worker HTTP, 12 D1-touching, 10 admissions | <=32 writes, <=512 reads, <=64 statements, <256 KiB delta | 3 accepted in this plan; cap is 4 |

The actual plan must be frozen with exact request bodies, expected statuses,
baseline counters and a per-request STOP condition before A4. Any extra request,
unexpected D1 row, principal mismatch, wrong status, ambiguous timeout, counter
overrun or appearance of a provider path is immediate STOP. There is no
compensating write, refund or second probe.

### A5 - close and revoke

A5 must be ready before A4:

1. disable the exact temporary route first;
2. return the Worker to the dormant configuration or recorded rollback version;
3. delete the test HMAC key and the scoped R2 credential;
4. delete every qualification R2 object and confirm the prefix is empty;
5. preserve all D1 rows, schema objects and ambiguous outcome evidence; never
   DROP, TRUNCATE or rewrite them;
6. confirm nonsecret closure state and publish only sanitized evidence.

If route disablement or credential revocation fails, STOP without another
request. Reopening or re-probing requires a fresh A0-A5 decision.

## Narrow implementation decision

No source or test change is made by this package. The missing implementation is
the approved R2 private-result adapter and the real mount of the already-reviewed
P2 composition. Writing either before the R2 decision would repeat the abstract
fake-store failure and would not be executable.

The existing P2 connection and private player remain unmounted. The focused
offline P2 tests remain the accepted baseline; this document does not add broad
synthetic coverage or duplicate P1.

## Verification and real-operation counters

- This change is documentation-only. No runtime, Worker, schema, player,
  Render, Auth0 or workflow file changed.
- Local Node `v24.19.0`: full `node --test` **273/273 pass**, 0 fail, 0 skip;
  focused P2 suite **9/9 pass**; smoke test PASS; `git diff --check` PASS.
- The existing P2 focused suite is also recorded at 9/9 pass in
  `V1-P2-ONE-SHOT-PLAYER-CONNECTION-20261027.md`; PR #137 standard CI is
  success.
- PR #138 standard CI is success. The new Draft PR uses normal `pull_request`
  CI only; no manual Actions dispatch.
- Exact final HEAD and the new PR/CI identifiers are recorded in the Draft PR
  body and total-control receipt to avoid a self-referential document hash.

Real operations in this task:

- Worker HTTP requests, Worker deploys, version changes, route/Preview changes:
  **0**
- Cloudflare API calls, D1 SQL/reads/writes/migrations: **0**
- Render/Auth0 changes: **0**
- R2 buckets, objects or credentials created/read: **0**
- HMAC/secret generation, injection or reads: **0**
- Real Auth0 tokens, cookies or subject reads: **0**
- MiniMax/provider/public MCP calls: **0**
- Manual Actions dispatches, merges or Asteria-Call edits: **0**

## V1 disposition and singular next action

Strict Voice V1 remains **2/9** (gates 1 and 8 only). B1-B4 remain OPEN:

- B1: no user-confirmed audible iPhone result for generated/bridged audio.
- B2: real D1 atomic admission and the deployed Worker path remain unqualified.
- B3: private durable result delivery remains absent.
- B4: no authorized real MiniMax end-to-end call.

**Disposition: TOTAL CONTROL DECISION REQUIRED.**

**Singular next action:** approve or reject exactly one private R2 bucket,
`shenshu-voice-v1-p2-audio-20261027`, as the P2 durable audio backend, with
public access disabled, one `p2/v1/` application prefix, least-privilege
bucket-scoped server credentials,
300-second logical TTL and explicit A5 deletion. If approved, the next bounded
step is the offline R2 adapter plus focused tests, then A0-A5; if rejected, P2
stays blocked and V1 stays 2/9.

No deployment, route, credential, D1, Worker, Render, Auth0, MiniMax or real MCP
action may be inferred from this document. STOP for ShenShu total-control
acceptance.
