# Voice V1 P2 final owner-confirm staging mount

Date: 2026-10-30. Status: **COMPLETE (offline normal-server mount only)**.
Voice V1 remains **2/9**; paid voice remains **paid OFF**. This is not a
paid-live qualification, not a deployment and not evidence of real human
audibility.

## What was wired

`src/v1-p2-controlled-staging-candidate.js` composes the existing frozen
components into a reusable request handler. `server.js` now imports that module
and `createShenShuRuntimeServer()` mounts it only when every independent gate is
ready:

- protected ChatGPT MCP prepare/status tools on `/paid-mcp`
- owner-only `/player/pending` with the exact sealed text and an explicit
  **确认生成** form
- signed owner session plus strict Origin/Fetch Metadata/CSRF POST
- sealed **D1 004+005** atomic claim and one-use consumed grant
- server-fixed MiniMax `speech-2.8-hd` / exact frozen 04 voice
  `ShenShuCN04Ziran_20261025220130` with one attempt
- Kodo encrypted, owner-only, short-TTL private result
- signed-session `/player/audio` read with replay, unknown and expiry fail closed

The paid handler is routed before the read-only pending page and the fixed P1
player. When the candidate is absent, those older nonbillable paths are
unchanged. No second server, port, model tool or confirmation API was added.

## OFF / ON behavior

- **OFF/default/partial configuration:** the candidate is not injected.
  GET and POST `/player/confirm` both return **404**; public P1-MOCK `/mcp`,
  fixed `/test-tone.wav`, private `/player` P1 WAV and nonbillable read-only
  `/player/pending` remain available. One flag or one key alone cannot charge.
- **ON test-only composition:** the same deployable normal server serves
  authenticated prepare, owner pending, explicit POST, one sealed D1 claim, one
  fake MiniMax request, one private fake-Kodo PUT and owner-only WAV GET.
  GET `/player/confirm` is 405; wrong owner, session, Origin, Fetch Metadata,
  CSRF, SHA, flag, secret, schema, quota or provider outcome fails closed.
- Tests use real local HTTP with `NODE_ENV=test`, local SQLite 001/002/004/005,
  a fake S3 protocol double and a fake MiniMax transport. Node **24.19.0** full
  suite: **415/415 pass, 0 fail, 0 skipped**.

## Safety evidence

- **No real MiniMax**, **No real Kodo**, **No real D1**, **No Render**, **No Call**,
  IAM, deployment or cloud write occurred in this round.
- Program code issues no Kodo **DELETE**, HEAD, LIST, If-Match, public URL or
  presigned URL. Physical removal remains the configured one-day bucket
  **lifecycle** rule; access expires in 60-300 seconds.
- Concurrent double confirm produces one provider attempt and one private PUT.
  Wrong ownership, stale/expired proposals, quota refusal, provider failure,
  bad WAV, ambiguous PUT, failed GET, expiry and tampered ciphertext do not retry
  or issue a second charge.
- Current authority: `8e70d1a7bd987cdb17e9688670dc7cec785e4ce8`.
  Predecessor authority: `29110e145c93be7455e6e1d5ffaec79dca7fc3c7`.
  The final delivery HEAD is the one reported by Draft **PR #146** after push.

## Future controlled-staging enablement (NOT executed)

1. Obtain separate total-control approval for the exact final PR #146 SHA and a
   short staging window. Record the prior known deploy as **rollback** first.
2. Deploy that exact SHA manually. Keep the branch and `autoDeploy=no`; do not
   use a generic deploy that could select an older branch. Verify Node 24 and
   `RENDER_GIT_COMMIT` equals the approved SHA.
3. Bring the new code up with all paid flags OFF. Verify P1-MOCK, OAuth, fixed
   tone, private P1 player and read-only pending first. GET/POST
   `/player/confirm` must still be 404.
4. Reuse the already recorded real D1 004+005 and Kodo private PUT/GET
   qualification PASS. Do not rerun it. Confirm the qualification database scope
   and Kodo IAM without DELETE; keep the one-day lifecycle rule.
5. Separately authorize **exactly one** real 04 MiniMax call. Keep the model
   `speech-2.8-hd` and exact frozen voice `ShenShuCN04Ziran_20261025220130`
   server-side fixed; no caller-selected voice, retry, refund or automatic
   background smoke. State the spend cap and unknown-outcome handling.
6. Only after the one-call approval, enable all four flags together:
   `SHENSHU_STAGING_FINAL_WIRING_ENABLED`,
   `SHENSHU_STAGING_PAID_CONFIRM_ENABLED`,
   `SHENSHU_STAGING_REAL_PROVIDER_ENABLED`,
   `SHENSHU_STAGING_PRIVATE_AUDIO_ENABLED`.
   The owner then opens `/player/pending`, reads the exact text and personally
   presses **确认生成** once. Verify one provider attempt, one private PUT,
   owner-only WAV, desktop and physical iPhone audibility.
7. On any mismatch, turn all paid flags OFF and roll back to the prior known
   deploy. Do not relax SHA, identity, D1, Kodo, CSRF or provider controls.

## Remaining real gate

The only next action is a separately approved controlled staging deploy of the
exact PR SHA with paid OFF, followed by a separately approved one-call 04 smoke
and owner desktop/iPhone audible acceptance. Offline PASS does not establish
real cloud timing, real synthesis quality or human audibility, so Voice V1
stays **2/9**. This is not a paid-live qualification.
