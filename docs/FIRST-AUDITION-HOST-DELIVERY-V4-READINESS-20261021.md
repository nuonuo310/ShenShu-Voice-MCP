# First audition host delivery v4 - offline readiness and decision - 2026-10-21

Status: **OFFLINE CANDIDATE AND FAKE-HOST HARNESS COMPLETE. ACTUAL MCP HOST WIRING IS BLOCKED BY THE FROZEN TOOL-REGISTRATION BOUNDARY. TOTAL CONTROL DECISION REQUIRED. NOT MERGED, NOT DEPLOYED, NOT BILLABLE. REAL HOST, DESKTOP AND IPHONE PLAYBACK NOT VERIFIED.**

Authority: `docs/construction-envelopes/2026-10-21-first-audition-host-delivery-v4.md`
at commit `07510d73dd43be6d6867fde34d4c7aee0a9fdffa`.

Implementation commit: `ce7dfdd8a307a0c5db6ed0b30b77a433b96685fa`.

Decision requested: approve or reject the one app-only, fixture-gated test tool described below. Without that approval the production OAuth MCP server has no route that can emit a generated-shape record, so an actual-host smoke test cannot exist.

## Opening gate

| Check | Recorded value |
|---|---|
| Repository | `nuonuo310/ShenShu-Voice-MCP` |
| Resolved worktree | `C:/Users/Administrator/Desktop/00_Desktop_Hub/03_Voice_and_Pet/ShenShu-Voice-First-Audition` |
| Git identity | `nuonuo310 <2584974449@qq.com>` |
| `origin/main` | `1cef5ada7f6af0b912b7d5bba2c42f4f776bb828` |
| Authority branch | `docs/first-audition-host-delivery-v4-20261021` |
| Authority SHA | `07510d73dd43be6d6867fde34d4c7aee0a9fdffa` |
| Task branch | `work/first-audition-host-delivery-v4` |
| Gate-time HEAD | `07510d73dd43be6d6867fde34d4c7aee0a9fdffa` |
| Gate-time worktree | Clean; no other worktree moved, reset, cleaned or stashed |
| PR stack | #68 `2635c3f` -> #69 `58fdb93` -> #70 `4560304` -> #71 `1276ccb` -> #72 `b97cc44` -> #73 `40a8482`; all open Drafts |
| PR #73 review | Total control accepted v3 only as offline source/mock-host evidence and required a real OAuth MCP Apps resource plus nonbillable test-only generated record next |
| PR #73 CI #304 | Run `39639121034`; `CI`; `pull_request`; completed success for `40a8482` |
| v4 authority delta | One envelope document over PR #73 head; no code, route, schema, workflow or package drift |

Inspection found the OAuth staging server already exposes authenticated, fixture-gated app-only probes for a fixed `oauth-bridge-tone`, but **no registered tool returns `source:"minimax"`, `generated:true`**. Adding that tool changes protected MCP tool registration in `src/staging-authenticated-mcp.js`, which is frozen by v4 unless total control explicitly approves it. The tool was therefore not registered.

No provider, D1, OAuth-account, deployment or CSP change was made. No STOP was crossed silently.

## Route graph

Offline evidence implemented in this branch:

`OAuth staging UI resource -> fake-host tool-result notification using local NONBILLABLE TEST record -> existing generated Web Audio validation -> explicit click -> AudioContext resume -> WAV decode -> buffer source start`

Missing production edge:

`registered app-only fixture-gated tool -> actual ChatGPT MCP Apps host tools/call -> OAuth UI -> explicit click -> Web Audio`

The fake host proves the UI resource and message shape. It does not prove that the production server registered, hosted or delivered the tool. No actual-host or device PASS is claimed.

## Changed files

Implementation commit `ce7dfdd8a307a0c5db6ed0b30b77a433b96685fa` changes three files:

- `src/generated-host-delivery-candidate.js` - local-only constructor for a bounded generated-shape synthetic WAV record and MCP Apps tool-result framing; explicitly marked `NONBILLABLE TEST`, `hostDeliveryTest:true`, `providerInvoked:false`, `billable:false`; it is not imported by `server.js`.
- `ui/mcp-bubble.html` - labels marked test records as nonbillable and rejects inconsistent NONBILLABLE markers before creating Web Audio; existing real generated-record path is unchanged.
- `test/generated-host-delivery-v4.test.js` - reads the actual OAuth staging UI resource in memory, proves no generated host tool is registered, exercises fake tool-result framing and explicit-click Web Audio playback, and rejects malformed markers.

Exact implementation diff: **3 files, 366 insertions, 4 deletions** (`git show --stat ce7dfdd8a307a0c5db6ed0b30b77a433b96685fa`).

This readiness report is the only additional file in the report commit.

## Tests and static checks

| Check | Result |
|---|---|
| v4 fake-host/resource suite | 5 passed, 0 failed |
| Targeted generated/OAuth/UI/CSP/composition set (12 files) | 57 passed, 0 failed |
| Full `node --test` | 205 passed, 0 failed, 0 skipped |
| `node --check` on changed JS and adjacent v3 modules | Pass |
| Module script extracted from `ui/mcp-bubble.html` and checked | Pass |
| `git diff --check` / staged commit check | Pass |

The v4 suite asserts:

- the local record matches the bounded generated-shape contract and contains no URL;
- the record is explicitly `NONBILLABLE TEST` and cannot be framed without all three nonbillable markers;
- the OAuth staging tool list contains the existing fixed bridge probe but **not** the proposed generated host tool;
- the actual OAuth UI resource accepts the fake-host `ui/notifications/tool-result` framing, creates no AudioContext before click, then decodes the exact fake bytes and starts one buffer source;
- HTMLAudioElement `src`, `load()` and `play()` remain unused for the generated path;
- inconsistent NONBILLABLE markers fail closed without fallback;
- the existing fixed `oauth-bridge-tone` probe remains unchanged.

Targeted command:

`node --test test/generated-host-delivery-v4.test.js test/generated-audio-playback-contract.test.js test/generated-web-audio-host-bridge.test.js test/p2x-ui-host-bridge-probe.test.js test/p2x-mcp-resource-csp-parity.test.js test/inline-csp.test.js test/p2x-oauth-bridge-audio-payload.test.js test/p2x-private-fixture-mcp.test.js test/private-fixture-delivery.test.js test/first-audition-offline-candidate.test.js test/audition-consent-capability.test.js test/contract.test.js`

## Frozen surfaces

Unchanged in this branch:

- `server.js`;
- `src/staging-authenticated-mcp.js` and all protected/public MCP tool registration;
- OAuth resource contracts and UI resource URI;
- `db/`, D1 schema, SQL and migrations;
- workflow files, `package.json`, deployment configuration and Actions;
- CSP connect/resource domains;
- provider credentials, voice ID, MiniMax calls and billing.

The new local helper is not mounted. The existing public and OAuth fixture paths remain intact.

## Minimal proposed diff - not applied

This is the smallest route that preserves the existing resource, CSP, OAuth and server entrypoint. It adds one app-only tool under the existing `SHENSHU_PRIVATE_FIXTURE_ENABLED` gate and one OAuth-only UI button.

`src/staging-authenticated-mcp.js`:

```js
import {
  makeNonbillableGeneratedHostToolResult,
  PROPOSED_GENERATED_HOST_TOOL_NAME,
} from "./generated-host-delivery-candidate.js";

if (privateFixtureEnabled) tools.push({
  name: PROPOSED_GENERATED_HOST_TOOL_NAME,
  title: "Check OAuth generated-shape host delivery",
  description: "App-only NONBILLABLE TEST synthetic generated-shape WAV for MCP Apps host delivery diagnosis. No MiniMax or D1.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  securitySchemes: oauth,
  _meta: { securitySchemes: oauth, ui: { visibility: ["app"] } },
});

if (request.params.name === PROPOSED_GENERATED_HOST_TOOL_NAME && privateFixtureEnabled) {
  return makeNonbillableGeneratedHostToolResult();
}
```

`ui/mcp-bubble.html`:

```html
<button id="bridge-generated-probe" type="button" hidden>NONBILLABLE TEST · 生成形状 WAV</button>
<p class="status" id="bridge-generated-result" aria-live="polite"></p>
```

```js
const bridgeGeneratedProbe = $("bridge-generated-probe");
if (isOAuthBubble) bridgeGeneratedProbe.hidden = false;
bridgeGeneratedProbe.addEventListener("click", async () => {
  if (!isOAuthBubble) return;
  bridgeGeneratedProbe.disabled = true;
  try {
    const result = await request("tools/call", {
      name: "probe_oauth_generated_delivery",
      arguments: {},
    });
    applyResponse(result);
    $("bridge-generated-result").textContent =
      "NONBILLABLE TEST 生成形状记录已交付；请点击播放。";
  } catch {
    $("bridge-generated-result").textContent = "NONBILLABLE TEST 交付失败。";
  } finally {
    bridgeGeneratedProbe.disabled = false;
  }
});
```

The proposed tool has no `resourceUri`; it is called by the already-open OAuth app UI through the existing host bridge. No new resource, CSP domain, public route, D1 path or provider path is needed.

The alternative of changing the existing `probe_oauth_bridge_audio_payload` output is rejected because it would break its fixed `oauth-bridge-tone` regression contract and blur an existing diagnostic.

## Exposure and risk analysis

- **Visibility:** the proposed tool is app-only, not a model-visible tool. It is absent unless authentication succeeds and `SHENSHU_PRIVATE_FIXTURE_ENABLED=1`.
- **Data:** it returns only the fixed 0.7-second 16 kHz mono synthetic tone already used by existing probes. It accepts no caller input and returns no URL, principal, token, provider key or D1 data.
- **Behavior:** it cannot synthesize, bill, reserve quota, mutate consent or call fetch. The result is explicitly labelled as a nonbillable test and rejects missing marker fields.
- **Registration delta:** this is still a protected MCP tool-list change. It can affect host tool caching and requires a connector refresh, a new review and a separate deployment approval before any host smoke.
- **UI risk:** a generated-shape test record could be confused with real MiniMax output. The strict marker tuple and visible `NONBILLABLE TEST` wording mitigate this; the helper cannot represent provider output.
- **No smaller honest route:** UI-only injection would prove neither host transport nor server registration and is rejected. Changing the existing fixed probe would break its legacy contract.

## Decision options

1. **Approve the minimal registration diff** in a new bounded implementation envelope. The next stage would still need separate deployment and operator host/device approval; this branch remains Draft and unmerged.
2. **Reject the app-only tool.** v4 cannot produce an actual-host generated-record proof within the frozen boundary. No fake PASS will be substituted.
3. **Defer.** Preserve this offline harness and decision record without changing the protected server surface.

No authorization to implement the proposal is assumed.

## Manual host/desktop/iPhone smoke plan - future, after separate approval

Use a test-only OAuth connector with `SHENSHU_PRIVATE_FIXTURE_ENABLED=1`; do not call MiniMax or touch D1.

Observed evidence must include:

1. Host/client name, host URL or version, connector identity, OAuth session status, exact UI build marker, resource URI `ui://shenshu/private-fixture-bubble-v2.html`, and exact tool name `probe_oauth_generated_delivery`.
2. Result of clicking the OAuth-only NONBILLABLE TEST button, including the visible tool result and any host error text.
3. Confirmation that the bubble text says `NONBILLABLE TEST`, the status says no MiniMax call occurred, and no public audio URL or generated `data:` URL appears.
4. Console/CSP result and Network evidence showing no MiniMax/provider request and no D1 operation.
5. Result of one explicit play click: audible yes/no, AudioContext creation/resume, decode result, one buffer-source start, and HTMLAudioElement `src` remaining empty.
6. Result of a second click: playback stops without a second decoder/source; a newer result invalidates a pending decode.
7. Repeat on desktop and iPhone, including first tap and embedded-host behavior.
8. Preserve console/network screenshots or text and record the exact host build. Do not infer device PASS from the Node harness.

## Evidence status

| Evidence level | Status |
|---|---|
| Local generated-shape NONBILLABLE record and framing | **PASS** |
| Actual OAuth staging UI resource + fake-host notification | **PASS (MOCK HOST ONLY)** |
| Existing fixed OAuth bridge tool regression | **PASS** |
| Registered generated host tool in production server | **ABSENT / DECISION REQUIRED** |
| Actual ChatGPT MCP Apps host generated-record delivery | **NOT VERIFIED / NOT RUN** |
| Generated-record desktop playback | **NOT VERIFIED** |
| Generated-record iPhone playback | **NOT VERIFIED** |
| Real OAuth/JWKS and account authorization | **NOT EXERCISED** |
| Real D1 reads/writes/migrations | **NOT EXERCISED** |
| Provider configuration or paid MiniMax trial | **NOT EXERCISED** |

The historical fixed-WAV OAuth bridge/Web Audio evidence remains user-confirmed for that old route only. It is not evidence for this new generated-record route.

## Non-execution counters

| Category | Count |
|---|---|
| Real MiniMax requests | 0 |
| Paid calls / billing | 0 |
| Real D1 reads, writes or migrations | 0 |
| Provider keys or voice IDs read/logged | 0 |
| Deployments, Render/Cloudflare changes or Actions dispatches | 0 |
| Merges | 0 |
| New public routes or public/paid tool registrations | 0 |
| Protected tool registrations added without approval | 0 |

GitHub was contacted only for authorized ref/PR/CI metadata and the branch/PR workflow. All tests use in-memory fake WAV, fake host messages and local staging server objects.

## Required total-control decision

Approve or reject adding exactly one app-only, authenticated, fixture-gated `probe_oauth_generated_delivery` tool under the existing OAuth staging UI resource. If approved, a future stage must separately approve deployment and the operator-run host/desktop/iPhone smoke. If rejected, v4 remains an offline evidence package only.

This Draft PR is not permission to merge, deploy, expose a paid tool, call MiniMax, read secrets or write D1.
