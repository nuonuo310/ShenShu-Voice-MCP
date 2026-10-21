# Continuous construction envelope v2 — first audition consent and playback offline delivery

**Authority:** ShenShu total control; follow `nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md` and `rules/VERIFIABLE_WORK.md`.
**Target repository:** `nuonuo310/ShenShu-Voice-MCP` only.
**Authority document path:** `docs/construction-envelopes/2026-10-21-first-audition-delivery-v2.md`.
**Fixed predecessor:** PR #69 commit `58fdb938868ee21096368ff488790ceafa76d63d` stacked on PR #68 commit `2635c3f170682dddccfe47f6fafa2bc44e759557`.
**Status:** authorized for OFFLINE CODE/TESTS and Draft PR only. No live trial authorization.

## Goal
Finish the remaining **offline** first-audition delivery candidate in one continuous pass: trusted, one-use human consent design and offline fake-backed implementation; generated WAV record transport to existing host/player using the smallest separately testable compatible path; end-to-end fake audio playback contract. Provide a single actionable live-audition readiness checklist. Do not wait for full production concurrency rollout; do not claim real playback or billing verified.

## Opening gate
1. Confirm exact repository, origin, current worktree path, current branch and HEAD. Read this envelope at its exact commit, predecessor PR #69 and its readiness report. Check `git status --porcelain`, all worktrees and remote branch topology. User's prior worktree metadata was disrupted: never repair by deleting/overwriting another worktree or moving its files. If unexpected tracked changes, changed canonical base or wrong repo: TOTAL CONTROL DECISION REQUIRED.
2. Verify `main`, #68 and #69 topology and existing OAuth/hosted-WAV player behavior. Inspect actual source, not only reports. Verify previous CI #300 belongs to commit `58fdb938...`.
3. Before implementation record frozen contracts: public OAuth routes, verified identity and D1 grant semantics, fixed WAV playback, existing UI versions, no MiniMax registration.

## Allowed continuous execution
- In a new task branch derived from the verified v2 authority branch, modify only task-relevant `src/`, `test/`, `ui/`, and `docs/` files. Prefer additive internal modules and tests; minimal player adapter change only if needed and demonstrably backward-compatible. Keep `server.js`, MCP route registration, `db/`, workflow files and `package.json` untouched unless stopping for total-control review.
- Self-diagnose and repair ordinary test, type, lint and fake-fixture failures; rerun targeted and full suites; document changes and regressions. No per-test stop.
- Model operator consent as a **trusted server-side, one-use, auditable capability** bound to verified opaque principal, exact action, request ID, content digest or bytes and expiration. Caller-supplied `approved`/`principal` is never authority. If a durable production consent ledger requires schema/architecture change, specify a proposed design only; STOP before implementing migration.
- Implement/test a generated WAV transport/playback contract for `source: minimax` with injected local fake WAV only, no live credentials or API. Preserve old fixture playback and CSP/size restrictions. If changing deployed host/player contracts or introducing new public access is unavoidable, stop and present design alternatives, do not force it.
- Explicitly test missing/forged consent, replay, concurrency, bad WAV, oversized payload, host decode failure, unsupported sources, stale resources, and regression of existing fixed WAV playback. Make proof-level distinctions: pure JS tests vs browser/phone manual tests.
- Use `node --test`, targeted checks, `node --check`, `git diff --check`, and any existing authorized local test commands. No real network except GitHub Git operations for branch/PR; no external provider calls.

## Forbidden / STOP
- No MiniMax or other paid TTS call, no real API keys or voice ID reading/logging, no Cloudflare/Render modifications, no D1 reads/writes/migrations, no Actions dispatch, no production deploy, no new public MCP endpoint, no actual account authorization change.
- No merge, rebase or rewrite of #68/#69, no edits to original Yinglianchun fork or Legacy Archive, no checkout/reset/stash/clean of another worktree. Do not silently treat user-provided consent as server authority.
- Stop on architecture/frozen-contract changes, unexpected base/HEAD, required secrets/real billing, inability to preserve existing player, or evidence ambiguity that would turn offline tests into an asserted production PASS.

## Authorized write endpoint
Commit and push only a new dedicated branch; create a **Draft PR** stacked on this authority branch (`docs/first-audition-delivery-envelope-v2-20261021`) or report inability without changing base. Do not merge or deploy. Keep only in-scope code, tests and a readiness report in the PR. Store evidence in the repository; never send raw keys or audio to chat.

## Acceptance
- Exact changed-file list and diff with no unrelated changes.
- Offline identity/consent/one-shot and fake MiniMax -> valid WAV -> compatible generated-audio host/player contract tests PASS, including backward compatibility. If host/browser cannot be tested, state NOT VERIFIED and provide manual verification instructions, never claim playback success.
- Report distinct states for fake pipeline, host integration, real OAuth/JWKS, D1, provider config, paid trial and iPhone/desktop playback. Include operator-only prerequisites for one future explicit paid trial, without doing it.
- Preserve `src/first-audition-offline-candidate.js` as offline-only; do not weaken fake-fetch boundary by wiring it into a live route.

## Final report
One of COMPLETE / BLOCKED / TOTAL CONTROL DECISION REQUIRED. Include repository, base/authority SHA, branch/HEAD, changed files, test counts and commands, Draft PR, verified evidence, STOP issues, and exact counts of real MiniMax calls, paid calls, real D1 operations, deployments and credential reads (expected all 0). Normal implementation failures are to be fixed autonomously within this envelope.
