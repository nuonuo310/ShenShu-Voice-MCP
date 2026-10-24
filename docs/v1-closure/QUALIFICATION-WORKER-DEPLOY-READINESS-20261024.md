# Voice V1 qualification Worker deployment readiness, offline only (2026-10-24)

**STATUS: COMPLETE FOR THE AUTHORIZED OFFLINE SCOPE. NO CLOUD DEPLOYMENT,
REAL D1 OPERATION, SECRET, PROVIDER CALL OR MERGE OCCURRED. REAL DEPLOYMENT
REMAINS SEPARATELY UNAUTHORIZED. STRICT V1 REMAINS 2/9; B1-B4 REMAIN OPEN.**

This package freezes a dormant, separately deployable qualification-only Worker
artifact and an unexecuted operator plan. It does not create or deploy a Worker,
read or write real D1, read a credential, enable a route, modify Render/Auth0,
dispatch GitHub Actions manually, call MiniMax or another provider, or merge.

## Authority and opening gate

- Repository: `nuonuo310/ShenShu-Voice-MCP`
  (`https://github.com/nuonuo310/ShenShu-Voice-MCP.git`).
- Authority branch: `docs/voice-v1-worker-deploy-readiness-20261024`.
- Authority commit: `69ed793f3f110ac796658fb392442a10e607a114`.
- Sole authority package:
  `docs/construction-envelopes/2026-10-24-voice-v1-qualification-worker-deploy-readiness.md`
  (Git-blob SHA-256
  `8b3f9fdc457fa96b544b010b3118e8bfb39feb72b31c4c75c5941dd6342d0fdd`).
- Task branch:
  `work/voice-v1-qualification-worker-deploy-readiness-20261024`, created from
  the exact authority commit without reset, stash, clean, rebase or history
  rewrite.
- Opening state: one registered worktree, clean before edits, no stash, origin
  verified, and HEAD exactly at the authority commit.
- Authority parent: PR #109 head
  `f23c6f05c6f2a46fcabedfef19ed5e35a4476ae0`.

The read-only PR dependency check observed this contiguous Draft/clean stack:

| PR | Head | Standard CI |
| --- | --- | --- |
| #106 | `433e5bd74d27b4b3e7d13a48384556a21a943ddc` | `40101414380` success |
| #107 | `11a166281733cc4c1e92a42bd9b6ffdb67556cbb` | `40103170968` success |
| #108 | `40b6ac0492e571587f27a314ab0609e94f373d54` | `40104416324` success |
| #109 | `f23c6f05c6f2a46fcabedfef19ed5e35a4476ae0` | `40108850317` success |
| #110 | `69ed793f3f110ac796658fb392442a10e607a114` | `40109178318` success |

PR #110 is based on #109. This task is a single Draft PR stacked on the exact
#110 authority commit.

## Fixed target and exclusions

- Qualification Worker and D1 database name:
  `shenshu-voice-v1-qualification-20261024`.
- Qualification D1 UUID: `234913cd-8901-4607-8147-31c4a4317111`.
- Binding name: exactly `DB`; no preview database, default database, REST D1
  transport, alternate binding or fallback.
- Forbidden old database: `shenshu-voice-budget-test`
  (`c39a6895-7028-4f59-a100-1455b92c96c1`).
- Existing Asteria Workers, production `server.js`, Render, Auth0, public MCP,
  connectors, provider paths and paid features are out of scope and untouched.

The real D1 schema initialization was user-observed only at the scope recorded
in `REAL-D1-SCHEMA-INITIALIZATION-EVIDENCE-20261024.md`: three business tables,
two explicit indexes, seven autoindexes, zero business rows and an empty
`foreign_key_check`. It is not proof of native cloud batch atomicity, Worker
signature isolation, concurrency, paid-path behavior or provider delivery.

## Frozen offline artifact

Implementation commit:
`04632ff0f9f3df6b08152c2d26c6eb7bc5532c97` (parent
`69ed793f3f110ac796658fb392442a10e607a114`).

These SHA-256 values are over the LF-canonical Git blobs in that commit:

| File | Role | SHA-256 |
| --- | --- | --- |
| `worker/qualification-entry.js` | Dormant Worker entrypoint | `17b7a6d9dbc4303bbbf70cdc6ceb579df74547c61959a060db3639d2ea7c398a` |
| `wrangler.qualification.json` | Fixed deployment manifest | `5ab91711da85ee99a98af29fd749d58a2a3e1b0f1fe58fb9d520630990262b50` |
| `test/qualification-worker-entry.test.js` | Offline entrypoint suite | `8ec72dd849f362a49a018830af0629085c8317ed1cf0493b07dfb422a8c4941f` |
| `.github/workflows/ci.yml` | Node 20 regression plus Node 24 SQLite job | `7cdd93b7d053415069d0b11328bb6c884f3972191931f50decbc41f11bf6f6d5` |

The manifest fixes `main`, `compatibility_date`, `workers_dev: false`, the Worker
name and one D1 binding. It contains no account ID, route, variable, secret,
preview database or old-database UUID. The entrypoint imports only the existing
signed D1 bridge; it has no Node built-in, network client, provider module,
secret source or production-account constant.

## Runtime gate and request contract

The artifact is dormant by default. Without
`QUALIFICATION_WORKER_ENABLED=1`, every request returns
`404 {"error":"not_found"}`.

Activation requires all of the following values out of band:

- `QUALIFICATION_WORKER_ENABLED=1`;
- `QUALIFICATION_MODE=qualification`;
- `QUALIFICATION_EXPECTED_HOST=<exact qualification host>.workers.dev`;
- one new test-only `QUALIFICATION_HMAC_KEY_ID`;
- one new test-only `QUALIFICATION_HMAC_SECRET`;
- the manifest-injected `env.DB` binding.

An enabled but incomplete, malformed or unsafe tuple returns
`503 {"error":"qualification_unavailable"}` before bridge construction. Missing
DB, partial DB, wrong mode, wrong/old Worker host, short secret, missing key or
missing host never fall back to another database or Worker.

Only five exact POST paths are accepted: `admit`, `status`, `provider-pending`,
`completed` and `unknown`. HTTPS, the configured exact host, no query/hash, the
exact JSON media type and the bounded body are required. Unsigned, forged,
stale, wrong-host, wrong-path, query-bearing, wrong-method and wrong-content-type
requests collapse to one generic `403 {"error":"not_authorized"}` before D1.
A validly signed malformed JSON body returns `400` before D1.

The existing signed bridge verifies raw bytes and HMAC metadata before it
rebuilds the single forwarded JSON request and enters the existing operation
state machine. The daily cap is fixed at 3. The nonce is signature-bound but is
not a durable one-use ledger. The durable `(principal, operation_id)` operation
record and conditional state transitions remain the replay anchor; exact-once
message delivery and stable ChatGPT `operation_id` ingress are not claimed.

## Offline verification

Local runtime: Node `v24.19.0`.

- qualification entrypoint suite: **9/9 PASS**, 0 failed, 0 skipped;
- full repository suite: **344/344 PASS**, 0 failed, 0 skipped;
- `node --check worker/qualification-entry.js`: PASS;
- `git diff --check`: PASS.

The tests prove, in the local process only:

- the manifest has one exact D1 binding and no cloud identity or old UUID;
- dormant and unsafe configurations fail closed before D1 construction;
- unsigned/forged/stale/wrong-host/wrong-path/wrong-media-type requests produce
  one generic 403 with zero D1 `prepare` or `batch`;
- a valid signature reaches only the injected `env.DB`, and a malformed signed
  body is rejected before D1;
- replay of one admission returns the existing record with no second
  reservation, grant or batch;
- an out-of-order `completed` transition returns 409 and leaves the operation
  admitted;
- Node 24 asserts `node:sqlite` availability, preventing the SQLite-backed cases
  from silently skipping; the existing Node 20 job remains.

The Node 24 CI job runs syntax checks, an independent `node:sqlite` probe and
the complete `node --test` suite. The first standard PR-triggered run for this
report is recorded below after delivery. Local success is not Cloudflare runtime,
native D1 atomicity or real network proof.

## Unexecuted operator deployment plan

Every numbered gate needs its own explicit authorization. Approval of this
offline package or of a later generic "continue" does not approve a cloud
operation.

1. **Account and Free/no-card gate.** In the operator's own session, verify the
   intended Cloudflare account identity, Workers Free and D1 Free, no card and
   no paid Access/Zero Trust dependency. Confirm the target D1 name/UUID and
   that no existing Asteria Worker, route, secret or Render consumer is selected.
   STOP on any upgrade, payment, Access or ownership ambiguity.
2. **Artifact gate.** Deploy only from implementation commit
   `04632ff...` or a later reviewed commit. Recompute and match all frozen file
   hashes. STOP if the manifest name, binding, UUID, `main`, `workers_dev` or
   source hash differs.
3. **Worker creation gate.** Use `wrangler.qualification.json` to create only
   `shenshu-voice-v1-qualification-20261024` with exactly one `DB` binding to
   UUID `234913cd-8901-4607-8147-31c4a4317111`. Do not use an existing Asteria
   Worker, production account route or old database. The checked-in manifest
   has `workers_dev: false`, so deployment alone has no public workers.dev route.
4. **Activation and key gate.** Provision only the five activation values above
   as out-of-band Worker environment bindings, including one newly generated
   test HMAC key pair. Never commit, log, echo or paste the secret. Confirm the
   Worker remains dormant until this gate.
5. **Route gate.** Because `workers_dev` is false, any reachable qualification
   host requires a separately reviewed route/manifest decision. Prefer a later,
   explicit enable/disable gate. Enabling workers.dev publicly accepts the risk
   that unauthenticated traffic can consume the shared Free request/CPU quota;
   this package provides no paid rate-limit, Access or anti-abuse guarantee.
6. **Bounded request gate.** Only after all prior gates, approve exact test
   identifiers, UTC date, signer location, request counters, observer and stop
   owner. Keep provider paths disabled. No retry, cleanup or compensating write
   may be used to manufacture a clean result.
7. **Revocation gate.** Disable the route and set the Worker dormant or revoke
   the test key immediately after the bounded run or any STOP condition. Key
   revocation, Worker deletion and route cleanup are explicit operations.

The first real deployment still requires at minimum separate authorization for:
account/Free/no-card verification; Worker creation; secret provisioning; route
enablement; the bounded request run; and route/key rollback. None is implied by
this document.

## Planned ceilings, not execution permission

The reconciled PR #104 limits are ceilings only:

| Counter | Maximum |
| --- | --- |
| Qualification Worker HTTP requests | 24 |
| D1-touching requests | 18 |
| Admission-route requests | 10 |
| D1 row-write units | 32 |
| Rows read | 512 |
| D1 statements | 64 |
| Storage delta | 256 KiB |
| Run duration | 20 minutes |
| Provider/MiniMax calls | 0 |

Any overrun, unexpected principal, extra row, duplicate slot, unexpected D1
access, malformed result, non-4xx ambiguity, timeout without a recoverable read,
secret leak or provider attempt is STOP. Do not delete ambiguous test rows,
drop tables or redeploy to make evidence appear clean.

## Rollback and preservation

The offline rollback is to close this Draft PR; there is no cloud state to
restore. A future real deployment must roll back in this order or as an
independently approved equivalent:

1. make the Worker dormant (`QUALIFICATION_WORKER_ENABLED` absent or not `1`);
2. disable the public route or return `workers_dev` to false through a reviewed
   change;
3. revoke the test-only HMAC key and any accidental test credential;
4. preserve D1 schema and all ambiguous or observed rows as evidence;
5. record request/D1 counters and stop reasons before any separately approved
   cleanup or Worker deletion.

The frozen additive `001/002/003` schema is unchanged. No `004`, DROP, DELETE,
truncate, automatic cleanup, rollback probe or old-database cleanup is
authorized.

## Known limitations

- A D1 binding object does not expose its database UUID at runtime. The exact
  UUID is enforced by the reviewed manifest and by operator pre/post checks, not
  by reading the binding object.
- `workers_dev: false` intentionally leaves the artifact without a public route.
  Enabling one creates public reachability and shared Free-quota availability
  risk.
- The nonce is not a durable one-use ledger. Replay safety depends on the
  operation key and state machine.
- Stable ChatGPT `operation_id` ingress into the future signer remains unproven.
- Cloudflare runtime CPU, native D1 batch rollback, cross-principal concurrency,
  uncertain upstream responses and route behavior remain unobserved.
- The reported real D1 schema state is user-observed and does not establish
  end-to-end paid qualification.

## Real-operation counters

- Workers or Durable Objects created/deployed: 0
- Routes, Access applications or Worker secrets created/changed: 0
- Real D1 reads/writes/queries/migrations: 0
- Cloudflare API calls: 0
- Cloudflare/Auth0/provider keys, tokens or voice IDs read/logged: 0
- Render/Auth0/connector changes: 0
- MiniMax or billable provider calls: 0
- Paid tools, plans, cards or cost changes: 0
- Manual GitHub Actions dispatches: 0 (standard PR CI only)
- Merges/rebase/rewrites: 0

Read-only public GitHub metadata and local Git state were inspected. No credential
value was printed, returned in evidence or written by this task.

## V1 disposition

Strict V1 remains **2/9** (gates 1 and 8 only). This offline package closes no
formal gate and reduces no blocker:

- **B1:** iPhone generated/bridge audio remains without a user-confirmed audible
  result.
- **B2:** real D1 atomic admission and the real Worker path remain unqualified.
- **B3:** real fail-closed/private durable result delivery remains absent.
- **B4:** zero authorized real MiniMax end-to-end calls.

**COMPLETE for the authorized offline deployment-readiness scope.** Actual
Worker deployment, key provisioning, route enablement, real D1 traffic and
provider qualification require separate total-control authorization.
