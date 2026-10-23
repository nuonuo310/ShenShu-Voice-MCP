# Voice V1 Worker signed-request decision (2026-10-23)

**STATUS: OFFLINE SECURITY REVIEW COMPLETE; RECOMMENDED HMAC-SHA256 SIGNED
REQUEST; NO CLOUD QUALIFICATION OR DEPLOYMENT. STRICT V1 REMAINS 2/9.**

This package compares card-free Render-to-Worker authentication options,
implements a small pure verification contract and tests it locally. It does not
create or deploy a Worker or Cloudflare Access application, access real D1,
read a credential or voice ID, change Render/Auth0, call MiniMax, dispatch
Actions, merge or spend money.

## Authority and Opening Gate

- Authority commit: `50c5be6b7efc742d1891a6812b32df683f8f5e81`.
- Authority package:
  `docs/construction-envelopes/2026-10-23-voice-v1-worker-signed-request-review.md`.
- Parent dependence: PR #97 head
  `697ca9ab78aacd68a6c586f7222e0a04aab5423a` and its authority commit
  `e1ab11d4374cdd77c149dfc30c3f564361aa309c`.
- Task branch: `work/voice-v1-worker-signed-request-review-20261023`.
- Implementation commit: `f770421703bef5672078a8ecfc24014d58a0bef3`.

The Opening Gate verified the exact remote, `nuonuo310` identity, one clean
worktree, the exact authority branch tip, and the open Draft stack through PR
#98. PR #98 is based on PR #97. No reset, stash, clean, move, rebase, merge or
rewrite was performed.

## Decision

**Recommend Option A: HMAC-SHA256 signed canonical requests.** Use the existing
Cloudflare Workers Free and D1 Free path, with the Worker reachable through its
public `workers.dev` hostname and no Cloudflare Access/Zero Trust onboarding.
The signature, not the URL, is the authentication boundary.

The Worker must verify the bounded raw body and signed metadata before any D1
prepare, read or batch. The existing operation key and state machine remain the
durable replay authority. This is an architecture recommendation, not evidence
that the existing account is eligible, card-free or safely deployed.

## Option comparison

### A - HMAC-SHA256 (selected)

Render and Worker hold a 32-64 byte random shared secret under a key ID. The
signature covers method, host, exact path, exact content type, Unix-seconds
timestamp, per-request nonce, key ID and base64url SHA-256 of the raw body.

Advantages:

- Cloudflare Workers Web Crypto documents HMAC sign/verify support; verification
  uses `crypto.subtle.verify` rather than a handwritten comparison.
- One symmetric key operation per request, a small canonical string and no
  keypair generation or asynchronous public-key discovery.
- Node 20 has the required Web Crypto HMAC primitive, so CI can exercise the
  contract without `node:sqlite`.
- Rotation is bounded to a current and previous key without changing the D1
  schema or request semantics.

Costs:

- A Worker compromise exposes a key capable of minting Worker requests.
- The secret must be provisioned in both Render and the Worker and never logged.
- A public endpoint remains subject to request flooding and Free-plan quota
  exhaustion, although a flood cannot create an unsigned database mutation.

The Worker-compromise distinction is not decisive for V1: an attacker who can
execute arbitrary Worker code can already attempt D1 operations directly. The
smaller key lifecycle and testable minimum surface favor HMAC for this one
trusted server-to-server channel.

### B - Asymmetric Ed25519

Render holds a private signing key; the Worker holds only public verification
keys. Cloudflare's current Web Crypto page lists Ed25519 sign/verify support and
a `NODE-ED25519` compatibility note.

Advantages:

- The Worker cannot mint new signatures from its verification material.
- Public-key rotation does not put a signing secret in the Worker environment.

Costs:

- Adds keypair generation, public-key encoding/import, algorithm/version and
  rotation handling that are unnecessary for one trusted caller.
- Local Node 20/CI compatibility and Cloudflare raw-key import behavior require
  a separate verification matrix before it can be called the minimum path.
- It does not prevent a compromised Worker from acting directly through its D1
  binding, so it is a defense-in-depth improvement rather than a V1 necessity.

Keep Ed25519 as a permitted future upgrade if total control later requires the
Worker to hold no signing capability. Do not silently switch algorithms.

### C - Other free/no-card mechanisms

Cloudflare Access/Zero Trust is declined because its official setup page says
even the Free plan requires entering payment details during onboarding. Custom
mTLS, a separate gateway, or a new identity provider would add account, plan or
operational surfaces without proving a card-free path. Service bindings do not
solve an external Render-to-Worker call. No option C is selected.

## Trust boundary

```text
ChatGPT
  -> Render /paid-mcp
       Auth0 JWT signature, issuer, audience, scope, lifetime
       derive opaque principal; validate text/operation_id; compute bytes/digest
       serialize bounded raw body exactly once
       add HMAC headers; no Auth0 bearer or raw text to Worker
  -> HTTPS workers.dev route (publicly reachable, signed)
       verify method/host/path/content-type/body digest/timestamp/key/signature
       reject before D1 on any failure
  -> native D1 binding
       fixed four-statement admission batch or conditional state transition
```

- The client never receives or supplies the HMAC secret.
- The Worker does not trust a principal, grant, approval, model, voice, SQL or
  raw text merely because it appears in a request. Render supplies the opaque
  principal only after its own verified OAuth path.
- The Worker must use `new URL(request.url).host` and `.pathname` for the signed
  values, not an untrusted `Host` header or a reconstructed URL.
- Query strings, alternate paths, non-POST methods, non-exact content types and
  extra fields are rejected. The request body is read once as bytes and bounded
  before parsing.
- Missing verifier configuration or an invalid keyring fails closed before D1.
- No bearer, signature, nonce, secret, raw body or voice identifier enters a
  URL, MCP result, application log or error message.

## On-wire contract

All values are header-carried; none are query parameters.

| Header | Meaning |
| --- | --- |
| `content-type: application/json` | Exact media type, signed and required |
| `x-shenshu-key-id` | Non-secret key selector, 8-64 base64url characters |
| `x-shenshu-timestamp` | Unix seconds, integer, accepted within +/-30 seconds |
| `x-shenshu-nonce` | 16-64 random bytes as 22-86 base64url characters |
| `x-shenshu-signature` | 32-byte HMAC as 43 base64url characters |

Canonical signing input, with one literal newline between fields and no trailing
newline:

```text
SHENSHU-WORKER-SIGNED-REQUEST-V1
POST
<lowercase request URL host, including port if present>
<exact URL pathname, no query>
application/json
<unix seconds>
<nonce>
<key ID>
<base64url SHA-256 of exact raw body bytes>
```

The body is limited to 2048 bytes. JSON is not re-serialized for signing; the
exact bytes sent must be the bytes hashed. The body digest is included in the
HMAC input, so changing any byte, field boundary, host, path, method, media type,
timestamp, nonce or key ID fails verification.

## Replay treatment and bootstrap

The nonce is unique per signed message and cryptographically bound into the
signature. The verifier intentionally does not keep an in-memory nonce set:
that would not survive Worker instances and would create a replay race before
authentication. A separate durable nonce table would add another D1 write and
must be part of the admission batch to avoid a non-atomic check/write gap. That
is a schema and transaction change outside this review.

For the current contract, the **durable operation key is the replay anchor**:

- An admission carries `(principal, operation_id)` and an exact text digest and
  byte count. Replaying the same signed admission can only reach the existing
  operation disposition: `replay`, `conflict`, `expired` or in-progress. It
  cannot create a second reservation or grant.
- Concurrent identical admissions are still protected by the existing unique
  `(principal, operation_id)`, request and grant constraints inside the four
  statement D1 batch. A capture cannot change the operation key because it is
  covered by the signature.
- `provider_pending`, `completed` and `unknown` are one-way conditional updates.
  Replaying one after it succeeded returns a state error and performs no second
  write, provider call, refund or retry.
- `status` is read-only. A captured status request may be replayed within the
  timestamp window by an entity that already captured it, returning only the
  same owner-scoped opaque state. Strict read-request one-use is not claimed.
- A future mutating endpoint without a durable operation ID must not use this
  contract. It requires a separately approved nonce ledger design.

This is a safe duplicate-operation disposition, not exact-once message delivery.
The signature layer does not claim one-use nonce storage; it claims authenticated
operation binding plus a durable state machine. The prior local D1 tests already
show duplicate and concurrent admissions do not produce a second reservation or
grant.

## Timing, failure and rotation

- Timestamp skew is at most 30 seconds in each direction. A clock failure or
  expired/future timestamp fails closed.
- All verifier failures collapse to one external error so key existence,
  signature bytes and timing do not become an oracle.
- The verifier accepts at most two key IDs: current and previous. Provision the
  verification material before the signer switches; keep the old key only for
  the timestamp window plus a bounded operational margin; remove it after the
  new path is confirmed.
- A missing, malformed or oversized keyring/config fails closed. Key IDs and
  signatures are public metadata; secret values are not.
- A lost signed admission response remains ambiguous at the transport layer.
  Render may query owner-scoped status with the same operation ID, but must not
  automatically generate a new operation or call the provider. This preserves
  the earlier at-most-one provider attempt contract.

## Free and no-card gate

The selected product path uses Workers Free and D1 Free and does not require a
Cloudflare Access application, Zero Trust organization, custom domain, payment
details or a paid plan. It uses the account's `workers.dev` hostname.

Official documentation reviewed on 2026-10-23:

| Source | Relevant fact | Limit on the claim |
| --- | --- | --- |
| [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), updated 2026-10-02 | The Workers Free plan exists by default with 100,000 requests/day and 10 ms CPU per invocation. | Does not prove this account's billing state or production capacity. |
| [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), updated 2026-04-21 | D1 is available on Workers Free with 5 million rows read/day, 100,000 rows written/day and 5 GB storage. | Does not prove real-cloud atomicity or no-card eligibility. |
| [workers.dev routing](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/), updated 2026-09-22 | Accounts get a workers.dev subdomain; when enabled, the URL is available publicly. Access can optionally protect it. | A public URL is not a private service; signed authentication is mandatory. |
| [Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/), updated 2026-10-15 | Secrets are encrypted text bindings available through the Worker `env`; values are not visible after definition. | Does not cover Render-side storage, rotation discipline or log hygiene. |
| [Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/), updated 2026-09-30 | HMAC and Ed25519 sign/verify are supported; use the native subtle API. | API support is documentation, not a benchmark or deployment proof. |

**No-card disposition:** no Access or Zero Trust onboarding is selected, so the
known payment-details gate is avoided. This review did not verify the existing
Cloudflare account's payment method or plan, and does not claim that account
creation or a future dashboard change is card-free. Before any deployment the
operator must attest that the account remains Free/no-card. Any request to add a
payment method, upgrade a plan, use Access, or accept a paid quota must STOP.

The public workers.dev route creates an availability risk: unauthenticated
traffic can consume Free request/CPU limits even though it cannot mutate D1.
There is no paid rate-limit or anti-abuse guarantee in this package. Total
control must accept that availability tradeoff, choose a future non-paid
mitigation, or keep the Worker undeployed.

## Offline verification

The isolated contract is in `src/worker-signed-request.js`; it has no Node
built-in, network, provider or secret-source import. Tests are in
`test/worker-signed-request.test.js`.

Local Node `v24.19.0`:

- signed-request contract: **7/7 PASS**;
- full `node --test`: **318/318 PASS**;
- Node 20-equivalent `--no-experimental-sqlite`: **287 pass, 0 fail, 31 explicit
  skips**;
- `node test/smoke-server.mjs`: PASS;
- syntax and `git diff --check`: PASS.

The suite covers valid signatures, method/host/path/media-type/body tampering,
unknown keys, missing headers, timestamp boundaries, oversized bodies, query
injection, duplicate header names, a two-key rotation window, malformed key
configuration and the absence of network/Node dependencies.

These are local cryptographic and canonicalization results, not Cloudflare
execution. They do not prove Worker CPU timing, D1 rollback, Access-free account
eligibility, Render networking, stable ChatGPT `operation_id` or provider
behavior.

## Future cloud qualification (not authorized here)

Before any deployment, require a separate package with:

1. Operator attestation of Free/no-card account status and acceptance of public
   workers.dev reachability/quota exhaustion.
2. A dedicated non-production D1 database, exact IDs, approved additive `003`
   migration and read-only preflight.
3. A test-only Worker, test key ID and test secret, deployment credentials and
   a maximum D1 write budget; no provider or paid route.
4. Negative tests for unsigned, malformed, wrong-key, forged, expired, future,
   body-tampered, path/host-confused and replay requests, all with zero D1 writes
   where expected.
5. Qualify duplicate admission, concurrent limit, conditional transition,
   rollback, timeout ambiguity and key rotation on the exact cloud schema.
6. Keep the Worker and test rows observable only through approved evidence
   channels; never log secrets or full signed requests.
7. Roll back by disabling the route, revoking the test key and leaving additive
   tables/rows in place. Any deletion or paid cleanup needs separate approval.

A Node 22+ Linux SQLite job is still needed for the real transactional cases
because Node 20 CI skips them. A narrow extra job is preferable to changing the
existing workflow in this package.

## Rollback and counters

No cloud resource, route, key, row, migration or production change exists to
roll back. Closing this Draft PR retires the helper and evidence. Any future
deployment rollback disables the route and revokes the test key; it must not
delete or refund admission rows merely to make evidence look clean.

- Workers, Durable Objects or Access resources created/deployed: 0
- Real D1 reads/writes/queries/migrations: 0
- Cloudflare API calls: 0
- MiniMax or billable provider calls: 0
- Cloudflare/Auth0/provider keys, tokens or voice IDs read/logged: 0
- Render/Auth0/connector changes: 0
- GitHub Actions dispatches: 0
- Merges/rebase/rewrites: 0

Read-only public Cloudflare documentation and GitHub PR metadata were fetched.
GitHub operations used the existing credential helper; values were not printed
or written to evidence.

## V1 blocker status

Strict V1 remains **2/9** (gates 1 and 8 only). The formal blocker count is not
reduced.

- **B1:** iPhone generated/bridge audio remains reported silent; no
  user-confirmed audible result.
- **B2:** real D1 paid admission remains unqualified. The signed-request review
  reduces the authentication uncertainty but does not close the cloud gate.
- **B3:** real fail-closed/private delivery remains undone; durable private
  result storage and authenticated retrieval are absent.
- **B4:** zero authorized real MiniMax end-to-end calls.

## Disposition

**COMPLETE for the authorized offline review.** Option A is the minimum
defensible card-free product path, subject to operator account attestation,
public-endpoint acceptance and a separate nonbillable cloud qualification.
No cloud PASS or provider evidence is claimed. If any of those gates require a
paid plan, payment details, account permission or a new replay/schema boundary,
STOP and return to total control.
