# P2C deployment gate — identity and paid voice

Status: **DESIGN ONLY**. Do not merge or deploy a paid tool.

## Public demo / private voice separation

The existing Render `/mcp` is public and can serve ONLY non-billable fixed fixtures. Do not add `speak_shenshu` to its tool list, even in a disabled-by-default mode, before authentication has been validated.

Use a **separately hosted and separately authenticated MCP resource server** for paid voice. Authentication must be verified on every paid tool call; not merely when connecting a plugin. A token, key or user ID provided inside a model tool argument is not authorization.

## Authentication requirements

1. Choose a provider-supported OAuth authorization-code-with-PKCE flow for ChatGPT and an auth-server integration supported by Cloudflare Workers; verify real provider-issued tokens at the trusted ingress.
2. Validate token signature (or perform authenticated introspection where appropriate), issuer, audience, expiration, scope, and intended resource. Refuse missing/invalid values. Bind a single allowlisted immutable subject to the owner's approved identity; email display alone is not sufficient.
3. Protect authorization and token endpoints against replay, CSRF, redirection abuse, and leaked callback state. Secrets only in Cloudflare-managed secrets.
4. Protect the **entire charged path**: an untrusted client can never bypass OAuth by reaching a raw D1/MiniMax endpoint.
5. Implement durable one-time grant consumption bound to the authenticated principal and invocation. The current `oneTime: true` object in the code is a staging contract, not an unforgeable grant.
6. Separate MiniMax billing credentials from Call where feasible. Even with software quotas, both workloads may share the upstream account balance.
7. No live credentials or OAuth client secrets in this public repository, screenshots, browser JavaScript, model prompts, MCP tool parameters, logs, or tool results.

## D1 admission rules

- Quota default: 3 paid attempts per principal per UTC day. Explicit user approval before enabling or increasing.
- The D1 SQL reserves a unique slot atomically. Server must treat D1 errors, zero rows, timeout, or indeterminate results as **not authorized** for upstream TTS.
- Reuse of a request ID across all days is forbidden by the global `request_id` primary key.
- Do not automatically retry or refund after the request might have reached MiniMax, regardless of the provider outcome.
- Exact once-billing is not guaranteed solely by local reservation; this is a ceiling on **attempts admitted by our server**, not on MiniMax billing across all clients.

## Current test coverage and remaining blockers

Local SQLite execution verifies SQL constraints, allocation under competing connections, duplicate requests, and denial paths. It does NOT prove deployed D1 concurrency or read/write quota behavior. Before approval:

- Run an actual isolated D1 database test with concurrent Worker requests and authenticated user contexts.
- Verify daily ceiling, cross-day ID uniqueness, replay, invalid tokens, expiry, and failures under database service disruption.
- Verify private audio delivery through ChatGPT's MCP UI; public permanent audio URLs are forbidden.
- Confirm no charging tools are listed on public `/mcp`.
- Get explicit authorization for one short paid MiniMax smoke run.

There is no reason to buy a paid Render PostgreSQL plan at this stage.
