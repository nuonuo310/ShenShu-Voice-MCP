# Voice V1 trusted ingress, stable operation_id and secure signer ingress decision (2026-10-25)

**STATUS: COMPLETE FOR THE AUTHORIZED READ-ONLY/OFFLINE READINESS SCOPE.**
No real Auth0 token or secret was read, no HMAC key was generated or
provisioned, no Cloudflare operation or Worker deployment occurred, no route or
Preview/Version URL was enabled, no real D1 request was made, no Render or Auth0
setting was changed, no MiniMax/provider call occurred, and no PR was merged.
Strict V1 remains **2/9**; B1-B4 remain open.

This package traces the only eligible Auth0/MCP principal source that exists in
the code, freezes the operation_id decision and its failure cases, specifies a
secure HMAC key-injection lifecycle, and prepares a future non-provider cloud
qualification packet. It does not claim that live trusted ingress, real D1
atomicity, signer-to-Worker key equality or paid execution is proven.

## Authority and Opening Gate

- Repository/origin: `nuonuo310/ShenShu-Voice-MCP`
  (`https://github.com/nuonuo310/ShenShu-Voice-MCP.git`).
- Sole authority package:
  `docs/construction-envelopes/2026-10-25-voice-v1-trusted-ingress-idempotency-readiness.md`
  in commit `c0a437c9a0fbb36b6819aceed5c22f7f2ce11e8d` on branch
  `docs/voice-v1-trusted-ingress-idempotency-readiness-20261025`.
- Authority parent and baseline: PR #118 head
  `ed9fba65014a455e303698ba7d54d63bc8752c0b`.
- Task branch:
  `work/voice-v1-trusted-ingress-idempotency-readiness-20261025`, created from
  the exact authority commit without reset, stash, clean, rebase, merge or
  history rewrite.
- Opening state: one registered worktree, clean branch, no stash, exact origin
  `nuonuo310/ShenShu-Voice-MCP`, exact authority HEAD.

The read-only Draft dependency check observed 58 open PRs, of which the direct
stack is:

| PR | Head | Base/relationship | State | Standard CI |
| --- | --- | --- | --- | --- |
| #118 | `ed9fba65014a455e303698ba7d54d63bc8752c0b` | based on the offline-signer authority branch | Draft, `clean` | run `40123120802`; `test` and `sqlite-node24` success |
| #119 | `c0a437c9a0fbb36b6819aceed5c22f7f2ce11e8d` | authority branch based on #118 head | Draft, `clean` | run `40195360917`; `test` and `sqlite-node24` success |

No manual Actions dispatch or merge was used. The Draft dependency branches are
not `main`; this task PR is therefore another stacked Draft, not a production
activation path.

The envelope also names three external continuity documents in
`nuonuo310/Shenshu-Continuity`. An unauthenticated read-only API request returned
HTTP 404 at audit time, so those external documents were not read and no
credential was requested or used. The explicitly designated in-repo envelope is
treated as the sole authority for this task. External continuity remains an
unverified authority boundary, not a claimed confirmation.

## Actual Auth0/MCP principal source

### Observed code path

There is no paid principal in the currently public fixture route. The only
eligible server-verifiable principal source is the HTTP `Authorization: Bearer`
access token on the separately gated `/paid-mcp` route, after signature and
claim verification against server-fixed trust anchors.

```text
ChatGPT / MCP client
  |
  | HTTPS /paid-mcp, Authorization: Bearer <Auth0 access token>
  v
server.js
  -> handleProtectedResourceShell()
     -> fixed production or allowlisted staging resource identity
     -> SHENSHU_AUTH_MCP_ENABLED=1 gate
        -> handleStagingAuthenticatedMcp()
           -> createStagingIdentityVerifier()
              -> trusted Auth0 JWKS, or explicit static test-only JWKS fallback
              -> createVerifiedIdentityResolver()
                 - RS256 and known kid only
                 - signature, iss, aud, exp, iat, nbf
                 - explicit voice:speak scope
                 - principal = base64url(SHA-256(issuer || NUL || sub))[0..43]
           -> verifiedSubject kept inside server closure
           -> makeStagingMcpServer()
              - currently only verify_shenshu_login / non-billable dry-run tools
              - no paid tool, signer, provider or grant exposure
```

The fixed issuer/audience/JWKS constants live in
`src/protected-resource-identity.js`, `src/verified-identity.js`,
`src/staging-authenticated-mcp.js` and `src/auth0-jwks-cache.js`. No header,
query, tool argument, JWT claim or body field selects the issuer, audience,
scope, key set or principal. The staging tool response does not return the
principal. Each Streamable HTTP request is verified independently.

The public `/mcp` route is a different path. `server.js` creates the
unauthenticated fixture MCP server there and does not import the identity
resolver, signer, D1 operation store or paid pipeline. The protected shell only
intercepts the paid resource and its metadata path. The public fixture must not
be relabeled as authenticated.

### Trust-boundary findings

| Boundary | Code-level finding | Real-world status |
| --- | --- | --- |
| Issuer, audience and Auth0 JWKS URL | Fixed in server code; not caller-selected | Constants and tenant existence are not independently attested here |
| JWT signature/claims/scope | RS256, known `kid`, pinned `iss`/`aud`, bounded lifetime, `voice:speak` required | Proven by offline synthetic tests only; no real token was presented |
| Principal origin | Derived only after token verification from `issuer + sub` | No body/argument principal is accepted on this path |
| Render deployment enablement | Requires operator environment flags | Actual Render environment and route state are unproven |
| User entitlement allowlist | Not implemented in this path | A subject granted this Auth0 API/scope can obtain a principal; per-user allowlisting or equivalent is still required |
| Signer principal provenance | No real signer adapter is connected | HMAC proves possession of a shared key, not a user; the signer must derive the principal from the verified request and must never accept it from client input |
| Worker secret equality | Worker expects one key ID/secret pair | No secret was provisioned; signer-to-Worker equality is unproven |
| Real D1 atomic batch | Local contract and SQLite tests exist | Cloudflare D1 transaction behavior and the deployed Worker remain unproven |

The code therefore proves a fail-closed verification mechanism and its synthetic
tests. It does **not** prove that a live Auth0/Render request reaches a paid
principal, that Render has the required flags configured, or that a trusted
server-side signer exists. Those remain explicit activation blockers.

## Stable operation_id ingress decision

### Decision

A client-provided opaque `operation_id` **may** be used as an idempotency key
only when all of the following hold:

1. The principal is independently verified from the Auth0 access token first.
2. The operation ID is treated only as an opaque correlation token, never as
   identity, approval, entitlement, grant, request ID, model or voice.
3. The ID is strictly validated, action-scoped and namespaced by the verified
   principal: the durable key is `(principal, operation_id)`.
4. The exact text digest, action and bounded expiry are persisted atomically
   with the reservation and consumed one-use grant.
5. A retry is accepted only when action, text byte length and text digest match
   the existing binding. The server never trusts a new payload merely because
   the ID matches.

The current contract uses an 8-128 character base64url-style identifier. For a
new paid client, the preferred contract is a client-generated random 128-bit or
256-bit base64url value (22 or 43 characters) reused only for retries of one
logical user action. A new intentional action, even with identical text, must
use a new ID. The server-generated `requestId` is not an idempotency key and is
never accepted from the caller.

A server-issued durable intent is an alternative, but it is not automatically
stronger: it needs a two-phase begin/execute protocol and the client must still
persist and replay the intent across reconnects and process restarts. No MCP
transport guarantee for identical tool arguments, retry preservation or
cross-reconnect intent storage has been observed. Until such behavior is
measured on the real ChatGPT/MCP path, a paid activation must not assume that a
retry carries the same `operation_id`.

### Ingress contract

The isolated, unmounted runner in `src/v1-transport-idempotency.js` accepts only
the exact tuple `{trustedRequest, operationId, text}`. It performs this order:

```text
verify Auth0 request -> stable principal
  -> reject extra/caller-supplied trust or billing fields
  -> validate bounded text and operation_id syntax
  -> build action + principal + operation_id + text digest + TTL binding
  -> atomic durable admit
     -> new: create operation + reservation + consumed grant
     -> existing: compare action/digest, then classify state
  -> mark provider_pending before the one provider attempt
  -> provider result becomes an opaque resultRef
  -> mark completed; any uncertainty becomes terminal unknown
```

`src/d1-transactional-operation-store.js` uses the additive
`paid_voice_operations` schema with primary key `(principal, operation_id)`,
unique request/grant IDs and an all-or-nothing injected batch client. It fails
closed unless the client explicitly advertises `atomicBatch=true`. This adapter
is not mounted and has not issued a real D1 request.

### State disposition

| Existing state | Required response | Provider attempts |
| --- | --- | --- |
| `completed` | return the existing opaque `resultRef`, mark replayed | 0 |
| `admitted` | `operation_in_progress`; no takeover or retry | 0 |
| `provider_pending` | `operation_outcome_unknown`; no second call | 0 |
| `unknown` | `operation_outcome_unknown`; no refund or second call | 0 |
| expired | `operation_expired`; no second call | 0 |
| same key, different action/digest | `operation_conflict` | 0 |
| different principal, same literal key | isolated new operation under that principal | at most 1 |

## Retry, restart and counterexample evidence

The following cases are executable offline counterexamples; none uses a real
provider or D1.

| Case | Expected invariant | Evidence |
| --- | --- | --- |
| Same operation and payload after completion | Replay result; provider count stays one | `test/v1-transport-idempotency.test.js` |
| Concurrent duplicate before completion | One admission; duplicate sees in-progress/unknown; one provider call | same file |
| Two intentional actions with identical text | Two distinct operations, not text-only deduplication | same file |
| Same operation ID with different text | Conflict before reservation or provider call | same file |
| Same operation ID under two principals | Separate rows, grants and provider calls | same file |
| Lost provider response | Attempt once, persist `unknown`, never retry or refund | same file |
| Completion-store failure | Persist/retain uncertain state, never recall provider | same file |
| Restart after admission, before provider start | `in_progress`, zero provider calls | same file and SQLite suite |
| Restart after completion | Reopened store replays opaque result, zero provider calls | `test/v1-transactional-operation-offline.test.js` |
| UTC-day rollover | Old operation remains replayable; a new logical operation receives a new day/slot | in-memory and SQLite suites |
| Daily limit | A completed replay is free; a new distinct operation is denied after the cap | in-memory and SQLite suites |
| Concurrent SQLite duplicates/limits | One durable reservation; worker-thread duplicates do not double-reserve | SQLite suite using `node:sqlite` |
| Partial malformed batch/read | Fail closed before any provider call | SQLite and Worker contract suites |

Important limitations are part of the contract, not defects to hide:

- A crash after `admitted` but before provider start yields a false-negative
  `in_progress`; a retry is refused to avoid double charging.
- A crash after a possible provider call yields `unknown`; there is no
  compensating write, refund or speculative retry.
- If a client generates a fresh operation ID after a timeout, the server cannot
  know that it is the same logical action. The client behavior must be made
  explicit and observed before paid activation.
- Operation IDs are not recycled after expiry. Reusing an old ID stays expired
  or conflicts; returning users must generate a fresh ID for a new intent.
- The local SQLite tests prove the Node 24 fixture and SQL transaction behavior
  in this repository, not Cloudflare D1's native cloud behavior.

## HMAC secret lifecycle and secure injection

### Trust meaning

HMAC authenticates the server-side signer process to the qualification Worker.
It does not authenticate the end user by itself. The signed principal is trusted
only if the signer derives that principal from an already verified Auth0 request
and keeps it out of caller control. The current offline signer accepts synthetic
`dryrun_` plan principals and must never be given a real secret or used as a
real ingress adapter.

### Key shape and ownership

- Generate exactly 32 bytes with the operating-system CSPRNG.
- Encode as unpadded base64url: exactly 43 ASCII characters. The raw key is
  32 bytes; the Worker verifier accepts a 32-64 byte decoded key.
- Use a random, non-user key ID matching `^[A-Za-z0-9_-]{8,64}$`. The key ID is
  not secret; it must not contain account, person, provider or production IDs.
- Use one key pair for one bounded qualification Worker version/window. The
  current Worker exposes only one key ID/secret pair, so multi-key overlap is not
  available.
- Never place the secret in Git, PRs, chat, terminal arguments, shell history,
  files, screenshots, logs, telemetry or evidence artifacts. Never record a
  secret-derived fingerprint.

### Operator-only injection sequence

No step below is executed by this package.

| Gate | Action | Leakage control |
| --- | --- | --- |
| Key generation | Human operator generates 32 CSPRNG bytes on the controlled host | Secret remains in memory / approved secret manager only; agent never receives it |
| Worker provisioning | Interactive, non-echoing `wrangler secret put` while route and Version/Preview URLs are closed | No secret CLI argument, no transcript, no debug tracing, no screenshot |
| Signer provisioning | Same exact key is injected into the trusted signer process through a non-echoing FD/stdin or approved secret-manager handoff | No environment value in a command line, no file, no log, no client access |
| Equality check | Operator confirms the same random key ID and byte-identical secret in one version | No plaintext and no key-derived fingerprint recorded |
| Pre-run verification | Re-read the resulting Worker version, exact host, one DB binding and closed URL surfaces | Secret remains unreadable |
| Revocation | Disable route first, make Worker dormant, remove signer key, delete the test secret, then record only nonsecret confirmation | No probe after deletion; no D1 cleanup |

Rotation is performed only while the route is off: confirm zero new requests,
provision the new pair, verify the resulting version and all URL surfaces, then
request a separately authorized activation. Do not attempt zero-downtime
dual-key rotation with the current one-pair Worker. If route disablement fails,
stop and escalate rather than sending another request. Preserve D1 rows and
ambiguous outcomes; no DROP, DELETE, truncate, refund or compensating write is
authorized.

## Implementation decision

No source, test, Worker, schema or workflow change is justified by this package.
The repository already contains the exact isolated operation binding, atomic D1
adapter, fail-closed state machine and Node 24 SQLite counterexamples required
for offline review. Adding a second signer or ingress implementation without a
live principal proof would create a larger unverified attack surface. This task
adds only this decision document.

The future paid path still requires, in order: a reviewed trusted signer adapter,
real key injection, a mounted authenticated paid tool, real D1 qualification,
durable private result delivery and explicit provider authorization. None is
claimed or enabled here.

## Local verification

Local runtime: Node `v24.19.0`.

- Full `node --test`: **360/360 PASS**, 0 failed, 0 skipped.
- Focused idempotency/SQLite/Worker/restart suite: **50/50 PASS**, 0 skipped.
- `node test/smoke-server.mjs` run alone: PASS for MCP initialize, tools/list and
  calls, protected metadata and fail-closed paid entry.
- `node --check` on `server.js`, `worker/qualification-entry.js`,
  `src/v1-transport-idempotency.js` and
  `src/d1-transactional-operation-store.js`: PASS.
- `git diff --check`: PASS.

The final committed HEAD, standard CI run and job conclusions are recorded in
the Draft PR body to avoid a self-referential document hash. Only standard PR CI
is used; no manual dispatch is authorized.

## Unproven trust boundaries and blocker inventory

1. **Live Auth0 principal:** no real token/JWKS/Render request was observed. The
   fixed tenant and API audience are code constants, not live attestations.
2. **Render route state:** the public `/mcp` remains unauthenticated fixture-only;
   whether `/paid-mcp` is enabled in the live Render environment is unknown.
3. **Per-user entitlement:** a valid Auth0 API grant is the current boundary;
   there is no proven per-user allowlist or spending entitlement beyond daily
   limits.
4. **Stable client operation ID:** no observed ChatGPT/MCP guarantee that a
   retry reuses the same tool argument or explicit operation ID.
5. **Trusted signer:** no real signer derives the principal from the verified
   request, and no real secret has been injected.
6. **Signer-Worker key equality:** not demonstrated; no live secret exists.
7. **Cloud D1 atomicity:** local SQLite and injected-batch contracts pass, while
   deployed D1 batch behavior and rollback semantics remain unqualified.
8. **Exact Worker hostname and URL surfaces:** the account's single workers.dev
   subdomain, current deployed version, Preview/Deployment inventory and trigger
   count are not independently attested.
9. **Result delivery/B3:** the idempotency contract returns only an opaque
   `resultRef`; private durable audio delivery remains absent.
10. **Provider/B4:** no MiniMax or other provider call, billing observation or
    paid end-to-end result exists.
11. **Availability:** HMAC does not prevent anonymous request-count exhaustion;
    the temporary route remains public and Free-quota constrained.
12. **External continuity:** the named continuity repository was not readable
    without credentials at audit time.

## Next exact non-provider cloud authorization packet

No gate below is authorized by this document. Each must be approved separately;
approval of one gate does not imply approval of the next.

### Fixed identities to re-attest

- Cloudflare account ID: `5a1af7ea0ef8f8aea6365306d775a894`.
- Qualification Worker: `shenshu-voice-v1-qualification-20261024`.
- Operator-observed rollback/deployed version:
  `2320fd44-294c-4789-91bd-c20694254eca`; any secret/deploy may create a new
  version that must be recorded before activation.
- Dedicated D1: `shenshu-voice-v1-qualification-20261024`, UUID
  `234913cd-8901-4607-8147-31c4a4317111`, exactly one `DB` binding.
- Forbidden legacy D1: `shenshu-voice-budget-test`
  (`c39a6895-7028-4f59-a100-1455b92c96c1`).
- Exact future host must be copied from the account dashboard as
  `<worker-name>.<single-account-subdomain-label>.workers.dev`. It must not be
  inferred from account ID/name/email, and Version/Preview/custom hosts are not
  acceptable.

### Independent gates

| Gate | Authorization requested | Required evidence before proceeding |
| --- | --- | --- |
| A0 | Read-only zero-request attestation | Free/no-card account, exact Worker/version/binding, exact workers.dev host, Version/Preview/custom/route/trigger inventory, observed 0 requests and 0 invocations |
| A1 | Artifact/deploy decision only | Reviewed commit/dry-run, exact new version, rollback to `2320fd44...`, routes and URL surfaces closed |
| A2 | Test-key and activation-value provisioning only | Fresh CSPRNG key, non-echoing injection, one key pair/version, signer equality, repeat URL/version inventory |
| A3 | Temporary exact-host route enablement only | One exact workers.dev host, no Version/Preview/custom route, no Access/paid setting/binding change, elapsed window <= 20 minutes |
| A4 | One bounded signed qualification run only | Named date, request IDs, observer, signer host, stop owner, baseline counters, hard caps below and provider calls fixed at zero |
| A5 | Shutdown and revocation only | Route disabled first, Worker dormant, signer key removed, test secret deleted, nonsecret confirmation, preserved D1 evidence |

### Hard run caps

| Resource | Hard cap |
| --- | ---: |
| Worker HTTP requests | 24 |
| D1-touching requests | 18 |
| Admission requests | 10 |
| Accepted admissions (existing plan) | 4 |
| Row-write units | 32 |
| Rows read | 512 |
| Statements | 64 |
| Storage delta | 256 KiB |
| Wall-clock window | 20 minutes |
| MiniMax/provider calls | 0 |

Any ambient Worker request, unknown Preview/Deployment URL, unexpected
status/body/row count, non-plan request, clock ambiguity, counter overrun,
unexpected principal, new binding, card/payment request, plan upgrade or
permission expansion is STOP. A valid HMAC key is not permission to continue or
to raise a cap.

## Real-operation counters

- Real Auth0 tokens, Auth0 secrets, HMAC keys generated/read/provisioned: 0
- Cloudflare API calls or credential reads: 0
- Worker deployments, versions, routes, domains, Preview/Version URLs or bindings changed: 0
- Worker HTTP requests or real D1 reads/writes/migrations: 0
- Render, Auth0, connector or public MCP changes: 0
- MiniMax/provider calls or billing changes: 0
- Paid tools, plans, cards or permission expansions: 0
- Manual GitHub Actions dispatches, PR merges, rebases or history rewrites: 0

## V1 disposition and receipt

Strict V1 remains **2/9** (gates 1 and 8 only). B1-B4 remain open:

- **B1:** no user-confirmed audible iPhone result for generated/bridged audio.
- **B2:** real D1 atomic admission and the deployed Worker path remain unqualified.
- **B3:** real fail-closed/private durable result delivery remains absent.
- **B4:** no authorized real MiniMax end-to-end call.

**COMPLETE for the authorized read-only/offline readiness scope.** Real trusted
ingress and paid execution are not authorized or proven by this package.
