# P2F — OAuth provider selection: Auth0 conditional candidate

Status: **design choice only / NO external tenant or login configured / NOT deployed**.

## Decision

Use **Auth0 as the first integration candidate**, because the official OpenAI authenticated MCP example documents Auth0 API audience configuration, PKCE login and enabling OIDC dynamic application registration.

Evidence:
- https://developers.openai.com/plugins/build/auth
- https://github.com/openai/openai-apps-sdk-examples/tree/main/authenticated_server_python
- https://developers.openai.com/plugins/build/plugins

This is not proof that a tenant, DCR or ChatGPT login works in our own project.

## Proposed endpoints and identities (NO actual credentials)

- Existing unauthenticated fixture MCP stays at `https://shenshu-voice-mcp.onrender.com/mcp`.
- Proposed separate paid endpoint `https://shenshu-voice-mcp.onrender.com/paid-mcp`, **not yet added**.
- The paid resource audience should be the full new paid MCP URL. Auth0 API identifier must be configured to issue access tokens for that audience.
- Auth0 tenant issuer is **not yet known**, must be operator-configured from an actual Auth0 account, never inferred from a user-submitted token or tool arguments.
- The protected resource metadata must advertise the actual Auth0 issuer and paid MCP resource.
- Prefer DCR where Auth0 tenant explicitly supports it and registration can be safely limited. Follow connector's actual ChatGPT callback/client registration mode rather than hardcoding redirect URIs.
- OAuth auth-code + PKCE S256, explicit `voice:speak` permission, and signed access token with correct `iss`, `aud`, `exp` and `scope`.
- Validate signing keys against a pin/trusted HTTPS JWKS and reject insecure key refresh / untrusted algorithm.
- Verify issuer/audience/signature/expiry/scope **on each privileged MCP call**; an identity token or unsigned claim must never substitute for a resource-scoped access token.

## Before provider activation

1. Obtain a real Auth0 issuer through an explicitly user-authorized account setup. Never ask the user to paste an API secret into chat or Git.
2. Verify real Auth0 OAuth metadata: authorization/token/JWKS HTTPS endpoints, PKCE S256, appropriate registration mode, resource/audience support and public-client token exchange configuration.
3. Configure a dedicated Auth0 API audience and a `voice:speak` scope; restrict to the authorized account/user. No arbitrary tenant-wide user may automatically spend MiniMax quota.
4. Host RFC 9728 metadata and a standards-compliant 401 WWW-Authenticate challenge on the *separate authenticated endpoint*; never convert the existing public fixture into a paid route.
5. Run a real no-credential denial and full OAuth login smoke; test invalid issuer/audience, missing scope, expiry and replay/duplicate calls. Confirm profile identity is only from verified access token.
6. Later complete PostgreSQL durability/concurrency and one-use request bound reservations, private audio delivery and explicit consent before a **single** paid MiniMax request.

## Scope guard completed separately

`createVerifiedIdentityResolver` now accepts `requiredScopes`; the paid path must explicitly pass `["voice:speak"]`. A token with a valid RSA signature but without that scope fails with `insufficient_scope`. Existing default behavior remains for offline test compatibility. **No paid handler imports this verifier yet.**

## Hard STOP

- No live Auth0 provider exists here.
- No Render secrets/keys, no database credentials and no MiniMax paid tool enabled.
- A service-level hard budget must still protect against any verified user draining the shared MiniMax account.
- Do not edit Asteria-Call, Asteria-Voice-Worker, or ShenShu-Voice.
