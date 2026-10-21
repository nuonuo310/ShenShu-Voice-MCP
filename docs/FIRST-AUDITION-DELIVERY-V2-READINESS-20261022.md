# First audition delivery v2 - offline readiness report - 2026-10-22

Status: **OFFLINE DELIVERY CONTRACT READY FOR TOTAL-CONTROL REVIEW. NOT MOUNTED, NOT DEPLOYED, NOT BILLABLE, HOST PLAYBACK NOT VERIFIED.**

Authority: `docs/construction-envelopes/2026-10-21-first-audition-delivery-v2.md`
at commit `4560304b71a6ac1a2fa35bd8266f597f56f4b289`.

## Opening gate

| Check | Recorded value |
|---|---|
| Repository | `nuonuo310/ShenShu-Voice-MCP` |
| Resolved worktree | `C:/Users/Administrator/Desktop/00_Desktop_Hub/03_Voice_and_Pet/ShenShu-Voice-First-Audition` |
| Requested desktop alias | Absent; no other worktree was moved, deleted, reset, cleaned or checked out |
| Git identity | `nuonuo310 <2584974449@qq.com>` |
| `origin/main` | `1cef5ada7f6af0b912b7d5bba2c42f4f776bb828` |
| Authority branch | `docs/first-audition-delivery-envelope-v2-20261021` |
| Authority SHA | `4560304b71a6ac1a2fa35bd8266f597f56f4b289` |
| Task branch | `work/first-audition-delivery-v2` |
| Gate-time HEAD | `4560304b71a6ac1a2fa35bd8266f597f56f4b289` |
| Gate-time worktree | Clean; only the in-scope diff in this report appeared afterwards |
| PR #68 | Open Draft; head `2635c3f170682dddccfe47f6fafa2bc44e759557`; base `main` |
| PR #69 | Open Draft; head `58fdb938868ee21096368ff488790ceafa76d63d`; base authority |
| Prior CI #300 | Run `39629947649`; `test`; `pull_request`; completed success; SHA `58fdb938868ee21096368ff488790ceafa76d63d` |
| Authority delta over #69 | One envelope document only; no code, route, schema, workflow or package drift |

Frozen contracts were inspected in source before implementation:

- Public fixture and OAuth/private UI routes remain unchanged.
- `src/verified-identity.js` remains the RS256 issuer/audience/lifetime and `voice:speak` gate.
- D1 reservation/issue/consume SQL and ownership semantics remain unchanged.
- Existing `fixture`, `private-fixture`, `tone-fixture` and exact hosted-tone playback paths remain present.
- CSP connect/resource domains were not widened.
- Paid MiniMax remains unregistered on public and authenticated MCP surfaces.

No unexpected base, HEAD, repository or unrelated tracked change was found. No STOP condition was reached.

## Changed files

- `src/audition-consent-capability.js` - new offline, server-issued, signed one-use consent capability.
- `src/generated-audio-playback-contract.js` - new bounded inline `source:"minimax"` transport and injected-decoder contract.
- `src/first-audition-offline-candidate.js` - composes verified identity, capability consumption, fake D1 admission, one fake provider attempt and WAV validation.
- `ui/mcp-bubble.html` - minimal backward-compatible generated-inline branch plus stale media-event guards.
- `test/audition-consent-capability.test.js` - consent capability adversarial suite.
- `test/generated-audio-playback-contract.test.js` - generated WAV transport, player static regression and unmounted-boundary suite.
- `test/first-audition-offline-candidate.test.js` - updated end-to-end fake audition suite.
- `docs/FIRST-AUDITION-DELIVERY-V2-READINESS-20261022.md` - this readiness record.

Untouched: `server.js`, `src/staging-authenticated-mcp.js`, `src/protected-resource-shell.js`, `db/`, D1 schema/migrations, workflow files, `package.json`, deployed configuration and account authorization.

## Consent capability contract

The execution order is:

`verified opaque identity -> request one short-lived capability -> server-store consume -> reserve -> issue -> consume D1 grant -> exactly one fake provider attempt -> WAV validation -> generated inline record -> injected local decoder`

The capability is HMAC-SHA256 signed and bound to all of the following:

- verified opaque principal;
- exact action `generate_shenshu_voice`;
- generated request ID;
- exact UTF-8 text byte count;
- SHA-256 text digest;
- issued-at and expiry times.

The default TTL is five minutes and the maximum configurable TTL is fifteen minutes. Signature comparison is constant-time. Missing, malformed, tampered, expired, replayed and binding-mismatched capabilities fail closed. The in-memory used-ID set makes consumption one-use within a process. Audit events record issue and consumption metadata but never the capability bearer string.

`approved`, `consent`, `principal`, `subject` and similar caller fields are ignored. A non-string boolean-like object is not authority. Only the injected consent store can consume the capability, and the candidate cannot synthesize until consumption succeeds.

This is an offline model, not a durable production consent ledger. It must not be represented as restart-safe or cross-instance safe.

## Generated playback contract

The generated branch accepts only:

- `source === "minimax"`;
- `generated === true`;
- `audioMimeType === "audio/wav"`;
- bounded, canonical base64 WAV data;
- no `audioUrl` field.

The transport revalidates RIFF/WAVE structure, 16 kHz mono 16-bit PCM, 0.2-60 seconds, the 2 MiB decoded limit and the existing 3,000,000-character base64 limit. It produces only a `data:audio/wav;base64,...` URL. The injected decoder receives the exact local fake WAV; decode failure, invalid decoded duration and stale load generations fail closed.

The shared player change is additive. It keeps all old fixture branches and adds load-generation checks so late metadata/error events from an older resource cannot overwrite the current state. This is source-level compatibility evidence, not browser playback proof.

## Proof levels

| Area | Status | Evidence / remaining gate |
|---|---|---|
| Fake JS pipeline: identity -> capability -> fake D1 -> fake MiniMax -> WAV -> record -> injected decoder | **OFFLINE PASS** | Targeted and full Node suites |
| Host/MCP Apps integration | **NOT VERIFIED** | UI is statically tested only; no host-mounted generated result was exercised |
| Real OAuth token and JWKS refresh | **NOT EXERCISED** | Existing verifier is unchanged; only signed offline fixtures passed |
| Real D1 reads/writes/migrations | **NOT EXERCISED** | Fake HTTP store only; zero D1 operations |
| CSP in real host | **SOURCE-LEVEL PASS / RUNTIME NOT VERIFIED** | Domains unchanged; host enforcement and console behavior untested |
| Provider key and voice ID configuration | **NOT CONFIGURED** | No secret or real voice ID read, printed or stored |
| Paid MiniMax trial | **NOT AUTHORIZED / NOT RUN** | Zero provider calls and zero paid calls |
| Desktop playback | **NOT VERIFIED** | No browser or host session |
| iPhone playback | **NOT VERIFIED** | No device session |

## Offline evidence

Commands:

```powershell
node --test test/first-audition-offline-candidate.test.js
node --test test/audition-consent-capability.test.js
node --test test/generated-audio-playback-contract.test.js
node --test
node --check <each changed JavaScript file>
git diff --check
```

| Run | Result |
|---|---|
| Untouched v1 baseline before v2 changes | 176 passed, 0 failed |
| First-audition candidate suite | 14 passed, 0 failed |
| Consent capability suite | 8 passed, 0 failed |
| Generated playback contract suite | 6 passed, 0 failed |
| Full suite after v2 changes | 193 passed, 0 failed |
| `node --check` on all changed JavaScript | Pass |
| `git diff --check` | Pass; no whitespace errors |

Coverage includes:

- successful signed identity and exact one fake synthesis;
- missing, expired, wrong-audience and wrong-scope identity stops before consent;
- caller-supplied principal/approval fields cannot authorize;
- missing, denied, thrown, forged, non-capability, expired and wrong-binding consent stops before D1 and fetch;
- capability replay and concurrent one-use consumption;
- concurrent candidate calls consume distinct capabilities but only one daily D1 slot;
- duplicate request/grant replay and non-refunded upstream timeout;
- bad and over-duration upstream WAV rejection without retry;
- valid fake WAV -> bounded inline record -> injected decode;
- bad/oversized base64, oversized decoded WAV, unsupported source, URL-bearing generated record, decode failure, invalid decoded duration and stale generation;
- old fixture branches and CSP domains retained;
- offline modules not imported by public/authenticated server entry points.

## Proposed durable production ledger - design only, not implemented

A production activation needs a separately reviewed append-only consent ledger and an operator-only issuance path:

- server-generated `consent_id`, unique and non-guessable;
- opaque principal, action, request ID, text byte count, text digest, issued/expiry/consumed timestamps and issuance actor;
- one atomic conditional transition from `issued` to `consumed` (for example, a single `UPDATE ... WHERE consumed_at IS NULL RETURNING` operation);
- uniqueness constraints preventing replay and a periodic expiry cleanup/index;
- an operator UI or control-plane action distinct from the execution endpoint;
- secret-manager-backed signing material and pseudonymized audit export;
- transaction/restart/cross-instance tests before any paid trial.

No D1 table, migration, SQL or account-authorization change is made by this PR. Implementing this ledger requires the separate architecture/schema approval named by the envelope.

## One future paid-trial checklist

This is a prerequisite list, not authorization to proceed.

1. Total control explicitly approves one audition, its maximum duration and billing exposure.
2. The durable consent ledger is reviewed, migrated and qualified without using production user data.
3. Real OAuth issuer/JWKS/audience/scope verification is exercised through the deployed protected endpoint.
4. Real D1 reservation/grant behavior and cross-instance replay denial are verified under the governed qualification process.
5. The host accepts the bounded inline WAV and desktop/iPhone playback is manually verified, including old fixture paths and CSP console cleanliness.
6. The provider key and voice ID are injected from a reviewed operator-controlled secret source outside Git and logs.
7. Exactly one provider attempt is enabled with no retry on uncertain billing.
8. Evidence records status, latency, WAV metadata, D1 counters and billing reconciliation without raw keys or audio in chat.

## Manual host/device verification still required

After separate host-wiring approval, use a test-only MCP Apps session with a locally generated fake WAV record:

1. Confirm the bubble shows the generated/offline label and does not expose a URL.
2. Confirm desktop `loadedmetadata` and play/pause work.
3. Repeat on iPhone, including first tap and Safari/embedded-host behavior.
4. Send a newer result while an older media load/error is pending; confirm only the newer status wins.
5. Re-run `private-fixture`, `tone-fixture`, exact `hosted-tone` and public `fixture` smoke checks.
6. Watch the host console for CSP violations and confirm no network request is made for generated data.

These steps were not run in this envelope, so no real playback PASS is claimed.

## Non-execution counters

| Category | Count |
|---|---|
| Real MiniMax requests | 0 |
| Paid calls / billing | 0 |
| Real D1 reads or writes | 0 |
| Database migrations | 0 |
| Real API keys or voice IDs read or logged | 0 |
| Deployments, Render/Cloudflare changes or Actions dispatches | 0 |
| Merges | 0 |
| New public MCP routes | 0 |

GitHub was contacted only for normal ref inspection, CI/PR metadata and the authorized branch/PR workflow. No application/provider network call was made; every fetch used by tests is an in-memory fake.

## Remaining decisions and limitations

1. The consent ledger is process-local and in-memory; durable cross-instance storage needs schema approval.
2. No operator consent UI or trusted production issuance adapter exists.
3. Host integration and real desktop/iPhone playback are not tested.
4. Real OAuth/JWKS deployment and real D1 behavior are not exercised.
5. Provider key/voice configuration is absent and remains operator-controlled.
6. The one paid audition still requires explicit total-control approval and billing guardrails.

This PR is not permission to merge, deploy, mount a paid tool, call MiniMax or write D1.
