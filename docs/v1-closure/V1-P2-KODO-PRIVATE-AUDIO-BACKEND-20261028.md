# Voice V1 P2 private Kodo audio backend (offline)

Date: 2026-10-28
Status: **COMPLETE** for the bounded offline package only.
Authority: `docs/construction-envelopes/2026-10-28-voice-v1-private-kodo-audio-backend-v1.md` at `285c57bbf9d024dc280adf922fd50ffaf5cf28d5`.
Delivery: existing Draft **PR #146** only. **Deployment: NO.**

## Implemented

`src/p2-kodo-private-audio-backend.js` implements the existing injected private-result backend contract without changing `createP2PrivateResultStore` or `createP2PlayerAudioLoader`.

- The client helper fixes Qiniu Kodo Singapore region `ap-southeast-1`, HTTPS endpoint `https://s3.ap-southeast-1.qiniucs.com`, path-style access, `maxAttempts: 1`, and a caller-bounded request timeout of at most 60 seconds. The AWS SDK performs SigV4; no hand-built signer or public URL exists.
- The bucket, fixed prefix, 32-byte backend key material, clock, timeout and operation cap are server-injected. Unsafe buckets, prefixes, keys and oversized limits fail closed.
- An HMAC-derived opaque object key hides the canonical principal. A separate HKDF domain derives owner tags and AES-256-GCM object keys; no principal, WAV bytes or credential appears in object metadata or logs.
- Metadata, WAV and ciphertext are one authenticated envelope in one `PutObject` request. The same principal maps to one key, so latest-one is an atomic object replacement; an ambiguous PUT is never retried or overwritten.
- Reads verify metadata, owner tag, authenticated AAD, ciphertext, WAV shape, duration and byte bounds before returning audio. Wrong owner, wrong key, tampering, missing metadata and expiry fail closed.
- `deleteExpired` performs bounded real `ListObjectsV2`/`HEAD`/conditional `DELETE` calls with a stable continuation cursor that advances only after a complete page. Expired reads conditionally delete only the exact object version they read. Access TTL and physical-retention policy remain separately visible; no empty cleanup returns a false success.

## Evidence

Focused suite: **18 tests, 18 pass, 0 fail, 0 skipped** on Node 24.19.0. It covers the fixed Kodo endpoint, SDK SigV4 request without network, encrypted latest-one writes, concurrent writes, conditional expiry deletion versus a newer write, owner isolation, wrong keys, ciphertext/tag/metadata/AAD tampering, missing metadata, oversized bodies, expiry deletion, multi-page bounded cleanup, missing configuration, SDK GET/DELETE errors, PUT timeout/ambiguity, repeated-GET egress bounds and a real local HTTP MCP -> owner consent -> one fake provider -> Kodo backend -> owner `/player/audio` journey with restart and replay.

Full Node 24 suite: **389 tests, 389 pass, 0 fail, 0 skipped**. `node test/smoke-server.mjs`, `node --check` and `git diff --check` also pass.

The real AWS SDK is exercised through a non-networking request handler; it captures one `AWS4-HMAC-SHA256` PUT, path-style Kodo path and one-attempt policy. The integration test uses only an in-memory S3 protocol double. `server.js` imports neither this backend nor the paid confirm runtime.

No real Kodo request, bucket, object, credential, Render deploy, D1 operation, MiniMax call, Call change or production nonbillable-staging change occurred. Strict Voice V1 remains **2/9**.

## Remaining real qualification

The only next decision gate is the separately authorized one-bucket Kodo activation in `V1-P2-KODO-REAL-ACTIVATION-GATE-20261028.md`: private Singapore bucket, limited prefix permissions, cost/egress approval, exact-SHA staging injection, one synthetic PUT/GET/DELETE, and rollback. Real 04 voice and paid TTS remain a later independent authorization.
