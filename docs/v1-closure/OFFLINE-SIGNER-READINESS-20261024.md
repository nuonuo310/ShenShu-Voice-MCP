# Voice V1 offline HMAC signer readiness (2026-10-24)

**STATUS: COMPLETE FOR THE AUTHORIZED OFFLINE SCOPE. NO REAL HMAC KEY,
NETWORK REQUEST, CLOUDFLARE MUTATION, WORKER DEPLOY, ROUTE, REAL D1 REQUEST,
PROVIDER CALL OR MERGE OCCURRED. STRICT V1 REMAINS 2/9; B1-B4 REMAIN OPEN.
THIS WAS THE FINAL AUTHORIZED PACKAGE; CONSTRUCTION STOPS HERE.**

This package adds a local-only, nonbillable, non-networking preparation tool.
It creates canonical signed request objects for the already frozen 24-slot
qualification plan. It does not send them and does not make a real key usable.

## Authority and Opening Gate

- Repository/origin: `nuonuo310/ShenShu-Voice-MCP`
  (`https://github.com/nuonuo310/ShenShu-Voice-MCP.git`).
- Authority branch: `docs/voice-v1-offline-signer-readiness-20261024`.
- Authority commit: `acfa92ddec9fca5c06a135ecc323f07dee50bd47`.
- Authority parent: PR #116 head
  `2728b5f8240d916f36155919e4697fedd014a588`.
- Sole authority package:
  `docs/construction-envelopes/2026-10-24-voice-v1-offline-signer-readiness.md`.
  Its raw Git blob is `da0fbdbed7010a6c1ce8e35ccebf90f87437c0cb`; raw LF
  SHA-256 is
  `273b2eb838c1a81d7f195b29900b598bac195a6874abbc50c1f6ca76fae18aaf`.
- Task branch: `work/voice-v1-offline-signer-readiness-20261024`, created
  from that exact commit. No reset, stash, clean, rebase, merge or history
  rewrite was used.
- Opening state: one registered worktree; task branch clean at the authority
  commit; no stash; origin and HEAD exactly the authority commit.

The read-only PR dependency check observed:

| PR | Head | Relationship | Standard CI |
| --- | --- | --- | --- |
| #116 | `2728b5f8240d916f36155919e4697fedd014a588` | Draft, `clean`; work branch stacked on the HMAC authority | run `40120710480` (#361) success |
| #117 | `acfa92ddec9fca5c06a135ecc323f07dee50bd47` | Draft, `clean`; authority branch based on the #116 work branch | run `40122084466` (#362) success |

Run #362 completed successfully in both Linux jobs: Node 20 `test` and Node 24
`sqlite-node24` (`120955645294` and `120955645434`). No manual Actions dispatch
or merge was used.

## Fixed target and exclusions

- Cloudflare account ID: `5a1af7ea0ef8f8aea6365306d775a894`.
- Qualification Worker: `shenshu-voice-v1-qualification-20261024`.
- Deployed version: `2320fd44-294c-4789-91bd-c20694254eca`.
- Dedicated D1: `shenshu-voice-v1-qualification-20261024`, UUID
  `234913cd-8901-4607-8147-31c4a4317111`, one `DB` binding.
- Forbidden legacy D1 remains `shenshu-voice-budget-test`
  (`c39a6895-7028-4f59-a100-1455b92c96c1`).
- Existing Asteria Workers, production `server.js`, public MCP, Render, Auth0,
  connectors, D1 schema and provider paths are untouched.

The account/version/dashboard facts come from the authority baseline and are
not new independent Cloudflare API attestations. No credential or cloud state
was read by this package.

## Offline signer design

The new files are:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `src/offline-hmac-signer.js` | 12802 | `c34d60f6879fd112949a3a008874cd20c3ba38a13cd39a9ec6642857fedd04b1` |
| `src/offline-hmac-signer-cli.js` | 2061 | `ffa2bfd030e1cf4352287ebccee8d27805a761031574d725fe7f831578757ca0` |
| `test/offline-hmac-signer.test.js` | 16888 | `a35cbd3d0aa7d4d70c2b48f6ce76a49339755463bc34c4d06819d00e83d9bb11` |

The library reuses the existing canonical
`signWorkerOperationRequest`/`signWorkerRequest` contract rather than defining a
second signing protocol. It binds POST, exact caller-selected host, fixed path,
JSON content type, raw body, timestamp, nonce, key ID and HMAC-SHA256 signature
through that contract.

Security properties enforced before a signature is prepared:

- Worker name and dedicated D1 name/UUID must exactly match the frozen
  qualification identity. The legacy D1 and arbitrary identities fail closed.
- Mode is exactly `synthetic_test_only`; key IDs require the
  `offline_synth_` prefix and principals require `dryrun_`.
- Only the five frozen internal paths are accepted. Caller URL, path, query,
  fragment, port, custom host, Version/Preview-like prefix, nested host and
  uppercase host forms are rejected.
- Every returned URL must equal the one supplied expected host and the fixed
  route for that operation. The caller cannot redirect the request after
  signing.
- Operation objects have exact keys. Extra body material, secret, URL, path and
  malformed IDs/digests/body metadata are rejected. There is no provider field.
- The process-local nonce set rejects replay and there is no retry path after a
  signing error. Durable replay remains the Worker operation-state machine's
  responsibility, not this tool's claim.
- Budget projection occurs before signing and again before a prepared request
  is returned. The injected request path has no clock wait that could silently
  extend the 20-minute window.

The complete plan uses the existing fixture's six negative/confused slots as
prior usage and prepares only its 18 valid authenticated requests. Its final
projected totals are 24 HTTP, 18 D1-touching, 10 admission, 4 accepted
admissions, 19 row-write units, 166 rows read, 38 statements, 28 KiB storage
and 0 provider calls. These are below the frozen caps of 24/18/10/4/32/512/64/
256 KiB/20 minutes/0 provider calls. No HTTP or D1 operation occurs.

The narrow CLI accepts only JSON on stdin, at most 64 KiB. It rejects all
command-line arguments, reads no environment variable, offers no real-secret or
credential prompt, imports no network/output module, writes no file and has no
retry or provider path. Success prints only status, mode, plan ID and redacted
counters. Failure prints only `{status:"blocked", code:"<stable STOP code>"}`
to stderr and exits 2. It never emits the body, signature, signed headers,
secret, principal, nonce, operation IDs or digests.

## Threat model and unresolved boundaries

This package reduces confused-deputy risk from a wrong Worker/D1/host/path,
strict-schema smuggling, accidental network use, secrets in CLI arguments or
logs, in-process nonce reuse, unbounded preparation and automatic retry. It is
not a live endpoint security review.

The following remain deliberately unsolved and require independent review:

1. **Real secret injection.** No real key was generated, read, accepted or
   persisted. A future key must be created by a separately authorized operator,
   injected by a no-echo mechanism that is not a shell argument, process list
   value, environment dump or file output, and then revoked. The synthetic-only
   CLI must not be treated as that mechanism.
2. **Exact cloud hostname.** The library binds the exact single host supplied by
   its caller and rejects endpoint variants, but this package did not read or
   attest the account's real workers.dev hostname.
3. **Verified principal source.** `dryrun_` principals are synthetic placeholders.
   Future ingress still needs a verified admission source; a caller-provided
   principal must never become trusted merely because a signature is valid.
4. **Stable operation ID provenance.** The future ChatGPT ingress does not yet
   have a proven deterministic operation-ID source. This tool does not claim to
   solve durable replay or safe retry across callers.
5. **Availability and Free quota.** Valid HMAC does not prevent anonymous
   flooding, request-count exhaustion or other Free-plan availability risk.
   There is no independent route/Preview inventory in this package.
6. **Real D1/provider behavior.** The plan remains fixture-only: no D1 read,
   write, migration, provider call or billing observation was performed.

## Local verification

Local runtime: Node `v24.19.0`, Git `2.55.0.windows.3`.

- Specialized offline signer suite: **11/11 PASS**, 0 skipped.
- Signed request/bridge/HMAC budget regressions: **22/22 PASS**, 0 skipped.
- Full `node --test`: **360/360 PASS**, 0 failed, 0 skipped.
- `node test/smoke-server.mjs` run alone: PASS for MCP initialize, tool listing/
  calls, protected metadata and fail-closed paid entry.
- `node --check` on the two new source files, the new test, `server.js` and
  `worker/qualification-entry.js`: PASS.
- `git diff --check`: PASS.

The specialized tests cover canonical determinism and verification with a
synthetic key, exact route/host rejection, identity rejection, caller path/URL/
secret rejection, plan and prior-usage validation, duplicate nonces, no retry,
budget/duration exhaustion, a `fetch` trap, source import scanning, CLI stdout/
stderr redaction and CLI no-side-effect failures.

The committed HEAD, standard Node 20/Node 24 PR CI run and job results are
recorded in the Draft PR body after the commit is pushed. Standard PR CI only is
authorized; no manual dispatch is used.

## Real-operation counters

- Real HMAC keys generated, read, provisioned, persisted or deleted: 0
- Cloudflare API calls or credential reads: 0
- Workers, versions, routes, domains, Preview/Version URLs or bindings changed: 0
- Worker deployments or HTTP requests: 0
- Real D1 reads, writes, queries or migrations: 0
- Render, Auth0, connector or public MCP changes: 0
- MiniMax/provider calls or billing changes: 0
- Paid tools, plans, cards or permission expansions: 0
- Manual GitHub Actions dispatches, merges, rebases or history rewrites: 0

## V1 disposition and STOP

Strict V1 remains **2/9** (gates 1 and 8 only). B1-B4 remain open:

- **B1:** no user-confirmed audible result for iPhone generated/bridge audio.
- **B2:** real D1 atomic admission and the deployed Worker path remain
  unqualified.
- **B3:** real fail-closed/private durable result delivery remains absent.
- **B4:** no authorized real MiniMax end-to-end call.

**COMPLETE for the authorized offline signer scope.** This is the last package
requested for today. Construction stops after delivery; no next stage is
scheduled or started.
