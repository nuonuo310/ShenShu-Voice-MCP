# Voice V1 private Worker offline readiness (2026-10-23)

**STATUS: OFFLINE CANDIDATE COMPLETE; CLOUD NOT QUALIFIED; NO-CARD ACCESS
ELIGIBILITY FAILED; TOTAL CONTROL DECISION REQUIRED. STRICT V1 REMAINS 2/9.**

This package implements and tests a dormant private Worker candidate only. It
did not create or deploy a Worker or Access application, query or change real
D1, apply a migration, read Cloudflare/Auth0/provider credentials, modify
production routes, refresh a connection, call MiniMax, dispatch Actions or
merge anything.

## Authority and fixed base

- Authority commit: `e1ab11d4374cdd77c149dfc30c3f564361aa309c`.
- Authority package:
  `docs/construction-envelopes/2026-10-23-voice-v1-private-worker-offline.md`.
- Task branch: `work/voice-v1-private-worker-offline-gate-20261023`.
- Implementation commit: `26db9e255e5a0d9f60459c76087fc70ef3da982b`.
- Prior decision:
  `docs/v1-closure/D1-ATOMIC-ARCHITECTURE-DECISION-20261023.md` (Option A).

The Opening Gate verified the exact origin, `nuonuo310` Git identity, a single
clean worktree, the authority branch at the exact commit, and open PR #96 as the
envelope stacked on PR #95. No rebase, reset, stash, clean, merge or rewrite was
performed.

## Offline candidate

`worker/private-d1-worker-candidate.js` is a standalone module unreferenced by
`server.js`, the staging route or package scripts; only its tests import it. It
imports only the fixed SQL constants from the existing D1 SQL modules; it has no
Node built-in, provider, REST, secret or HTTP-client import.

The candidate:

- accepts only exact internal POST routes for `admit`, `status`,
  `provider-pending`, `completed` and `unknown`;
- requires exact `application/json`, no query string, a 2 KiB body bound and a
  deployment-injected `authorize()` hook; it does not treat any header or
  Cloudflare Access presence as authentication;
- admits only `{version, principal, operation_id, action, text_digest,
  text_bytes, ttl_ms}` and rejects raw text, caller request/grant IDs, model,
  voice, audio, SQL, identity material and every extra field;
- validates the action, identifiers, SHA-256 base64url digest shape, byte range
  and 1 second to 15 minute TTL before preparing SQL;
- generates request and grant IDs and the UTC day inside the Worker, failing
  closed on collision or weak random-source availability;
- constructs exactly four fixed statements and sends them through one native
  `env.DB.batch()`: strict slot reservation, strict grant issue, operation
  binding and grant consume;
- validates D1 result `success`, result array cardinality and every returned
  owner/request/grant/slot/state field, and never exposes the grant ID or text
  digest to the caller;
- implements owner-scoped status and ordered
  `admitted -> provider_pending -> completed|unknown` transitions, with no
  automatic retry or compensating write;
- returns only an opaque `result_ref` for a completed operation and implements
  no production result storage or provider call.

The state contract remains at-most-one provider attempt through ordering and
fail-closed ambiguity. It does not claim exact-once provider billing.

## Evidence tiers

| Claim | Tier | Evidence |
| --- | --- | --- |
| Cloudflare says native D1 `batch()` is a SQL transaction and a statement failure aborts or rolls back the sequence | Documented API guarantee | Current Cloudflare D1 Database `batch()` reference; not observed on this account |
| Four fixed statements commit or roll back together under the local fake native binding | Local evidence | `node:sqlite` rollback and collision tests |
| Concurrent independent local connections allocate exactly the configured slots | Local evidence | Four worker threads, limit three: three admissions, one daily limit, slots 1/2/3 |
| Idempotent replay, conflict, TTL, UTC rollover, grant one-use and transitions behave as specified | Local evidence | Targeted Worker suite, 10/10 PASS |
| Exact-schema Cloudflare D1 rollback, concurrency, limits, `RETURNING` and timeout behavior | **Not observed** | Zero real-cloud operations |
| Cloudflare Access actually protects this Worker and rejects non-Render callers | **Not observed** | No Access application, hostname, policy or token exists |
| Render can reach the Worker with bounded timeout and never calls the provider after an ambiguous pending response | **Not observed** | No Worker bridge or Render change was authorized |
| Provider billing is exactly once | **Not claimed** | Provider calls in this task: 0 |

The Worker `batch()` documentation is API contract evidence. It is not real
Cloudflare execution proof for the exact `003` schema, SQL, `RETURNING` rows or
concurrent requests.

## Offline verification

Run on local Node `v24.19.0`:

- new private Worker suite: **10/10 PASS**;
- full `node --test`: **311/311 PASS**, zero fail or skip;
- `node test/smoke-server.mjs`: PASS;
- JS syntax checks and `git diff --check`: PASS.

The suite covers admission rollback, malformed/short/throwing D1 results,
missing binding, request-ID and grant-ID collisions, replay/conflict, wrong
owner, TTL expiry, daily limit, UTC rollover, ordered transitions, terminal
states, strict request/routing/media-type/body controls, authorization failure,
and independent concurrent SQLite connections.

Repository CI uses Node 20. Its SQLite-backed cases self-skip because
`node:sqlite` is unavailable; the skip is explicit. CI output is recorded on the
Draft PR. A reproducible Node 22+ Linux job is still required before any cloud
qualification.

## Free and no-card eligibility review

Public official documentation was read on 2026-10-23. No account, dashboard,
API, plan selection or payment flow was accessed.

| Source | Current statement | Consequence |
| --- | --- | --- |
| [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), last updated 2026-10-02 | Users have access to the Workers Free plan by default; 100,000 requests/day and 10 ms CPU per invocation. | A free Worker tier is documented. It does not prove this account can deploy without a card. |
| [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), last updated 2026-04-21 | Workers Free includes 5 million rows read/day, 100,000 rows written/day and 5 GB total storage; the FAQ says D1 will continue to have a Free plan. | A free D1 tier is documented. It does not prove actual-cloud atomicity or account eligibility. |
| [Cloudflare One setup](https://developers.cloudflare.com/cloudflare-one/setup/), last updated 2026-10-12 | Zero Trust onboarding requires selecting a plan and **entering your payment details**; this is still required for the Zero Trust Free plan, with no charge. | The required Access Free path is not demonstrably card-free. **STOP before registration or upgrade.** |
| [Access service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/), last updated 2026-10-02 | Service tokens authenticate automated systems to Cloudflare One policies and support rotation/revocation. | Mechanism exists, but policy allocation, custom hostname, DNS and card eligibility remain unverified. |

**Result: CONDITIONAL / NOT NO-CARD ELIGIBLE.** The official Cloudflare One
setup path requires payment details even when the selected plan is free. This
package cannot establish a free and card-free Access deployment without crossing
the explicit STOP boundary. No signup, payment entry, plan change or Access
resource creation was attempted.

## Required total-control decision

One of the following is required before any cloud work:

1. Explicitly authorize the operator to enter payment details for Cloudflare One
   Free and accept the associated card/billing-policy risk; this requires a new
   approval and is outside this envelope.
2. Authorize a new architecture review for the documented fallback: a
   Worker-verified asymmetric or HMAC-signed Render request with timestamp,
   body binding, replay protection and key rotation, avoiding Cloudflare Access.
   This changes the architecture boundary and cannot be assumed here.
3. Defer the private Worker path and keep B2/B3 open.

If option 1 is authorized later, a separate one-run nonbillable qualification is
still required for the exact D1 schema and Worker path. Documentation and local
test success must not be reported as cloud PASS.

## Remaining deployment and qualification prerequisites

- Explicit operator decision on payment details versus signed-request fallback.
- A dedicated non-production D1 database, exact account/database IDs and a
  separately approved additive `003` migration/preflight.
- A private Worker deployment, custom hostname, Access application/policy,
  service token lifecycle and proof that alternate public routes are disabled.
- A test-only verified principal and a hard nonbillable write budget.
- Real-cloud rollback, concurrent-limit, duplicate replay, timeout ambiguity,
  one-use and postflight evidence.
- Stable ChatGPT `operation_id` ingress, private durable result storage and
  authenticated retrieval.
- A reproducible Node 22+ Linux SQLite job before relying on local concurrency
  evidence.

## Rollback

No cloud resource, route, migration or row exists to roll back. Revert or close
the Draft PR to retire the dormant candidate. Do not drop tables, delete rows or
alter production state as routine rollback. Any future paid attempt must remain
fail-closed and must never be cleaned up to make evidence appear successful.

## V1 blocker status

Strict V1 remains **2/9** (gates 1 and 8 only). The formal blocker count is not
reduced.

- **B1:** iPhone generated/bridge audio remains reported silent; no
  user-confirmed audible result.
- **B2:** real D1 paid admission remains unqualified; the offline Worker
  candidate reduces implementation uncertainty but provides no cloud proof.
- **B3:** real fail-closed/private delivery remains undone; private durable
  result storage and authenticated retrieval are absent.
- **B4:** zero authorized real MiniMax end-to-end calls.

## Real-operation counters

- Workers, Durable Objects or Access resources created/deployed: 0
- Real D1 reads/writes/queries/migrations: 0
- Cloudflare API calls: 0
- MiniMax or billable provider calls: 0
- Cloudflare/Auth0/provider keys, tokens or voice IDs read/logged: 0
- Render/Auth0/connector changes: 0
- GitHub Actions dispatches: 0
- Merges/rebase/rewrites: 0

Read-only public Cloudflare documentation and GitHub PR metadata were fetched.
Git and GitHub operations used the existing local credential helper; credential
values were not printed, returned in evidence or written to disk by this task.

## Disposition

**TOTAL CONTROL DECISION REQUIRED.** The authorized offline work is complete and
the candidate is green under local tests, but Access Free requires payment
details in the official setup flow. Proceeding would cross the task's explicit
card/payment STOP boundary. The formal V1 status remains 2/9 with B1-B4 open.
