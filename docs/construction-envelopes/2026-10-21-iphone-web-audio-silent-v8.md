# Continuous construction envelope v8 — iPhone embedded-host silent Web Audio diagnosis

Owner: ShenShu total control. Follow `nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md` and `rules/VERIFIABLE_WORK.md`.
Repository: `nuonuo310/ShenShu-Voice-MCP`. **OFFLINE investigation, bounded implementation/tests and Draft PR only. No deploy, connector refresh, MiniMax or D1.**

## Grounded observation and opening gate

- Desktop actual ChatGPT staging OAuth host: nonbillable generated-shape WAV delivery and explicit click audibly successful (user confirmed; evidence PR #82).
- iPhone actual ChatGPT staging OAuth host: player appears, user taps play, progress advances, **no audible sound**.
- User confirms media volume on, no Bluetooth, other videos audible. The older `试听桥接 WAV（非计费）` path also produces no sound on the same iPhone.
- Evidence PR #83. Do not claim iPhone PASS or blame a specific subsystem without proof.
- Current staging deployment pinned to `3552ec2ee418cc2654968e5630f1790f98f2ccdb`, OAuth test enabled, private fixture enabled; production unchanged. Authority branch derived from this exact baseline. Earlier implementation PR #81 is Draft and must not be rewritten.
- Verify repository origin, worktree, clean status, exact authority SHA and current staging source. Read `ui/mcp-bubble.html`, existing fixed OAuth Web Audio bridge, generated playback branch, tests and PR #82/#83 evidence. Stop on drift, unexpected tracked modifications or conflicting worktrees.

## Goal and diagnosis strategy

Find a small, evidence-backed iPhone ChatGPT embedded Web Audio audio-output fix or a bounded diagnostic that distinguishes AudioContext resume, audio session category/activation, decode, source connection/start, context state, gesture timing and host media restrictions. The animation/progress bar is not evidence of audible output. Compare two silent iPhone Web Audio paths and the audible desktop path, looking for shared failure points.

1. Map exact two paths and their common audio output code; distinguish real WAV bytes, decode success, context.currentTime and source.start from speaker audibility.
2. Examine iOS Safari/WebKit audio session semantics and MCP Apps iframe restrictions from existing code/docs, without inventing runtime observations. Prefer tiny diagnostic UI that displays only nonsecret context.state, resume result, decode metadata, start/ended events, host build marker and user-gesture sequence; no secret, token or principal leakage.
3. If supported by code-level evidence, implement the smallest reversible compatibility improvement under `ui/`, `src/`, `test/`, `docs/`. Consider explicit gesture synchronous AudioContext construction/resume and platform audio-session API only with careful feature detection and fallback, never broad autoplay hacks. Preserve the desktop successful path and fixture/CSP/OAuth boundaries.
4. Add offline fake-iOS harness tests for suspended/interrupted contexts, gesture timing, decode/start errors, stale messages, duplicate clicks and old fixed bridge regression. Mocked PASS does not mean device audio PASS.
5. Provide one-step-at-a-time operator iPhone manual verification plan after a separately approved staging deployment; limit retries and preserve screenshots/console where available. If root cause cannot be supported without device instrumentation, report TOTAL CONTROL DECISION REQUIRED with smallest safe diagnostic change rather than guessing.

## Allowed execution

- Autonomous read/implement/test/fix/retest in a new dedicated task branch; run targeted/full `node --test`, JS/HTML syntax, `git diff --check`; collect exact test counts, changed files, evidence and Draft PR.
- Scope: relevant `ui/mcp-bubble.html`, `src/` helper if indispensable, `test/`, `docs/`. No changes to `server.js`, protected/public tool registration, `db/`, `package.json`, workflows, CSP, OAuth/JWKS/audience, Render or Auth0.
- No new public tool, no live host requests, no network except authorized GitHub Git/PR operations, no cloud configuration or deploy. Do not touch other worktrees or merge predecessor PRs.

## STOP boundaries

- Real MiniMax/provider/billable call, provider key/voice ID read, D1 operation/migration, paid quota/consent changes, OAuth changes, tool registration, Render/Auth0 change, deployment, connector refresh, production merge, user-account actions: all prohibited.
- If code change requires a frozen contract, STOP with a narrow proposal. No fabricated device evidence.

## Delivery

Commit and push dedicated branch; create one Draft PR stacked on `docs/iphone-web-audio-silent-diagnostic-v8-20261021`. Write `docs/IPHONE-WEB-AUDIO-SILENT-V8-READINESS-20261021.md` with actual findings, evidence confidence, test results, unchanged boundaries and a precise single-session iPhone check plan. Final receipt COMPLETE / BLOCKED / TOTAL CONTROL DECISION REQUIRED with exact SHA/PR/CI and all real provider/D1/deploy/refresh counters expected zero.
