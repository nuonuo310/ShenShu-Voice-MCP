# Continuous construction envelope v4 — nonbillable generated-record MCP host delivery gate

Authority: ShenShu total control; follows `nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md` and `rules/VERIFIABLE_WORK.md`.
Repository: `nuonuo310/ShenShu-Voice-MCP` ONLY.
Authority document: `docs/construction-envelopes/2026-10-21-first-audition-host-delivery-v4.md`.
**Permission: OFFLINE DESIGN, CODE, FAKE-HOST TESTS AND DRAFT PR ONLY. NO DEPLOYMENT OR LIVE TOOL CALL.**

## Fixed Opening Gate
- Verify origin repository, worktree paths and cleanliness, current branch/HEAD, remote refs and full stacked topology: #68 `2635c3f170682dddccfe47f6fafa2bc44e759557` -> #69 `58fdb938868ee21096368ff488790ceafa76d63d` -> #70 `4560304b71a6ac1a2fa35bd8266f597f56f4b289` -> #71 `1276ccb44533c1cacc99642a16d9de81b90f062e` -> #72 `b97cc44d62293245d74b7fb1f59148ded5d65812` -> #73 `40a848217cece01f7f974cbdefad471165650d33`. All are Draft/stacked, not production main.
- Read v3 readiness report and total-control review on PR #73. Confirm CI #304 applies to head `40a8482`. Inspect actual OAuth resource delivery, tool-result notification, existing nonbillable host bridge, `ui/mcp-bubble.html`, generated Web Audio implementation, CSP and test-only tool boundaries.
- Never move/reset/clean/stash another worktree. If identity/base/frozen-contract drift is material, STOP.

## Stage goal
Establish, with **nonbillable fake WAV only**, an independently reviewable candidate for actual ChatGPT MCP Apps host delivery of a generated-shape `source:"minimax"` record and explicit-click Web Audio playback. Reuse the historically successful OAuth bridge, but do not claim device verification from offline mocks. Prioritize the smallest reversible path to a future operator-run host smoke test.

## Authorized autonomous work
- Inspect source, design a precise end-to-end route and trust boundary; implement in-scope local helper(s), fake-host harness and tests under `src/`, `test/`, `ui/`, `docs/` only. Ordinary test failures may be fixed and rerun autonomously.
- Preserve legacy public and private fixture behavior. Fake generated-shape records must be explicitly labeled NONBILLABLE TEST and must never be accepted as proof that MiniMax ran.
- If a host-visible test-only tool is necessary, first determine whether it can be added without touching frozen MCP registration, resource contracts, `server.js`, CSP or auth. If it cannot, DO NOT implement it: produce a minimal proposed diff, exposure/risk analysis and a TOTAL CONTROL DECISION REQUIRED receipt. No fake PASS.
- Validate exact record shape, byte/size/duration, generated:true/source:minimax and no URL or browser provider fetch. Confirm UI user gesture gating, decode/start, duplicate click and stale-message protection. Test host message framing and regressions with existing fixtures.
- Create a human-operable, nonbillable host/desktop/iPhone smoke plan with explicit observed evidence requirements (host URL/version, resource identity, tool name, click result, console/CSP, generated playback audible, no MiniMax/D1 activity). Do not run real host or deploy in this envelope.

## Frozen / STOP boundaries
- No real MiniMax or any paid call; no credentials, provider voice ID, D1 read/write/migration, Cloudflare/Render change, OAuth account/permissions change, GitHub Actions dispatch, production deploy, public endpoint or paid MCP registration.
- No modification of `server.js`, `db/`, `package.json`, workflow files, public/protected MCP tool registration or CSP without explicit total-control decision. No silent new hosted resource, no public audio URL, no auth bypass, no runtime consent ledger substitution.
- No merge/rebase/rewrite of predecessor PRs, no destructive Git operations on unrelated worktrees. No source-level PASS relabeled as real host or iPhone PASS.

## Required checks / evidence
- Targeted fake-host, OAuth resource and UI/CSP tests; full `node --test`; `node --check` for modified JS and extracted UI script; `git diff --check`. Track baseline and exact head SHA.
- Write `docs/FIRST-AUDITION-HOST-DELIVERY-V4-READINESS-20261021.md` with actual route graph, tested behavior, frozen changes, exact test counts and evidence, and separate columns for mock host / real host / desktop / iPhone.
- If STOP occurs, preserve completed read-only analysis and code only within scope; clearly identify minimum authorization needed next. Do not assume approval.

## Write endpoint / final receipt
Use new dedicated task branch based on exact v4 authority commit; commit/push and create ONE Draft PR stacked on `docs/first-audition-host-delivery-v4-20261021`. No merge or deploy. Return COMPLETE / BLOCKED / TOTAL CONTROL DECISION REQUIRED with opening gate, changed files, tests, CI, PR/commit, host/device status and counts of provider calls, paid calls, D1 ops, secrets, deployments, Actions dispatches and merges (all expected 0).
