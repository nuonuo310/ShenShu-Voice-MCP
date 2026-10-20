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

## P2I — user-provided real Auth0 OIDC discovery assessed (2026-10-20)

- User successfully fetched the public `/.well-known/openid-configuration` document from `dev-nwr87q0tnrbjeapr.us.auth0.com` and pasted it into chat. The data is **user-supplied, not independently downloaded by this runtime**.
- Verified from supplied values: issuer `https://dev-nwr87q0tnrbjeapr.us.auth0.com/`, HTTPS authorization/token/JWKS paths, authorization-code grant, PKCE S256, token endpoint auth methods including `none`, `client_secret_post`, `client_secret_basic`, `private_key_jwt`, and authorization response issuer signal.
- The document DOES NOT advertise `registration_endpoint` or `client_id_metadata_document_supported`. **Do not presume DCR or CIMD registration works.** The preferred next feasibility study is ChatGPT `provided` client registration with a separately registered, controlled third-party OAuth application. Verify callback URI, Auth0 client grant, third-party access policy and API audience before making changes.
- `voice:speak` is not in the OIDC discovery `scopes_supported` list; this alone does NOT invalidate the API-specific permission the user created. It needs a real audience-bound access-token proof.
- Added `test/auth0-user-discovery-fixture.test.js` with public (non-secret) representative values and explicit negative registration assertions. This is validation only, NOT login or client setup.
- Auth0's Resource Parameter Compatibility Profile may be needed for MCP `resource` to map to the API audience; verify actual issued `aud` before enabling protected functionality.
- **Next exclusive action:** verify the ChatGPT provided-client requirements and Auth0 dashboard's controlled client-registration settings; do not enable open DCR, do not expose credentials, do not open paid TTS.
- Public MOCK `/mcp`, original Call and Voice Worker are unchanged.

## P2J — Separate paid MCP route is fail-closed (2026-10-20)

- Implemented `src/protected-resource-shell.js` and wired into `server.js` **before** the existing public `/mcp` route. Existing mock tools and audio fixture remain unchanged.
- `GET /.well-known/oauth-protected-resource/paid-mcp` publishes resource metadata for `https://shenshu-voice-mcp.onrender.com/paid-mcp`, advertising configured Auth0 issuer `https://dev-nwr87q0tnrbjeapr.us.auth0.com/` and `voice:speak`. These are public discovery identifiers, not secrets.
- **ALL** requests to `/paid-mcp` return 401 with RFC 9728 resource metadata challenge, even if they include an Authorization token. There is NO paid MCP tool, no login handler, no MiniMax call, no secret configuration.
- CI at test commit `876690477076fe74059ea7a3d1d8dd96240104e6` PASSED, including local HTTP smoke checking discovery metadata and unauthorized/forged-token denial.
- This proves the route is **closed** under tested scenarios; it does NOT prove Auth0 login works or that ChatGPT connects to this protected route. No production database, one-use grant or private audio is deployed.
- No Auth0 callbacks were entered by the user. The existing SPA application's Allowed Callback URLs should remain unchanged until ChatGPT's real registered redirect is known.
- **Next gate:** verify Render actually deployed this commit, then perform non-paid OAuth client registration / login compatibility tests against the separate protected route. Do NOT open `speak_shenshu` before real identity, durable quota, one-use grant and secure audio delivery are independently proven.

## P2K — verified identity diagnostic gate, no paid capability (2026-10-20)

- Added `src/paid-auth-probe.js` and `test/paid-auth-probe.test.js`. Offline-only injection of RS256 verifier, pinned Auth0 issuer, exact paid-mcp audience, explicit `voice:speak` scope.
- Defaults DISABLED. When enabled in tests, valid signed identity returns **403 paid_voice_disabled**, never an authorization to use MiniMax. Missing/forged/wrong-audience/expired tokens return 401; valid token without scope returns 403 insufficient_scope.
- No verified identity/credential details are exposed to callers. No real Auth0 token has been obtained. This code is deliberately NOT imported by public `server.js`; no deployment of authenticated probe occurred.
- Code commit `e89a00dc18a01fb284f835a76d6b8f16ba156e9a` GitHub CI completed SUCCESS.
- User has created Auth0 API, voice:speak permission, and SPA client; Allowed Callback URLs remain unfilled by agreement. No secret supplied or needed for this mock.
- **Next exclusive gate:** obtain the exact OAuth redirect from the ChatGPT MCP management flow, confirm provided-client registration works with the SPA's actual Auth0 client ID and resource/audience parameter, then connect an isolated staging auth verifier with trusted JWKS. Do NOT accept a real paid request until durable budget, single-use server grant, private audio delivery and explicit user approval are all proven.
- The existing no-auth `/mcp` and fail-closed `/paid-mcp` endpoints, Asteria-Call, Voice-Worker and voice gallery remain untouched.

## P2L — optional Auth0 signed-token check on protected route (2026-10-20)

- Code now wires `createConfiguredPaidDiagnostic` to the existing `/paid-mcp` through an asynchronous protected shell. New files `src/configured-paid-diagnostic.js` and `test/configured-paid-diagnostic.test.js`.
- **Default behavior unchanged:** `SHENSHU_AUTH_DIAGNOSTIC_ENABLED` absent/other than `1` means ALL paid-path requests still return 401; no trusted JWKS configured => still 401.
- The optional check requires `SHENSHU_AUTH_DIAGNOSTIC_ENABLED=1` and operator-provided `SHENSHU_AUTH_PUBLIC_JWKS_JSON` (public JWK document only), plus fixed Auth0 issuer `https://dev-nwr87q0tnrbjeapr.us.auth0.com/`, resource audience `https://shenshu-voice-mcp.onrender.com/paid-mcp` and scope `voice:speak`. Do not source any of these values from caller arguments or headers.
- When diagnostics are configured, valid signed access-token + proper scope returns **403 paid_voice_disabled**, NOT a grant. Missing/invalid token => 401; missing scope => 403 insufficient_scope. No token or principal is reflected.
- `/paid-mcp` is still NOT an MCP Streamable HTTP endpoint for authenticated sessions. No OAuth login flow, client registration, trust-key rotation, database admission, MiniMax invocation or private audio delivery is available.
- CI at implementation/test commit `f43af679b5d2d1e5c47a8a703ecf6949b422ea09`: SUCCESS. Fake RSA keys used in tests only; no actual Auth0 token was received.
- **Do NOT enable diagnostics on production Render yet.** First verify the actual Auth0 JWKS trust chain and approved ChatGPT provided-client configuration, exact callback URL and audience token flow. A static public-JWKS snapshot lacks automatic rotation; design safe refresh and key failure before production real login.
- Original `/mcp` mock, Call, Voice Worker, voice gallery and billable TTS remain untouched.
- Next step: collect the exact ChatGPT OAuth redirect from the new connector setup and Auth0 app's nonsecret Client ID through user-controlled UI; verify controlled registration and audience without asking for Client Secret, access token, or credentials.

## P2M — authenticated non-billable MCP handshake (2026-10-20)

- Code: `src/staging-authenticated-mcp.js` and `test/authenticated-stage.test.js` added; `src/protected-resource-shell.js` conditionally routes requests to the non-billable stage.
- **Default remains LOCKED**: unless Render has `SHENSHU_AUTH_MCP_ENABLED=1` and operator-validated `SHENSHU_AUTH_PUBLIC_JWKS_JSON`, `/paid-mcp` continues returning 401 without opening a paid tool.
- With test-only generated RSA keys configured, every MCP HTTP request validates signature, pinned issuer, exact `/paid-mcp` audience, expiry, and `voice:speak` scope. Authenticated clients can initialize and invoke only `verify_shenshu_login`, returning `paid_voice_enabled:false`. Invalid, expired, wrong audience or missing scope requests denied; subsequent unsigned tool calls also denied.
- Code/test commit `9f5fbabba09c885ec3ea53a754aa6ffa1a211b4b` GitHub CI **SUCCESS**. Test uses fake keys only. No real Auth0 token, no real paid synthesis.
- Saved all user-confirmed NONSECRET Auth0/ChatGPT OAuth field values to `docs/OAUTH-SETUP-REFERENCE.md`; users no longer need to keep the ChatGPT creation form open to retrieve settings.
- **This does not mean production OAuth works.** Real Auth0 JWKS keys are not provisioned or refreshed; user authorization callback flow and resource-audience token are not verified. Paid tools, quota writes, private audio delivery and MiniMax remain absent.
- NEXT ONLY: independently verify tenant's public JWKS and design safe key rotation/fail-closed handling; obtain explicit approval before enabling even the non-billable diagnostic in Render. Then test ChatGPT login once, without replacing the public MOCK connection.
- Do not touch Asteria-Call, original Voice Worker, or voice gallery.

## P2N — Auth0 JWKS trust refresh/cache candidate (2026-10-20)

- Added `src/auth0-jwks-cache.js` and `test/auth0-jwks-cache.test.js`. This is a standalone, unconnected, **NON-PRODUCTION** security component; production `server.js`, `/mcp` and `/paid-mcp` remain unchanged.
- Uses pinned Auth0 public JWKS URL `https://dev-nwr87q0tnrbjeapr.us.auth0.com/.well-known/jwks.json`, refuses attacker-selected endpoints, non-RS256/signature keys, duplicate KIDs and private-key material.
- Enforces 64 KiB streamed response bound, HTTPS-only pinned destination, 8s timeout by default, small TTL, deduplicated concurrent refresh, key rotation on successful refresh and **fail-closed on stale-refresh failure**. No grace use of stale keys.
- CI at implementation/test commit `eac18f6ff377e2c421ae40149569db387761b228`: SUCCESS, all added offline tests passed. No real Auth0 JWKS retrieval was performed in this test, and no real token was used.
- This code is **NOT wired** to either P2L diagnostic or P2M authenticated MCP. Such integration requires deliberate trust-boundary review, treatment of untrusted issuer metadata, rotation and timeouts, and actual Auth0 JWKS verification.
- **Next exclusive gate:** independently read and validate real tenant public JWKS from a trusted route; verify real access-token issuance with audience and scope through the already-provisioned Auth0 SPA client, keeping all tools non-billable. Do not enable Render auth flags until explicitly authorized.
- Call, Voice Worker, Voice Gallery, original MOCK MCP and paid MiniMax remain untouched.

## P2O — rotating JWKS wired into staged OAuth verifier (2026-10-20)

- P2N JWKS cache is now supported by `src/staging-authenticated-mcp.js`; the protected staging route constructs one pinned Auth0 cache and, when authentication staging is explicitly enabled, verifies each request against currently cached/rotated keys.
- Production staging no longer accepts a static JWKS environment snapshot. Static `SHENSHU_AUTH_PUBLIC_JWKS_JSON` is usable only when the dedicated `SHENSHU_AUTH_STATIC_JWKS_TEST_ONLY=1` flag is set; HTTP tests use that flag. Do NOT set it on Render.
- Dynamic path uses only the repository-pinned `https://dev-nwr87q0tnrbjeapr.us.auth0.com/.well-known/jwks.json`; endpoint cannot be selected by user/token. Cache refresh failure after expiry fails closed.
- Added `test/staging-rotating-jwks.test.js` and updated authenticated HTTP test. A temporary CI failure was caused by using `NODE_ENV=test` (which intentionally prevents `server.js` from listening); replaced with dedicated test-only flag. Latest fix/test commit `e48298edceb71b6509f35c8feb0f393315199ffe` CI **SUCCESS**.
- No real Auth0 JWKS was downloaded by CI, no real access token was issued, and Render auth staging remains disabled unless explicitly configured. There is still no paid MCP tool, quota mutation, private audio delivery or MiniMax call.
- **Next exclusive gate:** inspect the real public Auth0 JWKS (nonsecret) and then explicitly approve/enable the NON-BILLABLE Render OAuth staging flag for one ChatGPT login attempt. The only tool must remain `verify_shenshu_login` returning `paid_voice_enabled:false`. If JWKS validation or audience/scope issuance fails, STOP; do not weaken verification.
- Public `/mcp`, Asteria-Call, original Voice Worker and Voice Gallery remain untouched.

## P2P — real Auth0 public JWKS fixture validated (2026-10-20)

- User fetched the tenant's official public JWKS document from `https://dev-nwr87q0tnrbjeapr.us.auth0.com/.well-known/jwks.json` and supplied it in chat. It contained two RSA signing keys with `use=sig`, `alg=RS256`, unique KIDs `e0gVxtW9x9tjNh7LNvLPE` and `R9HzjCHmHPE86pa72yazT`.
- Added `test/auth0-real-jwks-fixture.test.js` containing only the public JWK components needed for compatibility checks (`kty/use/alg/kid/n/e`); no certificates, tokens, secrets or private key material stored.
- Real-fixture compatibility test commit `341104148626293102c49949272e48c945335443` GitHub CI **SUCCESS**. Both public keys are accepted by Node's JWK parser and by our bounded JWKS cache validator.
- This validates key SHAPE and current public trust material only. CI did not download the tenant itself and no real Auth0 access token has yet been issued to ChatGPT.
- P2O dynamic JWKS path remains the only production-staging trust path. Do NOT configure static JWKS JSON on Render; do NOT set `SHENSHU_AUTH_STATIC_JWKS_TEST_ONLY` there.
- **Next authorized gate:** enable ONLY the non-billable OAuth staging handshake on Render with `SHENSHU_AUTH_MCP_ENABLED=1`. Do not add MiniMax secrets or any paid tool. Then create a separate ChatGPT connector pointed at `/paid-mcp` using the saved provided-client OAuth settings and test one real login. Expected authenticated toolset: ONLY `verify_shenshu_login`, returning `paid_voice_enabled:false`.
- If login fails due to audience/resource/scope/callback, STOP and diagnose; do not weaken validation. Existing public `/mcp`, Asteria-Call, Voice Worker and Voice Gallery remain untouched.

## P2Q — ChatGPT action discovery compatibility fix (2026-10-20)

- User observed real ChatGPT UI status: **"Authentication succeeded, action discovery failed"** after Gmail login. This proves the OAuth flow reached a successful authentication state; failure moved to MCP action/tool discovery.
- Root causes addressed without weakening auth:
  1. JWT `aud` validation now accepts either the exact resource string or a standards-compliant audience array containing the exact `/paid-mcp` resource; arrays not containing it still fail.
  2. Auth0 staging verifier permits up to 86400-second access-token lifetime (Auth0 API default may be 24h), while still enforcing signed `exp/iat/nbf`, issuer, resource audience and `voice:speak`.
  3. Staging identity MCP was migrated from high-level `McpServer.registerTool()` to low-level `Server` request handlers solely for the one non-billable test tool, because MCP SDK v1 does not serialize OpenAI-required root-level `securitySchemes` from the high-level registry.
- `tools/list` now emits one deterministic tool `verify_shenshu_login` with root-level and mirrored `_meta.securitySchemes=[{type:"oauth2",scopes:["voice:speak"]}]`, strict empty-object input schema and structured output showing `paid_voice_enabled:false`.
- Low-level `tools/call` handler manually enforces exact tool name and zero-argument schema to avoid the low-level SDK input-validation gap.
- Implementation commit `834c597e3d6e1bd73cc769f3fe89738166b6b3ea` CI **SUCCESS**, including the authenticated HTTP discovery assertion for root-level securitySchemes.
- OpenAI current auth docs require protected resource metadata + per-tool `securitySchemes`; OAuth authentication alone is insufficient for tool discovery/linking.
- No paid tool, MiniMax call, quota mutation or private audio path was introduced. Public MOCK `/mcp`, Asteria-Call, Voice Worker and Voice Gallery remain unchanged.
- **Next exclusive gate:** wait for Render to deploy this commit, then reconnect the existing "沈述声音MCP-身份测试" once. Expected outcome: action discovery succeeds and the only discovered tool is `verify_shenshu_login`. If discovery still fails, inspect Auth0 token audience/scope or Render logs; do not weaken security or reconfigure Auth0 blindly.

## P2R — real OAuth PASS + durable one-use admission candidate (2026-10-20)

### Real OAuth result

- ChatGPT UI reached a green connected state for `沈述声音MCP-身份测试`.
- This conversation then exposed the connector tool `verify_shenshu_login`; the assistant invoked it successfully and received exactly:
  - `authenticated: true`
  - `paid_voice_enabled: false`
- Therefore the real chain **Auth0 login -> ChatGPT OAuth -> action discovery -> protected MCP tools/call** is now verified PASS for the non-billable identity tool.
- This does NOT authorize MiniMax. The only live authenticated tool remains non-billable.

### Durable admission candidate

- Added `db/002_paid_voice_grants.sql`, `src/postgres-grant-store.js`, `src/durable-paid-admission.js` and tests.
- Candidate flow is strictly server-side:
  1. cryptographically verified principal;
  2. durable daily budget reservation;
  3. server-generated grant issued in PostgreSQL;
  4. the exact grant is consumed once, BEFORE any paid upstream attempt;
  5. only then return an internal `allowed:true, oneTime:true` authorization object.
- Grant IDs are never accepted from MCP tool arguments and never returned to the client. Replay consumes zero rows and fails closed.
- Reservation/grant failures are conservative: no automatic refunds after a reservation because an uncertain future provider attempt could be billable. There is still no retry behavior.
- Candidate/test commit `c076afbd53967132e6a0b3b2902b7da4d10f3acb` CI **SUCCESS**. This is offline fake-database coverage; no real PostgreSQL instance/migration/concurrency test has occurred.
- No production paid tool imports this authorizer yet. MiniMax remains completely closed.
- **Next exclusive gate:** provision an isolated PostgreSQL database for this MCP, run migrations 001 + 002, then perform real concurrent reservation/one-use grant tests. Do not add MiniMax secrets or `speak_shenshu` before the database gate passes.
- Existing public MOCK `/mcp`, authenticated identity test connection, Asteria-Call, Voice Worker and Voice Gallery remain unchanged.

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
