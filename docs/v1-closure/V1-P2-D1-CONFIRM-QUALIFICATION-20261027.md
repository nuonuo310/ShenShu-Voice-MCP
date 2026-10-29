# Voice V1 P2 - D1 explicit-confirm qualification readiness (2026-10-27)

**RECEIPT: COMPLETE for the bounded offline D1 confirmation candidate. GitHub
publication and real D1 qualification are BLOCKED. TOTAL CONTROL DECISION
REQUIRED for the separately authorized A0-A5 nonbillable live D1 session.
Voice V1 remains 2/9; paid P2 remains OFF; B1-B4 remain OPEN.**

No real Cloudflare, D1, Worker, R2, Qiniu/Kodo, Render, Auth0, MiniMax or MCP
operation was performed. No deployment, secret, merge or manual Actions
dispatch occurred. The old forbidden D1 database was not touched.

## Authority and opening gate

- Correct repository: `nuonuo310/ShenShu-Voice-MCP`.
- Origin: `https://github.com/nuonuo310/ShenShu-Voice-MCP.git`.
- Sole authority: PR #145, commit
  `8c3ede3e3f3e2ef4d8387436019d3dd3d2a4a22d`, file
  `docs/construction-envelopes/2026-10-27-voice-v1-p2-d1-confirm-qualification.md`.
- Parent baseline: PR #144 HEAD
  `72c6a58be308544e3b5388632120453efb2da7e2`.
- Authority tree: `5d5b3308520682ad3a4a2d587ffe380b4ef5dcde`.
- Isolated worktree: `C:\Users\Administrator\Desktop\ShenShu-Voice-MCP-P2-145`.
- Branch: `codex/voice-v1-p2-d1-confirm-qualification-20261028`.
- Opening HEAD was the exact authority commit; the opening worktree had no
  tracked edits. The sibling `P2-143` worktree and its node_modules junction
  were read/used for dependency resolution only and were not modified.
- The authority envelope records PR #144 normal `pull_request` CI run
  `40533096965` as success. It was not re-queried from this sandbox.

## Verified code facts before implementation

### The current D1 REST client is a single-statement client

- `src/cloudflare-d1-http.js` issues exactly one
  `POST /accounts/{account_id}/d1/database/{database_id}/query` with
  `{sql, params}` and parses exactly one `results` array.
- It has no `batch()` method and does not advertise an atomic multi-statement
  transaction.
- `src/d1-http-paid-store.js` maps reserve/issue/consume to three independent
  `query()` calls. Those individual statements are atomic in SQLite, but the
  three-call sequence is not a transaction and was not used as one here.

### Historical 003 cannot represent the required pre-billing state

- Historical `db/d1/003_paid_voice_operations.sql` allows only
  `admitted | provider_pending | completed | unknown`.
- It requires non-null `request_id` and `grant_id` foreign keys to
  `paid_voice_reservations` and `paid_voice_grants`, so it cannot store a
  nonbillable `pending_confirmation` operation before either row exists.
- Historical `src/d1-transactional-operation-store.js` requires an injected
  client with `batch()` and `atomicBatch === true`. The current D1 HTTP client
  cannot satisfy that contract.

### Existing P2 state machine and player-only confirmation are reusable

- `src/v1-p2-stable-operation-identity.js` already models nonbillable
  `initiate`, owner-scoped `status`, one compare-and-set claim and at most one
  provider attempt, with terminal `completed` and `unknown` receipts.
- `src/v1-p2-player-confirmation.js` already requires the signed Auth0 player
  session, exact Origin, same-origin/navigate fetch metadata, exact form shape,
  a scoped CSRF token and the owner-scoped proposal text. There is no
  model-accessible confirmation route.
- MCP and player identity both derive the same canonical principal from the
  trusted issuer and verified Auth0 `sub`. The D1 row is owner-scoped by that
  principal and an opaque handle; a principal mismatch makes the row invisible
  before any admission or provider work.

## Atomic admission design

The historical multi-statement batch is not approximated. Instead, admission is
ONE SQLite statement:

```text
pending_confirmation --UPDATE--> provider_pending
  AFTER UPDATE trigger:
    reserve first free slot in [1, max_daily_calls] for (principal, day_utc)
    RAISE(ABORT, 'quota_denied') if no slot was inserted
    issue the grant
    RAISE(ABORT, 'grant_denied') if issuance failed
    consume the grant
    RAISE(ABORT, 'grant_consume_denied') if consumption failed
```

The operation row's constraints bind the exact derived identifiers:

- `request_id = operation_id`
- `grant_id = 'grant_' || operation_id`
- `provider_pending`, `completed` and `unknown` require both identifiers and a
  `day_utc`; `pending_confirmation` requires all three to be null.

Any trigger failure aborts and rolls back the entire UPDATE. A quota denial
therefore leaves the operation pending with no reservation, no grant and no
provider call. A concurrent second claim sees either `provider_pending` or a
terminal receipt; it cannot obtain a second slot or a second grant.

The broker's new optional `authorizePaidAttempt` callback is only an attestation
of that already-committed admission. It cannot create a reservation, grant or
provider call by itself. The existing paid-store path remains the default and is
unchanged. The pipeline still makes exactly one provider attempt and never
retries or refunds an uncertain outcome.

This removes the dependency on a multi-statement transaction for admission.
It does NOT prove Cloudflare D1 behavior. `node:sqlite` is a local semantic
model; it is not Cloudflare D1.

## Offline implementation

### Added

- `db/d1/004_paid_voice_confirmation_operations.sql`: additive table, indexes
  and the `paid_voice_confirmation_admit` trigger. It does not alter 001 or 002
  and does not adopt historical 003.
- `db/d1/004_paid_voice_confirmation_operations_rollback.sql`: disposable
  offline fixture reset only. Live A5 must preserve rows and must never DROP,
  TRUNCATE or rewrite ambiguous-outcome evidence.
- `src/d1-p2-confirmation-operation-store.js`: D1 operation store with
  `createPending`, `get`, `listPending`, one-statement `claim`,
  `markProviderPending` (post-claim attestation), `markCompleted`,
  `markUnknown`, read-only `attestAdmission` and read-only `verifySchema`.
- `src/v1-p2-d1-confirmation.js`: dormant composition of the D1 store, the
  shared broker, the protected MCP JWT verifier and the standalone player
  handler. It is not imported by `server.js` or any MCP route.
- `test/v1-p2-d1-confirm-qualification.test.js`: focused adversarial suite,
  16 SQLite semantic tests plus one closure-document check.

### Changed narrowly

- `src/v1-offline-paid-pipeline.js`: optional `authorize` override for an
  already-admitted operation. The default durable paid-authorizer path is
  unchanged.
- `src/v1-p2-stable-operation-identity.js`: optional
  `authorizePaidAttempt`; the default paid store path is unchanged. The shared
  record validator is exported for the D1 store.

### Preserved

- P1 `/player`, `/player/login`, `/player/callback` and `/player/audio` behavior
  is unchanged, including the fixed nonbillable WAV and explicit-load playback.
- The player confirmation module remains the only explicit-confirm surface.
- No D1, cloud, provider or MCP I/O is introduced on any mounted route.

## PASS matrix

| Gate | Result | Evidence |
| --- | --- | --- |
| 004 migration additive over 001/002 | PASS (offline) | Local SQLite schema; no ALTER of 001/002; historical 003 absent |
| Single-statement admission | PASS (offline) | Exactly one `UPDATE` claim; trigger performs slot/grant work; no batch call |
| Quota denial rolls back the claim | PASS (offline) | `quota_denied` abort leaves the operation pending with zero reservation/grant |
| MCP initiate/status nonbillable | PASS (offline) | Zero reservations, grants and provider attempts; no text in MCP responses |
| Owner player sees exact text | PASS (offline) | Owner-scoped pending page; foreign principal sees neither text nor handle |
| Explicit confirm one admission/provider | PASS (offline) | One claim statement, one reservation, one consumed grant, one provider attempt |
| Missing session/Origin/CSRF/extra field/cross-user | PASS (offline) | 401/403/403/400/404 before any admission or provider call |
| Concurrent confirmations | PASS (offline) | One admission and one provider attempt; the loser gets a safe conflict |
| Duplicate click and lost response | PASS (offline) | Completed replay with zero additional provider attempts |
| Restart after completion | PASS (offline) | New broker over the same D1 store replays completed |
| Restart after claim before provider | PASS (offline) | Row stays `provider_pending`; retry is outcome-pending with no provider |
| Daily quota and next UTC day | PASS (offline) | Fourth distinct operation denied; next-day operation gets slot 1 |
| Per-principal quota and owner scope | PASS (offline) | Another canonical principal starts at slot 1 and sees only its own proposal |
| Expired pending operation | PASS (offline) | 410/expired before admission; zero quota and provider |
| Text digest/byte binding | PASS (offline) | Wrong digest does not claim; correct binding does |
| Unknown provider outcome | PASS (offline) | Terminal `unknown`; grant consumed; no retry |
| Private result-store failure | PASS (offline) | Terminal `unknown`; grant consumed; no retry |
| Terminal CAS | PASS (offline) | Wrong handle/state cannot complete or mark unknown twice |
| Unmounted and offline | PASS (offline) | No server/MCP import; no fetch/cloud/provider I/O in the store |
| Node 24 full suite | PASS | 316 tests, 316 pass, 0 fail, 0 skipped, 0 todo after this document exists |
| Real Cloudflare D1 qualification | BLOCKED | Not executed; no Cloudflare API, D1 SQL, Worker request or deployment |
| Real Auth0/Render identity continuity | BLOCKED | Not re-exercised live; offline canonical derivation only |
| Real browser human gesture | BLOCKED | A server cannot prove a human click from CSRF/same-origin controls alone |
| Text at rest | BLOCKED | The dormant table stores the exact proposal text; live use needs an approved private-sealing decision |
| Private durable audio | BLOCKED | No R2/Kodo/Qiniu bucket or adapter was provisioned or authorized |
| Real MiniMax billing | BLOCKED | Zero provider calls; no quota, charge, timeout or receipt evidence |
| ChatGPT transport retry identity | BLOCKED | The stateless MCP transport has no server-owned session/idempotency identity; the player-only confirm makes extra retries nonbillable, not transport-idempotent |
| GitHub publication | BLOCKED | Sandbox network/credential boundary; no remote branch, Draft PR or remote CI is claimed |

## Verification

Run on Node `v24.19.0`:

- Focused D1 qualification suite: **17/17 pass**, 0 fail, 0 skipped, 0 todo.
- Full `node --test`: **316/316 pass**, 0 fail, 0 skipped, 0 todo.
- Existing P2 stable-operation suite: **14/14 pass**.
- Existing P2 player-confirmation suite: **12/12 pass**.
- `node test/smoke-server.mjs`: PASS for MCP initialize, public fixture tools
  and fail-closed paid entry.
- `node --check` for the new modules and the modified pipeline/broker: PASS.
- `git diff --check`: PASS.

The 16 SQLite semantic tests are Node 24 evidence. On a Node 20 CI runner,
`node:sqlite` is unavailable and those tests are explicitly skipped; they are
not replaced with a fake pass. The repository's existing normal CI remains the
honest place to see which tests a Node 20 runner can execute. No manual Actions
dispatch was made.

## BLOCKED live gates and visible limitations

1. **Real D1 is not qualified.** The local SQLite model proves the intended SQL
   and rollback semantics, but it is not Cloudflare D1. D1's acceptance of the
   trigger CTE/`RAISE`, `RETURNING`, constraint checks, HTTP retry behavior,
   row-size limits and production concurrency remain unproven.
2. **Real Auth0 continuity is not re-exercised.** The offline canonical
   derivation is shared and tested, but one real Auth0 user across the MCP and
   player paths has not been observed in this round.
3. **A human gesture is not provable by the server.** CSRF, SameSite, exact
   Origin and same-origin navigation reduce browser-mediated forgery; they do
   not distinguish a human click from compromised same-origin UI code.
4. **Proposal text at rest is plaintext in the dormant table.** A live mount
   requires an approved private at-rest sealing/encryption decision. This round
   does not choose a key, algorithm or key-management owner.
5. **Private durable audio remains absent.** No R2, Kodo, Qiniu or equivalent
   private object store is provisioned. D1 is not used as the audio backend.
6. **No real provider or billing evidence exists.** MiniMax was not called; no
   quota, charge, timeout, receipt or refund behavior was exercised.
7. **ChatGPT transport retry identity remains unproven.** The player-only
   confirmation boundary means a restarted MCP sequence can create only another
   nonbillable pending proposal, and a duplicate player click cannot obtain a
   second claim. It does not prove transport-level handle reuse.
8. **GitHub publication is blocked.** The sandbox has no usable authenticated
   network path. No remote branch, PR number or remote CI run is claimed. The
   complete local commit and test evidence are preserved for a normal
   PowerShell publication.

## Fixed A0-A5 nonbillable live qualification plan (not authorized now)

No test traffic may occur until A5 closure is ready. A0-A5 are independent
approvals, in order.

### A0 - read-only identity reconciliation

One bounded read-only recapture with no application request and no D1 SQL:
UTC window, operator, STOP owner, evidence hashes, account free/no-card
posture, exact Worker/version/route/invocation state, exact test D1 name/UUID
and one `DB` binding, existing schema identity, and a negative attestation that
no secret was displayed, copied, read or logged. Missing, contradictory or
time-mismatched fields are STOP.

### A1 - test credentials

Create only a test Auth0 principal and, if the temporary route requires it, one
32-byte test HMAC key. Inject through a no-echo mechanism. No production
credential, broad token, second key or unrelated permission. Record only
nonsecret key IDs/scopes and a negative exposure attestation.

### A2 - exact reviewed build

Adopt or deploy the exact reviewed build identified by this delivery's source
commit and tree. Do not redeploy from a documentation branch. No route is
enabled and no provider path is connected.

### A3 - one temporary route

Enable exactly one closed-by-default temporary host for at most 20 minutes.
No custom domain, second host, Access bypass or billing change. Record the exact
host, UTC start, automatic close method and STOP owner. A5 must already be
executable.

### A4 - fixed nonbillable D1 qualification

Use one real Auth0 test principal, a fixture synthesizer, zero MiniMax/provider
attempts and zero automatic retries. This proves the D1 admission/rollback
semantics and identity continuity; it does not re-run P1 audibility.

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

Suggested fixed request plan, to be frozen with exact bodies, statuses,
baseline counters and per-request STOP conditions before A4:

| Phase | Maximum requests | Expected D1 behavior | Expected outcome |
| --- | ---: | --- | --- |
| Schema/identity read-only preflight | 3 D1 reads | Read only | Schema, FK and identity evidence |
| MCP initiate four pending proposals | 4 Worker HTTP | 4 pending inserts, 0 reservations/grants | Four nonbillable handles |
| Explicitly confirm three distinct proposals | 3 admissions | Three single-statement claims; slots 1-3; grants consumed | Three completed receipts; fixture provider only |
| Duplicate and concurrent confirmations | 2 Worker HTTP | Read/compare; no second write | Conflict or completed replay; no second provider |
| Same handle with a different digest | 1 admission | Conflict before write | Binding conflict; no provider |
| Fourth distinct operation on a three-call day | 1 admission | `quota_denied` abort; no write | Denied; operation remains pending |
| Expired and cross-principal checks | 3 Worker HTTP | Expiry/owner checks before admission | Denied; no write |
| Restart/reconnect replay | 2 Worker HTTP | Read-only terminal receipt | Completed replay; no provider |
| Postflight read-only counts | 1 D1 read | Read only | Sanitized evidence |

The plan totals at most 19 Worker HTTP requests, 12 D1-touching requests and 10
admission attempts, with three accepted admissions in this plan (cap four). Any
extra request, unexpected row, principal mismatch, wrong status, ambiguous
timeout, counter overrun or appearance of a provider path is immediate STOP.
There is no compensating write, refund or second probe.

### A5 - close and revoke

A5 must be ready before A4: disable the exact temporary route first; restore the
dormant/rollback configuration; delete the test HMAC key and test credentials;
preserve all D1 rows, schema objects and ambiguous-outcome evidence; never DROP,
TRUNCATE or rewrite them; publish only sanitized nonsecret closure evidence. If
route disablement or credential revocation fails, STOP without another request.

## Real-operation counters

- Real Cloudflare/D1/Worker/R2/Kodo API requests or mutations: **0**.
- Deployments, route changes or Render/Auth0 changes: **0**.
- MiniMax/provider calls or billing changes: **0**.
- Real MCP/connector calls, secrets, merges or manual Actions dispatches: **0**.
- Old forbidden D1 `shenshu-voice-budget-test` operations: **0**.

## V1 disposition and singular next action

Strict Voice V1 remains **2/9**. Paid P2 remains OFF. B1-B4 remain OPEN.

The bounded offline D1 confirmation candidate is COMPLETE and locally verified.
The immediate single next action is to publish this exact local HEAD through a
normal, network-enabled, credential-authorized Windows PowerShell session as a
stacked Draft PR based on the PR #145 head branch (authority commit
`8c3ede3e3f3e2ef4d8387436019d3dd3d2a4a22d`; its parent baseline is
`72c6a58be308544e3b5388632120453efb2da7e2`), then let normal `pull_request` CI
run. Do not deploy, mutate D1, change Render/Auth0, call MiniMax or merge during
publication.

After publication, the only live step is a separate Total Control authorization
of A0-A5 for the bounded nonbillable D1 qualification above. Until that
authorization and A5 closure exist, real D1 qualification remains BLOCKED and no
test traffic is permitted.
