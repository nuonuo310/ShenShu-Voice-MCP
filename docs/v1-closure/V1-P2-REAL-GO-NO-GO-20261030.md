# Voice V1 P2 real go/no-go card - 2026-10-30

**Status: COMPLETE (offline hardening only). BLOCKED FOR REAL CLOUD
QUALIFICATION. Voice V1 remains 2/9 and paid voice remains paid OFF.**
This card is not a deployment, a paid-live qualification or a claim of
desktop/iPhone audibility. Authority: Draft **PR #146**; scope authority
`142f109cefeeb3c0082fd0f8c27117a1429eb5a5`. The exact delivery HEAD is the
final PR #146 head containing this file, reported by the final receipt and CI.

## 1. Real versus offline evidence

Real evidence already available: staging Auth0 login returned authenticated,
paid OFF; the Render live deploy remains `e452337d7579e4ad7504a0e520b08a846cd60f04`
(`dep-dbhod0flk1mc73d9aa9g`), manually pinned, autoDeploy=no. That live service
still reports **Node 26.13.0**, not Node 24.

Offline evidence in this round: Node **24.19.0** `npm ci` tree, full test suite,
local HTTP smoke, local SQLite 004+005 semantics and a fake S3 protocol double.
No real D1/Kodo/MiniMax/Render environment mutation or Call operation occurred.

## 2. Node and dependency decision

- `package.json` is bounded to Node `>=24 <25`; `package-lock.json` is tracked
  and CI installs it with `npm ci --ignore-scripts --no-audit --no-fund`.
- Fresh Node24 production-tree audit result: **0 vulnerabilities**.
- The concrete reproducible advisory was **zod** `GHSA-mrhx-c7xc-m3w5`
  (memory exhaustion while validating oversized constrained collections,
  CVSS 7.5, range `<4.6.6`). It is fixed by direct upgrade to `zod 4.6.7`;
  all 400 existing tests pass on that version.
- Render's historical build showed two highs. That old count is not treated as
  current evidence: the current locked tree reproduces one named high before
  the fix and zero afterwards. The second historical advisory cannot be
  independently attributed from the available build log, so no claim is made
  that it was separately reproduced or fixed.
- Render will adopt Node 24 and this lockfile only after a future, explicitly
  authorized deploy of the exact final SHA. A live Node 26 SHA is unchanged by
  this PR.

## 3. Deployment identity and accidental-payment block

- Production/non-test deployment identity comes only from the platform-provided
  **RENDER_GIT_COMMIT**. Missing or wrong commit returns
  `render_git_commit_required` / `render_git_commit_mismatch`.
- **SHENSHU_STAGING_RUNTIME_SHA** is a legacy operator-writable value and is
  never consulted as a deployment identity. Setting it equal to the approved
  SHA cannot enable a candidate.
- Only a `NODE_ENV=test` fixture may pass an explicit `currentSha` argument.
  Supplying that argument outside test mode returns
  `test_sha_injection_forbidden`. Static test JWKS is forbidden outside tests.
- Any failure makes `createV1P2ControlledStagingCandidate()` return `null`;
  it never falls back to an unprotected paid path. `server.js` still does not
  import the candidate, and `/player/confirm` remains 404.

## 4. Next real qualification: two bounded lanes

### Lane A - D1 004+005 and Kodo private audio (no provider charge)

Authorize one short staging window only for the qualification database
`234913cd-8901-4607-8147-31c4a4317111`. Never use
`c39a6895-7028-4f59-a100-1455b92c96c1`; never rerun migration 004 or 005.
Use a new synthetic run id and synthetic principals. Preflight and postflight
are read-only. Hard D1 budget: 4 operation rows, 5 claim attempts, 12 writes,
3 reservations, 3 grants, 0 provider calls, 0 retries, 0 deletes, 15 minutes.
Required evidence: one concurrent claim wins, replay adds no admission, quota
denial leaves zero new reservation/grant, another owner is isolated, and an
unknown outcome is terminal with no refund or retry.

For Kodo, use only private bucket `shenshu-voice-v1-sg-20261029`, region
`ap-southeast-1`, prefix `shenshu/voice-v1/private-audio/`, one new synthetic
owner and one object. Hard budget: **1 PUT / 3 GET**, at most 256 KiB PUT,
768 KiB total GET, 4 object requests, one bucket, 0 provider calls, 0 retries,
15 minutes. Owner GET must return matching private WAV; foreign owner must
return no audio; expired owner read must return `null`. **0 DELETE, HEAD, LIST,
presign or public URL.** Physical removal remains the configured one-day
bucket lifecycle; access TTL is 60-300 seconds. Source-station egress may be
billable and has no approved hard billing cap, so the user must accept the
possible cost before this lane starts.

### Lane B - exactly one 04 MiniMax smoke (separate charge approval)

Only after Lane A passes: authorize exactly one real MiniMax request with fixed
model `speech-2.8-hd` and the already approved 04 voice/server voice ID, text
at most 800 UTF-8 bytes, one provider attempt, no retry, WAV at most 60 seconds
and 2 MiB, owner-only private playback, and explicit desktop + iPhone audible
acceptance. The approval must state the spend cap and the handling of a
successful, failed or unknown billing outcome. Do not mix debugging attempts
into this one smoke.

## 5. Exact deploy and rollback gate

Any future staging deploy must pin the exact final PR #146 SHA, keep the branch
and autoDeploy=no, and prove from logs that `RENDER_GIT_COMMIT` equals that SHA
and that Node 24 is actually running. Keep all four paid flags OFF until Lane A
and Lane B approvals are complete. Rollback is: set the paid flags OFF, select
the prior known deploy `dep-dbh476ek1f9s738lr0l0`
(`f5e91ce59c1b7e642ed14b02878d05420cd2f53e`) or the current live
`e452337d7579e4ad7504a0e520b08a846cd60f04`, and do not change environment
variables without the controlled window. Production, Call and MiniMax must not
be touched by rollback.

**Minimal next authorization:** approve one no-provider cloud window for the
bounded D1+Kodo lane above, including the exact final SHA and a D1 token scoped
only to the qualification database. Lane B remains a separate one-call 04
approval. Offline PASS does not raise Voice V1 above **2/9**.
