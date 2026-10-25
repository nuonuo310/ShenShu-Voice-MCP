# Voice V1 S1 — iPhone private fixture media-code-4 bounded fix (2026-10-25)

Authority: ShenShu total control. This is a single bounded S1 repair task, not permission to deploy or call providers. V1 remains 2/9; B1 remains OPEN until device audibility.

## Opening gate
Repository nuonuo310/ShenShu-Voice-MCP. Base exactly `878f4e863d7f32484dc5b03ddae1cfed8937b39a` (PR #86 S1/S2 head and current Render staging deployed commit). Verify origin, branch, clean isolated worktree, PR dependencies, current CI and source identity. Do not reset/stash/clean/rebase existing worktrees. Review `docs/v1-closure/V1-CLOSURE-PLAN.md`, `docs/v1-closure/S1-S2-IMPLEMENTATION-EVIDENCE.md`, `ui/mcp-bubble.html`, `src/staging-authenticated-mcp.js`, `src/private-fixture-delivery.js`, `src/inline-fixture.js`, and existing generated/bridge UI tests.

## New real-device observation
User on iPhone ChatGPT opened ShenShu Voice Staging, was prompted to reauthenticate at Auth0, successfully invoked `preview_private_fixture` exactly once. Player appeared but play failed: `NotSupportedError`, HTMLMediaElement error code 4, readyState 0, duration 0:00. Diagnostic displayed `s1-20261023`, `UI v6-host-smoke-20261021`, iOS host, path none, gesture none, context not-created, resume not-called, decode not-started, source not-started, ended no. Do not mistake this HTMLAudioElement private fixture failure for generated Web Audio output failure. No second tap or diagnostic button was used. Do not assume an old UI from marker alone. OAuth success is not proof of playable media.

## Task
1. Trace exact `preview_private_fixture` structured record and `applyResponse` -> `inlineAudioUrl` -> `audio.src`/`audio.load` -> click `audio.play` path. Establish whether WAV bytes, data URL MIME, base64, record shape, host CSP or iOS HTMLMediaElement support are implicated. Distinguish proven code facts from hypotheses. Inspect existing fixture encoding and validation; no live requests.
2. Implement the smallest safe, dormant/isolated UI-side correction supported by evidence. Prefer robust validated audio loading or a bounded alternate click-gesture playback path only if tests prove it does not introduce autoplay, public URLs, repeated tool calls, leaked audio, duplicate play, or bypass protected tool authentication. Do not add a new transport, billing subsystem or broad compatibility framework. If root cause cannot be bounded offline, STOP with TOTAL CONTROL DECISION REQUIRED rather than speculative rewrites.
3. Add focused regression tests for iOS HTMLMediaElement code 4/readyState 0 and whichever fallback or error-state behavior is selected; assert a genuine audible PASS is never inferred from UI/progress and that the tool remains one-call/nonbillable. Distinguish private fixture from generated-shape WAV; do not close B1 based on synthetic tests.
4. Prepare one exact staging-only deployment candidate (commit/hash, changed files, UI marker, rollback commit `878f4e863d7f32484dc5b03ddae1cfed8937b39a`) and a one-session iPhone acceptance: one `preview_private_fixture`, one play, record audible yes/no and error; no blind retries. Deployment and iPhone call are separately authorized later, NOT in this package.

## Prohibitions
No Render deployment or environment change, production main, Cloudflare/D1, Auth0 config/token changes, MiniMax/provider, real secrets, route enablement, manual Actions dispatch, merge, Asteria-Call/Worker/Gallery edits, or extra live connector invocations. No general new test sprint.

## Deliverable
On an isolated branch from the exact authority commit, produce minimal code/test changes only if justified and `docs/v1-closure/S1-IOS-MEDIA4-BOUNDED-FIX-20261025.md`. Run relevant focused suites and full Node 24 test suite with 0 skips, smoke, syntax, diff check and normal PR CI. Open one Draft PR stacked on this authority branch. Report COMPLETE/BLOCKED/TOTAL CONTROL DECISION REQUIRED, exact HEAD/PR/CI, proposed deployment artifact, unproven iPhone audibility, real cloud/provider counters zero, V1 2/9. Stop.
