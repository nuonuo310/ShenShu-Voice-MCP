# ChatGPT + Auth0 setup reference (public identifiers only)

**DO NOT put Client Secret, MiniMax API key, bearer token, authentication code, password, or session cookie here.**

This is a human-readable record of values already supplied/confirmed by user in October 2026. Auth0 UI save state is user-reported; real OAuth issuance and login have NOT been proven.

| Field | Value |
| --- | --- |
| Auth0 tenant issuer | `https://dev-nwr87q0tnrbjeapr.us.auth0.com/` |
| Auth0 API name | `ShenShu Voice MCP` |
| API identifier / MCP resource | `https://shenshu-voice-mcp.onrender.com/paid-mcp` |
| API permission | `voice:speak` |
| Auth0 client application | `ShenShu ChatGPT Client` (Single Page Application, public client) |
| OAuth Client ID | `B4ESGc0BTdTHSOY2BX36nXV4dPjUu1LI` |
| Client Secret | **None. Do not supply.** |
| Token endpoint auth method | `none` |
| Authorization endpoint | `https://dev-nwr87q0tnrbjeapr.us.auth0.com/authorize` |
| Token endpoint | `https://dev-nwr87q0tnrbjeapr.us.auth0.com/oauth/token` |
| ChatGPT redirect URI | `https://chatgpt.com/connector_platform_oauth_redirect` (user-confirmed from actual UI; saved in Auth0 by user) |
| OAuth registration | provided client, NOT DCR / CIMD |
| Default OAuth scope | `voice:speak` |
| Base scope | blank |
| OIDC extension | off for initial test |
| Existing public MOCK MCP | `https://shenshu-voice-mcp.onrender.com/mcp` — do not modify |

## Verification accomplished

- User confirmed Auth0 User-delegated Access for ShenShu ChatGPT Client shows `1 / 1`.
- User opened the RFC 9728 resource metadata and verified resource / auth server / voice scope keys.
- User opened `/paid-mcp` without an authorization header and observed `{"error":"unauthorized"}`.
- No actual signed access token was yet issued or tested through ChatGPT.

## Development status (P2M)

- Separately authenticated test MCP code is committed and passes mock signed-token tests.
- It is **disabled on Render by default** (`SHENSHU_AUTH_MCP_ENABLED` must be explicitly set to `1` and public JWKS must be provisioned).
- The only authenticated MCP tool when enabled is `verify_shenshu_login`; it generates **no audio** and costs **zero MiniMax credits**.
- **Do not enable or deploy OAuth on live Render without explicit approval and a reviewed JWKS refresh/rotation policy, Auth0 audience test, and the precise client callback.**
- Do not claim a successful ChatGPT OAuth connection while the route is closed.

## Subsequent work (not for user to repeat now)

1. Independent verification of the Auth0 JWKS document at the issuer pinned in the repository.
2. Design a fail-closed trust-key refresh and rotation policy, using safe caching and bounds; review bearer-specific error/WWW-Authenticate handling.
3. Approve a safe activation of **non-paid** identity test, then one ChatGPT login attempt without touching production mock.
4. Later PostgreSQL durable quotas, single-use grants, private audio delivery. Real MiniMax tests only after explicit consent.
