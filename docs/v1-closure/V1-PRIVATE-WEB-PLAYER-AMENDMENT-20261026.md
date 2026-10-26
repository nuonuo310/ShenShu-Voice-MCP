# Voice V1 - standalone private web player amendment (2026-10-26)

## Receipt

- Authority: ShenShu total control; user-selected option 3, one standalone authenticated private mobile web player for V1.
- Offline P1 engineering: **COMPLETE**.
- P2 integration: **PLANNED ONLY**.
- Deployment and iPhone evidence: **NOT PERFORMED / NOT YET CLAIMED**.
- Strict Voice V1 remains **2/9**. B1-B4 remain **OPEN**.
- Real Render/Auth0/Cloudflare/D1/Worker/MiniMax/MCP/secrets/deployments/manual Actions/merges: **0**.

## Authority and PR chain

- Repository: `nuonuo310/ShenShu-Voice-MCP`.
- Origin: `https://github.com/nuonuo310/ShenShu-Voice-MCP.git`.
- Authority commit: `b38db8a743a45a48fdd22bc742f549552933043c`.
- Authority branch: `docs/voice-v1-private-web-player-scope-20261026`.
- Authority package: `docs/construction-envelopes/2026-10-26-voice-v1-private-web-player-amendment.md`.
- Authority parent: PR #132 head `cb35a9f3e6d4382499c29f9b1c5942c302ff53f2`.
- PR #132 is an open Draft, base `docs/voice-v1-host-audio-capability-stopgate-20261026` at `b363d88b5d3d18cab2aaf0c376bb07215024ac8e`, head `cb35a9f3e6d4382499c29f9b1c5942c302ff53f2`, `mergeable_state=clean`.
- The authority commit adds only the construction package. Both remote branches exist; the authority branch has no PR and no Actions run of its own.

### Base-invalid diagnosis

The repository-side dependency is valid: the PR #132 base and head are real remote branches in the same repository, the authority branch resolves to `b38db8a...`, and `b38db8a...` has `cb35a9f...` as its sole parent. The failed create request is not persisted by GitHub, and no failed call payload exists in the local logs, so the exact rejected string cannot be reconstructed.

The remaining cause is request-level, not a deleted base branch, permission failure, Draft restriction, merge or rewritten history: GitHub `base` validation requires an existing branch ref, not a commit SHA, a self-reference or an unpublished/typo ref. The likely failure mode is that the automation supplied the authority/parent commit SHA (or another non-branch ref) as `base`. This is consistent with the supplied "authority commit + branch" pair and the current clean refs, but is not claimed as recovered request evidence.

The only valid stacked bases are therefore:

- Authority package PR, if one is opened: PR #132 head branch `codex/voice-v1-s1-host-audio-capability-stopgate-delivery-20261026` at `cb35a9f...`.
- This P1 implementation PR: authority branch `docs/voice-v1-private-web-player-scope-20261026` at `b38db8a...`.

No baseline was changed, merged, reset or rewritten.

## P1 delivered offline

The new staging-only entrypoint is `/player` on the existing single origin `https://shenshu-voice-mcp-staging.onrender.com`.

### Routes

- `GET /player`: mobile-first standalone page; no identity, token or capability in the URL; no external assets; no automatic playback.
- `GET /player/login`: starts Auth0 Authorization Code + PKCE S256 with a signed, HttpOnly, Secure, SameSite=Lax state/verifier cookie.
- `GET /player/callback`: checks the signed state and PKCE verifier, exchanges the code at the fixed Auth0 token endpoint without a client secret, obtains `sub` from the fixed Auth0 userinfo endpoint, discards the access token, and sets an opaque signed session cookie.
- `GET|HEAD /player/audio`: requires the signed session, calls the subject-scoped loader, validates a bounded 16 kHz mono PCM WAV, and returns it with `Cache-Control: private, no-store`, `Vary: Cookie`, `nosniff` and no CORS.

The OAuth authorization code appears only in the standard short-lived callback query, bound to the HttpOnly PKCE verifier cookie. It is never echoed, logged, used for audio access, or propagated to the stable player/audio URLs. No bearer, token or capability is placed in a player or media URL.

### Security boundaries

- The session value contains only an expiry and the existing opaque principal derivation `sha256(issuer + NUL + sub)`; no email, name, Auth0 subject, access token or refresh token is stored in the cookie.
- The access token exists only in server memory during the callback identity lookup.
- Session lifetime is one hour. There is no refresh token and no persistent session store; rotating the deployment session secret invalidates every cookie.
- Cookie parsing rejects duplicates. HMAC verification is constant-time. Missing, expired, tampered or wrong-key sessions return a generic 401 before loading audio.
- No CORS, no public audio URL, no CSP domain expansion, no public `/mcp` change and no authenticated audio content block.
- The page requires two explicit user actions: load the authorized audio, then play it. The `autoplay` permission is disabled.
- P1 serves one fixed synthetic WAV. It is nonbillable and not ShenShu's voice.
- The browser-cookie and real iPhone playback behavior is deliberately **not** inferred from offline tests.

### Configuration and single external prerequisite

The code is dormant unless all of the following are true:

1. `SHENSHU_STAGING_RESOURCE_MODE=1` and the already allowlisted staging origin is exact.
2. `SHENSHU_PLAYER_ENABLED=1`.
3. `SHENSHU_PLAYER_AUTH0_CLIENT_ID` is the existing SPA client's public client ID.
4. `SHENSHU_PLAYER_SESSION_SECRET` is an operator-provided 32-256 byte deployment secret.

The existing Auth0 SPA client must have exactly this callback added under separate approval:

`https://shenshu-voice-mcp-staging.onrender.com/player/callback`

No Auth0 change was made in this task. That callback configuration is the single external prerequisite for a real P1 staging test; it is not a new platform or a second playback route.

## P2 connection plan, not implemented

1. Keep the same standalone entrypoint and `/player/audio` session boundary.
2. Replace the fixed loader with a subject-scoped private record lookup. The signed-in principal sees only its own latest bounded result; no deep-link token is required.
3. Reuse `v1-offline-paid-pipeline.js` for verified principal, durable atomic reservation, server-issued one-use grant, one fixed provider attempt and bounded WAV validation.
4. Reuse the reviewed D1/store contracts only after a separately approved real-D1 security gate. Add record TTL, one-time/limited retrieval and explicit deletion/expiry behavior.
5. Reuse the existing private audio response headers, changing only the authorization source from bearer to the verified same-origin player session.
6. Add separately approved daily/length/spend limits and a safe stop control before recurring usage.
7. Perform exactly one separately authorized MiniMax E2E smoke only after P2 gates pass.

P2 must not add a second transport family, embedded ChatGPT playback, streaming, automatic retry or a public media URL.

## Verification

- Environment: Node `v24.19.0`.
- Full Node 24 suite: **262 passed, 0 failed, 0 skipped**.
- Focused P1 security suite: **11 passed, 0 failed**.
- `git diff --check`: clean.
- Tests cover disabled/production routing, incomplete configuration, exact Auth0 endpoints, PKCE S256, signed login state, duplicate/tampered/wrong-key/expired sessions, callback state mismatch, duplicate query parameters, bounded Auth0 responses, private audio headers, subject forwarding, MIME/WAV validation, and source-level absence of provider/D1/chat-audio paths.

## Staging candidate and one-session iPhone acceptance

The only staging candidate is the exact implementation commit in the stacked Draft PR. It is not deployed.

After separate approval of the Auth0 callback configuration and staging deployment, perform one session only:

1. On iPhone Safari, open `https://shenshu-voice-mcp-staging.onrender.com/player`.
2. Tap login, complete the normal Auth0 login, and confirm the browser returns to `/player` without a token in the URL.
3. Tap `载入授权音频` once, then tap play once.
4. Record: login success/failure, load state, audible yes/no, and the visible status text. No identity data needs to be reported.
5. Desktop uses the same page and the same acceptance fields.

STOP rule: do not retry, switch to the ChatGPT embedded route, use a public tone as a substitute, or repeat taps. Any failure is returned to total control. B1 remains open until a private standalone-playback WAV is user-confirmed audible on iPhone. P1 passing would still not close gates 2-5, 7 or 9.

## Machine receipt

Exact delivery HEAD, Draft PR number and CI are attached to the Draft PR and final total-control receipt rather than self-referenced inside this commit. The authority and parent values above are fixed.
