# Voice V1 P2 - stable operation identity: offline contract, transport BLOCKED (2026-10-27)

## Verdict

**BLOCKED.** The offline state machine proves that one server-issued operation
handle can make retries of the *same* `confirm` call idempotent across
concurrency, a lost response and a simulated process restart. It does **not**
prove that ChatGPT/MCP automatic retry preserves that handle instead of
restarting the whole `initiate -> confirm` sequence. A restarted sequence would
create a new nonbillable handle and could then be confirmed as a second paid
operation. The current stateless MCP transport has no server-owned session,
cursor or platform idempotency key that closes that gap.

No cloud, D1, Worker, Render, Auth0, Qiniu, MiniMax, real MCP or deployment
operation was performed. Strict Voice V1 remains **2/9**; B1-B4 remain OPEN.

## Authority and opening gate

- Correct repository: `nuonuo310/ShenShu-Voice-MCP`.
- Origin: `https://github.com/nuonuo310/ShenShu-Voice-MCP.git`.
- Isolated worktree: `C:\Users\Administrator\Desktop\ShenShu-Voice-MCP-P2-136`.
- Authority: PR #141, head
  `54dd0ba8b772b5d946b26f0dc2d0af2013701682`, file
  `docs/construction-envelopes/2026-10-27-voice-v1-p2-stable-operation-identity.md`.
- PR #141 was open, Draft, mergeable, base
  `docs/voice-v1-p2-no-card-short-lived-delivery-20261027` at
  `8e9fc6b00bfd362e6e04501f89c3d9ac6abc8de0`; its normal CI run
  `40522675608` / job `122253688772` succeeded.
- Parent baseline: PR #140 head
  `2a48c15c878ef314634675a7042327da1c5de529`; normal CI run
  `40517971365` / job `122236517838` succeeded.
- Worktree at opening: only ignored/untracked `node_modules/`; no stash or
  unrelated tracked edits. History was not rewritten and nothing was merged.

The opening audit read the current P1 player, P2 resolver, protected identity
verifier, MCP transports and the historical D1 operation state machine and
migrations read-only. P1 staging behavior was not modified.

## Verified code facts

### MCP transport does not supply a trusted operation identity

- `server.js` and `src/staging-authenticated-mcp.js` construct
  `StreamableHTTPServerTransport` with `sessionIdGenerator: undefined`.
- Requests are authenticated independently by a signed Auth0 JWT, which is
  sufficient for principal identity but not for correlating an automatic
  retry with the original paid operation.
- A JSON-RPC request ID is client-controlled and was not used as identity.
- `src/p2-one-shot-player-connection.js` still receives its operation from an
  injected `resolveServerOperation(trustedRequest)`. The existing P2 test uses a
  constant stub, so it proves only that a fixed ID prevents a second provider
  call; it does not prove that a real ChatGPT retry supplies the same ID.

### Historical D1 operation model is not sufficient as-is

- Historical `src/v1-transport-idempotency.js` contains
  `admitted -> provider_pending -> completed|unknown` and a fail-closed runner,
  but it accepts a client-supplied `operationId` and does not prove transport
  replay/restart semantics.
- Historical `src/d1-transactional-operation-store.js` requires an injected
  atomic batch client and couples reservation, grant issue, operation admission
  and grant consumption in one batch.
- Historical `db/d1/003_paid_voice_operations.sql` requires non-null foreign
  keys to `request_id` and `grant_id`, and allows only
  `admitted|provider_pending|completed|unknown`. It cannot persist a
  nonbillable `pending_confirmation` operation before a reservation or grant
  exists. A new additive schema/transition contract is required before real D1
  qualification.
- The current single-query Cloudflare D1 HTTP client does not by itself satisfy
  the historical store's `client.batch` plus `atomicBatch === true` requirement.
  No live D1 atomicity is claimed.

### Canonical principal is shared correctly

The signed MCP verifier and the standalone player both use
`deriveCanonicalPrincipal({issuer, subject})`. The new offline flow re-verifies
the Auth0 principal on every `initiate`, `status` and `confirm`; it never accepts
a principal, operation ID, digest, grant or billing flag from the caller.

## Bounded offline implementation

Added `src/v1-p2-stable-operation-identity.js` (unmounted, no network or D1):

| Method | Billing effect | Contract |
| --- | --- | --- |
| `initiate({trustedRequest,text})` | None | Verifies Auth0 principal, fixes action/text digest/bytes, creates a server-generated 256-bit opaque handle and nonbillable `pending_confirmation` record. |
| `status({trustedRequest,handle})` | None | Re-verifies the same owner principal and returns `pending_confirmation`, `confirmation_in_progress`, `outcome_pending`, `completed`, `unknown` or `expired`. |
| `confirm({trustedRequest,handle,text})` | One claim, then at most one paid pipeline/provider attempt | Atomically claims only an unexpired owner+exact-text match, marks `provider_pending`, runs the existing offline paid pipeline, stores the private WAV and marks `completed`. |

The handle is not authorization. It is a random correlation value returned in
the tool result, cannot retrieve audio, and cannot spend quota without the same
freshly verified canonical principal and the exact original text. The operation
record stores only the text digest and byte count; confirm resubmits text.
Operation IDs, grants, principal and digest remain server-only.

Transitions are:

```text
initiate -> pending_confirmation -> confirming -> provider_pending
                                      |              |
                                      +--------------+--> completed
                                                     \--> unknown
```

Any failure after claim is terminal `unknown`: provider error, ambiguous result,
result-store failure, completion-write failure or a process loss between claim
and provider. There is no refund, automatic retry or silent replacement
operation. Replaying a completed handle returns `completed` with
`providerAttempts: 0`; replaying `unknown` remains an error. Expired,
cross-principal, altered-text and forged handles never reach quota or provider.

`test/v1-p2-stable-operation-identity.test.js` uses an executable in-memory
compare-and-set store and the signed Auth0 verifier. The test-only store is not
production durability. A real adapter must implement `createPending`, `get`,
`claim`, `markProviderPending`, `markCompleted` and `markUnknown` with the same
atomic conditions in D1 (or another approved durable store).

## Proven offline, conditionally

Given that a retry supplies the **same handle** and exact text, the focused
adversarial tests prove:

- `initiate` never calls reservation, grant or provider.
- concurrent `confirm` calls on one handle allow one claim and one provider
  attempt;
- a lost `confirm` response replayed with the same handle returns completed with
  zero new provider calls;
- a new broker sharing the durable state recovers completed or unknown without
  a new provider call;
- a provider exception is terminal unknown, consumes rather than refunds the
  grant and is never retried;
- a crash after claim but before provider is unknown with zero provider calls;
- private-result persistence failure is unknown with no retry;
- expiry, changed text, cross-principal access, forged handles and
  caller-supplied principal/operation ID/digest/grant/model/voice/request ID/
  JSON-RPC fields fail before billing;
- the completed portrait is retrievable through the player using the same
  canonical principal;
- the module remains unmounted and has no fetch, Cloudflare, D1 or provider I/O.

## Not proven - the BLOCKED boundary

The following are not established and cannot be replaced with a fixed test ID:

1. **Whole-sequence retry.** If ChatGPT automatic retry re-invokes
   `initiate` before `confirm`, it legitimately receives a new nonbillable
   handle. Confirming that new handle is a new operation and can cause a second
   provider charge. The server cannot distinguish this from two deliberate,
   text-identical user requests without a trusted operation identity that the
   current transport does not provide.
2. **Human confirmation.** The offline `confirm` method proves a valid tool call,
   not that a human explicitly approved this specific paid operation. A model can
   call it immediately after `initiate`.
3. **Handle preservation and recovery.** No real ChatGPT/MCP retry, reconnect,
   downgrade or Render restart was observed. Lost `initiate`/`confirm` responses
   have only the conditional recovery described above; a lost handle cannot be
   recovered from text, and text hashing is explicitly not accepted as identity.
4. **Real D1 atomicity and schema.** The historical `003` table cannot represent
   the pre-billing state, and the current D1 HTTP client is not proven to provide
   the required multi-statement transaction.
5. **Private durable audio.** The player path is reusable, but its current
   production backend and short-lived media storage remain unqualified. The new
   test uses only an in-memory private-result backend.
6. **Real provider and billing.** MiniMax was not called; no real quota,
   reservation, grant or charge behavior was exercised.

Therefore the model-only three-method flow must stay dormant. Mounting
`confirm` as a model tool without a user-gesture boundary would not satisfy the
one-explicit-operation guarantee.

## Visible limitations

- Paid P2 is not active. The new module is not mounted and cannot be invoked by
  ChatGPT, the public MCP route or the player.
- There is no durable server operation, atomic D1 reservation/grant binding or
  production private-audio backend in this round.
- The offline flow's recovery depends on the caller retaining the exact opaque
  handle and exact text. A lost handle is not recoverable by text lookup.
- A completed operation returns only status; audio remains a separate
  authenticated player concern. The offline test backend is intentionally
  short-lived and single-latest per principal.
- No deployment, secret, provider, cloud, D1, Qiniu, Render, Auth0, real MCP or
  billing evidence is contained here.

## Verification

Run on Node `v24.19.0` at delivery HEAD:

- Focused stable-identity tests: **14/14 pass**, zero fail/skip/todo.
- Full `node --test`: **287/287 pass**, zero fail/skip/todo.
- `node test/smoke-server.mjs`: PASS for MCP initialize, public tools, protected
  metadata and fail-closed paid entry.
- `node --check` for `server.js`, the new module and its test: PASS.
- `git diff --check`: PASS.
- Authority CI before this delivery: run `40522675608` / job `122253688772`
  succeeded. The independent delivery PR uses normal pull-request CI only; no
  manual Actions dispatch was made.

Real-operation counters for this task:

- Render requests, service edits, restarts or deployments: **0**
- Auth0 reads/changes, credentials or tokens: **0**
- Cloudflare/Worker/D1 API calls, reads, writes or migrations: **0**
- Qiniu/R2/Kodo bucket, object, egress or credential operations: **0**
- MiniMax/provider calls or billing changes: **0**
- Real MCP/connector calls, secrets, merges or manual Actions dispatches: **0**

Delivery HEAD, independent Draft PR and its CI identifiers are reported in the
PR body and final total-control receipt instead of being embedded in this
self-referential document.

## Impact on frozen Voice V1

Strict Voice V1 remains **2/9** (gates 1 and 8 only). B1-B4 remain OPEN:

- B1: no user-confirmed audible iPhone result for generated/bridged audio.
- B2: real D1 atomic admission and deployed Worker path remain unqualified.
- B3: production private durable result delivery remains absent.
- B4: no authorized real MiniMax end-to-end call.

Gate 7 is still blocked because whole-sequence retry/reconnect/restart identity
is not proven. Gate 4 cannot be guaranteed for the same reason. Gates 3 and 5
remain offline-only. Gate 9 remains unauthorized. This delivery does not raise
the count, lower the nine-gate line or authorize paid P2.

## Singular next product decision

**Decide whether the existing authenticated private player, not the model, will
be the sole paid-confirm surface.** The model may create nonbillable pending
operations, but the one paid attempt must require an explicit, CSRF-protected
user gesture on a specific server-persisted operation inside the player's
Auth0 session.

If accepted, the next bounded round may implement that browser-confirm contract
offline against the same canonical principal and operation state. A whole MCP
retry can then create only additional nonbillable pending records and cannot
cause a second charge. If rejected, the only alternative is a platform-level
transport idempotency/session guarantee, which the current stateless MCP route
does not provide and which offline tests cannot fabricate.

Until that decision, keep paid P2 dormant: no D1 migration, provider call,
deployment, OAuth change or real charge is authorized.
