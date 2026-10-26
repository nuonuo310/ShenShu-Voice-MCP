# Voice V1 P1 - auth and session security review (2026-10-26)

## Receipt

- Review: **COMPLETE**.
- Concrete findings: **2**, both fixed with focused offline tests.
- Strict Voice V1: **2/9**. B1-B4 remain **OPEN**.
- Real Auth0 login, iPhone cookie behavior and audible playback: **NOT VERIFIED**.
- P2: **NOT IMPLEMENTED**.
- Deployment, Render/Auth0/Cloudflare/D1/Worker changes, MiniMax/provider calls, real MCP, secrets, manual Actions dispatch and merges in this task: **0**.

## Authority and dependency

- Repository: `nuonuo310/ShenShu-Voice-MCP`.
- Origin: `https://github.com/nuonuo310/ShenShu-Voice-MCP.git`.
- Review authority: PR #134, commit `acbd30b4516cc11e16c9deaab01e75d39819a7b3`, tree `3e28f3ca97f3fe83899719fa793a4371484746d2`.
- Authority package: `docs/construction-envelopes/2026-10-26-voice-v1-p1-auth-session-security-review.md`, blob `fdc72e3b15b16d2304faea6e17f4ab71b9cf6cb0`.
- Parent baseline: PR #133 HEAD `eb52f22a9062ccb3be7c8697ecaa1e464d24123a`; the authority commit has exactly that parent and adds only the review package.
- PR #134 is an open Draft with base `codex/voice-v1-private-web-player-p1-20261027`, head `docs/voice-v1-p1-auth-session-security-review-20261026`, `mergeable_state=clean`; CI run `40370959185` is success.
- PR #133 remains an open Draft with exact head `eb52f22...`; CI run `40360336846` is success.

Review executed from a clean isolated worktree branching from the exact authority commit. No baseline was changed, merged, reset or rewritten.

## Findings and fixes

### SEC-P1-01 - Auth0 response limit was applied after full buffering

The original `readBoundedJson()` called `response.text()` before checking `MAX_AUTH_RESPONSE_BYTES`. The configured 64 KiB limit therefore constrained parsed JSON but not bytes buffered from an oversized or misbehaving fixed Auth0 response. The endpoint is trusted and pinned, so practical exploitability requires a pathological upstream response, but the stated bound was not real and could permit avoidable memory pressure.

Smallest fix:

- Validate a declared `Content-Length` before opening the body.
- Read `response.body` incrementally with a running 64 KiB byte cap.
- Cancel the reader immediately when the cap is exceeded, then release its lock.
- Reject malformed declared lengths and retain a post-read bound only for test/non-stream fallbacks.
- Do not expose response bodies, bodies of errors, tokens or user subjects.

Focused cases cover declared oversize without a read, an undeclared stream crossing the cap with cancellation, and a malformed declared length without a read. In every case no userinfo request or session cookie is produced.

### SEC-P1-02 - OAuth state comparison used ASCII aliasing

The original constant-time helper converted both state strings with `Buffer.from(value, "ascii")`. Node's `ascii` encoding maps some non-ASCII code points to the same byte as ASCII characters. For example, `\u0141` maps to byte `0x41`, the same byte as `A`. Exact OAuth state equality should not accept a non-ASCII alias, even though the state is random and an attacker normally cannot learn it.

Smallest fix:

- Require both compared values to match `^[A-Za-z0-9_-]{43}$` before comparison.
- Then compare the equally sized ASCII byte strings with `timingSafeEqual`.
- Add a regression proving the old low-byte alias is rejected before any token request.

## Reviewed controls

| Area | Result |
|---|---|
| Auth0 endpoints | PASS - authorization, token and userinfo endpoints are fixed from one pinned HTTPS issuer. |
| PKCE and state | PASS after SEC-P1-02 - 32 random bytes, S256 challenge, signed HttpOnly state/verifier cookie, exact state check and duplicate-parameter rejection. |
| Code handling | PASS - authorization code appears only in the standard callback query and token POST; it is not logged, echoed, stored or placed in a stable player/audio URL. |
| Token/userinfo response | PASS after SEC-P1-01 - HTTP status, bounded JSON, Bearer token shape/length and userinfo `sub` are checked before a session is minted. The access token is not persisted. |
| Account mixing | PASS under the offline model - no ID token or caller-supplied principal is trusted; the session principal derives from the fixed userinfo endpoint for the token minted for the fixed client, redirect URI and PKCE verifier. |
| Cookie scope and expiry | PASS - both cookies use the `__Host-` prefix, `Path=/`, `HttpOnly`, `Secure`, `SameSite=Lax` and no Domain; login is 600 seconds and session is 3600 seconds. |
| Session integrity | PASS - HMAC-SHA256 with a 32-256 byte operator secret, constant-time signature verification, duplicate-cookie rejection and expiry checked before use. Changing the secret invalidates existing cookies. |
| CSRF | PASS for the implemented routes - callback is state-bound, login initiation has no protected side effect, audio is read-only, and no session-changing POST endpoint exists. |
| Subject isolation | PASS for P1's fixed fixture - audio loading occurs only after session verification and receives only the signed opaque principal. There is no user audio store in P1. |
| Audio authorization | PASS - missing, expired, duplicated, tampered or wrong-key sessions return generic 401 before `loadAudio`; returned bytes must be a Buffer and exact bounded 16 kHz mono PCM WAV. |
| Cache/CORS/CSP | PASS - private audio is `private, no-store`, `Vary: Cookie`, `nosniff` and same-origin without CORS; the player has no external assets or autoplay and denies framing. |
| Staging isolation | PASS - activation requires the explicit player flag plus the exact existing staging mode/origin; production identity is not selected by request headers or path. |
| MCP isolation | PASS - review diff changes only the player module and its focused test; `/mcp`, `/paid-mcp`, provider and D1 code are unchanged. |
| Secret/debug leakage | PASS - no client secret, access token, refresh token, raw subject, email/name or console logging is present in the player path. |

## Residual live assumptions

- Offline tests prove implementation behaviour, not that the existing Auth0 SPA client has the correct callback, consent, token/userinfo policy or that a real code exchange succeeds.
- Safari/iPhone `__Host-` cookie return, SameSite callback behaviour, media-cookie attachment and audible playback remain unverified.
- No server-side authorization-code replay cache is added; the design relies on Auth0 authorization codes being one-time and PKCE-bound. A real Auth0 replay observation is still required during acceptance.
- The access token is not locally JWT/audience parsed; trust comes from the fixed TLS token endpoint, the fixed client/redirect/PKCE exchange and immediate use at the fixed userinfo endpoint. Real tenant behaviour remains to be observed.
- There is no explicit logout or rate limiter in this narrow P1. The session expires after one hour, secret rotation invalidates all sessions, and the fixed fixture is nonbillable. These are residual staging considerations, not newly closed gates.
- The P1 tone is non-sensitive test audio and is not subjected to a storage-isolation claim. The existing `/test-tone.wav` also serves the same synthetic tone; no user-specific or provider-generated audio exists in P1.
- No real D1/store authorization, one-time retrieval, P2 subject-scoped record lookup or iPhone audibility is implemented or claimed here.

## Verification

- Runtime: Node `v24.19.0`; npm `11.17.0`.
- Focused P1 security suite: **13 passed, 0 failed, 0 skipped** (`node --test test/private-web-player.test.js`).
- Full Node 24 suite: **264 passed, 0 failed, 0 skipped**.
- An intermediate focused run was **12/13** because the new test incorrectly expected `releaseLock` for a preflight rejection before any reader existed. Only the test expectation was corrected; final focused and full runs are green.
- `node --check server.js`, `src/private-web-player.js` and the focused test: pass.
- MCP smoke: initialize, tools/list and tool calls, plus protected-route fail-closed metadata: pass.
- `git diff --check`: clean.
- Normal pull-request CI is required after publishing this review branch; no manual Actions dispatch was used.

## Changed files

- `src/private-web-player.js` - bounded streaming response read and exact OAuth state format/equality.
- `test/private-web-player.test.js` - adversarial state-alias and bounded-stream/cancellation tests.
- `docs/v1-closure/P1-AUTH-SESSION-SECURITY-REVIEW-20261026.md` - this evidence record.

## Sole next operator action

Independently review this stacked Draft PR and its exact-head CI. If accepted, separately decide whether to approve the already identified Auth0 staging callback prerequisite and one-session iPhone acceptance. Do not deploy or enter P2 from this review alone.
