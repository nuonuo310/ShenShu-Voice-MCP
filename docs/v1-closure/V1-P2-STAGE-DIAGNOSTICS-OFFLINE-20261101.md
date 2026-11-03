# Voice V1 P2 — bounded offline stage diagnostics (2026-11-01)

**Status:** OFFLINE-ONLY DIAGNOSTIC CANDIDATE. No live telemetry, no paid calls, no deployment authority.

## Why

The 2026-10-30 owner-confirmed first 04 attempt ended in terminal `provider_outcome_unknown`. A read-only owner D1 aggregate found one UNKNOWN with one matching reservation and one consumed grant, while a mainland MiniMax hourly success line correlated to the test's 28 billing units. Those observations **do not uniquely identify whether the provider response, audio validation, Kodo PUT, or D1 completion failed**. The original process did not retain a stage-specific diagnostic. Do not claim retroactive root cause.

## New bounded offline instrumentation

At the existing Draft PR #146 only:

- `src/v1-p2-stage-diagnostics.js` defines a closed, fixed stage vocabulary and a trusted, synchronous observer interface. It emits **only one allowlisted stage string** at a time; arbitrary stage values throw; observer errors are swallowed without affecting the paid result.
- `src/v1-p2-stable-operation-identity.js` accepts an **optional** `onStageDiagnostic` function, default `null`. It marks admission, provider-pending, provider attempt/return/failure, pipeline completion/failure, audio-record acceptance/rejection, private save start/success/failure, and D1 completion start/success/failure.
- The deployable `server.js`, `src/v1-p2-d1-confirmation.js`, production wiring, Render and all provider adapters **do not supply an observer**. There is no automatic console, network, database, file or third-party telemetry and no live trace for historical operations.
- A provider-adapter *return* indicates the adapter resolved; it is **not** proof that upstream billing succeeded. A provider failure code cannot distinguish upstream HTTP, timeout and WAV validation inside the adapter. That narrower distinction, if required for V1, demands separate nonsecret offline work and review.

## Invariants under test

1. Normal synthetic flow produces fixed stages in order; all event values are allowlisted strings and contain no request text, subject, handle, credential, audio bytes, URL or ID.
2. Fake provider throw, fake private PUT failure and fake D1 completion failure have distinct last-stage codes but the **same terminal UNKNOWN and no-retry** behavior. Provider and private calls are not silently repeated.
3. An observer exception cannot cause, prevent or repeat a paid attempt; malformed codes and nonfunction observer configuration are rejected.
4. The existing CI suite must remain green on Node24; no real Cloudflare, Qiniu, MiniMax, Render or Call calls and no live /player/confirm POST.

## Deployment and security boundary

- Four paid staging flags stay **OFF**. The latest confirmed Render LIVE remains the approved patched SHA `b87f5af63a170df2e1c666095daaa6f8d9f69650`; this new PR HEAD **has not been deployed**.
- Do not add a logging sink to production, expose stage codes in owner-facing API, extend request data or store persistent traces without a separate privacy/security and release review.
- This change cannot recover the original 2026-10-30 unknown. It only makes future **offline** failure boundaries inspectable.
- Any future real paid smoke requires a new owner authorization, exact deploy pin, one provider attempt, a budget and separate desktop/iPhone audible acceptance.
- Keep the old UNKNOWN and consumed D1 grant as-is. Never reset, refund, rerun the consumed qualification, or automatically retry.
- The Voice V1 gate counter remains conservatively **2/9**; an observer is not an acceptance gate.

**Freeze point:** CI success and an independent source review confirm only allowlisted stage codes cross the optional test sink. Do not expand this into generalized telemetry work just to keep constructing.
