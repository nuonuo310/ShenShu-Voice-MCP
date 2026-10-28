# Voice V1 P2 explicit confirm to private WAV (offline)

Date: 2026-10-28  
Status: **COMPLETE** for the bounded offline package only.  
Authority: `docs/construction-envelopes/2026-10-28-voice-v1-explicit-confirm-private-wav-offline-v1.md` at `90d3910ede732565c12ec1d76c12baaff4cb66c6`.  
Delivery: existing Draft **PR #146** only. **Deployment: NO.** No new PR, merge, base change, cloud access, credential read, or paid service call.

## Evidence

The Node **24.19.0** test starts a real local HTTP server and executes this bounded journey:

1. A synthetic RS256 principal calls protected `/paid-mcp`; the public tool set remains nonbillable and cannot confirm, charge, reserve quota, or request audio inline.
2. The same canonical owner principal opens `/player/pending` and sees the immutable proposal through `sealed:v1` text decryption.
3. An explicit `POST /player/confirm` carries signed session, exact Origin, Fetch Metadata, CSRF, owner handle, and immutable text binding.
4. One `node:sqlite` 004+005 statement claims admission and atomically creates exactly one reservation plus one consumed grant.
5. The injected fake synthesizer is called exactly once with the fixed model and fixture voice. A fixed synthetic WAV is validated and saved through the injected test-only **private** result store.
6. Owner-only `/player/audio` returns `audio/wav` with `private, no-store`; another principal, anonymous access, replay, expiry, and provider uncertainty fail closed without a second provider attempt.

Focused suite: **13 tests, 13 pass, 0 fail, 0 skipped**. It covers the full journey, missing/wrong JWT scope/audience, wrong principal, session/Origin/Fetch Metadata/CSRF/form failures, concurrent double submit, restart/replay, provider error/timeout/bad WAV/private-store failure, quota denial plus next UTC day, stale CSRF/expiry/tampered digest, missing 005/wrong sealed key, atomic trigger refusal, private WAV expiry deletion, deployable-route preservation, explicit test-only guards, and receipt evidence.

Full local suite on Node 24.19.0: **371 tests, 371 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo**. `node test/smoke-server.mjs`, syntax checks, and `git diff --check` also pass.

The deployable `server.js` remains closed to `/player/confirm` for both GET and POST (404); public `/mcp` and the fixed P1 `/player/audio` remain intact. The offline composition requires both `NODE_ENV=test` and the explicit offline test flag, and is never imported by `server.js`.

Strict Voice V1 remains **2/9**. This is not paid qualification, not a human click, and not proof of real Cloudflare D1, real private object storage, real MiniMax, Render, desktop playback, or iPhone audibility.

## Next real blockers (minimum)

1. **Real D1 concurrency/quota rollback qualification with locks**: local SQLite cannot prove the production Cloudflare D1 trigger and transaction behavior in `db/d1/004_paid_voice_confirmation_operations.sql`; the dedicated qualification namespace `234913cd-8901-4607-8147-31c4a4317111` requires separate authorization and must not be touched by this offline package.
2. **Private short-TTL audio backend choice and deployment permission**: `src/p2-private-result-store.js` intentionally accepts only an injected backend; no durable private object store is selected or configured in this repository.
3. **Real fixed 04 model/voice, key, spend cap, and one-call smoke authorization**: `src/v1-p2-offline-confirm-runtime.js` accepts only an injected fake synthesizer and has no reachable real provider path.
4. **Controlled deployment of the player confirm route**: `server.js` deliberately hard-guards the deployable server to `/player/pending` only; enabling `POST /player/confirm` requires an independently authorized deployment and rollback plan.

No MiniMax call, cloud operation, deployment, secret access, real D1 read/write, human browser click, or `audio/wav` device-audibility claim occurred in this package.
