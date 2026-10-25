# Voice V1 S1 - iPhone private fixture media-code-4 bounded fix (2026-10-25)

**STATUS: COMPLETE FOR THE AUTHORIZED OFFLINE BOUNDED-FIX SCOPE.
IPHONE AUDIBILITY NOT YET VERIFIED. B1 REMAINS OPEN. V1 REMAINS 2/9.**

This report traces the failing private-fixture playback path, records the
smallest evidence-supported UI correction, and prepares one staging-only
deployment candidate. It does not deploy, alter Render or Auth0, call D1 or
MiniMax, invoke a live MCP tool, or claim device audibility.

## Opening gate and authority

- Repository: `nuonuo310/ShenShu-Voice-MCP`.
- Origin: `https://github.com/nuonuo310/ShenShu-Voice-MCP.git`.
- Authority PR: #125, open Draft, unmerged, mergeable `clean`.
- Authority commit: `791182dcbc2571f53cb19a0d04b45ec18cf0756e`.
- Authority tree: `9caa27d3e726902d843ff3d22c92645d5e723d64`.
- Authority document:
  `docs/construction-envelopes/2026-10-25-voice-v1-s1-ios-media4-bounded-fix.md`,
  blob `73bc2c5ed71b4c0f1d70e3d1e74e93bd5aca1844`.
- Authority parent: `878f4e863d7f32484dc5b03ddae1cfed8937b39a`, exactly the
  supplied staging deployment baseline and PR #86 S1/S2 head.
- Authority CI: run `40215290478`, event `pull_request`, result `success`.
- Task branch: `codex/voice-v1-s1-ios-media4-fix-20261025`.
- Task worktree:
  `C:\Users\Administrator\.codex\worktrees\voice-v1-s1-ios-media4-fix-20261025\ShenShu-Voice-MCP`.

The task worktree was created from the exact authority commit without reset,
clean, stash, rebase or history rewrite. Existing worktrees remained untouched.
PR #125 is an independent side Draft based on the S1/S2 staging branch, not part
of the earlier #118-#124 evidence-documentation stack. No predecessor was merged
or treated as deployment proof.

## Device observation and evidence level

The user opened ShenShu Voice Staging on iPhone ChatGPT, completed Auth0
reauthentication, and invoked `preview_private_fixture` exactly once. The player
appeared, but play failed with `NotSupportedError`, HTMLMediaElement error code
4 and `readyState` 0. The UI reported duration `0:00` and diagnostic version
`s1-20261023`, host marker `v6-host-smoke-20261021`, iOS host, `path none`,
`gesture none`, context not created, no resume, no decode and no source start.

This is a user-reported real-device observation, not an independently captured
console trace. OAuth success proves admission, not media playability. The
failed path is an HTMLAudioElement private-fixture path, not the generated
Web Audio path.

## Exact pre-fix path

1. `makeStagingMcpServer()` registers `preview_private_fixture` only when the
   private-fixture flag is enabled.
2. The tool calls `preparePrivateFixtureAudio()`, which authenticates the caller,
   loads `makeInlineToneFixture()` bytes and validates a 0.7-second, 16 kHz,
   mono, 16-bit PCM RIFF/WAVE file.
3. The server returns `structuredContent.record` with `source:"private-fixture"`,
   `generated:false`, `audioMimeType:"audio/wav"`, `audioBase64`, no `audioUrl`
   and no provider invocation.
4. The MCP Apps notification reaches the UI `message` listener and
   `applyResponse()`.
5. Before this fix, the private-fixture branch called `inlineAudioUrl()`, which
   converted the complete base64 payload to `data:audio/wav;base64,...`.
6. The UI then assigned that data URL to `audio.src`, called `audio.load()` and
   enabled the play button. A later click called `audio.play()`.
7. On the observed iPhone runtime, the media element transitioned to the error
   state before metadata became available: code 4, `readyState` 0.

### Proven facts vs hypotheses

Proven from source and fixtures:

- The server WAV is a complete, bounded PCM file and the same generator has been
  used by the fixed OAuth bridge and hosted controls.
- The failing private-fixture record contains valid base64 WAV bytes and no
  network URL.
- Before the fix, only the private-fixture path used `audio.src` plus
  `audio.load()` plus `audio.play()` for MCP Apps inline delivery.
- The generated record and the historical fixed OAuth bridge use a click-gated
  `AudioContext`/`decodeAudioData()` path with no media URL.
- The historical fixed-bridge Web Audio path was user-confirmed audible on
  native iPhone ChatGPT at commit `e498e57`.

Not proven:

- Whether the immediate cause is iOS HTMLMediaElement data-URL support, MCP Apps
  CSP `media-src`, an iframe sandbox rule, MIME handling, or another host policy.
- Whether the current host runtime has the same behavior as the historical
  `e498e57` observation.
- Whether the same decoded PCM will be audible after the new staging deployment.

The best-supported bounded correction is therefore not a data-URL tweak. It is
to bypass the failing media element for this one source and reuse the already
reviewed, click-gated Web Audio path that consumes the exact same validated WAV
bytes. No root-cause claim beyond that behavior is made.

## Bounded implementation

Changed files:

- `ui/mcp-bubble.html`
- `test/generated-audio-playback-contract.test.js`
- `test/generated-web-audio-host-bridge.test.js`

The private-fixture branch now:

- validates source, `generated:false`, absence of `audioUrl`, MIME, bounded
  canonical base64, RIFF/WAVE length, one PCM format chunk and one data chunk;
- derives the exact WAV bytes and duration without trusting the record duration;
- stores those bytes only in memory and never assigns `audio.src`, calls
  `audio.load()` or calls `audio.play()` for this source;
- enables play only after successful validation;
- creates/resumes `AudioContext` synchronously from the explicit click, decodes
  the copied bytes and starts one buffer source;
- fails closed on unavailable/interrupted context, decode failure, invalid
  decoded duration, stale result, duplicate start or malformed input;
- performs no tool call on playback click and introduces no URL, fetch, provider,
  D1, token, secret or route.

The generated-shape path uses the same state machine after its stricter
nonbillable markers are checked. Legacy `tone-fixture` remains on its existing
HTMLAudioElement path so unrelated public playback behavior is not expanded.
The new nonsecret diagnostic marker is `s1-ios-media4-20261026`; the existing
host-injected resource marker remains `v6-host-smoke-20261021`. A staging
acceptance must show both.

The pre-fix failure can no longer be selected by source because a malformed or
unsupported record disables play and a programmatic click with no accepted
record returns without touching the media element.

## Regression evidence

Node runtime: `v24.19.0`; npm `11.17.0`.

- Focused transport/UI/protected suite: **37/37 PASS**, 0 failed, 0 skipped.
- Full `node --test --test-reporter=tap`: **248/248 PASS**, 0 failed, 0 skipped,
  0 cancelled, 0 todo.
- `node test/smoke-server.mjs`: PASS for MCP initialize, fixture tools/list and
  calls, protected metadata and fail-closed paid entry.
- `node --check` on `server.js`, `src/staging-authenticated-mcp.js` and the
  extracted UI module: PASS.
- `git diff --check`: PASS.
- No dependency lockfile is retained; the repository intentionally has none.

New focused assertions cover:

- an iOS media element already in code 4 / readyState 0 does not block the new
  private-fixture Web Audio path;
- no `audio.src`, `load` or `play` call occurs for the private fixture;
- no `tools/call` occurs on playback click;
- exact fixture bytes reach `decodeAudioData()` and exactly one source starts;
- URL-bearing, generated, wrong-MIME, malformed and oversized records fail
  closed without playback;
- duplicate clicks start one source and a later click stops it;
- diagnostics never contain base64 and never infer audible success.

These are offline harness results. They do not prove iPhone audibility.

## Staging deployment candidate

This is a candidate, not authorization to deploy.

- Branch: `codex/voice-v1-s1-ios-media4-fix-20261025`
- Base and rollback commit: `878f4e863d7f32484dc5b03ddae1cfed8937b39a`
- Scope: UI private-fixture playback routing and focused tests only
- UI diagnostic marker: `s1-ios-media4-20261026`
- Host UI marker expected unchanged: `v6-host-smoke-20261021`
- Target: staging service only after separate total-control approval
- Production/Render environment/Auth0/route/Worker/D1: no change

The exact candidate commit, tree, Draft PR and standard CI run are recorded in
the PR body after commit. Deployment is not part of this task.

## One-session iPhone acceptance

After a separate staging-only deployment authorization:

1. Confirm the deployed commit equals the approved candidate and the rollback
   target remains `878f4e863d7f32484dc5b03ddae1cfed8937b39a`.
2. Open the existing staging connector once and confirm markers
   `s1-ios-media4-20261026` and `v6-host-smoke-20261021`.
3. Invoke `preview_private_fixture` exactly once. Confirm the player is enabled,
   no media-code-4 message appears and the diagnostic reads
   `path web-audio-private-fixture-ready`.
4. Tap play exactly once. Record audible yes/no and the complete emitted
   diagnostic: path, gesture, context, resume, decode, source and ended.
5. On audible success, record it as private-fixture device evidence only. Do not
   close B1, which requires the V1 generated/bridged audio path, and do not infer
   MiniMax, D1, private delivery or paid execution.
6. On silence or failure, record the complete line and stop. Do not retry, use a
   diagnostic button, open another chat or redeploy in the same acceptance.

## Remaining limitations and counters

- iPhone audibility of the fix: **UNPROVEN**.
- Definitive iOS/CSP/root-cause attribution: **UNPROVEN**.
- Generated-shape V1 audio on iPhone: **UNPROVEN**; B1 remains open.
- B1-B4 remain open. Strict V1 remains **2/9**.

Real-operation counters for this task:

- Deployments or Render environment/Auth0 changes: 0
- Cloudflare, Worker, route or D1 requests/changes: 0
- Real secrets, tokens, HMAC keys or provider credentials read: 0
- MiniMax/provider calls: 0
- Live MCP/connector invocations: 0
- Manual GitHub Actions dispatches or merges: 0
- Asteria-Call/Worker/Gallery edits: 0

**COMPLETE for the authorized offline bounded fix. Staging deployment and one
iPhone acceptance require separate total-control approval.**
