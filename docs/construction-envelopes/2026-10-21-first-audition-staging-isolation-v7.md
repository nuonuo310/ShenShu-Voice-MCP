# Continuous construction envelope v7 — approve Option A staging resource identity isolation, code only

Owner: ShenShu total control. Target `nuonuo310/ShenShu-Voice-MCP` only. Governing rules: `nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md` and `rules/VERIFIABLE_WORK.md`.

**Status: APPROVED TO IMPLEMENT AND OFFLINE-TEST STAGING-SAFE PROTECTED RESOURCE CONFIGURATION; NO CLOUD/ACCOUNT ACTIONS, DEPLOYMENT, CONNECTOR REFRESH OR LIVE HOST TEST AUTHORIZED.**

## Total-control decision

Approve **Option A** from `docs/FIRST-AUDITION-HOST-SMOKE-V6-DECISION-20261021.md` as architecture, **reject Option B** production-branch deployment. Isolate the test in a new Render staging service and distinct Auth0 API audience *after* separate operator authorization and account-specific configuration review. The user must not be asked to copy secrets into chat. This envelope DOES NOT authorize creation of any Auth0 API, Render service, connector, or changes to existing account settings; those are subsequent explicit operational gates.

## Frozen identities / Opening Gate

Authority file `docs/construction-envelopes/2026-10-21-first-audition-staging-isolation-v7.md`. Exact parent v6 PR #79 head `c310ab9f44cc5becf99acb4e7aaa2696acf23c41`, implementation commit `f28fac3103cfbefebef6568a97d84a8f75464a83`; v6 authority `b7a5d9d93b37b223b58eeb81c38e4657a3b5004c`. Prior PR #68–#78 remain Draft stacked. Verify repo, origin, branch, head, worktree map, clean working tree, remote topology and PR #79/CI #312 `39649547766`. Inspect full v6 decision report, `src/protected-resource-shell.js`, OAuth metadata/JWKS modules, `server.js`, related tests and nonsecret deployment docs. Stop on unexpected ref or unrelated change. Never modify/reset/clean/stash/move other worktrees.

## Bounded construction goal

Add minimal **explicit staging-only, allowlisted and fail-closed** configuration for OAuth protected-resource base URL/audience and matching protected-resource metadata URL, while preserving existing production defaults **byte-for-byte** when no staging flag is present. The stable Auth0 issuer remains the existing issuer unless an isolated, separately approved staging issuer is later warranted; staging **audience must be distinct** and bound to the staging hostname. No server trusting production-audience tokens on staging.

Production `PAID_RESOURCE`, `RESOURCE_METADATA_URL`, resource metadata, WWW-Authenticate challenges, auth verifier audience, paid diagnostic and JWKS source must remain mutually consistent; no caller-supplied Host, Forwarded or X-Forwarded-* header may select a resource identity. Never allow an arbitrary URL or silent fallback to production audience under a staging override.

Suggested design: one explicitly named staging-mode env flag plus one operator-set exact HTTPS staging origin that is validated/allowlisted against the intended `.onrender.com` staging host pattern and/or a stricter explicit service name. Construct `/paid-mcp` audience and `/.well-known/oauth-protected-resource/paid-mcp` metadata URL from that *same* validated origin. Reject production hostname as staging override; reject HTTP, username/password, path/query/hash, IP, localhost, wildcard, Unicode/IDN tricks, redirects or ports if not explicitly required. Avoid reliance on arbitrary untrusted process env. Prefer reusable pure resolver with tests and no secret content. If adequate hostname isolation cannot be assured using offline source alone, STOP for total-control architecture decision instead of weakening restrictions.

## Permitted code

Modify only task-relevant `src/protected-resource-shell.js`, a dedicated small `src/` resolver if necessary, `test/` and `docs/`. Change `server.js`, public /mcp, `db/`, `package.json`, workflows, Render/Auth0 settings, OAuth scope, UI/resource URI, CSP, D1 semantics, real paid tools, secrets or other worktrees **only after a new total-control decision**. Do not change production constants' exported meaning for existing callers. Default-off production identity and OAuth metadata must remain identical. Keep strict JWT issuer/audience/scope/lifetime and rotating JWKS. Private fixture flag default off; generated probe remains app-only, OAuth-gated, fake-WAV-only. No MiniMax or D1 dependencies introduced.

## Required tests / evidence

- Default configuration identity, discovery metadata and 401 WWW-Authenticate remain EXACT unchanged.
- Staging flag absent or false with malicious override: cannot alter production identity.
- Staging flag on with missing/malformed/production/host-header-influenced origin: fail closed (never fall back to production).
- Valid staging origin changes audience, metadata and challenge consistently; verified production-audience JWT is rejected for staging and staging-audience JWT is accepted only under trusted issuer/scope (local fixture signing only).
- Reject insecure/untrusted URLs and unexpected staging hostname, verify app-only protected fixture and public /mcp unchanged, no real provider/D1 path and no secret reads.
- Execute targeted and full `node --test`, JS syntax, extracted UI module if modified, `git diff --check`; ordinary in-scope failures may be self-fixed continuously. No real external requests except GitHub Git/PR operations.
- Prepare `docs/FIRST-AUDITION-STAGING-ISOLATION-V7-READINESS-20261021.md` with exact branch SHA/diff/test counts, sample **nonsecret** environment names and test-only values, production parity proof, recommended operator setup sequence, Auth0 staging audience matching, abort and rollback steps. Mark real Render/Auth0/ChatGPT desktop/iPhone validation **NOT RUN**.

## Hard prohibitions and STOP

Zero real MiniMax/paid calls, D1 operations/migrations, provider key or voice-ID reads, Auth0 administration, Render administration, service/deployment creation, OAuth connector creation/refresh, GitHub Actions dispatch, host probe or device test, merge, promotion or rewrite of stacked PRs. Do not print/copy credentials. STOP if live account context needed to select identity or if production behavior changes unexpectedly.

## Write endpoint / receipt

Use new dedicated task branch from exact v7 authority commit. Commit/push scoped changes and open ONE Draft PR stacked on `docs/first-audition-staging-isolation-v7-20261021`. Preserve all preceding Draft PRs. Final COMPLETE / BLOCKED / TOTAL CONTROL DECISION REQUIRED report: opening gate, exact code/authority SHA, PR and CI, test evidence, remaining operator configuration decisions, production-default parity, and explicit zero counts for paid calls, D1, secret accesses, deployments, connector or host operations and merges.
