# First audition protected probe v5 - offline readiness - 2026-10-21

Status: **OFFLINE IMPLEMENTATION, TESTS AND DRAFT PR COMPLETE. ACTUAL HOST, DESKTOP AND IPHONE DELIVERY IS NOT RUN. NOT MERGED, NOT DEPLOYED AND NOT ACTIVATED.**

Authority: `docs/construction-envelopes/2026-10-21-first-audition-protected-probe-v5.md`
at commit `9ed082d94e562375fdf4f689ab692ad16e126922`.

Implementation commit: `e9faa157a91bd0c2f5efad18df7b4ab8d0d0048c`.

## Opening gate

| Check | Recorded value |
|---|---|
| Repository | `nuonuo310/ShenShu-Voice-MCP` |
| Resolved worktree | `C:/Users/Administrator/Desktop/00_Desktop_Hub/03_Voice_and_Pet/ShenShu-Voice-First-Audition` |
| Git identity | `nuonuo310 <2584974449@qq.com>` |
| `origin/main` | `1cef5ada7f6af0b912b7d5bba2c42f4f776bb828` |
| Authority branch | `docs/first-audition-protected-probe-v5-20261021` |
| Authority SHA | `9ed082d94e562375fdf4f689ab692ad16e126922` |
| Gate-time branch / HEAD | `work/first-audition-protected-probe-v5` / `9ed082d94e562375fdf4f689ab692ad16e126922` |
| Gate-time worktree | Clean; one registered worktree at the resolved path; nothing moved, reset, stashed, cleaned or overwritten |
| Predecessor PR #75 | Open Draft; head `e4c2b0020cca29a439bc8ab01e1902ec5beb5e68`; base `docs/first-audition-host-delivery-v4-20261021` at `07510d73dd43be6d6867fde34d4c7aee0a9fdffa` |
| Predecessor CI #306 | Run `39641889938`; `CI`; `pull_request`; completed success for `e4c2b0020cca29a439bc8ab01e1902ec5beb5e68` |
| v5 authority delta | One envelope document over PR #75; no frozen code, route, schema, workflow, package or CSP drift found |

The complete v4 readiness report, candidate helper, protected staging server, UI bridge and adjacent authentication/tool/UI tests were read at the gate. No unexpected HEAD, dirty tracked state, remote mismatch or concurrent worktree conflict was found.

## Delivered scope

The branch adds exactly the one change authorized by v5:

- one authenticated, `SHENSHU_PRIVATE_FIXTURE_ENABLED`-gated, app-only tool named `probe_oauth_generated_delivery`;
- one OAuth-only UI button that calls that tool through the existing MCP Apps bridge and then reaches the existing gesture-gated Web Audio path;
- tests and harness updates for registration, visibility, authentication, strict input, payload, UI transport, playback, regressions and dependency boundaries.

No public provider route, real generated speech, paid path or model-visible tool was added.

## Exact implementation diff

Base: `9ed082d94e562375fdf4f689ab692ad16e126922`.

Implementation head: `e9faa157a91bd0c2f5efad18df7b4ab8d0d0048c`.

`git show --stat e9faa157a91bd0c2f5efad18df7b4ab8d0d0048c`: **5 files changed, 611 insertions, 3 deletions**.

| File | Change |
|---|---|
| `src/staging-authenticated-mcp.js` | Imports the reviewed fixed-result helper; registers one app-only tool only under the existing private-fixture flag; returns that helper result only under the same flag |
| `ui/mcp-bubble.html` | Adds one hidden button/result pair; reveals and accepts it only under the existing OAuth resource specialization; sends empty-argument `tools/call`; applies the host response and requires the existing explicit play gesture |
| `test/protected-probe-v5.test.js` | New v5 registration/auth/visibility/strictness/payload/UI/Web Audio/regression/static tests |
| `test/generated-host-delivery-v4.test.js` | Updates the predecessor surface assertion from absent to approved registration and enumerates the new UI IDs |
| `test/generated-web-audio-host-bridge.test.js` | Enumerates the new UI IDs in the existing generated playback harness |

The registration is:

```js
if(privateFixtureEnabled) tools.push({
  name:PROPOSED_GENERATED_HOST_TOOL_NAME,
  title:"Check OAuth generated-shape host delivery",
  description:"App-only NONBILLABLE TEST synthetic generated-shape WAV for MCP Apps host delivery diagnosis. No MiniMax or D1.",
  inputSchema:{type:"object",properties:{},additionalProperties:false},
  securitySchemes:oauth,_meta:{securitySchemes:oauth,ui:{visibility:["app"]}}
});
```

The result branch returns the existing `makeNonbillableGeneratedHostToolResult()` unchanged. No arbitrary text, voice ID, provider key or D1 value enters the fixture path.

## OAuth-only and app-only proof

| Check | Evidence |
|---|---|
| Verified OAuth required | `handleStagingAuthenticatedMcp` still resolves a signed identity before it calls `makeStagingMcpServer`; missing and fake tokens returned 401 and wrong scope returned 403 |
| Fixture flag required | In-memory tool list omits the probe when `privateFixtureEnabled=false`; registration and invocation branches both require the flag |
| App-only visibility | Raw protected `tools/list` and in-memory descriptor both expose `_meta.ui.visibility:["app"]` |
| Protected security scheme | Raw protected descriptor exposes `securitySchemes:[{type:"oauth2",scopes:["voice:speak"]}]`; matching metadata is retained |
| No model-visible registration | The probe is not part of the public `createShenShuServer()` composition used by public `/mcp`; `server.js` does not import or name the candidate/probe |
| No caller input | Empty schema with `additionalProperties:false`; the existing call handler rejects every nonempty, null, array or non-object argument before dispatch |
| No resource contract change | Existing URI `ui://shenshu/private-fixture-bubble-v2.html` and existing CSP domains are unchanged |

The unauthenticated integration checks assert that the 401/403 bodies contain no `structuredContent`, fixture ID or audio bytes. This verifies rejection at the authentication gate before a protected server can emit the fixture.

## Exact nonbillable payload

The protected call returned one fixed record with these fields:

| Field | Value |
|---|---|
| `id` | `host_delivery_fake_generated_001` |
| `title` / `text` | Contains `NONBILLABLE TEST` |
| `source` | `minimax` (transport-shape label only) |
| `generated` | `true` |
| `hostDeliveryTest` | `true` |
| `providerInvoked` | `false` |
| `billable` | `false` |
| `voiceLabel` | `NONBILLABLE TEST` |
| `audioMimeType` | `audio/wav` |
| `durationSeconds` | Exact existing 0.7-second fixture duration |
| `audioBase64` | Exact existing bounded synthetic PCM WAV bytes |
| `audioUrl` | Absent |

Tests require the exact fixture bytes and reject any URL. The `minimax` value is only the already-reviewed generated host-shape discriminator; no MiniMax module is imported or called.

## OAuth UI and playback path

The OAuth resource HTML contains the new button, while the public HTML keeps it `hidden`. The specialized OAuth resource sets it visible and the handler early-returns outside that specialization.

The fake-host test performs this complete offline path:

`OAuth-only button click -> postMessage tools/call with empty arguments -> host response resolved by matching RPC id -> applyResponse -> no AudioContext yet -> explicit main play click -> AudioContext resume -> decode exact WAV bytes -> one buffer-source start`

The test also proves that HTMLAudioElement `src`, `load()` and `play()` remain unused for this generated path. No autoplay and no `data:` fallback was introduced.

## Preservation

- Existing `probe_oauth_bridge_audio_payload` still returns the unchanged `oauth-bridge-tone`, `generated:false`, `paid_voice_enabled:false` record with no URL.
- Existing private fixture still returns authorized inline audio with `source:"private-fixture"`, `generated:false` and no URL.
- Existing hosted-tone control still returns only `https://shenshu-voice-mcp.onrender.com/test-tone.wav`, `source:"hosted-tone"`, `generated:false`.
- Existing private resource URI and CSP remain `ui://shenshu/private-fixture-bubble-v2.html`, `connectDomains:[]`, and the single existing Render resource domain.
- Existing public fixed-tone, generated Web Audio, stale-result, decode-failure and manual-stop tests pass unchanged apart from harness ID enumeration.
- `server.js`, `db/`, `package.json`, workflows, Cloudflare/Render settings, OAuth/JWKS issuer/scopes and D1 SQL are unchanged.

## Tests and static checks

| Check | Result |
|---|---|
| Prechange full `node --test` | 205 passed, 0 failed, 0 skipped |
| v5 plus generated/OAuth/UI/CSP/contract targeted set (12 files) | 48 passed, 0 failed |
| Postchange full `node --test` | 216 passed, 0 failed, 0 skipped |
| `node --check` on changed service/tests | Pass |
| Module script extracted from `ui/mcp-bubble.html` and checked | Pass |
| `git diff --check` / staged commit check | Pass |

Targeted command:

`node --test test/protected-probe-v5.test.js test/generated-host-delivery-v4.test.js test/generated-web-audio-host-bridge.test.js test/generated-audio-playback-contract.test.js test/p2x-ui-host-bridge-probe.test.js test/p2x-oauth-bridge-audio-payload.test.js test/p2x-private-fixture-mcp.test.js test/p2x-oauth-https-control.test.js test/p2x-mcp-resource-csp-parity.test.js test/inline-csp.test.js test/private-fixture-delivery.test.js test/contract.test.js`

The new suite covers gate-off absence, verified-subject construction, app-only/OAuth descriptors, nonempty-argument rejection, exact payload, missing/fake/wrong-scope authentication, public composition absence, OAuth-only UI framing, explicit-click Web Audio, public inertness, legacy fixture regressions and static dependency boundaries. Authentication rejection is checked through the real stateless protected HTTP handler with locally generated RSA/JWKS material; no real identity provider was contacted.

## GitHub delivery

| Item | Recorded value |
|---|---|
| Draft PR | #77, https://github.com/nuonuo310/ShenShu-Voice-MCP/pull/77 |
| PR state | Open Draft |
| PR head at implementation CI | `e9faa157a91bd0c2f5efad18df7b4ab8d0d0048c` |
| PR base | `docs/first-audition-protected-probe-v5-20261021` at `9ed082d94e562375fdf4f689ab692ad16e126922` |
| CI #308 | Run `39644780624`; `CI`; `pull_request`; completed success for `e9faa157a91bd0c2f5efad18df7b4ab8d0d0048c` |

The implementation commit predates this report. The report commit is docs-only; final branch CI is reported in the task receipt and PR checks.

## Evidence status

| Evidence level | Status |
|---|---|
| Protected app-only tool registration and strict argument contract | **PASS (OFFLINE)** |
| Missing/invalid/wrong-scope OAuth rejection before fixture emission | **PASS (LOCAL FAKE JWKS)** |
| Exact fixed nonbillable payload and absence of URL | **PASS (OFFLINE)** |
| OAuth-only UI tools/call framing plus explicit Web Audio gesture | **PASS (FAKE HOST / NODE VM)** |
| Public `/mcp` composition excludes the probe | **PASS (OFFLINE)** |
| Existing fixed bridge, private fixture, hosted tone and CSP | **PASS (REGRESSION)** |
| Actual ChatGPT/MCP Apps host delivery | **NOT RUN** |
| Desktop playback | **NOT RUN** |
| iPhone playback | **NOT RUN** |
| Real OAuth account/JWKS session | **NOT RUN** |
| Real D1 reads/writes/migrations | **NOT RUN** |
| Real MiniMax or paid synthesis | **NOT RUN** |

No host, desktop or iPhone PASS is inferred from the Node VM harness.

## STOP and non-execution counters

No v5 STOP boundary was reached. No frozen file needed modification, so no exception proposal was required.

| Category | Count |
|---|---|
| Real MiniMax requests | 0 |
| Paid calls / billing | 0 |
| Real D1 reads, writes or migrations | 0 |
| Provider keys or voice IDs read/logged | 0 |
| Deployments or hosting changes | 0 |
| Connector refreshes | 0 |
| Actions dispatches | 0 |
| Merges | 0 |
| New public routes or public/paid tool registrations | 0 |

GitHub was used only for the authorized branch push, one Draft PR and read-only PR/CI metadata. All tests use in-memory transports, local fake JWKS, a local loopback handler and synthetic WAV bytes.

This Draft PR is review evidence only. It is not permission to merge, deploy, activate, refresh a production connector or run an actual host/device test.
