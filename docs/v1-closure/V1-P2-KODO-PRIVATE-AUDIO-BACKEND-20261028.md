# Voice V1 P2 private Kodo audio backend (offline)

Date: 2026-10-28
Status: **COMPLETE** for the bounded offline package only.
Authority: `docs/construction-envelopes/2026-10-28-voice-v1-private-kodo-audio-backend-v1.md` at `285c57bbf9d024dc280adf922fd50ffaf5cf28d5`.
Delivery: existing Draft **PR #146** only. **Deployment: NO.**

**2026-10-29 superseding update:** the active conditional-delete behavior
described below is retired. The backend now relies only on strict read TTL and
the configured one-day bucket lifecycle for physical removal. See
`V1-P2-KODO-NO-CAS-DELETE-SAFETY-REPAIR-20261029.md`.

## Implemented

`src/p2-kodo-private-audio-backend.js` implements the existing injected private-result backend contract without changing `createP2PrivateResultStore` or `createP2PlayerAudioLoader`.

- The client helper fixes Qiniu Kodo Singapore region `ap-southeast-1`, HTTPS endpoint `https://s3.ap-southeast-1.qiniucs.com`, path-style access, `maxAttempts: 1`, and a caller-bounded request timeout of at most 60 seconds. The AWS SDK performs SigV4; no hand-built signer or public URL exists.
- The bucket, fixed prefix, 32-byte backend key material, clock, timeout and operation cap are server-injected. Unsafe buckets, prefixes, keys and oversized limits fail closed.
- An HMAC-derived opaque object key hides the canonical principal. A separate HKDF domain derives owner tags and AES-256-GCM object keys; no principal, WAV bytes or credential appears in object metadata or logs.
- Metadata, WAV and ciphertext are one authenticated envelope in one `PutObject` request. The same principal maps to one key, so latest-one is an atomic object replacement; an ambiguous PUT is never retried or overwritten.
- Reads verify metadata, owner tag, authenticated AAD, ciphertext, WAV shape, duration and byte bounds before returning audio. Wrong owner, wrong key, tampering, missing metadata and expiry fail closed.
- `deleteExpired` performs no DELETE, HEAD or LIST. It returns `deleted: 0` with `physicalRemoval: "bucket_lifecycle_only"`. Expired reads return `null` without mutating the object, so a concurrent newer PUT remains readable.

## Evidence

Original 2026-10-28 package: focused **18 tests, 18 pass, 0 fail,
0 skipped** and full **389 tests, 389 pass, 0 fail, 0 skipped** on
Node 24.19.0. Those counts are historical; the 2026-10-29 lifecycle-only repair
supersedes the active-delete tests and records its current counts separately.

The real AWS SDK is exercised through a non-networking request handler; it captures one `AWS4-HMAC-SHA256` PUT, path-style Kodo path and one-attempt policy. The integration test uses only an in-memory S3 protocol double. `server.js` imports neither this backend nor the paid confirm runtime.

No real Kodo request, bucket, object, credential, Render deploy, D1 operation, MiniMax call, Call change or production nonbillable-staging change occurred. Strict Voice V1 remains **2/9**.

## Remaining real qualification

The real stale-ETag conditional DELETE remains **BLOCKED** and must not be
retried. Before any first Kodo launch, remove the delete-resource permission
from `ShenShuVoiceKodoPrivateAudio`. The remaining launch qualification is a
separate exact-SHA/credential/cloud/paid-D1 gate plus one explicit MiniMax 04
authorization; Voice V1 remains **2/9**. Real 04 voice and paid TTS remain a
later independent authorization.
