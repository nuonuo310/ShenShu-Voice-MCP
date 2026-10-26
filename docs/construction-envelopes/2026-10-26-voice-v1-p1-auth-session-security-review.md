# Voice V1 P1 — one-pass auth/session security review before staging

Authority: ShenShu total control, 2026-10-26. Parent PR #133 exact HEAD `eb52f22a9062ccb3be7c8697ecaa1e464d24123a`. User-approved V1 playback entrypoint is a standalone authenticated web player. Strict V1 2/9; B1-B4 OPEN. This is one narrow review/fix, not new architecture.

## Opening gate
Verify origin, branch, clean isolated worktree, exact parent, PR chain, CI and diff. Read `src/private-web-player.js`, `ui/private-player.html`, `server.js`, `test/private-web-player.test.js`, P1 amendment and V1 closure plan.

## One-pass review
Independently examine exact Auth0 Authorization Code + PKCE S256 callback binding: fixed issuer/authorization/token/userinfo endpoints; state/verifier integrity and single-use/replay implications; correct token response validation, userinfo identity and issuer/audience assumptions; error redirects and query code leakage/referrer; account confusion and login CSRF; signed HttpOnly Secure SameSite=Lax cookie scope/expiry/key length and rotation; CSRF on state-changing operations; auth checks before audio bytes; subject isolation; cache/CORS/CSP/no-public-audio; staging-only activation; no inadvertent /mcp or /paid-mcp changes; no secrets in logs/URL. Do not assume successful offline tests prove real Auth0 configuration or iPhone cookie behavior.

If a concrete flaw exists, make the smallest offline fix with adversarial focused tests, preserve P1 behavior. If no concrete flaw, document PASS with evidence. Do not broaden to identity-platform rewrite, new transport or paid P2. Exactly one review cycle.

## Deliverable
`docs/v1-closure/P1-AUTH-SESSION-SECURITY-REVIEW-20261026.md`, optionally narrow code/test changes. Full Node24 0-skip suite if code changes, focused tests, smoke, syntax/diff and normal CI. One Draft PR stacked on this authority branch. Final COMPLETE/BLOCKED/TOTAL CONTROL DECISION REQUIRED, exact HEAD/tree/CI, residual live assumptions, single next operator action. No deployment, Render/Auth0/Cloudflare/D1/Worker, MiniMax/provider, real MCP, secrets, merge, manual Actions dispatch, other Asteria edits. Strict V1 2/9. Stop.
