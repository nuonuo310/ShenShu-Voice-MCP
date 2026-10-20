# P2I GitHub OAuth exchange — read-only security review

Status: **BLOCKED for live authentication**. Existing public `server.js` has not registered this module.

## Confirmed

- The exchange module is staged on the Draft PR branch only.
- It requests an OAuth token from GitHub and uses it to query `/user`.
- It returns a stable numeric GitHub account ID, not the GitHub bearer.
- The latest CI passed, but this does **not** establish dedicated exchange tests passed: the intended test file was not added.

## Risks and required fixes before deployment

1. **Redirect binding:** Current `redirectUri.startsWith("https://")` is too broad. The HTTPS callback must be an exact server-configured allowlisted URI, never caller-selected, and match the initial authorization request.
2. **Network deadlines:** Add bounded request timeouts and response-size limits for both code exchange and user lookup. Treat timeouts as failure, with no automatic exchange retry.
3. **One-time state:** Persist OAuth state, tie it to redirect and initiating session, atomically consume it before code exchange, and verify nonce/PKCE where applicable. The staged state interface does not itself provide durable storage.
4. **Token issuance:** GitHub's access token must never be passed through to ChatGPT as the paid MCP credential. Complete authorization-server token issuance, signature/key rotation and audience-bound resource verification.
5. **Fail-closed owner restriction:** Require an explicitly approved immutable GitHub numeric account ID. Account login/email are not authoritative selectors.
6. **Refusal tests:** Wrong state, replay, user ID, redirect, token type, expired/invalid/forged resource token, unavailable GitHub, D1 denial and downstream timeout.
7. **Production isolation:** The public Render `/mcp` stays preview-only. No MiniMax credential, paid generation route, Call changes or Worker deployment until all gates pass.

## Decision

Do not merge the Draft PR or configure live OAuth credentials yet. Next slice is a controlled, isolated test of the exchange module and a strict callback binding implementation. No bypass of repository safety controls.
