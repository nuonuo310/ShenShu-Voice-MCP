# Paid voice OAuth isolation — selected architecture, NOT deployed

Basis: Cloudflare Workers OAuth Provider v1 split API (Oct 2026).
Reference: https://developers.cloudflare.com/changelog/post/2026-10-01-workers-oauth-provider-1x/

## Frozen boundaries

- Existing public Render `/mcp` retains *only* non-billable audio test tools.
- A separately authenticated paid MCP resource server will be required.
- Authorization server and resource server should be separate Cloudflare
  Workers, with a private service binding for token validation.
- Authentication service must securely sign in the user's chosen provider
  identity (e.g. GitHub) and issue resource/audience-bound MCP tokens.
- Resource server must validate issuer, audience, expiration and scope, then
  enforce an **allowlisted immutable account subject**, not email display text.
- `voice:generate` is the only paid scope. No permission to edit Call, the
  audio gallery, or arbitrary MiniMax voices/models.
- Only after authentication: an atomic D1 quota reservation tied to invocation.
  Refuse when D1 unavailable, over daily limit, or replayed.
- Generated audio must be delivered privately with an expiring, authorized
  retrieval path; existing public WAV tone URL is not suitable for private speech.
- Never put MiniMax API Key, OAuth tokens, voice ID or D1 secrets in source,
  tool input arguments, chat-visible response, or logging.

## What was implemented in this slice

`src/paid-identity-policy.js` contains a **post-verification** policy checker
with mock identities. It requires an externally verified resource middleware
context, exact allowlisted subject, issuer, audience, expiry and paid scope.
This module is not imported by the public server.

It does NOT cryptographically validate OAuth signatures, issue OAuth tokens,
authenticate GitHub users, check real Cloudflare service bindings, or grant
production access. A caller-provided `verified:true` is NOT a trustworthy
credential: real integration must build the identity inside trusted
authentication middleware, never from tool arguments.

Next gates: select and configure OAuth identity provider and approved immutable
subject without exposing secrets; implement and test real token exchange,
negative auth cases, D1 binding, private WAV delivery and billed-call end-to-end
with explicit user approval.

No live paid endpoint is authorized in this draft PR.
