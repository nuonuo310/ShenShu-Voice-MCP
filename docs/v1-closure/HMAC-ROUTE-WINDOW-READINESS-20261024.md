# Voice V1 HMAC and temporary route window readiness (2026-10-24)

**STATUS: COMPLETE FOR THE AUTHORIZED OFFLINE SCOPE. NO REAL HMAC KEY,
CLOUDFLARE MUTATION, ROUTE ENABLEMENT, WORKER DEPLOY, REAL D1 REQUEST,
PROVIDER CALL OR MERGE OCCURRED. STRICT V1 REMAINS 2/9; B1-B4 REMAIN OPEN.**

This package freezes an operator-ready but **unexecuted** HMAC key lifecycle,
temporary workers.dev route plan, deterministic offline budget plan and failure
closure review. It does not claim that the public endpoint is safe from Free
quota exhaustion. HMAC protects mutation admission, not availability.

## Authority and Opening Gate

- Repository/origin: `nuonuo310/ShenShu-Voice-MCP`
  (`https://github.com/nuonuo310/ShenShu-Voice-MCP.git`).
- Authority branch: `docs/voice-v1-hmac-route-window-readiness-20261024`.
- Authority commit: `15848cf2bb460957b70ea7f17bb2d293075b6946`.
- Authority parent: PR #114 head
  `0d00e4076267d7061ba1d0dbdfb6cd23534240a7`.
- Sole authority package:
  `docs/construction-envelopes/2026-10-24-voice-v1-hmac-route-window-readiness.md`
  (Git-blob SHA-256
  `ccdc530fbb075e459bbf418e1f26ff939ab53837e4ba75d52e8a5e0984cd29aa`).
- Task branch: `work/voice-v1-hmac-route-window-readiness-20261024`, created
  from the exact authority commit without reset, stash, clean, rebase or history
  rewrite.
- Opening state: one registered worktree, clean at opening, no stash, exact
  origin and HEAD. Git fetch moved the remote authority ref byte-for-byte to
  `15848cf2bb460957b70ea7f17bb2d293075b6946`.

The read-only Draft dependency check observed:

| PR | Head | Base/relationship | Standard CI |
| --- | --- | --- | --- |
| #114 | `0d00e4076267d7061ba1d0dbdfb6cd23534240a7` | preceding work branch | run `40117395402` success |
| #115 | `15848cf2bb460957b70ea7f17bb2d293075b6946` | based on the #114 work branch | run `40119898642` success |

Both PRs were open, Draft and `clean`; Node 20 `test` and Node 24
`sqlite-node24` checks were successful. No manual Actions dispatch or merge was
used. The base branch of #115 is
`work/voice-v1-explicit-preview-disable-20261024`, not `main`.

## Fixed target and exclusions

- Cloudflare account ID: `5a1af7ea0ef8f8aea6365306d775a894`.
- Qualification Worker: `shenshu-voice-v1-qualification-20261024`.
- Deployed rollback version: `2320fd44-294c-4789-91bd-c20694254eca`.
- Dedicated D1: `shenshu-voice-v1-qualification-20261024`, UUID
  `234913cd-8901-4607-8147-31c4a4317111`, exactly one `DB` binding.
- Forbidden old D1: `shenshu-voice-budget-test`
  (`c39a6895-7028-4f59-a100-1455b92c96c1`).
- Existing Asteria Workers, production `server.js`, Render, Auth0, public MCP,
  connectors and provider paths remain out of scope and untouched.

The account, Free/no-card status, current dashboard settings and deployed
version are operator-observed facts from the authority baseline, not an
independent Cloudflare API attestation. Any request for a card, paid plan,
Access/Zero Trust, custom domain, upgraded quota or permission expansion is a
hard STOP.

## Frozen artifact review

At the authority commit, these Git-blob SHA-256 values were recomputed from raw
LF canonical blobs:

| File | SHA-256 | Finding |
| --- | --- | --- |
| `worker/qualification-entry.js` | `17b7a6d9dbc4303bbbf70cdc6ceb579df74547c61959a060db3639d2ea7c398a` | dormant gate and exact host check |
| `wrangler.qualification.json` | `bd74e903deb635b178f7f5aead24bb93ff1a8049502be43cbc06142fc66c85a9` | `workers_dev:false`, `preview_urls:false`, one fixed D1 |
| `worker/signed-d1-worker-bridge.js` | `cc7383417ab518a09d79918b0c45a9bf46ed8e4594d00aa1e752fad18d07b9aa` | bounded body, verify before D1 |
| `src/worker-signed-request.js` | `65e100f10af84e8d6a33e2483026325e1b1966271d8942675a5c8978f40c6dc6` | canonical HMAC contract |
| `.github/workflows/ci.yml` | `7cdd93b7d053415069d0b11328bb6c884f3972191931f50decbc41f11bf6f6d5` | Node 20 regression and Node 24 SQLite jobs |

The manifest is repository intent, not current cloud proof. Version
`2320fd44...` was deployed from older source before PR #114. In particular,
`preview_urls:false` has **not** been deployed to that version. The operator
observed workers.dev and Preview Version URLs disabled and no routes/domains,
but no independent inventory of every Preview/Deployment URL exists.

## HMAC key lifecycle

### Key shape and generation

- Use exactly one test-only HMAC key for one bounded qualification window.
- HMAC is HMAC-SHA256 over the canonical UTF-8 request string below.
- Generate 32 random bytes with an operating-system CSPRNG. This yields a
  256-bit key and a 43-character unpadded base64url representation. The Worker
  secret regex accepts 43-86 base64url characters, which corresponds to input
  keys of 32-64 raw bytes; the verifier independently enforces that byte range.
- Use a non-user key ID matching `^[A-Za-z0-9_-]{8,64}$`. The key ID is not
  secret, but must be unique to this qualification and contain no account,
  person, provider or production identifier.
- Never place a secret in Git, a PR, chat, logs, screenshots, shell arguments,
  command history or an evidence file. Never record a secret-derived
  fingerprint. The operator may record only the key ID, creation time and
  deletion confirmation.

The following generator is a documented operator template, **not executed by
this package**:

```powershell
$bytes = [byte[]]::new(32)
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
```

Provisioning must be an interactive or otherwise non-echoing secure input. Do
not use an inline command-line secret. The ephemeral signer receives the secret
from secure process input, keeps it in memory only, emits no body or secret to
logs, and exits after the bounded window. The committed fixture contains only
synthetic plan metadata and can neither read nor send a secret.

### Rotation and revocation

The underlying verifier supports at most two keys for an overlap window, but
`worker/qualification-entry.js` currently exposes only one key ID/secret pair
per Worker version. Therefore this package does **not** authorize a zero-
downtime multi-key rotation. Rotate only while the public route is disabled:

1. Confirm the route is off and Worker request counters are unchanged.
2. Provision the new key pair and activation values while the route is closed.
3. Verify the new Worker version, exact host, binding and disabled URL surfaces.
4. Enable the route only under a separate approval, run once, then disable it.
5. Retire/delete the old key only after the route is off and no request is in
   flight. Do not test revocation with another live request.

Revocation order is: disable the route first, then make the Worker dormant and
delete the test secret/key ID binding, then record nonsecret confirmation. If
route disablement fails, do not continue probing; immediately remove the
activation gate/secret or preserve the incident for total control. Preserve all
D1 rows, versions and ambiguous outcomes as evidence. No DROP, DELETE,
truncate, refund or compensating write is authorized.

## Exact hostname and signed request contract

The operator must copy the account's workers.dev subdomain from the Cloudflare
Dashboard; it must never be inferred from the account ID, account display name,
email or Worker name. The only acceptable value is exactly:

`<worker-name>.<single-account-subdomain-label>.workers.dev`

The entrypoint regex permits one Worker name followed by one DNS label and
`.workers.dev`. It rejects a Version URL prefix, Preview URL prefix, nested
labels, custom domain, port, non-HTTPS origin, query and fragment. A configured
Version/Preview/custom host returns `503 qualification_unavailable` before D1.
A request arriving on such a host after exact-host activation returns the same
generic `403 not_authorized` before D1.

The signature binds these exact values in order:

```text
SHENSHU-WORKER-SIGNED-REQUEST-V1
POST
<lowercase exact host>
<exact allowed path, no query>
application/json
<decimal Unix timestamp seconds>
<nonce>
<key ID>
<unpadded base64url SHA-256 of exact body bytes>
```

The signature is unpadded base64url HMAC-SHA256. The body must be 1-2048 bytes;
`content-type` must be exactly `application/json`; timestamp skew is at most 30
seconds in either direction; and the nonce is 22-86 base64url characters. The
nonce is not a durable one-use ledger. Replay safety comes from the operation
state machine for state-changing routes.

### Failure closure

| Condition | Response before D1 |
| --- | --- |
| `QUALIFICATION_WORKER_ENABLED` missing or not `1` | `404 not_found` |
| wrong mode, host, key ID, secret shape or DB binding | `503 qualification_unavailable` |
| method/path/query/host/media type/body-size mismatch | generic `403 not_authorized` |
| missing/forged/stale/unknown-key signature | generic `403 not_authorized` |
| verified signature and exact request shape | only then may `env.DB` be used |

The bridge reads a bounded body before checking HMAC because the body digest is
signed, but it performs no D1 prepare, read or batch until verification succeeds.
The entrypoint avoids signature/timestamp/key oracle responses by collapsing
authentication failures to one generic response.

## Temporary route window and version risk

The repository manifest requests both `workers_dev:false` and
`preview_urls:false`. This is not a claim that all current Preview or
Deployment URLs are absent, nor that the older deployed version has the same
setting. Before activation, the operator must record a zero-request dashboard
attestation of the exact account, Worker version, DB binding, workers.dev state,
Version URL state, Preview/Deployment inventory, custom domains/routes and
trigger count.

Disabling workers.dev and disabling Version URLs are separate controls. Enable
only the exact production workers.dev host for the bounded window; leave
Version, Preview and custom routes disabled. Do not add Access, a custom domain,
a paid limit or a new binding. A future secret/activation change can create a
new Worker version, so after every such change the operator must repeat the
version/URL inventory before enabling the route and preserve `2320fd44...` as
the rollback reference.

The temporary route is public. Every request, including unsigned `403` and
dormant `404` responses, can consume the shared Workers Free request/CPU
allowance. The 24-request ceiling below covers only this plan; ambient traffic
can exhaust quota independently. There is no authorized paid rate-limit,
Access policy or anti-abuse guarantee. Keep the route open for no more than the
20-minute run, preflight a near-zero baseline, monitor counters, and disable the
route immediately on unexpected traffic or any cap movement. HMAC does not
solve availability or denial-of-service risk.

## Deterministic single-run plan

`test/fixtures/hmac-route-window-budget.mjs` freezes a plan-only 24-operation
sequence. It contains no secret, endpoint, provider client, text, audio or
network call. `test/hmac-route-window-budget.test.js` proves the aggregate and
rejects request, D1, row-write, read, statement, storage, duration, provider,
duplicate-ID and extra-field overruns.

| Phase | Worker HTTP | Admission route | D1-touching | Accepted | Row-write units | Statement ceiling | Rows-read ceiling |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| six negative/confused requests | 6 | 3 | 0 | 0 | 0 | 0 | 0 |
| seven authenticated admission cases | 7 | 7 | 7 | 4 | 16 | 27 | 144 |
| eleven authenticated status/transition cases | 11 | 0 | 11 | 0 | 3 | 11 | 22 |
| **plan total / cap** | **24 / 24** | **10 / 10** | **18 / 18** | **4 / 4** | **19 / 32** | **38 / 64** | **166 / 512** |

The plan also allocates 28 KiB against the 256 KiB storage-delta ceiling, a
maximum wall-clock duration of 20 minutes and zero provider calls. The four
accepted admissions create 12 durable rows; four grant-consumption updates make
16 successful-admission row-write units, plus three synthetic state transitions
for 19 total. These are conservative planning ceilings, not real D1 metering.

The future harness must be a single process with one monotonic request counter,
must check the next counter before emitting a request, and must stop at the
first unexpected status, body, row count, timing ambiguity, non-plan request or
any counter overrun. It must never automatically retry, clean up, compensate,
or manufacture a clean result. Because this plan reaches the 24/18/10 ceilings
with no spare capacity, any ambient Worker request is STOP rather than an
invitation to extend the budget. No executable network harness or real key is
included here.

## Separate cloud authorization gates

No gate below is authorized by this package:

1. **A0 - zero-request attestation.** Operator records Free/no-card identity,
   exact account/Worker/version, one `DB` binding, workers.dev, Version URL,
   Preview/Deployment inventory, routes/domains/triggers and zero requests.
2. **A1 - artifact/deploy decision.** If source/config must change, separately
   authorize a reviewed commit, dry-run, deployment and rollback target. Deploy
   only with routes and Version URLs closed; creation of a new version is not
   route activation.
3. **A2 - test key and activation.** Separately authorize test key generation,
   non-echoing secret provisioning and the exact hostname/activation tuple while
   the route remains closed. Verify the new version and all URL surfaces again.
4. **A3 - temporary route enablement.** Separately authorize only the exact
   workers.dev host for a short window; no Version/Preview/custom route, Access,
   paid setting or binding change.
5. **A4 - bounded signed run.** Separately authorize the 24/18/10 plan, exact
   run date/IDs, observer, signer host and stop owner. Zero provider calls.
6. **A5 - shutdown and revocation.** Disable the route, make the Worker dormant,
   delete the test secret, confirm nonsecret state and preserve D1 evidence.

Any card/payment, plan upgrade, permission expansion, Access dependency,
unexpected principal, new binding, unknown preview inventory, ambiguous result
or cap overrun is STOP for total control.

## Narrow offline changes

This package makes only test/evidence changes:

- assert the manifest's explicit `preview_urls:false` value;
- add Version URL, Preview URL, nested-subdomain and custom-domain rejection
  cases to the qualification entrypoint suite;
- add a pure plan-only budget fixture and test proving the complete request,
  D1-touching, admission and write/read/statement ceilings.

It does not modify `worker/qualification-entry.js`,
`worker/signed-d1-worker-bridge.js`, `src/worker-signed-request.js`,
`wrangler.qualification.json`, `server.js`, D1 schema, provider code, Render,
Auth0 or workflows.

## Local verification

Local Node `v24.19.0`:

- qualification entry plus budget suite: **13/13 PASS**, 0 skipped;
- signed-request/bridge regression suite: **18/18 PASS**, 0 skipped;
- full `node --test`: **349/349 PASS**, 0 failed, 0 skipped;
- `node test/smoke-server.mjs`: PASS when run alone;
- `node --check server.js`, `src/minimax-adapter.js` and
  `worker/qualification-entry.js`: PASS;
- `git diff --check`: PASS.

The first smoke attempt was run concurrently with the full suite and failed to
connect to its own fixed local port. It passed when run alone; this is a local
port-contention observation, not a product failure and no smoke script change
was made.

These are offline repository results, not Cloudflare execution, Free-quota
evidence, native D1 rollback evidence or provider behavior. Final committed HEAD
and standard PR CI run IDs are recorded in the Draft PR body to avoid a
self-referential document hash.

## Real-operation counters

- Workers or Durable Objects created/deployed: 0
- Worker versions, routes, Preview/Version URLs or bindings changed: 0
- HMAC secrets generated, read, provisioned or deleted: 0
- Worker HTTP requests: 0
- Real D1 reads/writes/queries/migrations: 0
- Cloudflare API calls: 0
- Cloudflare/Auth0/provider keys, tokens or voice IDs read/logged: 0
- Render/Auth0/connector changes: 0
- MiniMax/provider calls: 0
- Paid tools, plans, cards or cost changes: 0
- Manual GitHub Actions dispatches: 0 (standard PR CI only)
- Merges/rebase/rewrites: 0

Read-only GitHub metadata and local Git state were inspected. No credential
value was printed, returned in evidence or written by this task.

## V1 disposition

Strict V1 remains **2/9** (gates 1 and 8 only). B1-B4 remain open:

- **B1:** iPhone generated/bridge audio remains without a user-confirmed audible
  result.
- **B2:** real D1 atomic admission and the deployed Worker path remain
  unqualified.
- **B3:** real fail-closed/private durable result delivery remains absent.
- **B4:** zero authorized real MiniMax end-to-end calls.

**COMPLETE for the authorized offline readiness scope.** The next independent
cloud decision is at most Gate A0: a zero-request read-only account/Worker/URL
attestation. Test key creation, any deploy, route enablement, live signed
requests and revocation each still require a separate explicit authorization;
none is implied by this document.
