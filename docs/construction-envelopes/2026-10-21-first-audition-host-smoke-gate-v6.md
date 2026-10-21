# Continuous construction envelope v6 — bounded real-host smoke readiness, no deployment authorization

Authority: ShenShu total control. Repository: `nuonuo310/ShenShu-Voice-MCP`. Governing rules: `nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md` and `rules/VERIFIABLE_WORK.md`.

**Status: AUTHORIZE READ-ONLY DEPLOYMENT READINESS AUDIT, OFFLINE IMPROVEMENTS AND DRAFT PR. ACTUAL DEPLOYMENT, CONNECTOR REFRESH AND HOST/DEVICE OPERATIONS REMAIN CLOSED.**

## Fixed identity / Opening Gate

Authority file `docs/construction-envelopes/2026-10-21-first-audition-host-smoke-gate-v6.md`. Baseline v5 PR #77 head `f981c59b813c587bba21fa364cd868c036b670c8`, implementation `e9faa157a91bd0c2f5efad18df7b4ab8d0d0048c`, v5 authority `9ed082d94e562375fdf4f689ab692ad16e126922`; prior stack #68–#76 still Draft and not merged to main. CI #309 run `39645064326` successful.

Verify exact origin, remote and current worktree branch/HEAD/clean status, v5 PR and code. Do not modify/delete/move/reset/clean/stash other worktrees. Check changed remote refs and existing Render/config/connector entrypoint as SOURCE or read-only metadata only. STOP if this authority is stale or relevant worktree has unexpected tracked changes.

## Goal

Determine the smallest **safe, reversible, nonbillable** process to exercise `probe_oauth_generated_delivery` in a genuine ChatGPT OAuth MCP Apps host on desktop and iPhone, without enabling MiniMax, paid routes, D1 mutations or exposing an unauthenticated tool. This stage is an explicit deployment/host-smoke **decision package**, NOT the permission to deploy. Avoid another deep offline feature sprint unless a concrete regression is discovered.

## Autonomous authorized execution

- Audit v5 registration, existing protected resource URI `ui://shenshu/private-fixture-bubble-v2.html`, host UI marker, `SHENSHU_PRIVATE_FIXTURE_ENABLED`, protected OAuth paths, Render configuration sources and CI releases. Analyze whether a staging-only test deployment could be used without touching production. Clearly distinguish source facts and unknown account-level configuration.
- Validate static and in-memory coverage for missing/expired JWT, wrong scope/audience, flag off, public tool invisibility, empty-args enforcement, synthetic fixture provenance, client/tool result framing, generated Web Audio direct click and old fixed WAV regressions. If v5 left narrowly scoped vulnerabilities, self-repair only inside `src/`, `ui/`, `test/`, `docs/` and new task branch with test evidence. Do not change actual deployment configuration or registration outside the v5 authorized tool.
- Produce a concise operator checklist with **exact deploy target, branch/commit pin, config flags, OAuth connector identity, test order, rollback switches, host capture artifacts**, and clearly mark information that still needs explicit operator confirmation rather than inventing it.
- Analyze risks: tool caching, OAuth redirect/audience/JWKS, fixture flag default-off, private route isolation, tool registration/visibility, iPhone/desktop UI version skew, no provider network/billing, backout behavior. Recommend the smallest isolation strategy and exact STOP boundaries.
- If any deploy, account configuration, connector refresh, real host test or infrastructure mutation is required for evidence, STOP with **TOTAL CONTROL DECISION REQUIRED** and an actionable minimal authorization packet. Do NOT infer consent from this envelope.
- Run targeted and full offline test suite, changed JS/HTML syntax and git diff check; do not run real API/host/D1. Include separate proof levels source/offline vs actual host/desktop/iPhone.

## Immutable boundaries

No paid MiniMax/provider call or key/voice ID read, no D1 query/write/schema/migration, no deployment, Render/Cloudflare change, connection or OAuth settings change, connector refresh, GitHub Actions dispatch, real ChatGPT host tool call, branch merge or promotion. No `server.js`, `db/`, `package.json`, workflow, public MCP, CSP, auth/JWKS/scope, production consent ledger modifications. No destructive Git/worktree operation. If a protected edge cannot be isolated, recommend BLOCK rather than deploy.

## Output / handoff

Commit only scoped audit/report or justified narrow offline fixes on a dedicated task branch based on exact v6 authority HEAD; push and open ONE Draft PR stacked onto `docs/first-audition-host-smoke-gate-v6-20261021`.

Report to `docs/FIRST-AUDITION-HOST-SMOKE-V6-DECISION-20261021.md` with exact repository, authority SHA, branch/HEAD, changed files, CI and tests, trust and route graph, precise suggested deploy sequence and rollback, **explicit operator decision required**, and counters of provider calls, D1 operations, secret reads, deploys, connector refreshes, host calls, merges (all 0). Receipt COMPLETE / BLOCKED / TOTAL CONTROL DECISION REQUIRED. Never label real host or device PASS without manual evidence.
