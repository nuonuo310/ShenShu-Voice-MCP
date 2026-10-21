# Continuous construction envelope v3 — generated WAV via verified host bridge / Web Audio

Authority: ShenShu total control. Target: `nuonuo310/ShenShu-Voice-MCP`. This envelope follows `nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md` and `rules/VERIFIABLE_WORK.md`.

**Status: AUTHORIZE OFFLINE IMPLEMENTATION, TESTS, AND DRAFT PR ONLY. NO LIVE OR PAID EXECUTION.**

## Fixed identities / Opening Gate
- Authority path: `docs/construction-envelopes/2026-10-21-first-audition-web-audio-bridge-v3.md`.
- Parent v2 implementation PR #71 head `1276ccb44533c1cacc99642a16d9de81b90f062e`; parent authority PR #70 head `4560304b71a6ac1a2fa35bd8266f597f56f4b289`; predecessor PR #69 head `58fdb938868ee21096368ff488790ceafa76d63d`; original authority PR #68 head `2635c3f170682dddccfe47f6fafa2bc44e759557`. All are stacked Draft PRs, not production main.
- Verify origin repository, all worktree paths/metadata, current branch and HEAD, remote topology, clean working tree and existing PR #71 CI #302. The host previously relocated a worktree; do not remove, move, reset, clean, stash, or overwrite another worktree. If drift changes identity/authorization, STOP for total control.
- Read PR #71 total-control review comment and the v2 readiness report before implementing. Confirm actual existing OAuth host bridge/Web Audio source and manual iPhone/desktop user-reported evidence; do not infer device PASS from source or tests.

## Goal
Replace v2 generated `source:"minimax"` HTMLAudioElement `data:audio/wav;base64` playback path with a **bounded, explicit-user-gesture, host-bridge + Web Audio generated WAV playback candidate**, following the known successful nonbillable OAuth WAV path. Preserve v2 offline identity/consent/quota/fake synthesis modules and their tests. The goal is a trustworthy nonbillable generated-record delivery candidate and a clear manual host verification plan; NOT production voice enablement.

## Authorized autonomy
- Work continuously in a new dedicated task branch based on the exact v3 authority commit; inspect, implement, run tests, fix ordinary failures, rerun, document evidence and create a Draft PR stacked on this authority branch. Do not merge or deploy.
- Modify task-relevant `src/`, `ui/`, `test/`, and `docs/` only. Avoid unrelated refactoring. Preserve existing fixture/private-fixture/tone-fixture/hosted-tone playback and public UI.
- Compare existing working OAuth host bridge with v2 generated branch. Prefer minimal reuse of the proven message/payload/manual Web Audio decode-and-play flow. Avoid broad rewrite or new protocol.
- For `source:"minimax"`, require generated=true, audio/wav, bounded canonical base64, validated 16kHz mono 16-bit PCM, no external URL, and explicit user gesture before playback. Keep old fixture paths intact. Never auto-play or fetch provider audio from browser. Reject malformed, oversized, stale, cross-source and wrong-generation payloads. Do not assume a decoded fake WAV in Node means ChatGPT host playback works.
- Use in-memory fake WAV only. Add targeted tests for correct generated record -> host bridge -> manual Web Audio decode/play contract, bad WAV, oversized data, stale messages, host failure, duplicate clicks, gesture gating, and old playback regression. Keep clear distinctions between source-level, mocked host, actual host and iPhone evidence.
- If actual host-side bridge requires changing public MCP contracts, resource registration, CSP, OAuth boundaries, server entrypoints, or a new privileged tool, STOP and present the smallest architecture decision instead of crossing the boundary.

## Required checks
- Inspect `ui/mcp-bubble.html`, actual OAuth bridge resources and related tests, `src/generated-audio-playback-contract.js`, `src/first-audition-offline-candidate.js`, and v2 readiness report.
- Run targeted Node tests and full `node --test`, `node --check` on modified JS, `git diff --check`, and any existing offline UI checks. If possible, run a local no-network fake-host harness; do not claim desktop/iPhone PASS without a real manual host session.
- Produce `docs/FIRST-AUDITION-WEB-AUDIO-BRIDGE-V3-READINESS-20261021.md` with exact SHA, changed files, tests, diff, remaining gates, host manual steps and device status. If code cannot safely implement within frozen boundaries, finish as TOTAL CONTROL DECISION REQUIRED with alternatives and no fabricated implementation.

## Frozen / STOP
- No MiniMax or other paid API calls; no API keys/voice IDs read, written, printed or used; no real D1 read/write/migration; no live OAuth/JWKS or account authorization change; no deployment, Cloudflare/Render change, Actions dispatch, production MCP tool registration or public exposure.
- No changes to `server.js`, `db/`, workflow files, `package.json`, public/protected MCP registration, canonical identity/consent ownership or D1 semantics without total-control approval.
- No silent fallback to `data:` HTMLAudioElement for generated MiniMax records. Existing fixed fixture behavior may remain unchanged.
- No destructive Git operations on other worktrees or rewriting predecessor PR branches. No merge. No fabricated host/device PASS.

## Allowed write endpoint
Commit and push a dedicated implementation branch and open one Draft PR with base `docs/first-audition-web-audio-bridge-v3-20261021`. No merge or deploy. Preserve stacked PR topology.

## Final receipt
Return COMPLETE / BLOCKED / TOTAL CONTROL DECISION REQUIRED; repo, authority SHA, branch and HEAD, exact diff, tests/CI, Draft PR, manual host/device verification status, any STOP decision, and counts of real provider calls, D1 operations, credential access, deployments and merges (all expected zero). Ordinary in-scope failures should be self-repaired without requesting per-step approval.
