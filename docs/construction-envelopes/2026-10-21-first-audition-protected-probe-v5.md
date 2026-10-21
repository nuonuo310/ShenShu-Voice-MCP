# Continuous construction envelope v5 — explicitly authorized protected nonbillable generated-WAV host probe

Owner: ShenShu total control. Target: `nuonuo310/ShenShu-Voice-MCP`. Follow `nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md` and `rules/VERIFIABLE_WORK.md`.

Status: **AUTHORIZED FOR BOUNDED LOCAL CODE, OFFLINE TESTING AND DRAFT PR ONLY. NOT AUTHORIZED FOR MERGE, DEPLOYMENT OR ACTUAL HOST TEST.**

## Authority and baseline

This authority document is `docs/construction-envelopes/2026-10-21-first-audition-protected-probe-v5.md`.
Predecessor PR #75 / v4 head `e4c2b0020cca29a439bc8ab01e1902ec5beb5e68` (implementation commit `ce7dfdd8a307a0c5db6ed0b30b77a433b96685fa`), on v4 authority `07510d73dd43be6d6867fde34d4c7aee0a9fdffa`. Earlier stack PR #73 host/Web Audio candidate `40a848217cece01f7f974cbdefad471165650d33`. All Draft, NOT merged into main. Prior v4 CI #306 run `39641889938` success. This envelope records total-control approval for ONE narrowly scoped change previously STOPPED by v4: a protected app-only generated-shape *nonbillable fixture* probe.

## Opening Gate — mandatory

Verify owner/repository/remote, current real worktree path, all worktree ownership, clean status, branch/ref/base and exact authority-document commit. Verify PR #75 and read full `docs/FIRST-AUDITION-HOST-DELIVERY-V4-READINESS-20261021.md`, source `src/generated-host-delivery-candidate.js`, `src/staging-authenticated-mcp.js`, `ui/mcp-bubble.html` and existing authentication/tool registration/bridge tests. Record actual main HEAD and ensure no unexpected frozen-contract drift. Host has moved worktrees before: never move, reset, stash, clean or overwrite another worktree. STOP on unexpected HEAD, dirty tracked files, repository mismatch or conflicting concurrent work.

## Narrow architecture decision: APPROVED FOR OFFLINE IMPLEMENTATION ONLY

Permit exactly ONE additive, test-only registration in `src/staging-authenticated-mcp.js` for `probe_oauth_generated_delivery`, guarded by **both** existing verified OAuth protected session and `SHENSHU_PRIVATE_FIXTURE_ENABLED` (existing `privateFixtureEnabled`), with `_meta.ui.visibility:["app"]` and matching protected `securitySchemes`. Do not expose on public /mcp or model-visible tools. No user-provided arguments: empty input schema with `additionalProperties:false`; reject any nonempty/unsupported invocation arguments. Do not mint the fixture from arbitrary client text.

Use existing `makeNonbillableGeneratedHostToolResult` in `src/generated-host-delivery-candidate.js` to return a bounded fixed synthetic 0.7s mono 16kHz PCM WAV record in the already-reviewed generated host shape, with explicit `NONBILLABLE TEST`, `hostDeliveryTest:true`, `providerInvoked:false`, `billable:false`. The fixture handler must never reach D1, MiniMax, fetch, billable authorizers or secrets. Preserve verified principal/auth-gate semantics unchanged.

Permit ONE additive OAuth-only test button/handler in `ui/mcp-bubble.html` with visible nonbillable labeling and `tools/call` through the already-existing MCP Apps OAuth bridge. Reuse v3 gesture-gated Web Audio generated path; no HTMLAudioElement `data:` fallback, no autoplay and no public provider URL. Button must be hidden/inert outside the verified private resource. Do not advertise generated audio as a real ShenShu voice or production success. Do not modify the existing `probe_oauth_bridge_audio_payload` output or private fixture resource URI; preserve desktop/iPhone fixed-tone historical behavior.

## Agent authorized actions

Implement code only for task-relevant `src/staging-authenticated-mcp.js`, `ui/mcp-bubble.html`, task-specific `src/` helper only if indispensable, `test/` and `docs/`. Within that scope continuously inspect, implement, run offline tests, autonomously fix ordinary defects, rerun and report. Include tests proving tool absent under disabled fixture flag, missing/invalid OAuth and public MCP, no model-visible registration, no-input-only strictness, exact fixed nonbillable payload, output shape, OAuth UI click/host-message framing, Web Audio manual gesture playback and regression of existing fixture/hosted-tone/CSP. Verify authorization checks occur before any fixture emission. Include static nonimport checks to prevent paid dependencies.

NO other server entrypoints or resource contract change. No changes to `server.js`, `db/`, `package.json`, GitHub workflows, Cloudflare/Render settings, CSP, OAuth/JWKS issuer/scopes, production consent/D1 SQL or other projects. If these prove necessary, STOP with minimal diff proposal; do not implement.

## Evidence and STOP boundaries

Run existing targeted test suites and full `node --test`, JS `node --check`, extracted UI module syntax check and `git diff --check`. Document exact tested head, prechange baseline, test counts, source/tool compatibility, rejection/visibility tests and whether host/device tests are NOT RUN. Any real browser/ChatGPT MCP Apps session, tool call, connector refresh, deployment or hosting change requires separate total-control approval; do not perform.

No real MiniMax/paid synthesis, no real provider key or voice ID access, no real D1 operations/migrations, no production endpoint, no Actions dispatch, no merge, no deployment, no deletion/rebase/rewrite of earlier stacked PRs or worktrees. A test-only tool registration in a Draft branch is NOT permission to activate or deploy that registration.

## Output

Use a dedicated task branch started from exact v5 authority branch commit; commit/push and open ONE Draft PR stacked onto `docs/first-audition-protected-probe-v5-20261021`. Leave predecessor branches untouched. Write `docs/FIRST-AUDITION-PROTECTED-PROBE-V5-READINESS-20261021.md` with exact implementation and STOP evidence.

Final receipt: COMPLETE / BLOCKED / TOTAL CONTROL DECISION REQUIRED, authoritative SHA, head/base, exact diff, test counts, CI, Draft PR, prior fixture preservation, proof of OAuth-only/app-only and flag checks, host desktop/iPhone status, and zero-counts for live MiniMax, billable calls, D1 ops, credential reads, deployments, connector refreshes, Actions dispatches and merges.
