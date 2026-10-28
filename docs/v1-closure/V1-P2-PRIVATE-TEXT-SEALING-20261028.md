# Voice V1 P2 提案原文私有密封（2026-10-28）

**RECEIPT: COMPLETE for the bounded offline implementation.** Deployment,
cloud schema changes, real credentials and paid calls are **NO**. Voice V1
remains 2/9.

Authority: PR #146, commit `a3e8a56e997312835be7b5dfb86c41589842e6a3`, file
`docs/construction-envelopes/2026-10-28-voice-v1-private-text-sealing-v1.md`.
Fixed base: `docs/voice-v1-p2-d1-confirm-qualification-20261027` at
`8c3ede3e3f3e2ef4d8387436019d3dd3d2a4a22d`.

## Delivered

- `005_paid_voice_confirmation_private_text_sealing.sql` is additive: one
  nullable `sealed_text TEXT` column. 004 constraints, indexes and the
  single-statement atomic admission trigger are untouched.
- Sealed rows store the fixed marker `sealed:v1` in 004 `text`, the complete
  versioned authenticated ciphertext envelope in `sealed_text`, and a keyed
  HMAC in `text_digest` instead of the public bare SHA-256 text digest.
- The codec uses Node-native AES-256-GCM, random 96-bit nonces, 128-bit tags,
  a 32-byte synthetic-only test master key, and independent HKDF-derived AEAD
  and HMAC keys. AAD binds principal, handle, operation ID, action, origin,
  text byte count, expiry, key ID, version and purpose.
- The existing D1 operation adapter maps `createPending/get/listPending/claim`
  through the codec. Claim still performs one atomic 004 UPDATE after sealed
  row verification, so reservation, grant issue/consume and rollback semantics
  are preserved.
- The staging-only composition candidate defaults off. It requires the exact
  staging identity, explicit flags, a valid 32-byte secret, a D1 client and a
  005 schema preflight. A flag alone returns no closure and never falls back to
  plaintext or an in-memory map.
- Protected MCP prepare/status, owner-only read-only `/player/pending`, the P1
  fixed WAV and public MOCK remain unchanged. `/player/confirm` remains 404.

## Fail-Closed Evidence

- Round trip is proven for Unicode and exactly 800 UTF-8 bytes.
- The database and envelope contain no proposal plaintext or public SHA-256
  text digest; `text_digest` is a context-bound keyed HMAC.
- Missing/wrong keys, wrong key ID/version/algorithm/purpose, malformed
  envelopes, nonce/ciphertext/tag/AAD tampering, swapped owner/handle/operation
  and changed byte/expiry metadata are rejected.
- Sealed mode rejects legacy unsealed rows instead of returning historical
  plaintext. Existing 004 rows are not overwritten, deleted or re-encrypted.
- Expired rows do not appear in the pending list and cannot claim a slot.
- Real D1/Cloudflare SQL, Render/Auth0/R2/Qiniu changes, deployments, real key
  creation/read/copy, provider calls and paid writes: **0**.

## Verification

- Runtime: Node `v24.19.0`.
- Full suite: **347 tests, 347 pass, 0 fail, 0 skipped, 0 todo**.
- `node test/smoke-server.mjs`: PASS.
- Required `node --check` and `git diff --check`: PASS.
- Implementation head `db484cdbb14ca8ab520e4e42939c34d7dd7ce1f2`, normal
  `pull_request` CI run `40734163477`: **success**.

## Retention And Remaining Gates

No destructive cleanup is added. Historical 004 plaintext and expired sealed
ciphertext remain for an independent data-retention decision; approved billing
receipts are not deleted. Enabling the sealed path still requires separate
human authorization for a real staging 32-byte secret, the 005 migration and a
deployment. This receipt does not claim staging availability, real D1 proof or
audio/provider qualification.
