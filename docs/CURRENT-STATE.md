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

## P2S — recovered Cloudflare D1 becomes canonical paid-admission path (2026-10-20)

- User verified the existing Cloudflare D1 database `shenshu-voice-budget-test` is live and non-empty: dashboard showed 17 queries, 106 rows read, 29 rows written and 1 application table.
- Live D1 schema recovered from `sqlite_master`:
  `paid_voice_reservations(request_id PRIMARY KEY, principal, day_utc, slot CHECK 1..20, created_at, UNIQUE(principal, day_utc, slot))`.
- Live rows prove real prior testing:
  - `test_owner` occupied slots 1 and 2 for day `2026-10-20`;
  - probe principal `probe_16444859c922438a927488438f83c7ee` occupied slots 1,2,3 for day `2026-10-19`.
- Therefore PostgreSQL is **not** the canonical production direction. Existing PostgreSQL files remain historical/candidate evidence only and must not be deployed unless explicitly re-authorized.
- Added `db/d1/001_paid_voice_reservations.sql` matching the recovered live schema, `db/d1/002_paid_voice_grants.sql`, `src/d1-paid-store.js` and tests.
- D1 reservation uses one atomic SQLite `INSERT OR IGNORE ... SELECT first-free-slot ... RETURNING` statement. Existing primary key prevents request replay; existing unique `principal/day/slot` constraint protects concurrent slot collisions. Limit remains server-supplied and max 20.
- One-use grant candidate uses D1 `paid_voice_grants`; consume is `UPDATE ... WHERE state='issued' RETURNING`, so replay returns no row and fails closed.
- D1 implementation/test commit `142889851719f885baf79ddc68a383b40289c0c3` CI **SUCCESS**.
- Cloudflare documentation confirms D1 batch statements are transactional and roll back the sequence on statement failure; our reservation path currently needs only one atomic statement. See https://developers.cloudflare.com/d1/worker-api/d1-database/
- **Next exclusive gate:** do NOT create a new database. Apply only migration 002 to the EXISTING D1 `shenshu-voice-budget-test` after explicit review/approval, then run real D1 concurrency/replay tests against the existing reservation table plus new grant table. No MiniMax call yet.
- Existing Auth0 OAuth PASS, public MOCK `/mcp`, Asteria-Call, Voice Worker and Voice Gallery remain unchanged.

## P2T — existing Cloudflare D1 migration 002 applied and live baseline recovered (2026-10-20)

- User applied `db/d1/002_paid_voice_grants.sql` manually to the EXISTING Cloudflare D1 database `shenshu-voice-budget-test`; Cloudflare reported successful execution.
- Live schema now includes:
  - `paid_voice_reservations` with PK `request_id`, UNIQUE `principal/day_utc/slot`, slot CHECK 1..20;
  - pre-existing index `paid_voice_reservations_by_owner_day(principal, day_utc)`;
  - new `paid_voice_grants` with unique request_id, state issued/consumed and FK to reservations;
  - new index `paid_voice_grants_principal_state(principal,state)`.
- Existing real test rows show `test_owner` occupies slots 1,2,3 for `2026-10-20`, and probe principal occupies slots 1,2,3 for `2026-10-19`. This confirms the prior D1 quota path was actively exercised, not an empty database.
- No existing reservation rows were modified or deleted. No MiniMax call occurred.
- **Next exclusive gate:** run live D1 SQL probes for (a) limit=3 fourth reservation refusal, (b) one grant issue tied to an existing test reservation, (c) first consume succeeds, (d) replayed consume returns no row. If all pass, record D1 admission as live-tested before any MCP-to-D1 runtime wiring.

## P2U — live Cloudflare D1 admission gate PASS (2026-10-20)

- Live D1 database: `shenshu-voice-budget-test`.
- Real production-like manual probes against existing test data all matched the intended fail-closed behavior:
  1. Existing `test_owner` already occupied slots 1,2,3 for `2026-10-20`.
  2. A fourth reservation candidate using the canonical first-free-slot SQL returned **no data**.
  3. Follow-up count for request_id `test_nuo_004_should_deny` returned `0`, proving no hidden insert.
  4. Grant `grant_test_nuo_003` for existing reservation `test_nuo_003` inserted successfully with state `issued`.
  5. First conditional consume returned one row and changed state to `consumed`.
  6. Replaying the exact same consume statement returned no row (Cloudflare UI reported successful statement execution but no RETURNING result), proving one-time consumption.
- Therefore the live D1 gate has now demonstrated: **daily slot limit, request replay protection, grant issuance, one-time grant consumption / replay denial**.
- No MiniMax call, no paid MCP tool, and no Call/Voice-Worker changes occurred.
- PostgreSQL remains superseded historical candidate only.
- **Next exclusive gate:** wire the already-PASS real OAuth principal to this D1 admission path in the authenticated MCP runtime, but expose only a NON-BILLABLE dry-run/admission diagnostic first. The diagnostic must prove a real authenticated principal can reserve/consume admission server-side without exposing principal/grant IDs and without calling MiniMax. Only after that should private audio delivery be tested.

## P2W — OAuth-to-live-D1 non-billable dry-run staged (2026-10-20)

- Added Render-compatible Cloudflare D1 REST client `src/cloudflare-d1-http.js` using the official Cloudflare API query endpoint `POST /accounts/{account_id}/d1/database/{database_id}/query`.
- Cloudflare account ID, D1 database ID and API token are environment-only values: `CF_D1_ACCOUNT_ID`, `CF_D1_DATABASE_ID`, `CF_D1_API_TOKEN`. They are never tool arguments/results and must never be committed.
- Added `src/d1-http-paid-store.js` mapping the canonical D1 SQL into the same reservation/issue/consume contract.
- Added `src/d1-admission-dry-run.js` and an optional authenticated MCP tool `verify_shenshu_d1_admission`.
- The dry-run uses a separate `dryrun_<verifiedSubject>` principal namespace and limit 20, so testing **does not consume the authenticated user's real paid voice quota**. It still uses the real D1 reservation + grant issue + one-time consume path.
- Tool is exposed ONLY when `SHENSHU_D1_ADMISSION_DRY_RUN_ENABLED=1` and all D1 environment values validate. Otherwise the authenticated connector continues exposing only `verify_shenshu_login`.
- Dry-run result exposes only `admission_verified`, `paid_voice_enabled:false`, `real_quota_consumed:false`; no principal, request ID, grant ID, Cloudflare IDs, token, or SQL data is returned.
- Official Cloudflare API docs confirm D1 query endpoint and recommend API Tokens; D1 Read or D1 Write permissions are accepted, while this workflow requires writes.
- A temporary test failure was only a deterministic UUID fixture mismatch; implementation unchanged. Latest fix/test commit `28f7b99b49299fcab1c16772f35339b7deff9622` CI **SUCCESS**.
- No live Render D1 credentials have been configured yet; no dry-run has touched Cloudflare through the MCP runtime, and no MiniMax call occurred.
- **Next exclusive gate:** obtain the existing Cloudflare Account ID and D1 Database UUID for `shenshu-voice-budget-test`, create a narrowly scoped D1 Write API Token, store all three ONLY in Render Environment together with `SHENSHU_D1_ADMISSION_DRY_RUN_ENABLED=1`, redeploy, then invoke `verify_shenshu_d1_admission` once through the already-connected OAuth MCP. Expected result: `admission_verified:true, paid_voice_enabled:false, real_quota_consumed:false`.
- Do not expose the API token in chat or GitHub. Do not add MiniMax secrets yet.

## P2V — Render -> Cloudflare D1 runtime wiring IN PROGRESS (2026-10-20)

- Real OAuth identity chain is already PASS in ChatGPT: `verify_shenshu_login` was successfully called in-chat and returned `authenticated:true, paid_voice_enabled:false`.
- Live Cloudflare D1 database `shenshu-voice-budget-test` is canonical. Its live reservation table and one-use grant table have both been manually verified; daily slot limit, request replay protection, grant issue, first consume and replay denial all PASS.
- PostgreSQL is superseded and MUST NOT be deployed unless explicitly re-authorized.
- Current implementation work is wiring the Render-hosted MCP to the existing Cloudflare D1 using Cloudflare's official D1 REST API, because Render cannot use a Worker-native `env.DB.prepare()` binding directly.
- Added:
  - `src/cloudflare-d1-http.js`: fixed Cloudflare D1 REST endpoint client using operator-only environment values;
  - `src/d1-http-paid-store.js`: maps REST query results to reservation/grant contract;
  - `src/d1-admission-dry-run.js`: NON-BILLABLE admission dry-run using a separate `dryrun_` principal namespace so it does not consume the authenticated user's real 3-call voice quota;
  - staging MCP support for optional tool `verify_shenshu_d1_admission` only when explicitly enabled.
- Cloudflare secret/config values are NEVER tool arguments or GitHub content. Intended Render-only env names: `CF_D1_ACCOUNT_ID`, `CF_D1_DATABASE_ID`, `CF_D1_API_TOKEN`, plus explicit `SHENSHU_D1_ADMISSION_DRY_RUN_ENABLED=1`.
- The initial REST adapter tests passed, but the latest dry-run integration test is currently RED with `dryrun_budget_denied`; this is an implementation/test mismatch under investigation. **Do not ask the user to configure Cloudflare token/IDs or enable dry-run until CI is green.**
- No MiniMax API call, no paid tool, no real quota consumption, and no Call/Voice-Worker change occurred in this slice.
- NEXT ONLY: fix and green the dry-run test; then record exact Render environment setup and perform one authenticated, NON-BILLABLE D1 dry-run from ChatGPT. If that passes, move to private audio delivery. Do not open `speak_shenshu` yet.

## P2V/W — Render-to-Cloudflare D1 dry-run wiring candidate (2026-10-20)

- Added Cloudflare D1 REST client for the Render-hosted MCP using the official `POST /accounts/{account_id}/d1/database/{database_id}/query` API.
- Added `src/d1-http-paid-store.js` adapter so the existing canonical D1 SQL can be used over REST; no SQL is built from user text, only parameter arrays vary.
- Added opt-in `verify_shenshu_d1_admission` authenticated MCP tool. It is exposed only when `SHENSHU_D1_ADMISSION_DRY_RUN_ENABLED=1` and valid Cloudflare D1 environment values are present.
- The dry-run uses a separate `dryrun_<verifiedSubject>` namespace and limit 20, so it does not consume the authenticated user's real paid-voice quota. It still performs live D1 reserve -> grant issue -> one-time consume and returns only:
  `admission_verified:true`, `paid_voice_enabled:false`, `real_quota_consumed:false`.
- Cloudflare account ID, database ID, and API token are environment-only and never appear in MCP tool arguments/results or GitHub.
- Initial dry-run tests failed only because deterministic fixture IDs did not match the generated IDs. Fixture alignment commit `21f354198de1b6934c7fe680eeafe1c777e158f4` CI **SUCCESS**.
- No MiniMax call, no paid tool, no real quota mutation, and no Call/Voice-Worker changes occurred.
- **Next exclusive gate:** provision three Render secrets/variables for the existing D1 database and enable the dry-run flag, redeploy, then invoke `verify_shenshu_d1_admission` once through the already-connected OAuth MCP. If it returns the three expected booleans, OAuth->D1 runtime admission is PASS. Do not add MiniMax secrets yet.

## P2W — OAuth-to-D1 non-billable dry-run ready (2026-10-20)

- Added Render-to-Cloudflare D1 REST adapter `src/cloudflare-d1-http.js`, D1 paid-store HTTP adapter, and non-billable `src/d1-admission-dry-run.js`.
- Runtime design: Render talks only to the existing Cloudflare D1 through Cloudflare's official REST API. Account ID, database ID and D1 API token come only from Render environment; never tool arguments, GitHub, MCP results or UI.
- Dry-run is separately gated by `SHENSHU_D1_ADMISSION_DRY_RUN_ENABLED=1`; absent/misconfigured values mean no dry-run tool is exposed.
- Authenticated stage now conditionally exposes `verify_shenshu_d1_admission`. It uses the verified OAuth principal but rewrites it into a separate `dryrun_` principal namespace and limit 20 so real paid daily quota is not consumed.
- Dry-run performs the real D1 reservation -> grant issue -> one-time consume sequence and returns only `admission_verified:true, paid_voice_enabled:false, real_quota_consumed:false`. It does not expose principal/request/grant IDs and never imports/calls MiniMax.
- Cloudflare REST and adapter tests are green. After correcting test fixture IDs to echo the actual bound UUID-derived values, commit `1300888d86e86ede3e6aeacf864c5030ad37da0f` CI **SUCCESS**.
- No Cloudflare API credentials have been configured yet. No live Render-to-D1 request has occurred from this new path.
- **Next exclusive gate:** configure Render secrets `CF_D1_ACCOUNT_ID`, `CF_D1_DATABASE_ID`, `CF_D1_API_TOKEN` and `SHENSHU_D1_ADMISSION_DRY_RUN_ENABLED=1`, using a narrowly scoped Cloudflare token with D1 write access to the intended account. Then reconnect/refresh the existing OAuth test connector and call ONLY `verify_shenshu_d1_admission` once. Expected: `admission_verified:true`, `paid_voice_enabled:false`, `real_quota_consumed:false`.
- Still no MiniMax key/tool, private audio delivery, or paid synthesis.


## P2W — OAuth -> live Cloudflare D1 NON-BILLABLE admission: PASS (2026-10-20, user-reported MCP result)

- Evidence provenance: user pasted the response from a freshly refreshed ChatGPT OAuth test connector after invoking `verify_shenshu_d1_admission` **once**. The assistant did not directly observe the tool invocation or inspect D1 rows. Reported structured result: `{"admission_verified":true,"paid_voice_enabled":false,"real_quota_consumed":false}`. No retry, MiniMax call, or paid voice tool invocation was reported.
- Render auto-deployed commit `5dbb6b60b650bde2bdb3b2a43b5b57273ccde8dd` after diagnostic PR #2 merged. User-provided Render startup log displayed `oauth_stage_enabled:true`, `dry_run_flag_enabled:true`, `d1_config_accepted:true`, `d1_tool_registered:true`, `paid_voice_enabled:false`. This is a local configuration/registration diagnostic, not proof of successful D1 network access by itself.
- OAuth connector tool discovery initially showed only `verify_shenshu_login`; after the user refreshed tools, a new chat reported `verify_shenshu_d1_admission` available and then the successful result above. Tool discovery cache is the observed operational issue; do not claim the protocol itself was defective.
- **Decision:** accept P2W non-billable admission dry-run as PASS on the reported result. This supersedes earlier P2V/P2W notes claiming D1 credentials are absent or live dry-run remains unexecuted. Do not treat this as proof of a paid synthesis path or production release.
- **Remaining gates:** independent review of authenticated paid-call boundaries, concurrency/replay and ambiguous failure handling, private short-lived audio delivery on ChatGPT/iPhone, and explicit user authorization before any billable MiniMax smoke test. Existing paid tool remains CLOSED; `paid_voice_enabled:false`.
- **Next authorized work:** read-only contract/code audit and test planning only. Do not provision MiniMax credentials, enable `speak_shenshu`, alter quota limits, or rerun live D1 admission without separate approval.
- No secrets, Cloudflare IDs, verified principal, request/grant identifiers, or SQL payloads are recorded in this checkpoint.


## P2X — OAuth HTTPS WAV iPhone PASS after narrow CSP allowlist (2026-10-20)

- User-confirmed on ChatGPT native iPhone App after Render `45ce17a` Live: OAuth identity-test tool `preview_oauth_hosted_tone_control` called once, returned existing voice bubble; initial transient load-failure message appeared for a few seconds, then cleared to `HTTPS 固定提示音测试（不扣积分）`; tapping play produced audible WAV. **OAuth UI + public fixed HTTPS WAV: PASS (audible)**.
- This followed PR #24 adding only `https://shenshu-voice-mcp.onrender.com` to OAuth UI `resourceDomains` (connectDomains remains empty). Evidence strongly implicates resource/CSP policy in previous HTTPS failure, but transient error and lack of independent CSP traces prevent definitive single-cause attribution.
- **NOT YET PASS:** OAuth `preview_private_fixture` inline data WAV still previously failed at `private-inline` media code 4; no private authenticated HTTPS generated speech delivery, no real MiniMax synthesis or paid voice release.
- **Next exclusive engineering step:** inspect/repair transient media load error state reporting without changing working HTTPS playback; then design authenticated private media retrieval (do not treat publicly hosted test-tone as private). Avoid re-running already successful hosted control unnecessarily.

## P2X — SAME-RUNTIME native ChatGPT iPhone comparison (2026-10-20, user confirmed)

- **Public HTTPS WAV PASS:** In native ChatGPT iPhone App, ordinary `沈述声音MCP` tool `preview_hosted_tone` produced an audible 0.7-second fixed synthetic WAV from `/test-tone.wav` (one call, user confirmed).
- **OAuth private inline WAV FAIL:** In the **same native ChatGPT iPhone App**, identity-test connector `preview_private_fixture` was called once with zero retries. The bubble rendered but immediately displayed `试听音频加载失败（阶段 private-inline，媒体码 4）` before pressing play. This confirms earlier Safari failure also reproduces in native app. Do not attribute failure merely to Safari-versus-App differences.
- Both tools source the same WAV generator (`makeInlineToneFixture`) and share the existing bubble. Transport/source and authenticated MCP resource contexts still differ, so this narrows suspicion to inline data-URI or sandbox policy but does not isolate the exact CSP rule or prove media decoder failure.
- **Current gate:** private inline WAV playback FAIL; public hosted fixture PASS. No authenticated private HTTPS media playback proven. Do not call P2X delivered.
- **Next:** inspect MCP Apps UI CSP/media-source handling and design a nonsecret isolated diagnostic that distinguishes data URI restriction from protected-resource CSP differences, without publishing private audio or changing paid controls. Avoid repeated user calls to the known-failing private fixture.

## P2X — identical WAV mobile transport A/B result (2026-10-20)

- **User-confirmed PASS:** `preview_hosted_tone` in ordinary `沈述声音MCP` produced an audible fixed 0.7-second WAV over `https://shenshu-voice-mcp.onrender.com/test-tone.wav` on iPhone in the ChatGPT native app. The user confirmed sound was heard; screenshot shows player with no load failure. This is a public, nonsecret synthetic tone only.
- **Previously confirmed FAIL:** the OAuth `preview_private_fixture` in `沈述声音MCP-身份测试` produced a player but failed to load `data:audio/wav;base64` with `private-inline`, media error 4, and `NotSupportedError` on playback. Those observations were made in ChatGPT through Safari, not established as the same native-app runtime.
- **Important confound:** successful HTTPS was tested in native ChatGPT App while prior private inline failures were on ChatGPT web/Safari. The fixture generator is the same, but both **transport and client runtime differ**. Do NOT claim this A/B conclusively isolates the data: URI as root cause. It is strong evidence HTTPS WAV can play in the native app.
- PR #19 identical-fixture source regression CI #181 PASS, merged `c80ef50`.
- **Next discriminating test:** compare private inline and public HTTPS WAV in the *same* ChatGPT native app runtime, using one nonbillable call each, with no repeated calls or paid tools. If private inline fails in native app too, transport restriction becomes more likely. If it succeeds, investigate Safari-specific media/CSP behavior. Keep OAuth/paid boundaries intact.
- **Do not redo:** public mock bubble UI, Render/OAuth/D1 setup, existing HTTPS fixture, or previously successful nonbillable D1 admission. Do not expose generated/private voice publicly or activate MiniMax.

## P2X — operational checkpoint / no rework (2026-10-20)

**Completed / verified:** Existing ChatGPT public mock player rendered and played an HTTPS fixture on iPhone per user confirmation (do not rebuild player). OAuth -> live D1 nonbillable admission PASS was reported once with `admission_verified:true,paid_voice_enabled:false,real_quota_consumed:false`. Render previously deployed OAuth private fixture tool with `SHENSHU_PRIVATE_FIXTURE_ENABLED=1`; user confirmed Live and tool invocation once, with player displayed. **Playback FAILED** on iPhone: `NotSupportedError`, media error `4`, readyState `0` for private inline WAV. Do NOT label mobile private audio delivery PASS.

**Repository work:** PR #5 offline private fixture delivery merged `72699ac`; PR #6 UI private-fixture adapter merged `b1e4c4c`; PR #7 OAuth private fixture tool/UI resource merged `ebf7452`; PR #8 safe playback diagnostics merged `44595a3`; PR #11 HTTPS security decision merged `9c39c6b`; PR #12 offline authenticated HTTPS WAV response contract merged `f522af2`. CI #167 PASS for PR #12. PR #9 Blob URL probe FAILED CI #163 due to explicit CSP/data URI invariant and remains draft; PR #10 offline in-memory one-use tickets CI #164 PASS but remains draft, NOT production deployable. The original mock player and public fixture must be preserved.

**Current blocker:** ChatGPT iPhone private inline WAV playback fails; successful public HTTPS fixture is NOT evidence that an OAuth-protected media URL can be fetched by HTMLAudioElement. Ordinary audio src cannot attach OAuth bearer header. No private HTTPS media route, durable audio storage, or authorized browser playback proven. The offline response contract is not a deployed service.

**Next exclusive step:** Investigate an authenticated browser-to-HTTPS audio delivery mechanism that preserves privacy and works with MCP Apps iPhone sandbox/CSP; implement only isolated tests/prototypes until an end-to-end nonbillable phone test can be authorized. Reuse existing UI. No secret/ticket in URL, no permanent public audio URL. Audit durable single-use authorization separately before MiniMax.

**DO NOT:** Reconfigure Cloudflare D1, repeat OAuth setup, recreate the player, merge PR #9 merely to green CI, deploy in-memory PR #10 as production, expose `speak_shenshu`, run MiniMax or spend paid quota, alter Asteria-Call/Voice-Worker. Prior old PostgreSQL/"OAuth not implemented" paragraphs below are historical and superseded by newer P2W/P2X checkpoints.

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
