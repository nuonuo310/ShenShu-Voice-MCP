# Voice V1 — host audio capability/privacy STOP gate (2026-10-26)

Authority: ShenShu total control. Exact parent PR #130 HEAD `1222b4e6cd1b4ab827924cdf6023f8f8cebb8c1e`. Strict Voice V1 2/9; B1-B4 OPEN. This is ONE offline STOP-gate implementation/readiness package, not live probe authorization.

## Context
Rank A private Web Audio was twice silent on iPhone, including with speaker/output confirmed normal. Public hosted HTTPS WAV was audible only after restoring speaker. Rank B authenticated HTTPS media transport is blocked; do not implement public/permanent audio, bearer URL capabilities, unverified cookies, or Blob assumptions. PR #130 found SDK `@modelcontextprotocol/ext-apps` 1.7.5 types for `hostCapabilities.message.audio` and `ui/message`, but public spec differs and ChatGPT iPhone actual support and privacy/persistence are unknown. Sending private generated audio as a chat message is NOT authorized.

## Single mission
Read the exact source and PR #130 feasibility report. Establish whether `ui/initialize` response can be *safely inspected locally* for hostCapabilities.message.audio and nonsecret boolean UI diagnostics without sending any audio or changing server behavior. Implement at most a tiny dormant, nonsecret capability-readiness diagnostic in the already authenticated staging-only UI, guarded so it does not call `ui/message` and cannot expose principal/token/host metadata. Only if code proves safe and useful. Do not add audio message send functionality. If no safe minimal change, deliver decision-only and STOP.

Produce a precise device acceptance plan for a *future* separately approved fixed synthetic-tone probe: first read capability boolean, stop if absent; require independent privacy/persistence authorization before any `ui/message` audio send. Define how to detect whether the audio becomes a user chat message or enters model context; if unverifiable, STOP and prefer explicit V1 entrypoint reassessment instead of new transport. One device session maximum, no retries.

If host audio cannot be proven without private/persistence risk, prepare a clear binary total-control choice: (a) keep ChatGPT embedded private playback blocked and hold V1, or (b) propose a user-approved alternative authenticated playback entrypoint as a **scope amendment**, not as stealth V1 completion. No new platform or implementation now.

## Hard constraints
No Render deploy/env, Auth0, Cloudflare/D1, Worker, provider/MiniMax, live MCP/connector, secrets, production, route changes, manual Actions dispatch, merge, or other Asteria edits. No new HTTPS endpoint, cookies, URL tokens, audio message sending, Blob fallback, Web Audio retests or broad compatibility framework.

## Delivery
Verify repo/origin/HEAD/worktree/CI/PR stack. Use isolated branch exact parent; one Draft PR stacked on authority. Deliver `docs/v1-closure/V1-HOST-AUDIO-CAPABILITY-STOPGATE-20261026.md`, optional minimal staging-only UI/test diff if justified. Node24 full suite if code changes, focused tests, smoke/syntax/diff check, normal CI. Report COMPLETE/BLOCKED/TOTAL CONTROL DECISION REQUIRED, exact HEAD/PR/CI, whether capability-only diagnostic is feasible, privacy blockers and one next decision. V1 remains 2/9.
