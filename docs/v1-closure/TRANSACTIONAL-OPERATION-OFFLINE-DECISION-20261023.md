# Voice V1 transactional-operation offline decision (2026-10-23)

Status: **TOTAL CONTROL DECISION REQUIRED. OFFLINE SQLITE IMPLEMENTATION AND
TESTS COMPLETE. CLOUDFLARE D1 ATOMICITY IS NOT PROVEN. STRICT V1 REMAINS 2/9.**

This package did not operate a real D1 database, apply a migration, register or
modify an MCP tool, deploy, read a credential or provider voice ID, call
MiniMax, refresh a connector, dispatch an Actions workflow or merge anything.
All provider behavior was an injected fake. All transactional storage used a
local `node:sqlite` database.

## Decision

The additive `003` schema, transactional operation store and unmounted runner
are ready for independent review. They enforce the requested operation binding,
one-use grant, daily reservation and fail-closed state behavior under real local
SQLite transactions, including concurrent worker threads with independent
SQLite connections.

They are not evidence of production atomicity. The repository has no approved
Cloudflare Worker binding or independently proven atomic D1 HTTP batch path.
Replacing this gap with three independent REST calls would be a false PASS.
Real migration, paid activation and provider use therefore remain a total-control
decision rather than an implementation-completion claim.

## Authority and opening verification

- Repository: `nuonuo310/ShenShu-Voice-MCP`.
- Origin: `https://github.com/nuonuo310/ShenShu-Voice-MCP.git`.
- Git identity: `nuonuo310 <2584974449@qq.com>`.
- Authority branch: `docs/voice-v1-transactional-operations-offline-20261023`.
- Authority commit: `74be323c847824074c3a69bc5dfab4c9f03095ac`.
- Sole authority package:
  `docs/construction-envelopes/2026-10-23-voice-v1-transactional-operations-offline.md`.
- Task branch: `work/voice-v1-transactional-operations-offline-20261023`,
  created from the exact authority commit.
- Worktree: `ShenShu-Voice-First-Audition`; no other worktree is registered for
  this repository.
- No reset, stash, clean, rebase, move or rewrite was performed.
- Opening tracked-file state was clean. The candidate schema, source and test
  files were still untracked from the in-progress attempt; they were reviewed,
  narrowly repaired, tested and committed rather than discarded.
- Authority CI run `39965776087` is `completed/success` for the exact authority
  SHA `74be323c847824074c3a69bc5dfab4c9f03095ac`.

The open stacked Draft topology was verified through the GitHub API:

1. PR #90, `docs/voice-v1-idempotency-gate-20261023`, head `f6621f67...`, base
   `work/voice-v1-s3-d1-qualification-20261023`.
2. PR #91, `work/voice-v1-idempotency-gate-20261023`, head `2ae28223...`, base
   `docs/voice-v1-idempotency-gate-20261023`.
3. PR #92, `docs/voice-v1-transactional-operations-offline-20261023`, head
   `74be323c...`, base `work/voice-v1-idempotency-gate-20261023`.

All three were open Draft PRs. No conflicting worktree existed. The authority
package explicitly records the exact parent #91 head
`2ae28223ec58172663a476deaf21f5c186563372`.

## Implementation

Implementation commit:
`6c20a7e7e038c6d910a8073d8db5dc0b64f0a3e9`.

Diff from authority: seven additive files, 1,464 inserted lines, no deletions
or modifications to existing files.

- `db/d1/003_paid_voice_operations.sql` (new)
- `src/d1-operation-sql.js` (new)
- `src/d1-transactional-operation-store.js` (new)
- `src/v1-transactional-operation-runner.js` (new)
- `test/fixtures/local-sqlite-atomic-client.mjs` (new)
- `test/fixtures/sqlite-operation-worker.mjs` (new)
- `test/v1-transactional-operation-offline.test.js` (new)

### Additive schema

`paid_voice_operations` binds the verified principal and opaque operation ID as
its primary key. It also stores:

- unique `request_id` and `grant_id`, with foreign keys to the unchanged
  reservation and grant tables;
- fixed action `generate_shenshu_voice`;
- a 43-character SHA-256 base64url text digest and exact UTF-8 byte count;
- `admitted`, `provider_pending`, `completed` or `unknown` state;
- bounded issue/expiry timestamps and a noncompleted/result-reference invariant;
- an opaque result reference only in `completed`;
- no plaintext text, raw audio, bearer, URL, model, voice or secret.

The migration is additive and does not alter `001` or `002`.

### Atomic admission order

One operation admission is expressed as one four-statement batch on a client
that must expose both `query()` and `batch()` and explicitly declare
`atomicBatch === true`:

1. strict daily reservation with the first free slot;
2. strict one-use grant issue bound to that request and principal;
3. operation insertion bound to the same request, grant and principal;
4. grant consumption conditioned on the same IDs, principal and `issued` state.

The store rejects a client without that explicit all-or-nothing contract with
`atomic_batch_contract_unavailable`. It never substitutes three independent
queries for a transaction.

This turn narrowly repaired generated-ID collision handling. Reservation and
grant issue no longer use `INSERT OR IGNORE` inside the transactional path.
A generated request-ID or grant-ID collision now raises a SQLite constraint
error and rolls back the entire batch, including a just-created reservation.
All four result shapes are still checked after the batch, but the reachable SQL
preconditions no longer leave a committed reservation when grant issue or
operation insertion cannot succeed.

### Server-owned operation behavior

The unmounted runner accepts only `trustedRequest`, `operationId` and `text`.
It rejects caller-supplied principal, grant, request ID, approval, digest, model,
voice or provider control before storage work. The verified principal comes
from the existing signed-identity resolver. Provider input is only checked text;
provider output must be one opaque result reference.

The durable state rules are:

- a new operation is admitted with exactly one reservation, one grant and one
  consumed slot;
- `completed` replay returns the persisted opaque reference with zero provider
  attempts;
- `admitted` replay is in progress and makes no provider attempt;
- `provider_pending` or `unknown` replay fails closed with no retry or refund;
- same operation ID with different text is a conflict;
- different operation IDs with identical text remain distinct intentional
  actions;
- expiry fails closed before any new provider attempt;
- a provider failure, malformed/public result or completion-store failure moves
  to or leaves durable `unknown`/`provider_pending`; the provider is not recalled;
- operation, reservation and grant principal/request/slot ownership are checked
  on every durable replay.

## Verified local evidence

Environment: Node `v24.19.0` on Windows.

- Targeted `node --test test/v1-transactional-operation-offline.test.js`:
  **23/23 PASS**.
- Full `node --test`: **295/295 PASS**, zero skipped on the local Node version.
- `node test/smoke-server.mjs`: PASS for MCP initialize, tools/list, inline and
  hosted mock audio, protected metadata and fail-closed paid entry.
- `node --check` for all new source, test and fixture files: PASS.
- `git diff --cached --check`: PASS.
- Staged-file guard: only the seven files listed above; `server.js`,
  `package.json`, CI, frozen interfaces and migrations `001`/`002` are unchanged.
- Source isolation: neither `server.js` nor the staging MCP module imports the
  new store or runner; no production `node:sqlite`, HTTP or MiniMax dependency
  was added.

Targeted cases cover the additive schema, foreign keys, indexes and result
invariants; completed replay after reopening the database; a concurrent
duplicate at `provider_pending`; identical text under different operations;
same-operation text conflict; cross-principal isolation; UTC-day rollover and
limit; expiry; restart after admission; provider `unknown`; completion-write
failure; malformed/partial batch responses; caller-controlled fields; malformed,
multirow or failed reads; broken durable ownership; public URL rejection;
generated request/grant ID collisions; and source/package isolation.

Real SQLite worker-thread tests also prove:

- 12 concurrent attempts with limit 3 commit exactly 3 reservations, 3 consumed
  grants and 3 operations; the other 9 receive `daily_limit`;
- slots are exactly 1, 2 and 3 and `PRAGMA foreign_key_check` is empty;
- 5 concurrent deliveries of one operation produce exactly 1 admission and 4
  replays without reserving twice.

### Important CI limitation

The repository CI currently pins Node 20, while `node:sqlite` requires Node 22
or newer. The SQLite tests probe for the built-in module and self-skip on older
Node instead of pretending to pass. Therefore CI proves the repository-wide
Node 20 suite and smoke path, but local SQLite evidence above remains the only
execution of the real SQLite transaction cases. Changing CI or package engines
would be outside this package; it requires separate approval.

## What is proven and what is not

Proven:

- the fixed SQL and state transitions are valid under a real local SQLite
  all-or-nothing transaction with foreign keys and `BEGIN IMMEDIATE`;
- one local logical operation cannot invoke the fake provider more than once
  across sequential duplicates, concurrent workers, replay and process reopen;
- quota and grant failures before provider start cause zero fake-provider calls;
- ambiguous or malformed durable outcomes fail closed;
- the proposed schema is additive and contains no raw text/audio/secrets.

Not proven:

- that the intended Cloudflare D1 HTTP path can execute the batch atomically;
- that the existing three-call `src/d1-http-paid-store.js` sequence is a
  transaction (it is not);
- that a ChatGPT/connector transport retry reuses one stable operation ID;
- that the table can be applied to the real D1 database without drift;
- that a real paid provider/result service implements the opaque-reference
  contract, private retrieval or the required billing policy;
- that Node 20 CI executes the local SQLite cases.

Local SQLite atomicity must not be conflated with Cloudflare D1 execution
semantics.

## Unresolved total-control questions

1. **Cloud atomicity:** no approved cloud execution path has demonstrated that
   reservation, grant issue, operation insert and grant consumption commit or
   roll back as one unit. `src/cloudflare-d1-http.js` exposes a single
   parameterized query, not a transaction. The prior paid HTTP adapter issues
   independent calls.
2. **Operation-key ingress:** no paid MCP route exists, and no transport evidence
   proves that a retry preserves the same opaque `operation_id`. A client may
   intentionally or accidentally generate a new ID. This can only be accepted
   on a future paid tool after manual retry/reconnect evidence.
3. **Real schema state:** `003` has not been applied or reconciled with real D1.
4. **Private result persistence:** no private storage or authenticated retrieval
   exists for the opaque reference. The operation table correctly does not
   persist the result itself.
5. **Billing semantics after ambiguity:** the safe behavior is to stop, never
   retry or refund automatically. A recovery procedure for a paid but unreported
   provider result still needs total-control policy and audit approval.

## Smallest alternate architecture

The smallest truthful path is a server-owned Cloudflare Worker adapter using the
native D1 binding, not the current REST `query()` sequence. Before paid use it
must:

- accept only server-derived principal, request ID, grant ID and operation
  binding values;
- execute the same four statements through one approved atomic batch primitive;
- prove all-or-nothing behavior with a deliberately failing final statement and
  verify that no reservation/grant/operation row survives;
- prove concurrent duplicate and limit behavior against the actual D1 service;
- prove that a transport timeout cannot be converted into a second provider
  call.

If the native D1 batch cannot be independently proven atomic, the fallback is a
Durable Object SQLite transaction per principal or shard, with the same four
statements and a documented capacity/availability tradeoff. An official atomic
batch endpoint is also acceptable only after its contract and failure behavior
are verified. Three independent REST mutations are not an acceptable fallback.

No architecture may expose a provider call after an ambiguous admission result.

## Approval prerequisites for any real D1 work

Separate explicit approvals are required for:

1. reviewing and applying additive `003` to real D1;
2. the Worker binding or Durable Object transaction architecture and its cloud
   credentials;
3. a real-D1 consistency, rollback, concurrency and limit qualification;
4. private result storage and authenticated retrieval;
5. adding required `operation_id` only to a future paid tool, with manual proof
   of retry stability; existing public/protected tool schemas must remain frozen;
6. any later real MiniMax smoke, with fixed model/voice, maximum spend, audit and
   explicit user approval.

Each approval is separate. Approval of the offline files is not approval to
apply a migration, deploy a Worker, register a paid tool or spend money.

## Rollout and rollback

Rollout remains dormant. The proposed table is additive and unused until a paid
path is explicitly enabled. Do not register a paid route during schema or
adapter qualification.

Code rollback is a revert of this additive implementation, leaving an empty
table in place. Do not drop the table as routine rollback: that is audited DDL
and needs separate approval after confirming no rows. After any potentially
billable attempt, never delete or refund reservation/operation records to make a
failure look clean.

## Remaining distance to V1 Freeze

Strict V1 remains **2/9** (gates 1 and 8 only). This work adds offline evidence
for the operation/idempotency portion of gates 4 and 7, but closes neither gate
and does not reduce the formal count.

- **B1:** iPhone generated/bridge audio is still reported silent; no
  user-confirmed audible V1 result.
- **B2:** real D1 paid-namespace qualification and trusted paid wiring remain
  undone. The schema, batch architecture and cloud path are unapproved.
- **B3:** real fail-closed and private-audio delivery evidence remain undone.
  Cloud atomicity, a private durable result store and authenticated retrieval are
  still missing.
- **B4:** zero authorized real MiniMax end-to-end calls; one capped smoke remains
  a separate future gate.

The next true gates are: total-control cloud-transaction decision, approved real
D1 qualification, trusted operation-key ingress, private delivery plus iPhone
audibility, then one separately approved MiniMax E2E.

## Real-operation counters for this turn

- MiniMax calls: 0
- Billable provider attempts: 0
- Real D1 reads/writes/migrations: 0
- Cloudflare API calls: 0
- Real keys, tokens or voice IDs read/logged: 0
- Deployments / Render / Auth0 / connector refresh: 0
- GitHub Actions dispatches: 0
- Merges/rebase/rewrite: 0

Read-only GitHub metadata API requests were used only to verify open PR topology
and the authority CI conclusion. They did not read repository secrets or stored
credentials.

## Disposition

**TOTAL CONTROL DECISION REQUIRED.** The offline implementation is complete and
locally tested, but Cloudflare D1 atomicity and real operation-key ingress are
not proven. The V1 blocker set has not actually been reduced; B1-B4 remain open
and strict V1 remains 2/9.
