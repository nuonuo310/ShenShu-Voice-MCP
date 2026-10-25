# Voice V1 - Cloud A0 evidence reconciliation and Render closure (2026-10-25)

**TASK STATUS: COMPLETE FOR THE AUTHORIZED OFFLINE EVIDENCE-ONLY SCOPE.
CLOUD A0 STATUS: BLOCKED / PARTIAL. A1-A5: NO-GO. STRICT V1: 2/9.**

This paper reconciles the operator-supplied Cloudflare A0 evidence, archives the
Render production-service test-gate closure, and distinguishes that evidence
from independent API or live attestation. It does not complete A0, authorize any
A1-A5 action, or claim live trusted ingress, cloud D1 atomicity, private durable
delivery or paid execution.

No Cloudflare or D1 request, Render environment change, Worker deployment or
traffic, route enablement, real secret, Auth0 change, MiniMax/provider call,
public MCP call, manual Actions dispatch, merge or Asteria-Call edit occurred in
this task.

## Opening gate and authority

- Repository: `nuonuo310/ShenShu-Voice-MCP`.
- Origin: `https://github.com/nuonuo310/ShenShu-Voice-MCP.git`.
- Authority PR: #123, open Draft, `clean`, head
  `1f12ab348a99639359326c5db071756a69ae5323`.
- Authority parent: `47ac2d92ea0facee9e38d938a8e774a18b968693`, exactly PR
  #122 head.
- Authority document:
  `docs/construction-envelopes/2026-10-25-voice-v1-a0-evidence-reconciliation-render-closure.md`,
  blob `0883852f01d5b47c88de602b69a26ff4e227fd85`, 4,700 bytes.
- Task branch: `codex/voice-v1-a0-evidence-reconciliation-20261025`, created
  from the exact authority commit without reset, clean, stash, rebase, merge or
  history rewrite.
- Task worktree:
  `C:\Users\Administrator\.codex\worktrees\voice-v1-a0-evidence-reconciliation-20261025\ShenShu-Voice-MCP`.

The primary worktree remained at `498e806a...` with its pre-existing unrelated
zero-byte `$out`; it was not read, modified or included. The PR #122 worktree
remained at `47ac2d92...`. No stash exists. The new isolated worktree was clean
at opening.

The current chain is open, Draft and mergeable: #118 -> #119 -> #120 -> #121 ->
#122 -> #123. Standard pull-request CI is successful for every head:

| PR | Head | CI run |
| --- | --- | --- |
| #118 | `ed9fba65014a455e303698ba7d54d63bc8752c0b` | `40123120802` |
| #119 | `c0a437c9a0fbb36b6819aceed5c22f7f2ce11e8d` | `40195360917` |
| #120 | `498e806a582c636f1c0a9e627432e3fd61d2c9c5` | `40196715043` |
| #121 | `7f0a7027ea01a9e54ed72672618e446813753bb5` | `40202797312` |
| #122 | `47ac2d92ea0facee9e38d938a8e774a18b968693` | `40204108803` |
| #123 | `1f12ab348a99639359326c5db071756a69ae5323` | `40206810605` |

PR #123 has successful `test` and `sqlite-node24` checks. All runs were triggered
by `pull_request`; none was manually dispatched. CI is repository regression
evidence, not cloud qualification evidence.

The deployed Render `main` is commit
`1cef5ada7f6af0b912b7d5bba2c42f4f776bb828`, also the current local `origin/main`.
That commit predates the qualification Worker files; it therefore cannot be used
to infer the Cloudflare Worker artifact, deployed version or D1 behavior.

## Evidence classes used by this review

1. **Operator/user report:** Cloudflare dashboard screenshots and operator
   statements. No original files, image hashes or Cloudflare observation UTC
   timestamp were supplied to this task.
2. **Render API/log supplied in authority:** the exact workspace, service,
   deploy, commit, environment flags and startup booleans recorded in PR #123.
   This task did not re-query Render, read Render credentials or touch its
   environment.
3. **GitHub source/CI:** exact local Git objects, the deployed-main source and
   standard PR checks.
4. **Absent:** no evidence was supplied. It is recorded as blocked, not inferred
   from historic documents.
5. **Independent live attestation:** none in this task. No Cloudflare or Render
   API, public endpoint or MCP request was invoked.

## Render production-service closure archive

This is a distinct configuration change that is already reported as complete.
It is not an action performed by this task.

| Field | Recorded value | Evidence class |
| --- | --- | --- |
| Render workspace | `tea-dbb28o5g1s2s73e0bfb0` | Render API/log supplied in authority |
| Service | `srv-dbb2jmu7bikc73bgq2e0` | Render API/log supplied in authority |
| Environment | Production service, explicitly **not** the staging service | Render API/log supplied in authority |
| Deploy | `dep-dbf1rio473hc73bicchg` | Render API/log supplied in authority |
| Source commit | `1cef5ada7f6af0b912b7d5bba2c42f4f776bb828`, unchanged `main` | Render API/log plus local Git ancestry check |
| Live time | 2026-10-25 15:19:08 UTC | Render API/log supplied in authority |
| `SHENSHU_AUTH_MCP_ENABLED` | `0` | Merge-only environment change, operator-reported |
| `SHENSHU_D1_ADMISSION_DRY_RUN_ENABLED` | `0` | Merge-only environment change, operator-reported |
| `SHENSHU_PRIVATE_FIXTURE_ENABLED` | `0` | Merge-only environment change, operator-reported |

The supplied Render startup log reports:

```json
{
  oauth_stage_enabled: false,
  dry_run_flag_enabled: false,
  d1_config_accepted: false,
  d1_tool_registered: false,
  paid_voice_enabled: false
}
```

The deployed source supports the claimed effect: with
`SHENSHU_AUTH_MCP_ENABLED` not equal to `1`, `/paid-mcp` does not instantiate the
staging identity server; with the D1 dry-run flag not equal to `1`,
`createD1AdmissionDryRun()` returns `null`; and the private fixture tools are not
registered. These checks are nonbillable and do not expose a paid tool.

The closure does **not** prove every Render route or host unreachable. The public
`/mcp` fixture remains reachable by design, and the protected-resource metadata
and `/paid-mcp` routes still exist. The `/paid-mcp` path now fails closed for the
three closed flags, but `SHENSHU_AUTH_DIAGNOSTIC_ENABLED` and
`SHENSHU_AUTH_PUBLIC_JWKS_JSON` state was not included in the supplied closure;
that diagnostic is nonpaid but remains an unverified residual path. The closure
also neither removes existing Render credentials nor proves their removal.

### Public mock regression observation

The operator reports that unauthenticated `preview_shenshu_voice` returned the
existing fixed 10.056-second MP3 fixture and that the user personally heard it.
This is a successful public-mock regression observation only. It does not
exercise generated speech, private delivery, `/paid-mcp`, Auth0 identity, D1,
the qualification Worker, MiniMax or iPhone generated/bridge audio. It does not
close B1, B3 or B4. This task made no public MCP call.

## Claim/evidence ledger

| Claim | Supplied evidence | Evidence class | Disposition |
| --- | --- | --- | --- |
| Cloudflare account identity | `5a1af7ea0ef8f8aea6365306d775a894` | Operator screenshot/user report | Identity matches the frozen target; no independent account API check |
| Qualification Worker name | `shenshu-voice-v1-qualification-20261024` | Operator screenshot/user report | Name matches; Worker ID absent |
| Worker version | `2320fd44-294c-4789-91bd-c20694254eca` | Operator screenshot/user report | Version recorded; exact observation time and deployment source absent |
| Dedicated D1 identity | UUID `234913cd-8901-4607-8147-31c4a4317111`, one `DB` binding | Operator screenshot/user report | UUID and binding count match; current database display name and capture time absent |
| URL surfaces | workers.dev Production and Preview disabled; no custom domains/routes | Operator screenshot/user report | Reports closure; exact workers.dev host and complete Version/Deployment URL inventory absent |
| Triggers and routes | No custom routes; no Cron, Queue or Email triggers | Operator screenshot/user report | Positive for those named surfaces; Access applications and capture window absent |
| Worker counters | 24h requests 0, errors 0 at observation | Operator screenshot/user report | Supports zero Worker traffic for an unspecified 24h window; exact UTC interval and invocation metric absent |
| D1 historical activity | 24h: 19 queries, 159 rows read, 11 rows written; 3 tables, 61.44 KB | Operator screenshot/user report | Real activity exists; attribution to prior manual SQL is plausible but unverified |
| Render test-gate closure | Exact workspace/service/deploy/commit; three flags set to `0`; startup booleans all false | Render API/log supplied in authority, operator-reported | Closure archived; not independently re-queried by this task |
| Public mock playback | Fixed 10.056-second MP3 returned and heard | Operator/user report; source matches the fixed fixture | Public mock regression observation only |

## A0 required-field reconciliation

The statuses below apply the original PR #120 A0 contract. They do not upgrade a
user report into an independent API attestation.

| A0 field | Current evidence | Status | Exact gap |
| --- | --- | --- | --- |
| Capture metadata | Operator screenshots are referenced, but no original artifact, evidence ID, image hash or Cloudflare UTC interval is supplied | **BLOCKED** | Cannot bind the Cloudflare claims to one reproducible observation window |
| Account plan and payment posture | Account ID is supplied; current Free/no-card state, payment-method posture and absence of an upgrade prompt are not restated for this observation | **PARTIAL** | Refresh the current account-level facts without exposing billing identifiers |
| Worker identity and version | Correct Worker name and version `2320fd44-294c-4789-91bd-c20694254eca` are supplied | **PARTIAL** | Worker ID, deployment time/source and exact version-observation time are absent |
| D1 binding | Exactly one `DB` binding and UUID `234913cd-8901-4607-8147-31c4a4317111` are reported | **PARTIAL** | Current database display name, binding snapshot time and absence of every alternate/preview binding are not independently evidenced |
| Host and URL surfaces | workers.dev Production and Preview are reported disabled; no custom domains or routes are reported | **BLOCKED** | Exact workers.dev host is missing; Version/Deployment URL inventory and exact URL-state timestamp are absent |
| Routes, triggers and Access | No custom routes; no Cron, Queue or Email triggers are reported | **PARTIAL** | Access applications are not addressed; inventory time and exact route/domain list are absent |
| Worker counters | 24h requests 0 and errors 0 are reported | **PARTIAL** | No exact UTC window; Worker invocation count is not separately stated; dashboard snapshot is not an all-time ledger |
| D1 schema and metadata | 3 tables and 61.44 KB are reported; exact names, columns, indexes, foreign keys and migrations are absent | **BLOCKED** | Table count cannot establish the frozen 001/002/003 schema; no SQL may be run under this authorization |
| Secret surface | No statement that secret values were not displayed, read or copied | **ABSENT** | Add a nonsecret negative attestation; never record names as values |
| Restore point | Rollback candidate version `2320fd44...` and closed public surfaces are reported | **PARTIAL** | Exact host, complete URL inventory and a same-window restore-point state are absent |

**A0 result: BLOCKED / PARTIAL.** Several material fields are satisfied only by
operator report, and the capture window, exact host, Worker ID, schema identity,
Access inventory and secret-surface attestation are missing. A0 must not be
marked complete from this evidence.

### Zero-request invariant reconciliation

| A0 invariant | Result | Interpretation |
| --- | --- | --- |
| Worker application-plane HTTP requests = 0 | **USER-REPORTED WITHIN A 24H WINDOW** | Strong but not independently timestamped or ledger-backed |
| Worker invocations = 0 | **NOT EXPLICITLY PROVEN** | Request counter is 0; invocation metric was not separately supplied |
| Operator-issued D1 SQL/HTTP requests during A0 = 0 | **UNKNOWN** | No A0 capture interval is supplied |
| No D1 activity at all | **FALSE AS AN ALL-TIME/ZERO CLAIM** | The dashboard reports 19 queries, 159 rows read and 11 rows written in the last 24h |
| No token or secret was displayed/read | **NOT ATTESTED** | No secret-surface statement was supplied |

## Contradictions and reconciliation notes

| Observation | Correct reconciliation | What must not be claimed |
| --- | --- | --- |
| A0 is described as zero-request, while the D1 dashboard shows 19 queries, 159 rows read and 11 rows written in 24h | These are different planes and different windows. The Worker request snapshot does not establish zero D1 SQL, and the D1 activity may be the operator's cited prior manual work. Attribution and the A0 capture interval are absent | That all-time D1 activity is zero, that A0 itself caused or prohibited this historical activity, or that a dashboard request counter is a full request ledger |
| D1 reports 3 tables, while the frozen qualification contract contains a more specific schema | A table count is an inventory hint, not schema identity. Table names, columns, indexes, foreign keys and migration state are not supplied | That the live database exactly implements the frozen 001/002/003 schema or that native D1 rollback was observed |
| Render test-gate closure is reported complete, while some routes still exist | The closure disables three flags and the startup booleans fail closed for those paths. It does not remove code paths, credentials or every reachable surface; public `/mcp` remains intentionally reachable | That the whole Render service, every route or every host is unreachable |
| The Render deployment uses `main`, while the qualification Worker is a separate artifact | The deployed Render commit `1cef5ada...` predates the qualification Worker files. Render and the Worker have independent source, deployment and runtime state | That any Render result proves the Worker version, binding, route or D1 behavior |
| A fixed 10.056-second MP3 was audibly observed through the public mock | The supplied source matches a fixed public fixture. This is useful public-mock regression evidence only | Generated speech, iPhone private playback, Auth0 admission, `/paid-mcp`, D1, Worker invocation, durable delivery or MiniMax behavior |
| Three protected-route flags are closed, while diagnostic and public-JWKS values are not in the closure record | The diagnostic is nonpaid, but its enabled/disabled state and any public JWKS exposure are still residual configuration facts. They were not re-queried or changed here | That every protected-route flag is known, that the diagnostic is off, or that credentials were removed |

## Remaining blockers and STOP ownership

The total-control owner is ShenShu. The operator may collect only the evidence
separately authorized for a gate; the operator does not self-accept a gate. For
any future route window, the recorded STOP owner must be a named human distinct
from the request issuer where practical and able to disable the exact route
first. This task neither opened nor closed a route, so no rollback action was
required or taken.

If a later authorized action fails: stop the action, record the UTC reason and
counters, disable the exact host first, preserve every D1 row and sanitized
evidence, and escalate. Do not issue a diagnostic request, delete/drop/truncate
data, perform a refund or compensating write, rotate away a key to hide drift,
or remove Render credentials without separate authorization.

The trust boundaries remain:

| ID | Remaining boundary | Current disposition |
| --- | --- | --- |
| T1 | Live Auth0 principal | OPEN: still synthetic/offline only; no real principal observation |
| T2 | Render/route state | PARTIAL: three flags are reported closed with matching startup logs; diagnostic/JWKS state and complete route inventory remain unverified |
| T3 | Per-user entitlement | OPEN: a validated API grant is not a spending allowlist or proven quota policy |
| T4 | Stable client operation ID | OPEN: no observed client retry/reconnect/restart contract |
| T5 | Trusted signer adapter | OPEN: no real Auth0 request produces a trusted signer request |
| T6 | Signer-Worker key equality | OPEN: no real one-key injection or non-echoing equality attestation |
| T7 | Cloud D1 atomicity | OPEN: local SQLite cannot prove Cloudflare D1 batch rollback |
| T8 | Cloud identity and route inventory | PARTIAL: account/Worker/version/D1 identifiers and closure statements are reported, but capture window, Worker ID, exact host and complete inventory are absent |
| T9 | Private durable delivery | OPEN: only an opaque `resultRef` exists; private persistence/delivery is unimplemented and unqualified |
| T10 | Provider/B4 | OPEN: zero authorized MiniMax calls; model, voice and billing behavior remain unknown |

These boundaries are not closed by A0 evidence collection, Render flag closure,
public mock playback or GitHub CI. They require separate, evidence-specific
authorizations.

## A1-A5 authorization disposition

No gate inherits approval from A0, from this review, or from another gate. The
controlling labels are secret injection (A1), deployment/version (A2), route
enablement (A3), bounded run (A4) and close/revoke (A5).

| Gate | Status | Reason |
| --- | --- | --- |
| A1 secret injection | **NO-GO** | A0 is not accepted; key ID, non-echoing injection path, exact dormant target and resulting version are not authorized or evidenced |
| A2 deploy/adopt version | **NO-GO** | A0/A1 are not accepted; exact reviewed source/tree, artifact hash, version UUID, binding snapshot and closed-route inventory are incomplete |
| A3 enable one host | **NO-GO** | A0-A2 are not accepted; exact host and complete closure proof are absent. Public `/mcp` reachability is not permission for `/paid-mcp` or the Worker |
| A4 bounded nonbillable requests | **NO-GO** | A0-A3 and a separately pre-approved A5 are absent; no UTC window, observer, baseline counters, fixed request plan or STOP execution package is approved |
| A5 close/revoke | **NO-GO NOW; REQUIRED BEFORE A4** | No route was opened, so no cleanup is due. A concrete A5 execution approval must precede any A4 authorization, including route disable, dormant-version restore, key deletion and D1 row preservation |

The A4 ceiling remains a planning limit, never a permission: 24 Worker requests,
18 D1-touching requests, 10 admission requests, 4 accepted admissions, 32 row
write units, 512 rows read, 64 D1 statements, 256 KiB storage delta, 20 minutes
and zero provider calls. No gate may raise these caps, add a route or binding,
refresh Auth0/Render, dispatch Actions manually, merge or call MiniMax.

## Minimum next operator evidence

One bounded read-only A0 recapture is the maximum defensible next cloud action.
It must bind all fields to one declared UTC interval and one evidence set:

1. Declare the operator, total-control STOP owner, UTC start/end and evidence ID
   before capture. Retain sanitized artifacts with their SHA-256 hashes; do not
   fabricate or substitute a dashboard path.
2. Re-attest the account plan and payment posture without exposing billing
   identifiers, card data or secret values.
3. Record Worker ID, exact name, version UUID, deployment time/source, the exact
   workers.dev host, and the complete Version/Deployment URL state at the same
   time. Record all custom routes, Preview state, Access applications, Cron,
   Queue and Email triggers, including negative findings.
4. Record exact Worker request and invocation counters with their dashboard
   interval. A displayed zero is a time-window metric, not an all-time ledger.
5. Record the exact D1 database display name and UUID, exactly one `DB` binding,
   binding snapshot time, and absence of alternate or Preview bindings. Supply
   exact schema object names, columns, indexes, foreign keys and applied migration
   identities from a nonsecret pre-existing artifact, or separately authorize a
   read-only schema inspection. Do not infer schema identity from table count.
6. State whether any secret value was displayed, copied, read or logged. Record
   only a negative nonsecret attestation and never include a value or token.
7. Reconcile the 24h D1 counters as historical activity with attribution still
   unverified. Do not run SQL, read rows or delete/rewrite evidence.
8. For Render, record the current nonsecret `SHENSHU_AUTH_DIAGNOSTIC_ENABLED` and
   `SHENSHU_AUTH_PUBLIC_JWKS_JSON` posture, whether a public JWKS is exposed,
   and state whether credentials were not removed. Do not change the service.

Until those items are supplied, no evidence class in this paper can be upgraded
to independent Cloudflare or Render attestation. A0 remains blocked even if a
single field is later refreshed in isolation; the whole set must share one
capture window.

## Next total-control decision

Recommended decision: **accept this evidence reconciliation, keep Cloud A0 as
BLOCKED/PARTIAL, and authorize at most one bounded read-only A0 recapture under a
new explicit packet.** Do not authorize A1-A5, any traffic, any route/host,
Render/Auth0 changes, D1 SQL, secret injection or MiniMax. If total control
instead decides the current operator evidence is sufficient, that is a risk
acceptance decision and must be recorded separately; it must not be represented
as independent verification.

## Local verification and real-operation counters

This is a documentation-only task. Per the authority package, no duplicate full
test suite was run and no runtime, schema, Worker or test file changed. Local
checks are `git diff --check`, repository secret-pattern scanning and review of
the exact Git objects; standard pull-request CI is reported on the Draft PR.

New real actions in this task:

- Cloudflare API/dashboard actions, Worker requests/deploys/route changes: **0**
- D1 SQL/HTTP reads, writes or migrations: **0**
- Render environment reads or mutations, credential reads: **0**
- Auth0 changes or real tokens: **0**
- Secrets/HMAC keys generated, read or injected: **0**
- MiniMax/provider/public MCP calls: **0**
- Manual Actions dispatches, merges or Asteria-Call edits: **0**

The historical operator-reported D1 counters (19 queries, 159 rows read and 11
rows written in 24h) are not zero and are not attributed to this task.

## V1 disposition and final status

Strict Voice V1 remains **2/9** (gates 1 and 8 only). B1-B4 remain open:

- **B1:** no user-confirmed audible iPhone result for generated/bridged audio.
- **B2:** real Cloudflare D1 atomic admission and the deployed Worker path remain
  unqualified.
- **B3:** real fail-closed private durable result delivery remains absent.
- **B4:** no authorized real MiniMax end-to-end call.

**COMPLETE for the authorized evidence-reconciliation and Render-closure archive
scope. Cloud A0 remains BLOCKED/PARTIAL. A1-A5 are NO-GO. Total control decision
is required before any recapture or cloud gate.**
