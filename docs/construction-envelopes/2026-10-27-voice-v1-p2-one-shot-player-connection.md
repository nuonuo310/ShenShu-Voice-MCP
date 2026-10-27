# Voice V1 P2 — one-shot paid pipeline to proven standalone player, bounded offline implementation

Authority: ShenShu total control, 2026-10-27. Exact base PR #135 HEAD `a35e0136e788ad8eb0a1d591acad56ee4b644ffc`. The user confirmed audible private nonbillable fixed WAV in desktop browser and iPhone Safari. P1 is accepted as a device-observed fixture path, not real generated speech. V1 strict 2/9; B1-B4 OPEN until proper evidence.

## Opening gate
Verify correct repo nuonuo310/ShenShu-Voice-MCP, origin, clean isolated worktree, base SHA, PR stack, CI, staging deployed SHA and P1 device acceptance comment on #135. Read `docs/v1-closure/V1-CLOSURE-PLAN.md`, P1 implementation/security report, `src/private-web-player.js`, `src/v1-offline-paid-pipeline.js`, existing durable admission/store and MiniMax adapter modules, and existing D1/Worker qualification contracts. Never modify production or old worktrees.

## Single goal
Implement the smallest OFFLINE-ONLY P2 integration candidate: connect verified one-shot trusted request and fixed server-side text/model/voice, durable atomic quota/one-use grant, one provider attempt, bounded WAV, subject-scoped short-lived private result retrieval through the existing authenticated standalone /player interface. Preserve P1 fixed fixture path and its desktop/iPhone observed audibility. Do not invent a second audio transport or embed private audio in ChatGPT. No paid tool mounted, no real provider/D1 calls, no cloud route enabled in this round.

Important identity bridge: Auth0 session's opaque principal must be demonstrably the same canonical principal used by the protected MCP request; do not assume `sha256(issuer+NUL+sub)` equals the current MCP principal. Define exact binding and reject mismatches. No caller-controlled principal, model, voice, grant, operation id, or replay key. Distinguish ChatGPT initiation from player retrieval. If actual durable store cannot be safely integrated without live proof, implement a dormant injected adapter and mark cloud qualification as BLOCKED rather than simulate success.

## Acceptance and security
One explicit text request => at most one billable upstream attempt, including retries/restarts; atomic per-user reservation and one-use grant, no automatic refund/retry on unknown provider result; bounded text, fixed model and voice, WAV/duration/size validation; private result scoped to authenticated subject, TTL, no public URL/bearer in URL, no raw token/audio in logs, no user audio in chat thread, cache no-store and no cross-origin access. Prevent duplicate charge and unauthorized replay; define retention and deletion. No unbounded audio history. Existing public /mcp remains mock. Fixed P1 fixture must remain available for nonbillable regression.

Do NOT claim real D1 atomicity, live Auth0/MCP principal continuity, private storage or real MiniMax output from offline tests. Do not use the experimental `inline-base64-experimental` delivery as proof of browser player retrieval. If the required store/handoff cannot be implemented within a narrow change without new infrastructure, STOP and deliver the exact blocker and a single actionable next decision, not a broad architecture rewrite.

## Bounded output
One isolated Draft PR stacked on this authority branch, exact head/tree/CI, minimal code/tests and `docs/v1-closure/V1-P2-ONE-SHOT-PLAYER-CONNECTION-20261027.md`. Full Node24 0-skip suite if code changes, focused tests, smoke/syntax/diff, normal CI. State next gate as real D1/identity/cloud qualification, separately authorized, then one paid MiniMax E2E and iPhone/desktop verification. No new P1 tests or user device request in this round.

## Absolute prohibitions
No Render/Auth0 changes, deployment, Cloudflare/D1/Worker reads or writes, real MCP/connector, MiniMax/provider, secrets, production main, merge, manual Actions dispatch, other Asteria repositories. Strict V1 2/9. STOP after one bounded implementation or explicit BLOCKED.
