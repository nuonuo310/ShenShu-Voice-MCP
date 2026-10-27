# Voice V1 P2 — Player-only explicit confirmation

Date: 2026-10-27

## Receipt

`COMPLETE` for the bounded offline candidate. Real paid enablement remains `BLOCKED` on independent live identity, D1 atomicity and browser-gesture qualification.

Voice V1 remains **2/9**. Paid P2 remains OFF. B1–B4 remain OPEN.

## Authority and opening gate

- Repository: `nuonuo310/ShenShu-Voice-MCP`.
- Authority: PR #143, commit `fea7422aeae2f1bda6e53ffb56e5550a13612bc0`.
- Parent baseline: PR #142 HEAD `fb92e8b2a2e7aedcfc61aa785e72de7214e3c26c`.
- Envelope: `docs/construction-envelopes/2026-10-27-voice-v1-p2-player-confirm-only.md`.
- Isolated worktree: `C:\Users\Administrator\Desktop\ShenShu-Voice-MCP-P2-143`.
- Authority branch: `codex/voice-v1-p2-player-confirm-only-20261027`.
- Implementation branch: `codex/voice-v1-p2-player-explicit-confirm-20261027`.
- Implementation source commit: `29eb0e9aeea625340a2d074b79d4cf332e375469`.
- Implementation source tree: `4d405df74fe9f248532cd075ea846514bf66ecd6`.
- Parent of implementation commit: `fea7422aeae2f1bda6e53ffb56e5550a13612bc0`.
- Authority PR #143 was open, Draft and mergeable; its normal CI run `40528245651`, job `122273606209`, was successful. No manual Actions were triggered.

## Verified code facts before implementation

- `src/v1-p2-stable-operation-identity.js` already modelled nonbillable `initiate`, owner-scoped `status`, one CAS claim and at most one provider attempt.
- The existing record was bound to principal, handle, text digest, byte count and expiry, but did not retain the exact text or origin needed for first-party display.
- The Auth0 player used a signed `__Host-shenshu_player_session` cookie with `HttpOnly; Secure; SameSite=Lax` and duplicate-cookie fail-closed parsing.
- The player had no CSRF token or POST confirm route. The P1 page had `form-action 'none'` and served one fixed nonbillable WAV through `/player/audio`.
- `server.js` and the authenticated MCP module did not import the stable P2 broker. Streamable HTTP used no server-owned session identity, so a JSON-RPC request ID was not treated as an operation identity.
- Historical D1 schema `003` cannot represent `pending_confirmation`, and the D1 HTTP client is not an atomic batch. No cloud schema was read or changed in this round.

## Offline implementation

### Stable operation record

- A pending proposal now stores the exact validated text privately in the operation record so the standalone player can display it before consent.
- The record also stores the exact staging origin and rejects records whose text bytes, digest, origin or principal do not match.
- `initiate` and `status` responses still contain no text, digest, principal or operation ID.
- The executable in-memory test store now offers owner-scoped, unexpired `listPending` with a hard result bound.
- The record remains a shallowly copied immutable test fixture, not a durable production adapter.

### Player-only route candidate

- New module: `src/v1-p2-player-confirmation.js`.
- `GET /player/pending` requires the existing signed Auth0 player session and lists only that canonical principal's unexpired pending proposals.
- The page displays exact escaped text, expiry and a one-synthesis quota/third-party charge warning.
- `POST /player/confirm` requires the same session, exact `Origin`, same-origin and navigate fetch metadata when present, exact form content type, bounded body, exactly one `csrf` and one `handle` field, and an owner-scoped record.
- The CSRF token is HMAC-bound to the signed-in canonical principal, handle, exact text digest and a short expiry bounded by both the session and proposal.
- Text never comes from the POST form. The handler reloads it from the owner-scoped proposal that was displayed.
- A module-private Symbol capability is the only accepted player identity input to the broker; JSON, HTTP fields and MCP requests cannot mint it.
- The form contains no JavaScript, no automatic submit and no refresh. There is no model-accessible confirm tool or route.
- The shared broker still performs the atomic pending-to-confirming claim. A replay of a completed claim returns the completed receipt without another paid attempt.

### Preserved P1 behavior

- `/player`, `/player/login`, `/player/callback` and `/player/audio` are unchanged in route behavior.
- The fixed nonbillable WAV, explicit load click and no-autoplay behavior are preserved.
- The new confirmation module is not imported by `server.js` or `src/staging-authenticated-mcp.js`.

## PASS matrix

| Gate | Result | Evidence |
|---|---|---|
| MCP initiate/status are nonbillable | PASS | Paid store calls and provider attempts remain zero |
| Automatic retry creates separate proposals | PASS | Two same-principal proposals remain pending with no provider call |
| MCP-to-player canonical principal continuity model | PASS | Signed JWT principal and signed player-session principal match |
| Exact owner text displayed before click | PASS | Owner sees text; another principal sees neither text nor form |
| Explicit session + Origin + CSRF POST | PASS | Exactly one provider attempt and one result record |
| Missing/tampered/duplicate/expired session | PASS | 401 before quota or provider |
| Forged, cross-proposal, cross-user and expired CSRF | PASS | 403 before quota or provider |
| Wrong Origin, cross-site/cors fetch metadata | PASS | 403 before quota or provider |
| Foreign, forged and expired handle | PASS | 404/410 before quota or provider |
| Concurrent double POST | PASS | One 303 completion and one 409; provider count one |
| Lost response and same-form replay | PASS | Completed replay; no second provider attempt |
| New handler/broker over shared store | PASS | Restart model replays terminal receipt with no new billing |
| Unknown provider outcome | PASS | Provider count one, grant consumed, terminal unknown, no retry |
| Two independent proposals | PASS | Only each explicitly confirmed proposal bills |
| HTML injection and automation controls | PASS | Escaping, strict CSP, no script/meta refresh/auto-submit |
| P1 fixed WAV playback | PASS | Existing player and audio paths/tests preserved |
| New modules unmounted and offline | PASS | No server/MCP import, no fetch/cloud/provider I/O |

## Verification

- Runtime: Node `v24.19.0`.
- Full suite: **299 tests, 299 pass, 0 fail, 0 skipped, 0 todo**.
- Focused player-confirmation suite: **12 pass, 0 fail**.
- Existing stable-operation and private-player suites: **27 pass, 0 fail**.
- `node test/smoke-server.mjs`: PASS for MCP initialize, tools/list, fixture calls and fail-closed paid entry.
- `node --check` for `server.js`, `src/minimax-adapter.js`, the new module and its focused test: PASS.
- `git diff --check`: PASS.
- Final PR CI is recorded in the Draft PR after the normal pull-request workflow; no manual Actions.

## BLOCKED live gates

The following are intentionally not claimed as proven by synthetic tests:

1. A real browser cannot prove a human gesture to the server. CSRF, SameSite cookies and same-origin checks reduce browser-mediated forgery but cannot distinguish a human click from compromised same-origin UI code. No client attestation is claimed.
2. Real D1 cannot yet persist `pending_confirmation`; historical schema `003` is insufficient, and the current D1 REST client is not an atomic batch. A durable atomic pending claim and terminal state transition remain unqualified.
3. Real player-to-MCP identity continuity through Auth0 has not been exercised in staging. Canonical derivation is shared and tested offline, but the live token/userinfo boundary remains unqualified.
4. Durable private proposal text and generated audio storage are not configured. Storing exact text at rest requires a separate encrypted/private-content decision before live use.
5. ChatGPT automatic retry cannot be forced to reuse a handle because the current transport has no server-owned session or idempotency identity. Extra retries create nonbillable proposals, but true transport-level operation reuse is not proven.
6. No real MiniMax quota, charge, timeout, provider receipt or billing behavior was exercised.

These gates mean this commit is an executable offline candidate, not evidence of live paid eligibility.

## Strict non-actions

- Real D1, Cloudflare, Worker, R2, Qiniu, MiniMax, MCP, Render and Auth0 calls: **0**.
- Deployments, cloud or schema modifications, credential generation, provider calls, manual Actions and merges: **0**.
- Voice V1 remains **2/9**; paid P2 remains **OFF**.

## Single next decision

Authorize one bounded staging qualification, with MiniMax and billing disabled, that proves (a) an additive `pending_confirmation` D1 schema, (b) atomic pending/claim/terminal compare-and-set, and (c) real Auth0 player-to-MCP canonical principal continuity. Until that decision and evidence exist, live paid enablement is `BLOCKED`.
