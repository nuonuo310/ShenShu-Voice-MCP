# ShenShu Voice MCP — CURRENT CONSTRUCTION STATE

Last verified: 2026-10-20 (read-only GitHub inspection before this checkpoint).
Status authority: actual GitHub HEAD + CI + code > this document > conversation recollection.
This file is the FIRST ENTRY for any assistant or coding agent resuming this project.

## Immutable reference at checkpoint creation

- Repository: `nuonuo310/ShenShu-Voice-MCP`, branch `main`.
- Reviewed HEAD before this checkpoint: `204f7c5521cdf72bbe40c12146a91a60f9c59212`.
- CI at that SHA: completed, success. Historical README reports 14/14 tests.
- This checkpoint itself adds a commit; do **not** mistake the reviewed HEAD above for the future branch tip.
- Deployment previously reported: `https://shenshu-voice-mcp.onrender.com/mcp`; verify live state independently before action.
- ChatGPT connection previously reported as `沈述声音MCP`; user confirmed MOCK audio playback. Do not treat this as live TTS success.

## Finished and verified

1. Independent repo exists and can be read/written.
2. P0 input/WAV contracts and offline bubble exist.
3. P1 MOCK HTTP MCP `/mcp`, tool `preview_shenshu_voice`, UI resource `ui://shenshu/voice-bubble-v1.html` implemented; ChatGPT mock sample playback previously user-confirmed.
4. MiniMax fixed-voice `speech-2.8-hd` adapter and isolated paid-core staged, NOT exposed to users.
5. Paid admission contract, in-memory offline tests, PostgreSQL atomic reservation candidate and SQL migration staged. CI is green at reviewed HEAD.
6. Original `Asteria-Call`, `Asteria-Voice-Worker` and `ShenShu-Voice` are separate, protected workstreams. Do not edit or redeploy them for this project.

## P2C — 2026-10-20 identity verification slice (staged, NOT released)

- Added `src/verified-identity.js` and `test/verified-identity.test.js`.
- Offline RS256 JWT verification checks trusted-config issuer/audience/JWK key id, actual RSA signature, expiry, issue time, not-before and maximum token lifetime; maps signed `sub` to an opaque fixed-format database principal.
- This module is deliberately NOT imported by public `server.js`, NOT an OAuth provider, NOT wired to Render or any paid MCP tool. No real trust anchors, token secrets, or provider login configured.
- Next gate: choose and verify a real OAuth/OpenID issuer, implement MCP Protected Resource Metadata (RFC 9728) + authorization discovery and authenticate a distinct paid endpoint. Then connect it to durable budget with one-use server grants; never switch the existing no-auth mock into paid mode prematurely.
- Check CI on the most recent SHA before claiming this slice passed tests.


## P2D — OAuth discovery offline groundwork (2026-10-20, NOT deployed)

- Fixed a flaky P2C tamper test: it now changes signed JWT payload bytes, not a potentially equivalent base64url ending.
- Added `src/oauth-resource-metadata.js`: strict operator-configured RFC 9728 protected resource JSON and WWW-Authenticate challenge builders, without any provider credentials.
- Added `test/oauth-resource-metadata.test.js`: metadata shape, HTTPS/trust-anchor refusals, and 401 challenge cases.
- **This is only isolated code.** No provider has been selected, no actual OAuth login or issuer discovery is configured, and public `server.js` was not changed.
- **Next exclusive step:** choose a trusted authorization-server issuer supported by ChatGPT, validate its OIDC/OAuth metadata and token audience handling, then implement a separate authenticated paid route behind a fail-closed admission check. Do not add an unsecured paid tool.
- Current CI must be checked against current HEAD before any PASS claim.

## P2E — 2026-10-20 OAuth issuer discovery verification (OFFLINE ONLY)

- Added `src/oauth-provider-discovery.js` and `test/oauth-provider-discovery.test.js`.
- Offline validator requires an operator-pinned HTTPS issuer, matching metadata issuer, HTTPS authorization/token/JWKS endpoints, authorization-code support and PKCE S256. No server network fetching or live OAuth requests.
- This validates metadata only; it does NOT implement OAuth login, callback processing, access-token minting, refresh, dynamic registration or live JWK rotation. It does not prove any external vendor is compatible.
- Public `server.js` and deployed No-auth MOCK endpoint remain unchanged; no charged MiniMax calls or secrets.
- **Next exclusive gate:** choose/verify an actual issuer and ChatGPT client-registration method, test issuer/audience and protected resource metadata on isolated authenticated staging route; then verify database quota and private audio before enabling paid tools.
- Test status must be verified for the current SHA independently of this note.


## P2F — Auth0 candidate + explicit voice permission (2026-10-20)

- Latest provider research: official OpenAI authenticated MCP example uses Auth0 with OAuth auth-code/PKCE and DCR; see [OAUTH-PROVIDER-DECISION](OAUTH-PROVIDER-DECISION.md).
- **Decision is conditional**: Auth0 is the first candidate, NOT an actually connected issuer; real issuer URL, token audience, client registration capability and access-token permission still require independent verification.
- Added required OAuth scope validation in `src/verified-identity.js` with tests, so a correctly signed token without `voice:speak` is rejected. Actual privileged handler must explicitly set `requiredScopes:["voice:speak"]`.
- Proposed separate future `/paid-mcp` resource; NOT implemented or deployed. Existing public `/mcp` MOCK remains unchanged.
- Next ONLY: verify actual authorization-server onboarding and credentials securely, then develop a separate fail-closed protected endpoint. No real MiniMax TTS without all paid gates.
- Validate CI status for this commit; doc alone does not prove pass.

## P2G — Auth0 user onboarding and client registration policy (2026-10-20)

- User reports Auth0 Free registration, API `ShenShu Voice MCP` with identifier `https://shenshu-voice-mcp.onrender.com/paid-mcp`, RS256, and a saved `voice:speak` permission. These are user-reported UI actions and not yet API-verified.
- Updated `docs/OAUTH-PROVIDER-DECISION.md`: prefer controlled ChatGPT registration (provided client or CIMD if supported), rather than enabling Auth0 open DCR by default. Explicit client grants and verified audience/scopes are mandatory.
- **Next exclusive step:** obtain the Auth0 tenant Domain (nonsecret), independently verify its metadata, and identify which ChatGPT client registration mode our tenant supports. No client secret in chat; no paid route until all gates.
- Public MOCK and Call remain untouched.

## P2H — Auth0 tenant domain received; discovery diagnostic staged (2026-10-20)

- User supplied Auth0 tenant domain `dev-nwr87q0tnrbjeapr.us.auth0.com` (public identifier; not a secret). The expected issuer is `https://dev-nwr87q0tnrbjeapr.us.auth0.com/`.
- Attempts to fetch its OIDC metadata via available web/container routes failed from this environment. **Do not claim live tenant metadata verified**; do not infer DCR/CIMD support or token endpoint methods until actual response is captured.
- Added `src/auth0-discovery-check.js` + isolated tests: operator-pinned Auth0 domain, one HTTPS OIDC discovery request, HTTPS issuer/endpoint/PKCE metadata validation. NO provider secrets, no live authorization or paid MiniMax requests, no change to public MCP server.
- New diagnostic module is not wired to public route; CI must be checked at current HEAD before claiming PASS.
- **Next exclusive step:** obtain and verify real tenant OIDC metadata response through an authorized accessible route (without secrets); select a supported ChatGPT client registration mode, then implement isolated fail-closed protected staging route. Never enable payment while identity, durable quota, single-use admission, and private audio delivery are missing.

## Current STOP: identity / paid admission gates (P2, NOT released)

- Public Render `/mcp` remains **NO AUTH** and MOCK ONLY.
- No verified OAuth or other cryptographic user principal for paid operations.
- No deployed PostgreSQL pool/migration, no real parallel-transaction test, no deployed durable quota.
- No server-side atomic single-use grant bound to an invocation.
- No approved, authenticated/private short-lived audio delivery proven in ChatGPT on iPhone.
- No live MiniMax request, no payment credentials committed, and no paid `speak_shenshu` tool enabled.
- Daily paid reservation target is initially 3 attempts per verified user/day, not active. Shared upstream MiniMax quotas remain a separate consideration.
- Keep no-auth `preview_shenshu_voice` available while designing secure path. Do not accidentally expose `speak_shenshu`.

## Next authorized sequence — no shortcut

1. **IDENTITY FIRST**: inspect latest main and current deployed Render state; design and test authenticated identity verification for every paid route. No trust in caller-chosen name, tool args, unsigned headers, or client `oneTime:true`.
2. **DURABLE ADMISSION**: verify actual PostgreSQL concurrent reservations, duplicate request rejection, per-principal/day limits, one-time grant consumption; ensure paid calls cannot bypass reservation.
3. **AUDIO DELIVERY**: mock with realistic audio, test authenticated short-lived output and ChatGPT iframe/CSP/iPhone playback. No publicly permanent audio and no tokens in URL.
4. **DEPLOY STAGING + VERIFY**: keep live paid tool disabled; run CI/integration and independently inspect HTTP tools/list and authorization behavior.
5. **REAL PAID SMOKE**: ask user's explicit authorization for one billable MiniMax generation; only after all previous gates pass, no retry on uncertain results.

## Mandatory resumption protocol

Before advising or writing code on EACH future work session:
- Read `docs/CURRENT-STATE.md`, `docs/LIVE-SECURITY-GATE.md`, `docs/PAID-ADMISSION-CONTRACT.md`.
- Check GitHub current `main` HEAD, changed files since recorded checkpoint, latest CI, and deployed route status if available.
- State in plain Chinese: `已完成 / 当前卡点 / 本次唯一下一步 / 不得触碰`.
- If repo and checkpoint differ, report the discrepancy; update checkpoint based on evidence, do NOT overwrite newer code.
- Never tell user to redo GitHub/Render/MCP setup without verifying that a resource is missing.
- Do not request user to remember technical terms or source-control state.
- No secrets in GitHub; no production paid tool on no-auth MCP; never touch Call freeze.
