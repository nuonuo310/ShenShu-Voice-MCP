# Voice V1 S1 — iPhone audio route decision, one bounded design/implementation (2026-10-26)

Authority: ShenShu total control. Exact base PR #126 head `9b938724f94f3053b6267f9fd90567da07e8de96` (already deployed to Render staging; production main untouched). Keep immutable V1 nine-gate done line, strict 2/9, B1 OPEN.

## Real device evidence (do not overwrite)
1. iPhone `preview_private_fixture` before PR #126: HTMLMediaElement data:audio/wav;base64, `NotSupportedError` media code 4, readyState 0, no audible sound.
2. PR #126 iPhone private fixture: `s1-ios-media4-20261026`, path web-audio-private-fixture, direct-click, AudioContext running, resume resolved, decode ok 0.70s 48000Hz 1ch, source ended, but **silent**. Code execution does not prove acoustic output.
3. iPhone `preview_oauth_hosted_tone_control` fixed PUBLIC HTTPS WAV: initial tap silent; user observed iPhone speaker/output setting had switched off; after manually restoring speaker and playing, **audible**, and speaker stayed normal. This is an operator observation, not proof that the app or plugin switched routes. The hosted tone is public diagnostic data, not private speech.
4. Auth0 reauthentication occurred when connector prompted; OAuth allowed tool invocation. Do not conflate OAuth session with acoustic output.

## Opening gate
Verify repo, exact authority commit, worktree isolation, PR stack, deployed staging commit, no dirty state, and existing CI. Read `docs/v1-closure/V1-CLOSURE-PLAN.md`, `docs/v1-closure/S1-IOS-MEDIA4-BOUNDED-FIX-20261025.md`, `ui/mcp-bubble.html`, `src/staging-authenticated-mcp.js`, `src/private-fixture-delivery.js`, `src/generated-host-delivery.js` and tests. Do not re-run broad test suites unless code changed.

## One decision, no perpetual diagnostic sprint
Compare the exact two playback mechanisms and iOS output-routing evidence. Determine the shortest V1-safe way to deliver authenticated private WAV over a browser-compatible media element, **without public permanent URLs**, leaked bearer tokens, arbitrary URL fetch, open redirects, persistent unauthenticated audio, or new commercial billing architecture. Assess authenticated same-origin ephemeral HTTPS media endpoint, one-time capability with short TTL, authorization/cookie/headers constraints in iOS MCP sandbox, no raw secrets in URL/log, replay denial, and feasibility of bounded blob/object URL created from validated in-memory bytes (without network). Do not assume either is usable until supported by source/host constraints. Existing Web Audio may remain as secondary route only if justified; do not claim speaker route root cause.

Produce a ranked 2-option decision: (A) smallest secure private audio path feasible under existing host, (B) explicitly bounded fallback if A not feasible. For each, exact source edits, security properties, one iPhone nonbillable verification, STOP criteria and rollback. Prefer a single minimal offline implementation only if it has testable proof and no new infrastructure; otherwise design-only and STOP with explicit missing evidence. Do not add a third speculative pathway or broad compatibility matrix.

If implementing, include focused regression tests for authorization/privacy, no extra tool calls or provider attempts, no automatic retry, no public URL leakage, and actual UI state not falsely declaring audible success. Existing public /mcp mock and hosted-tone control must remain unchanged. No blind repeated device tests.

## Absolute prohibitions
No Render deployment or env change, Auth0 settings, Cloudflare/D1, Worker route, secrets, MiniMax/provider, live connector call, production main, Asteria-Call, Asteria-Voice-Worker, manual Actions dispatch, merge. Do not introduce paid feature or revise V1 gate definitions.

## Delivery
Create `docs/v1-closure/S1-IOS-AUDIO-ROUTE-DECISION-20261026.md`, optional narrow source/tests only if justified, isolated task branch from exact authority, one stacked Draft PR. If code changed: Node24 full suite zero skips, focused tests, smoke, syntax and diff check; normal CI. If docs only: syntax/diff checks and CI. Report COMPLETE/BLOCKED/TOTAL CONTROL DECISION REQUIRED, exact PR/HEAD/CI, a single staging candidate or explicit no-deploy recommendation, remaining acoustic uncertainty and strict V1 2/9. Stop.
