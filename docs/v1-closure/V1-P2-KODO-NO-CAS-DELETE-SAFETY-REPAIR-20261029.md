# Voice V1 P2 Kodo no-CAS delete safety repair (offline)

Date: 2026-10-29
Status: **COMPLETE** for the bounded offline repair only. **Paid OFF.**
Authority: `docs/construction-envelopes/2026-10-29-voice-v1-kodo-no-cas-delete-safety-repair-v1.md`
at `630db63ed534956187869011328a247e6fd10390`.
Delivery: existing Draft **PR #146** only. No new PR, merge or deployment.

## Decision

**REAL_KODO_CONDITIONAL_DELETE_BLOCKED.** The one consumed live trial accepted
a stale-ETag `DELETE`; this is not evidence that Kodo supports trustworthy
conditional deletion. The app no longer relies on it. Voice V1 remains **2/9**
and paid remains OFF. Do not rerun the consumed qualification, delete its lock,
or issue another real Kodo request.

## Implemented

- `putLatest` preserves AES-256-GCM envelope encryption, HMAC owner-derived
  opaque keys, owner-only metadata verification and one non-retried PUT.
- `getLatest` preserves strict owner/key/metadata/WAV validation and returns
  `null` when `expiresAt <= now` without calling any delete command.
- `deleteExpired` delegates physical removal to the configured one-day bucket
  lifecycle. It returns `deleted: 0` and
  `physicalRemoval: "bucket_lifecycle_only"`; it never enumerates, HEADs or
  mutates an object and never claims synchronous physical cleanup.
- No reachable `DeleteObjectCommand`, `HeadObjectCommand`,
  `ListObjectsV2Command` or `IfMatch` remains in the Kodo backend. The AWS SDK
  is retained only for bounded PUT/GET.
- Access TTL (60-300 seconds, hard maximum 900) is separate from physical
  retention (bucket lifecycle, not an exact 24-hour guarantee).

## Evidence

- Node **24.19.0**, focused Kodo suite: **19 tests / 19 pass / 0 fail /
  0 skipped**. Covers expired reads with interleaved newer PUT, owner
  isolation, wrong keys, tampered ciphertext/metadata/WAV, short TTL, latest
  one, restart, PUT timeout/no retry, authentication failure, no plaintext or
  URL leakage, and zero DELETE/HEAD/LIST commands.
- Local full Node 24 suite: **390 tests / 390 pass / 0 fail / 0 skipped**.
  `node test/smoke-server.mjs`, syntax checks and `git diff --check` pass.
  The final GitHub CI result is reported in the delivery receipt.
- Real Kodo API calls, real AK/SK, Qiniu account/IAM changes, Render, D1 and
  MiniMax calls in this repair: **0**.

## Remaining launch gate

The only immediate user action before any first Kodo launch is to remove the
delete-resource permission from the child-user policy
`ShenShuVoiceKodoPrivateAudio`. Formal launch still requires a separate
exact-SHA, credential, cloud-enable and paid-D1 gate plus one explicit
MiniMax 04 authorization. Offline PASS is not paid-live qualification.
