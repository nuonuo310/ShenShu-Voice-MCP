# Voice V1 P2 — 2026-10-30 terminal UNKNOWN: read-only evidence and STOP gate (2026-11-01)

**Disposition: BLOCKED FOR ATTRIBUTION; paid path OFF. Not a new construction slice or permission to retry.**

Authority: ShenShu Voice V1 total control; the existing Draft PR #146, its frozen V1 closure plan, and `nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md`. This is a narrowly scoped read-only forensic note. It neither changes the V1 DONE LINE nor reopens paid cloud qualification. No secret, user-specific proposal text, subject, handle, object key, API response, or billing screenshot is archived here.

## 1. What happened and what is grounded

- The owner viewed a sealed owner-scoped proposed utterance in the browser, and clicked its explicit POST once on staging.
- The first real-browser attempt failed with `confirmation_forbidden` (403), before `broker.confirm`. A narrowly scoped `Referrer-Policy: same-origin` repair in PR #146 corrected the native HTML POST/Origin policy mismatch, retaining strict Origin, session and CSRF checks. Repair CI `40963558311` passed; patched SHA `b87f5af63a170df2e1c666095daaa6f8d9f69650` was manually deployed to staging.
- A subsequent explicit owner click reached `broker.confirm`, but the browser received `provider_outcome_unknown` (409). The authenticated read-only status call for the same owner proposal returned `unknown`, a terminal, nonretryable state. **No second paid request may be tried under this old authority.**
- A later owner screenshot of the MiniMax mainland hourly API ledger shows a `t2a-v2` / `speech-2.8-hd` **SUCCESS** aggregate in the matching 2026-10-30 06:00–07:00 (UTC+8) hour, with 28 billable input units. The candidate text was also exactly 28 billable units under the mainland Chinese-character double-count convention. This is **strong provider-side correlation, not per-request proof** (no unique provider trace ID in the hourly ledger). Do not infer delivery.
- Owner then set the four independent paid flags OFF and manually deployed the exact existing SHA. Independent Render result: LIVE `dep-dbjku1nb9u1s73eb5kvg` at `b87f5af63a170df2e1c666095daaa6f8d9f69650`; owner-supplied new startup `sealed_ready`, `paid_confirm_mounted:false`, `paid_startup_code:final_wiring_flag_off`, `paid_voice_enabled:false`. Paid route **is now closed**, while sealed nonbillable proposal infrastructure remains active.

## 2. Precise source boundaries: why `unknown` is ambiguous

At patched SHA:

1. `src/v1-p2-player-confirmation.js` first checks owner session, exact same-origin, form type, owner record and CSRF. Only after those does it call `broker.confirm`. The returned 409 `provider_outcome_unknown` comes from `operation_outcome_unknown` inside the broker, so 403-style prechecks are no longer the blocking symptom.
2. `src/v1-p2-stable-operation-identity.js`: D1 `claim` is a durable admission; `markProviderPending`, injected paid pipeline, audio result validation, private result save and `markCompleted` all have branches that may terminalize an operation as UNKNOWN. That one public error code does not identify the failing stage.
3. `src/v1-offline-paid-pipeline.js`: trusted grant consumed before one fixed-provider synthesis attempt. No retry and no refund; a successful response can still be followed by downstream failure.
4. `src/minimax-adapter.js`: fixed mainland `https://api.minimaxi.com/v1/t2a_v2`, `speech-2.8-hd`, 04 voice, non-streaming hex WAV at 16k mono, validates the returned WAV strictly. On error the adapter collapses HTTP, parse, audio-format and timeout causes to `upstream_error` without a trace receipt.
5. `src/p2-private-result-store.js` and `src/p2-kodo-private-audio-backend.js`: owner-only encrypted Kodo PUT, 300-second access TTL, no app-level DELETE. Kodo's prior limited live 1-PUT/3-GET qualification was under user-owned local credentials; it does **not** prove the runtime's separate Render credentials or this exact real-audio PUT succeeded.
6. `src/d1-p2-confirmation-operation-store.js`: D1 `markCompleted` failure can also turn an already generated/saved audio result into UNKNOWN. A counted/consumed grant establishes admission, **not** successful private playback.

**Cannot distinguish from current evidence:** a provider HTTP response consumed but rejected locally, a valid WAV with rejected metadata/container, a Kodo PUT failure or ambiguity, and a D1 completion write failure. Hourly billing does not expose this distinction. The old runtime did not persist a sanitized per-stage trace; a code change made now cannot retroactively reconstruct it.

## 3. Evidence gap and low-risk read-only path

The current GitHub and connected Render read-only views contain no trace of the exact failed stage. A scoped Render log retrieval for the relevant 2026-10-29 22:15–22:35 UTC range surfaced service port messages, not an upstream/provider/Kodo-stage diagnostic. **Absence of such a log is not evidence of absence of a request.** No Cloudflare D1 or Qiniu connector with authenticated owner-authorized read-only access was available in this investigation; the assistant has NOT read private D1 rows or Kodo objects.

If an operator later opens authenticated owner dashboards (not public PR), the next useful checks are:

- **D1 only, read-only**: inspect just the sealed operation's terminal state and whether its one-time reservation/grant were consumed; no `UPDATE`, `DELETE`, migration, reset, repeated claim or manual refund. Omit principal, handle, text and private IDs from any shared receipt.
- **Kodo only, read-only**: see whether a corresponding private encrypted object or a lifecycle-removal audit exists *if* provider/dashboard still retains it. A one-day lifecycle may already have removed ciphertext; missing object in November does not prove PUT never happened. No new PUT, GET requiring decrypted playback, LIST at API scale, or object DELETE without new scope.
- **MiniMax only, read-only**: if the owner can obtain a single-operation provider trace/usage receipt for the matching time and billable count, compare on the owner's side. Hourly aggregate SUCCESS alone is not unique attribution. Do not export key, raw audio or billing identifiers into PR.
- **App code only, offline**: test the actual MiniMax-supported WAV container variants and SDK S3 request shape with synthetic bytes; if adding future observability, record **fixed stage enums only** (no text, handle, account, token, principal, file path or raw response), and prove it cannot expose secrets or change the one-shot admission path. Do not use a new paid smoke merely to see what failed.

## 4. GO / NO-GO

- **NO-GO now**: four paid flags remain OFF; no provider request, confirm POST, automated retry, D1/Kodo synthetic rerun, one-time lock deletion, manual quota reset, production/Call change, or PR merge.
- To call the incident **attributed**, obtain a bounded, privacy-safe, independently verified link to the failed stage; without this, status remains UNKNOWN and conservatively treated as potentially billed.
- If and only if the product still requires another real paid smoke after the offline/runbook correction, require **fresh explicit human approval**, a new operation, exact SHA and rollback, fixed provider attempt maximum one, price/voice-first-use boundary, and human desktop+iPhone audible result. Old UNKNOWN must not be recycled.
- V1 frozen count remains **2/9** until the nine original evidence gates are actually met. Do not turn this diagnostic into endless pre-V1 experimentation.

*The objective is to recover evidence or reduce one genuine V1 blocker, not to expand the V1 scope.*
