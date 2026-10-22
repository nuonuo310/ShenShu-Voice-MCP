# Voice V1 closure S1/S2 — offline implementation evidence (2026-10-23)

Status: **OFFLINE IMPLEMENTATION COMPLETE. STRICT V1 REMAINS 2/9.**
This report is implementation/test evidence, not staging or production proof.

## Authority and baseline

- Authority branch: `docs/voice-v1-closure-control-20261022`
- Authority commit: `a37b653bbaabc2de8c135da92acf7fe3b53258ff`
- Authority files: `docs/v1-closure/V1-CLOSURE-PLAN.md` and
  `docs/construction-envelopes/2026-10-22-voice-v1-closure-s1-s2.md`
- Task branch: `work/voice-v1-closure-s1-s2-20261023`
- Base commit: `a37b653bbaabc2de8c135da92acf7fe3b53258ff`
- Implementation commit: `3052e9dc33a524d50dc7ab3975a09ab1cdf1882a`
- Verified `origin/main`: `1cef5ada7f6af0b912b7d5bba2c42f4f776bb828`
- Opening worktree: `ShenShu-Voice-First-Audition`, clean, HEAD
  `3552ec2ee418cc2654968e5630f1790f98f2ccdb` on
  `work/first-audition-staging-isolation-v7`, no conflicting local worktree.

Open PR topology was re-read before changes. #68 → #81 is a stacked Draft chain;
#82, #83, #84 and authority #85 are side Drafts stacked on #81. #85 head is the
authority commit above. No predecessor PR was merged, rebased or rewritten.

## Changed files

- `ui/mcp-bubble.html`
- `src/v1-offline-paid-pipeline.js` (new, unmounted)
- `test/generated-web-audio-host-bridge.test.js`
- `test/protected-probe-v5.test.js`
- `test/generated-host-delivery-v4.test.js`
- `test/v1-offline-paid-pipeline.test.js` (new)

No change was made to `server.js`, tool registration, OAuth/JWKS/audience,
`db/`, workflows, Render/Auth0 configuration or the V1 DONE LINE.

## S1 — iPhone silent-output diagnosis

### Findings

- Desktop generated-shape playback is user-confirmed audible (PR #82).
- Current iPhone generated-shape and older fixed-bridge Web Audio paths are both
  user-confirmed silent (PR #83).
- The historical iPhone fixed-bridge Web Audio route was user-confirmed audible
  on `e498e57`. Its playback code is materially unchanged through the v7
  baseline. This turn did not establish a code-level regression and does not
  claim a root cause.
- The two current paths share Web Audio output. The bounded diagnostic now
  separates: iOS host detection, click gesture, `AudioContext.state`, resume
  result, decode duration/format, source start and ended state.

### Bounded implementation

- Added a nonsecret `s1-20261023` diagnostic line to the shared bubble.
- Added real generated-audio progress from `AudioContext.currentTime` instead
  of the paused HTML media element's `currentTime`.
- Preserved the direct-click gesture and desktop path.
- Added fail-closed handling when a context remains `suspended`/`interrupted`
  after resume. Such a state cannot be reported as a started/playing success.
- No autoplay, Blob fallback, public URL, OAuth change or server change.

### Evidence level

- Offline fake-iOS harness: PASS for suspended/resumed context, interrupted
  context, resume rejection, source-start error, stale result, duplicate click,
  decode failure/duration bounds and both bridge paths.
- Device audibility: **NOT VERIFIED**. iPhone remains SILENT until a separately
  approved staging deploy and one user-observed listening check.
- B1 remains open. No audible PASS is inferred from mocks, progress or context
  state.

### One-session iPhone check after separate approval

1. Deploy the exact approved commit to staging; do not touch production.
2. Open the existing staging connector once and confirm the diagnostic shows
   `s1-20261023` and the injected host build marker.
3. Deliver one NONBILLABLE generated-shape WAV. Click play once. Record audible
   yes/no, the complete diagnostic line and any error text.
4. If still silent, click the older fixed-bridge WAV once. Record the same
   fields. Do not repeat taps blindly.
5. Stop after one pass per path and return the observations for total control.

## S2 — offline paid-chain integration

### Implementation

`createV1OfflinePaidPipeline` composes, in order:

1. cryptographically verified OAuth principal from a trusted server request;
2. atomic per-principal UTC-day reservation through the reviewed store contract;
3. server-generated one-use grant, issued and consumed before provider access;
4. exactly one injected fake-provider attempt;
5. strict WAV validation and a private base64 record with no public URL.

The input accepts only `trustedRequest` and `text`. Client-supplied principal,
approval, one-time flag, grant, request ID, model, voice or any other field is
rejected before admission. The model is fixed to `speech-2.8-hd`; the voice is
deployment-supplied and never accepted from the caller or returned in output.
The request ID and text digest are bound server-side. An uncertain upstream
outcome fails closed with no retry and no refund path.

### Evidence level

- Real signed-JWT identity fixture + in-memory durable-store model: PASS.
- Reviewed `createD1HttpPaidStore` contract with an injected fake D1 client:
  PASS. No real D1 endpoint or credential was accessed.
- Concurrency/single-slot, daily limit, new UTC day, request replay, grant
  issue/consume mismatch, unknown upstream, invalid/oversized WAV, caller-field
  rejection, secret non-exposure and public MOCK isolation: PASS offline.
- Fake-provider attempt count on success: exactly 1.
- Real D1/cloud behavior: **NOT EXERCISED**.
- Real MiniMax/provider behavior: **NOT EXERCISED**.

This completes the offline implementation portion of S2. It does not close B2
or B3 at the V1 proof level; S3 real-D1 qualification remains mandatory.

## Verification

- `node --test`: 245/245 PASS.
- S1 iPhone diagnostic suite: 9/9 PASS.
- S1 protected/fixed-bridge suite: 13/13 PASS.
- S2 offline pipeline suite: 13/13 PASS.
- JS syntax checks for changed modules/tests: PASS.
- Extracted UI module syntax check: PASS.
- `git diff --check`: PASS.
- GitHub Actions: not yet run at recording time; PR CI is the next check.

## V1 status update

- Strict V1 gates: **2/9 unchanged** (Gates 1 and 8 only).
- B1: open. Offline diagnostics are complete; device audibility remains
  unverified.
- B2/B3: offline implementation portion covered by S2; real D1, private-cloud
  delivery and independent qualification remain open.
- B4: open; no real MiniMax call was made.
- S1: offline diagnostic/fix candidate complete; separately approved staging
  deployment + one iPhone manual check remain.
- S2: offline integration complete; no real D1 activation.
- S3: next, separately authorized real-D1 paid-namespace qualification.
- S4: later, exactly one separately approved billable MiniMax E2E smoke.

## Real-operation counters (this turn)

- MiniMax calls: 0
- Billable provider attempts: 0
- Real D1 reads/writes/migrations: 0
- Real keys/voice IDs read or logged: 0
- Deployments / Render / Auth0 / connector refresh: 0
- GitHub Actions dispatches: 0
- Merges: 0
