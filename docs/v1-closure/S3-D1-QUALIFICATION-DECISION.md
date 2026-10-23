# Voice V1 S3 - D1 paid-admission qualification decision (2026-10-23)

Status: **OFFLINE QUALIFICATION PACKET COMPLETE. REAL D1 NOT RUN. STRICT V1 REMAINS 2/9.**

This document prepares one bounded, reversible real-D1 qualification. It does not
authorize a D1 query, migration, credential read, deployment, connector refresh,
MiniMax call or paid-provider attempt.

## Authority and opening verification

- Repository/origin: `nuonuo310/ShenShu-Voice-MCP`
  (`https://github.com/nuonuo310/ShenShu-Voice-MCP.git`).
- Authority branch: `docs/voice-v1-s3-d1-qualification-20261023`.
- Authority commit: `fcca7f48aff788ec6a709cc5d823ca382acfce01`.
- Sole construction package:
  `docs/construction-envelopes/2026-10-23-voice-v1-s3-d1-qualification.md`.
- Selected worktree: `ShenShu-Voice-First-Audition`, clean at opening, with
  local identity `nuonuo310 <2584974449@qq.com>`.
- Task branch: `work/voice-v1-s3-d1-qualification-20261023`, created from the
  authority commit.
- Verified `origin/main`: `1cef5ada7f6af0b912b7d5bba2c42f4f776bb828`.
- The authority commit only adds the construction envelope. Its parent is
  `878f4e863d7f32484dc5b03ddae1cfed8937b39a`, the head of S1/S2 PR #86.
- Other local worktrees were inspected read-only and were not reset, stashed,
  cleaned or moved. `ShenShu-Voice-MCP-Official` points at the same origin but is
  on an older S1/S2 feature commit, is behind its upstream and has untracked
  `node_modules/`; it was not selected for this task.

Open stacked Draft topology verified at opening:

1. #85 `docs/voice-v1-closure-control-20261022` at `a37b653b...`, based on
   `work/first-audition-staging-isolation-v7`.
2. #86 `work/voice-v1-closure-s1-s2-20261023` at `878f4e86...`, based on #85.
3. #87 `docs/voice-v1-iphone-output-evidence-20261022` and #88
   `docs/voice-v1-s3-d1-qualification-20261023` at `fcca7f48...`, both based on
   #86.

This task branches from #88 and must not merge, rebase or rewrite any predecessor.

## Offline review result

### Reviewed invariants

- Identity is resolved only from a cryptographically verified OAuth request.
  Caller-supplied principal, approval, one-time flag, grant, request ID, model or
  voice is rejected before admission.
- Admission order is reservation -> grant issue -> grant consume -> provider.
  Any refusal or thrown/ambiguous D1 result prevents the provider call.
- The model is fixed in server code. The voice is deployment-supplied and is not
  accepted from or returned to the caller.
- The provider is attempted exactly once. Provider errors, invalid WAVs and
  uncertain outcomes are not retried or refunded.
- The returned record is inline base64 with no public URL. The pipeline is not
  mounted on `server.js` or the public MOCK route.
- Reservation SQL rejects duplicate request IDs and enforces at most one row for
  each `(principal, day_utc, slot)` pair. Grant issue is bound to an existing
  reservation owner. Consume is a one-way `issued -> consumed` transition.

### Narrow hardening

`src/d1-http-paid-store.js` previously interpreted any non-matching first row as
a normal quota/grant refusal. A malformed, non-array or multi-row D1 response is
not normal refusal; treating it as refusal could hide a partial or ambiguous
result during qualification. The adapter now treats only an empty result as a
clean refusal and fails explicitly with `d1_result_invalid` for:

- a non-array response;
- more than one returned row;
- a reservation row with the wrong request ID or invalid slot;
- a grant row with the wrong grant ID.

Transport exceptions continue to propagate once. No retry or refund was added.

### Local SQLite semantic check

The checked-in D1 migrations and fixed SQL were executed against an in-memory
SQLite database through the HTTP adapter. This is local structural evidence, not
Cloudflare D1 evidence.

- 12 concurrent unique reservation attempts with one principal/day and limit 3:
  3 accepted on slots 1, 2, 3; 9 refused.
- Each accepted request issued and consumed once: 3/3 consumed.
- A second consume of each grant: 0/3 accepted.
- Reusing an accepted request ID: no additional reservation.
- A reservation on the next test day: accepted on slot 1.
- Final local rows: 3 reservations for day A, 3 consumed grants.

### Residual findings that must not be overstated

1. The S1/S2 evidence statement that the text digest is "bound server-side" is
   too strong. The current pipeline validates text and computes a local digest,
   but the D1 schema has no digest column and the digest is not durably bound to
   the reservation or grant. Do not claim durable text binding in the real-D1
   packet.
2. `createV1OfflinePaidPipeline` generates a fresh server request ID for every
   invocation. Internal reuse of the same ID is rejected, but transport-level
   duplicate client requests are not deduplicated because no caller idempotency
   key is accepted. This must be resolved by a separate total-control contract
   decision before a paid route is enabled. It does not block this offline D1
   qualification, but it blocks closing V1 gate 7.

## Smallest real-D1 authorization packet

No field below authorizes execution until total control approves the completed
packet. Never place an API token, bearer token or provider key in this file.

### Exact target metadata

- Provider: Cloudflare D1.
- Repository: `nuonuo310/ShenShu-Voice-MCP`.
- Database display name confirmed from safe repository evidence:
  `shenshu-voice-budget-test`.
- Cloudflare account ID (32 hex characters) and D1 database UUID are safe
  non-secret metadata, but they are intentionally not committed here. The
  operator must copy them from the Cloudflare dashboard or another already
  approved metadata source into the external approval packet.
- The run must also record the approved source commit SHA.
- If the account ID, database UUID, display name or source commit cannot be
  independently confirmed, the run is **STOP**.

### Credential and approval boundary

- Provision a separate, short-lived D1 write credential scoped to only this
  account/database. Do not reuse or copy the production provider key, OAuth
  bearer, MiniMax key or voice ID.
- The credential stays in the operator environment. It must not be printed in
  logs, committed, pasted into chat, returned by MCP, or stored as evidence.
- Approval must name the account/account ID, database UUID/name, source commit,
  `runId`, two UTC test days, test principal, 12 + 1 attempt budget, limit 3,
  maximum 8 new durable rows and the no-retry/no-cleanup policy.
- Approval of this document, this PR or a GitHub merge is **not** execution
  approval.

### Schema and migration preconditions

No migration or DDL is authorized. The target must already match the checked-in
baseline:

- `paid_voice_reservations`: `request_id` primary key; required `principal`,
  `day_utc`, `slot`; `slot` constrained to 1..20; unique
  `(principal, day_utc, slot)`; supporting principal/day index.
- `paid_voice_grants`: `grant_id` primary key; unique `request_id`; required
  `principal` and `state`; state restricted to `issued`/`consumed`; foreign key
  from grant `request_id` to reservation `request_id`; supporting
  principal/state index.
- Read-only schema inspection must confirm the columns, primary keys, unique
  constraints, check constraint, foreign key and indexes.
- `PRAGMA foreign_keys` must return 1 and `PRAGMA foreign_key_check` must return
  no rows on the executing connection.
- Any mismatch, missing index/constraint or disabled foreign keys is **STOP**.
  Do not repair the database as part of this qualification.

### Isolation and write budget

- `runId`: `s3d1_20261023_<operator-suffix>` with 8-128 safe identifier
  characters.
- Test principal: `dryrun_s3d1_20261023_<operator-suffix>`. It must start with
  `dryrun_`, be new, and never be the real paid principal.
- Request prefix: `dryreq_s3d1_20261023_<operator-suffix>_`.
- Day A and Day B: two explicit UTC dates in the approval packet. Day B is the
  next UTC day for rollover isolation.
- Day A: 12 unique reservation attempts, limit 3.
- Day B: 1 reservation attempt, limit 3.
- Maximum successful reservations: 4 total (3 on Day A, 1 on Day B).
- Maximum grants: 4 total, all issued once and consumed once.
- Maximum new durable rows: 8 (4 reservations + 4 grants).
- Preflight must show zero existing rows for the test principal and request
  prefix. Any occupancy means choose a new run ID after approval; never delete
  existing rows.
- The P2X runners in `src/d1-qualification-*` are hard-coded to the 2026-10-20
  P2X principal/day and must not be repurposed for this S3 run.

## Real-D1 probe plan

Every step is single-attempt. Never retry an error, timeout, 429, partial result
or ambiguous response.

### P0 - read-only preflight

Confirm the exact account/database, source commit, schema, foreign-key state,
indexes and empty namespace. Record only non-secret metadata and counts. Any
identity or schema ambiguity is **STOP** before the first write.

### P1 - concurrent reservation and limit

Dispatch the 12 Day A requests once, without artificial retry. Expected result:

- exactly 3 reservations;
- slots exactly 1, 2 and 3;
- exactly 9 clean refusals;
- no duplicate request ID, duplicate slot or fourth reservation.

If any response is thrown, missing, malformed, multi-row or otherwise ambiguous,
do not issue any grant. Stop and preserve the observed state.

### P2 - grant issue and one-way consume

For each of the 3 accepted Day A requests, issue one deterministic run-scoped
grant and consume it once. Expected: 3 issued, 3 consumed. Re-issue and re-consume
one selected grant. Expected: zero additional successful transitions. Any
cross-principal or cross-request success is **STOP**.

### P3 - request replay

Reuse one accepted Day A request ID once. Expected: zero new reservations and no
new grant. This proves database request replay protection only; it is not a claim
of transport-level idempotency.

### P4 - UTC-day isolation

On Day B, reserve, issue and consume one request for the same test principal,
limit 3. Expected: one reservation on slot 1 and one consumed grant. Day A
occupancy must not block Day B. No real principal or production quota is touched.

### P5 - read-only postflight

Using fixed read-only queries for the exact run namespace, verify:

- 4 reservations for the test principal, 3 on Day A and 1 on Day B;
- slots 1-3 on Day A and slot 1 on Day B, with no duplicates;
- exactly 4 grants, all for this principal, all `consumed`, none unconsumed;
- the grant request IDs are exactly the accepted reservation request IDs;
- `PRAGMA foreign_key_check` is empty;
- no row belongs to a real principal and no unrelated row changed.

Any count mismatch, extra row, wrong owner, unconsumed grant, duplicate slot or
foreign-key violation means qualification is **NOT PASS**.

## Evidence and audit record

Retain only non-secret material:

- source commit, branch and PR number;
- account ID and database UUID from the approved external metadata packet;
- database display name;
- run ID, test principal, request prefix, Day A/Day B;
- UTC start/end timestamps and operator identity;
- per-step attempt, success, refusal and error-category counts;
- reserved slots, consumed-grant counts, replay counts and postflight counts;
- fixed SQL statement identifiers or hashes, not bearer tokens or API tokens;
- explicit statement that Cloudflare D1 behavior, not SQLite/offline mocks, was
  exercised.

Do not record the OAuth bearer, MiniMax key, voice ID, API token, private text,
generated audio or any credential-bearing request/response body.

## Abort and stop conditions

Stop before any further write if any of the following occurs:

- account, database UUID/name, source commit or approval packet mismatch;
- schema, index, unique constraint, foreign-key or migration mismatch;
- namespace collision or any row for the real principal;
- unexpected fourth reservation, duplicate slot or duplicate request ID;
- replay issue/consume unexpectedly succeeds;
- cross-principal or cross-request grant success;
- D1 401/403/429/5xx, timeout, abort, partial payload, malformed/non-array/
  multi-row result, or `d1_result_invalid`;
- credential or private data appears in output;
- any operation would require retry, refund, delete, reset or DDL.

An ambiguous write is durable evidence. Do not hide it with cleanup.

## Rollback and no-refund policy

- No schema change is part of the run, so rollback does not require DDL.
- Isolation is provided by a new `dryrun_` principal, a new request prefix and two
  fixed test days.
- Durable rows are retained as audit evidence by default.
- Cleanup requires a separate explicit approval naming the exact run prefix and
  dates, and must occur only after evidence export. Never delete ambiguous rows to
  make a result look clean.
- No refund or slot reuse is permitted after an ambiguous write. This run makes no
  provider call, so it creates no MiniMax charge.

## Explicitly not authorized

- Cloudflare API/D1 reads, writes, queries, migrations or console changes.
- D1/API credential or secret reads.
- Render, Auth0, OAuth connector or JWKS changes; connector refresh.
- Deployments, GitHub Actions dispatch, merges or production changes.
- Public or paid MCP tool registration/activation.
- MiniMax or any other paid provider call.
- Private generated-audio delivery qualification.

## Verification completed in this change

- Targeted adapter/pipeline tests: **19/19 PASS**.
- Full `node --test`: **249/249 PASS**.
- Local in-memory SQLite semantic check: PASS as described above; not Cloudflare.
- JS syntax checks: PASS.
- `git diff --check`: PASS.
- Public MOCK isolation regression: PASS.
- GitHub Actions: recorded on the Draft PR after push.

## Remaining distance to V1 Freeze

Strict V1 remains **2/9** (gates 1 and 8 only). The four blocker domains remain:

- **B1**: iPhone generated/bridge audio is still silent; no user-confirmed
  audible V1 result.
- **B2**: real Cloudflare D1 paid-namespace concurrency/replay/limit/rollover
  qualification and trusted paid-route wiring are not done.
- **B3**: real fail-closed/private-audio delivery evidence is not done.
- **B4**: zero authorized real MiniMax end-to-end calls.

The next real gates in order are:

1. approve and execute this bounded real-D1 run with independent review;
2. resolve transport idempotency/duplicate-request policy before enabling a paid
   entry point;
3. qualify private authenticated audio delivery and iPhone audibility;
4. perform exactly one separately authorized, capped MiniMax end-to-end smoke;
5. re-count all nine gates against concrete evidence before any Freeze claim.

## Real-operation counters for this turn

- MiniMax calls: 0
- Billable provider attempts: 0
- Real D1 reads/writes/migrations: 0
- Cloudflare API calls: 0
- Real keys/voice IDs read or logged: 0
- Deployments / Render / Auth0 / connector refresh: 0
- GitHub Actions dispatches: 0
- Merges: 0
