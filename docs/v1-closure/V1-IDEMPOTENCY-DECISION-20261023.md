# Voice V1 transport-idempotency decision (2026-10-23)

Status: **TOTAL CONTROL DECISION REQUIRED. OFFLINE CONTRACT AND TESTS COMPLETE.
STRICT V1 REMAINS 2/9.**

This package does not authorize real D1, DDL, a paid route, a provider call,
deployment, connector refresh or merge. The current implementation is an
unmounted, pure-JavaScript contract with an in-memory durable-store fixture.

## Authority and opening verification

- Repository/origin: `nuonuo310/ShenShu-Voice-MCP`
  (`https://github.com/nuonuo310/ShenShu-Voice-MCP.git`).
- Git identity: `nuonuo310 <2584974449@qq.com>`.
- Authority branch: `docs/voice-v1-idempotency-gate-20261023`.
- Authority commit: `f6621f67da73f594088504578e3b2109cb54671f`.
- Sole construction package:
  `docs/construction-envelopes/2026-10-23-voice-v1-idempotency-gate.md`.
- Task branch: `work/voice-v1-idempotency-gate-20261023`, created from the exact
  authority commit before implementation.
- Task worktree: `ShenShu-Voice-First-Audition`. No additional worktree is
  registered in this repository. Predecessor branches were not reset, stashed,
  cleaned, moved or rewritten.
- Opening tracked-file state was clean except for the already-started,
  untracked `src/v1-transport-idempotency.js`; it was reviewed, hardened and is
  included in the implementation commit below.
- `origin/main`: `1cef5ada7f6af0b912b7d5bba2c42f4f776bb828`.
- The authority commit only adds the construction envelope. Its parent is S3
  implementation head `7f74a5f3e1345c20e9ee0575a52bb84c566c2e64`.
- Authority CI run `39958831508` is complete with conclusion `success`.

Open stacked Draft topology verified before implementation:

1. #86 `work/voice-v1-closure-s1-s2-20261023` at `878f4e86...`, base
   `docs/voice-v1-closure-control-20261022`.
2. #88 `docs/voice-v1-s3-d1-qualification-20261023` at `fcca7f48...`, base #86.
3. #89 `work/voice-v1-s3-d1-qualification-20261023` at `7f74a5f3...`, base #88.
4. #90 `docs/voice-v1-idempotency-gate-20261023` at `f6621f67...`, base #89.

All four were open Drafts and reported mergeable clean. No PR existed for
`work/voice-v1-idempotency-gate-20261023` before this turn. One Draft PR is
created only after the implementation and this decision are committed.

## Implemented offline contract

Implementation commit:
`4f9ef9c98be29d31243c692a221e792c8ef2113c`.

Changed files:

- `src/v1-transport-idempotency.js` (new, unmounted)
- `test/v1-transport-idempotency.test.js` (new)

The module defines one action-scoped operation key:

- verified opaque principal from the server-owned identity resolver;
- narrowly validated operation ID, 8-128 safe identifier characters;
- exact text byte count and SHA-256 base64url digest;
- a 5-minute default and 15-minute maximum validity window;
- states `admitted`, `provider_pending`, `completed`, `unknown`.

The in-memory store admits the operation, daily reservation, consumed one-use
grant and slot in one serialized fixture transaction. It does not import or
contact D1, Cloudflare, MiniMax or HTTP. The runner accepts only
`trustedRequest`, `operationId` and `text`; caller-supplied principal, approval,
grant, request ID, digest, model, voice or provider is rejected before any side
effect. Provider input is limited to the checked text, and provider output is
limited to one opaque `resultRef`.

State behavior:

- completed replay returns the prior opaque result reference with zero provider
  attempts;
- admitted replay is in-progress with no provider attempt;
- provider-pending or unknown replay is an unknown outcome with no provider
  attempt and no refund/retry;
- text mismatch for an existing operation is a conflict;
- expiration fails closed and never calls the provider again;
- distinct operations with identical text remain distinct intentional actions;
- a completed result is returned only when its reservation, consumed grant and
  daily slot also remain intact.

## Test evidence

All provider calls were injected fakes. All paid-store state was in memory.

- Targeted `node --test test/v1-transport-idempotency.test.js`: **21/21 PASS**.
- Full `node --test`: **270/270 PASS**.
- `node test/smoke-server.mjs`: PASS for MCP initialize, tools/list, inline and
  hosted mock audio, protected metadata and fail-closed paid entry.
- `node --check` for the new source and test: PASS.
- `git diff --check`: PASS.
- Source compatibility assertion: neither `server.js` nor
  `src/staging-authenticated-mcp.js` imports the new module.

Targeted cases cover sequential replay, concurrent duplicate delivery, distinct
operations with identical text, same-operation text conflict, cross-principal
operation-ID collision, lost provider response, completion-write failure,
malformed/public-URL provider result, expiry, UTC-day rollover, daily limit,
second-process replay, crash after admission, caller-control rejection,
malformed ingress, forged/partial durable rows, generated-ID collision, opaque
only output and source-level isolation.

## What is actually validated

- The pure contract can enforce at-most-one injected provider call for one
  `(principal, operationId)` in the executable in-memory model.
- An operation is bound to exact text bytes/digest and bounded validity in that
  model.
- Sequential and concurrent replay of the same operation does not add a
  reservation, consume a second grant or call the injected provider again.
- A distinct intentional operation with the same text is not accidentally
  deduplicated.
- Unknown provider outcomes, completion persistence failures, expiry and partial
  local records fail closed with no automatic retry or refund.
- Public MOCK and existing unmounted paid-pipeline behavior remain unchanged.

## What remains unknown or unimplemented

- No production request currently has a stable operation ID. A duplicate
  transport delivery therefore cannot be connected to this contract until the
  frozen MCP ingress is changed or an equivalent trusted idempotency key is
  supplied by the host.
- The current D1 schema has no operation, digest, state, result reference or
  expiry binding.
- The current D1 HTTP adapter makes separate `reserve`, `issue` and `consume`
  calls. Three separate HTTP calls are not one transaction. The fixture's
  serialized in-memory queue is not a multi-instance production guarantee.
- Cloudflare D1 batch/transaction behavior for this exact HTTP deployment path
  has not been exercised. No claim is made from Worker binding documentation.
- No private durable result store exists. `resultRef` is an opaque contract
  value, not a deployed audio locator or delivery capability.
- No real authenticated paid path, real D1 row, provider request, audio
  delivery, deployment or iPhone result was produced.
- A malicious caller that deliberately chooses a new operation ID can create a
  new logical action. The selected ingress must make retry identity stable and
  auditable; the server cannot infer intent from identical text.

## Recommended minimal production architecture (Option A)

Adopt an additive operation-binding table plus a transactional admission call.
Do not alter the recovered reservation or grant columns.

### Proposed migration `db/d1/003_paid_voice_operations.sql`

Not authorized or applied by this package:

```sql
CREATE TABLE IF NOT EXISTS paid_voice_operations (
  principal TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  request_id TEXT NOT NULL UNIQUE,
  grant_id TEXT NOT NULL UNIQUE,
  action TEXT NOT NULL CHECK(action = 'generate_shenshu_voice'),
  text_digest TEXT NOT NULL CHECK(length(text_digest) = 43),
  text_bytes INTEGER NOT NULL CHECK(text_bytes BETWEEN 1 AND 800),
  state TEXT NOT NULL CHECK(state IN ('admitted','provider_pending','completed','unknown')),
  result_ref TEXT,
  issued_at INTEGER NOT NULL CHECK(issued_at >= 0),
  expires_at INTEGER NOT NULL CHECK(expires_at > issued_at),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(principal, operation_id),
  FOREIGN KEY(request_id) REFERENCES paid_voice_reservations(request_id),
  FOREIGN KEY(grant_id) REFERENCES paid_voice_grants(grant_id),
  CHECK(expires_at - issued_at <= 900000),
  CHECK(
    (state = 'completed' AND result_ref IS NOT NULL) OR
    (state <> 'completed' AND result_ref IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS paid_voice_operations_state_expiry
  ON paid_voice_operations(state, expires_at);
```

This table does not store audio, bearer tokens, provider keys, voice IDs or raw
text. `result_ref` is an opaque server-owned reference. The primary key scopes a
client operation ID to one authenticated principal; `request_id` and `grant_id`
are unique and foreign-key-bound to the existing admission records.

### Required admission transaction

After a verified principal and a bounded operation binding are built, one D1
batch/transaction must perform the following without exposing intermediate
success:

1. Return the existing operation disposition if `(principal, operation_id)`
   already exists.
2. Otherwise allocate one daily reservation slot.
3. Insert one `issued` grant bound to that reservation and principal.
4. Insert one `admitted` operation row bound to both records, digest, action and
   expiry.
5. Consume the grant with the existing conditional transition.

Any statement error, ambiguous batch response, duplicate slot, duplicate
operation or failed grant transition must roll back the whole batch and block
the provider. A concurrent loser may re-read the existing operation before any
provider call; it must never replay the admission write or call the provider a
second time after an ambiguous response.

Provider transitions remain one-way: `admitted -> provider_pending ->
completed|unknown`. A completion update must require `provider_pending`, the
same principal and request ID, and a server-generated opaque result reference.
Failure to write completion must attempt `unknown`; failure to write `unknown`
also fails closed. Expired or unknown operations are not automatically retried,
refunded or reused.

### Required trusted ingress decision

The recommended smallest protocol is a required opaque `operation_id` argument
on the future paid tool, generated once per logical user action by the trusted
host/model call and reused unchanged by transport retries. It must be documented
as an idempotency key, not a security credential. The server must reject a
missing or malformed value and bind it to the verified principal, exact text
digest, action and short expiry.

This is a change to a frozen public MCP tool schema and needs explicit approval.
Alternative trusted ingress is a host-supplied idempotency header, but only if
the actual ChatGPT/MCP transport is proven to preserve it across retries. A
server-generated fresh ID per HTTP delivery cannot solve duplicate delivery.

### Private result decision

`result_ref` may point only to a private, expiring, server-owned result store.
No public permanent URL, bearer, ticket or voice ID may be returned from the
paid operation row. The existing private HTTPS/in-memory ticket prototypes are
not production storage and are not authorized by this decision. Returning an
existing completed result requires separate authenticated delivery approval.

## Alternatives considered and rejected

1. **Use identical text as the dedupe key.** Rejected because two intentional
   user actions may contain the same text and must not be merged.
2. **Deterministic HMAC request ID only.** Rejected because request replay can
   be suppressed but completed, in-progress and unknown outcomes cannot be
   distinguished or result delivery recovered.
3. **Process-local Map/cache.** Rejected because it fails across Render instances
   and restarts and is not production truth.
4. **Caller-supplied principal, grant, approval, digest, model or voice.**
   Rejected because these are authorization/security controls, not client input.
5. **Add operation fields only to `paid_voice_reservations`.** This still needs a
   migration, but mixes daily quota with operation state and result lifecycle,
   and requires altering a recovered production table. It has a larger blast
   radius than an additive table.
6. **Rewrite `paid_voice_grants` state/constraints.** Rejected because changing
   an existing CHECK constraint in SQLite requires a table rebuild and expands
   migration risk.
7. **Retry after timeout/unknown.** Rejected because a provider attempt may
   already have been billable; no automatic retry or refund is allowed.
8. **Add an in-memory production ticket store.** Rejected for the same durability
   and multi-instance reasons.

## Smallest total-control authorization requested

Approve only the following next step; it is still offline and nonbillable:

1. Approve the additive `003_paid_voice_operations.sql` schema/index shape above,
   or direct a different schema.
2. Choose the trusted operation-key ingress. Recommended: required opaque
   `operation_id` on the future paid tool, bound server-side to principal, text
   digest, action and expiry.
3. Authorize implementation and local in-memory SQLite tests of a single
   transactional D1 operation store plus the transactional batch adapter. Do not
   apply real DDL and do not use real D1 credentials.

Separate approvals are still required before:

- applying migration 003 to the existing Cloudflare D1 database;
- real-D1 concurrency/replay/rollover qualification;
- any private result-store deployment or delivery route;
- registering or enabling a paid MCP tool;
- the one bounded MiniMax E2E smoke.

## Rollout and rollback

Rollout must remain dormant by default. The proposed table is additive and
unused until the paid path is explicitly enabled. Implement and verify the
adapter with local SQLite and malformed-response tests before requesting real
D1. A staging paid route must not be registered during schema/adapter
qualification.

Application rollback is reverting the code commit and leaving the empty additive
table in place. Do not drop the table as routine rollback: dropping is DDL with
audit risk. Any removal requires separate approval after confirming no rows and
preserving nonsecret evidence. After a potentially billable attempt, never delete
or refund the operation/reservation to make a result look clean.

## Remaining distance to V1 Freeze

Strict V1 remains **2/9** (gates 1 and 8 only). This turn improves offline
contract evidence for gates 4 and 7 but does not close them; gate 7 is explicitly
blocked on durable operation ingress and D1 transaction evidence.

- **B1**: iPhone generated/bridge audio remains user-reported silent; no
  user-confirmed audible V1 result.
- **B2**: real D1 paid-namespace qualification and trusted paid wiring remain
  undone. The proposed schema and transaction adapter need approval.
- **B3**: real fail-closed/private delivery evidence remains undone; completed
  replay still needs a private durable result store and authenticated delivery.
- **B4**: zero authorized real MiniMax end-to-end calls; one capped smoke remains
  a separate future gate.

The next true gates are: total-control schema/ingress decision, offline
transactional adapter proof, approved real-D1 qualification, private delivery
and iPhone audibility, then one separately approved MiniMax E2E.

## Real-operation counters for this turn

- MiniMax calls: 0
- Billable provider attempts: 0
- Real D1 reads/writes/migrations: 0
- Cloudflare API calls: 0
- Real keys, tokens or voice IDs read/logged: 0
- Deployments / Render / Auth0 / connector refresh: 0
- GitHub Actions dispatches: 0
- Merges/rebase/rewrite: 0

## Disposition

**TOTAL CONTROL DECISION REQUIRED.** The offline safety contract is ready and
tested, but a truthful production implementation requires an approved additive
D1 schema, one transactional batch path and a trusted operation-key ingress.
The design is complete enough to decide; the database or frozen tool interface
must not be changed silently.
