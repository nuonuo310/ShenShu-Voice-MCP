# Voice V1 S1 - Rank B private delivery feasibility (2026-10-26)

**STATUS: BLOCKED for a V1-deliverable safe private audio playback route.
The authorized offline feasibility review is COMPLETE. No route, source file,
test, deployment or staging candidate was added. iPhone private audibility
remains unverified, B1-B4 remain open, and strict Voice V1 remains 2/9.**

This report evaluates one bounded question: can the existing authenticated MCP
Apps surface deliver private audio to the actual ChatGPT iPhone host without a
public URL, a bearer-like URL capability, an unverified cross-site cookie, or
an unverified Blob/object-URL assumption? The answer is not established by the
available evidence. No root cause for the silent Web Audio observations is
asserted.

## Opening gate

| Check | Recorded value |
|---|---|
| Repository | `nuonuo310/ShenShu-Voice-MCP` |
| Origin | `https://github.com/nuonuo310/ShenShu-Voice-MCP.git` |
| Task worktree | `C:/Users/Administrator/Desktop/_codex-worktrees/voice-v1-s1-rankb-private-delivery-20261026/ShenShu-Voice-MCP` |
| Task branch | `codex/voice-v1-s1-rankb-private-delivery-20261026` |
| Exact authority parent | PR #128 head `e902cb29e18ebf91882a28814273c09a4753cc68` |
| Task starting HEAD | `e902cb29e18ebf91882a28814273c09a4753cc68` |
| Tracked worktree state at gate | clean |
| Authority envelope | PR #129, commit `0187a8169f2ef831d143b3813f0efa16da4e1bbf`; one added Markdown file, 19 lines |
| PR #129 | open Draft; base `codex/voice-v1-s1-audio-route-decision-20261026` at `e902cb29e18ebf91882a28814273c09a4753cc68`; head `docs/voice-v1-s1-rankb-private-delivery-feasibility-20261026` at `0187a8169f2ef831d143b3813f0efa16da4e1bbf`; unmerged |
| PR #129 CI | run `40336963619`, event `pull_request`, check `test`, job `121621015869`, conclusion `success` |
| PR #128 | open Draft; head `e902cb29e18ebf91882a28814273c09a4753cc68`; unmerged |
| PR #128 CI | run `40333921509`, event `pull_request`, check `test`, job `121610281732`, conclusion `success` |
| Staging deployed SHA | `9b938724f94f3053b6267f9fd90567da07e8de96`, **authority-reported only**; this session made no Render call |

The worktree was created from the exact parent and was not reset, cleaned,
stashed, rebased or merged. The construction envelope was read from the exact
authority commit because it is intentionally not present in the parent tree.

## Rank A evidence and stop condition

Rank A is the already-implemented private in-memory Web Audio route. This task
did not retest it and did not modify its source.

### A1 - first silent private Web Audio observation

The private fixture produced UI progress, a direct user gesture, a running
`AudioContext`, a resolved resume, a successful decode of `0.70s 48000Hz 1ch`,
a started source and an ended source. No sound was heard.

This proves JavaScript execution, graph construction, decode success and source
completion. It does not prove acoustic output.

### A2 - second silent observation with speaker/output positively checked

The authority records a second private-fixture attempt after the operator
positively checked the iPhone speaker/output state. It remained silent. That
removes the simple device-output confound from the private Web Audio result and
requires Rank A to stop. It still does not identify the silent layer: iframe
audio policy, Web Audio routing, host sandbox behavior and other causes remain
unproven. No causal claim is made.

### A3 - public HTTPS control became audible

A fixed, already-public HTTPS WAV became audible after the operator restored
the iPhone output setting. This proves that the observed ChatGPT iPhone host
can play that public HTTPS WAV in the tested state. It does not prove private
authenticated HTTPS, host-authenticated media transport or private Web Audio
audibility.

The earlier private `data:audio/wav` HTML media-element attempt also failed with
`NotSupportedError`, media code `4`, `readyState` `0`. That historical result is
not used here to infer the cause of the Web Audio silence.

## Current transport boundary

The protected staging contract has these relevant properties:

- `preview_private_fixture` runs behind protected MCP authentication and returns
  bounded, validated WAV bytes in `structuredContent.record`.
- `ui/mcp-bubble.html` validates the record again, keeps the bytes in memory and
  performs no fetch or URL creation on the private click path.
- The protected UI resource declares `connectDomains:[]` and only the public
  Render origin in `resourceDomains`. That is an origin allowlist, not an
  authenticated media transport.
- `src/private-https-audio-response.js` is an offline response contract with no
  mounted route.
- The UI currently reads the result of `ui/initialize` only for success/failure;
  it does not retain or display `hostCapabilities` or `hostContext`.

An OAuth grant for a protected MCP tool does not automatically authorize a
separate `<audio>` request. `HTMLAudioElement.src` cannot attach the tool
request's OAuth `Authorization` header. A URL capability would be a bearer-like
secret and is outside the no-secret-in-URL/log boundary. Cross-site cookie
behavior in the ChatGPT iPhone iframe is unproven. Blob/object-URL presence and
creation are also not evidence of host `media-src` permission or audible
playback.

## The only bounded Rank B candidate

The only candidate that avoids all of the above transport assumptions is a
host-mediated audio content block:

1. the protected MCP tool authenticates the request and supplies a fixed,
   bounded WAV;
2. the app retains the bytes in memory;
3. the app sends one `ui/message` request containing an MCP `audio` content
   block with the inline base64 bytes and MIME type;
4. the ChatGPT host, if it supports that modality, renders and/or plays the
   audio through its own trusted chat UI.

This is the single candidate considered. It requires no public URL, bearer URL,
cookie, Blob/object URL, new public endpoint, provider, D1, or persistent media
service.

### What the installed SDK proves

The installed `@modelcontextprotocol/ext-apps` package reports version `1.7.5`.
Its `spec.types.d.ts` defines:

- `McpUiMessageRequest` with `role:"user"` and `content: ContentBlock[]`;
- `McpUiSupportedContentBlockModalities.audio?: {}`;
- `McpUiHostCapabilities.message?: McpUiSupportedContentBlockModalities`;
- `App.sendMessage()` with the same message request shape and an optional
  `isError` result.

The SDK also defines `ui/download-file` for embedded or linked resources, but
its stated semantics are host-mediated file export/download, not playback. A
download is not accepted here as an inline private-audio playback path.

### What is not proven

The installed SDK surface does not establish that the actual ChatGPT iPhone
host:

- advertises `hostCapabilities.message.audio` in `ui/initialize`;
- renders an audio content block as a playable control rather than storing,
  transcribing, rejecting or otherwise processing it;
- produces audible output after a user gesture;
- keeps private audio out of conversation history, model context or any
  follow-up processing that `ui/message` triggers.

The checked public MCP Apps specification at tag `v1.7.5` (commit
`92f46a574568a3ddac7600343b7d3c4c4ed7b588`;
`specification/2026-01-26/apps.mdx`, blob
`43fef209d449c5456808ec82da8fb012c3b9b678`) still documents `ui/message` with a
text content object and a `HostCapabilities` interface without `message` or
`audio` modalities. That is a further contract gap, not evidence for playback.
The distributed SDK's broader TypeScript shape is necessary evidence, but it is
not proof of a specific host implementation.

The privacy boundary is independently unresolved. `ui/message` is specified as
adding a user message to the host chat and triggering a follow-up. Even if an
iPhone player appears, sending private audio as a chat message may retain or
expose it in conversation history or model context. The current evidence does
not establish local-only playback. That makes the candidate unsuitable for
private generated speech without an explicit host contract or device proof.

## Rejected alternatives

These are not additional routes; they are rejected transport assumptions.

- **Authenticated HTTPS media element:** blocked because the element cannot
  attach the protected OAuth header.
- **Capability URL:** rejected because it is a bearer-like secret in a URL and
  is explicitly outside the authorized design.
- **Cross-site cookie:** unproven for SameSite, third-party-cookie, CSRF and
  session binding in the ChatGPT iPhone iframe.
- **Blob/object URL:** local API existence does not prove the host's media policy
  or acoustic playback; the current CSP contract is origin-based, not a proven
  Blob media grant.
- **Public permanent URL:** violates the private-delivery boundary.
- **`ui/download-file`:** file export is not playback and host support on the
  actual iPhone host is unproven.

No speculative endpoint, URL capability, cookie fallback, Blob fallback or
second content-block family was implemented.

## Decision

**BLOCKED.** No V1-deliverable secure private playback path is proved. In
particular, the actual ChatGPT iPhone host's support for an authenticated or
host-mediated private audio route is not established.

This is not a claim that the host is incapable of such support, and it is not a
root-cause finding for Rank A. It is a fail-closed decision: without host-level
capability, playback and privacy evidence, implementing a prototype would create
an unverified security boundary and a misleading V1 artifact.

No source or test change is justified. There is no new staging candidate and no
deployment recommendation. The authority-reported existing staging commit
remains `9b938724f94f3053b6267f9fd90567da07e8de96`.

## One minimal next evidence requirement

The unique next step is one separately authorized, bounded device-capability
probe. It should reuse the already-authenticated, app-only, fixed nonbillable
WAV path where possible, add no provider, D1, public route or persistent media
service, and perform no URL/cookie/Blob fallback.

The probe must, in one iPhone session:

1. read the exact `hostCapabilities.message.audio` value returned by
   `ui/initialize`;
2. if and only if that modality is advertised, send exactly one fixed
   nonbillable `audio` content block through `ui/message` after a direct user
   click;
3. record whether the host returns an error, renders a playable control, and
   whether the operator hears the fixed fixture;
4. record the observable persistence/model-context behavior of that audio
   message without recording audio content, credentials or secrets.

The pass condition is all four: the capability is explicitly advertised, the
message is accepted, a playable control is observed, and the iPhone operator
confirms audible output. Privacy is not waived by audibility: if the audio is
retained or exposed beyond an acceptable user-controlled private playback
boundary, the route remains BLOCKED.

If capability advertisement is absent, the response fails, no playable control
appears, the fixture is silent, or the privacy behavior is unresolved, STOP.
Do not retry, do not switch transports, and do not introduce a temporary URL.
This device step is not authorized by the present round.

## Acceptance and V1 status

- Secure private audio delivery to ChatGPT iPhone: **NOT PROVEN / BLOCKED**.
- Private-fixture iPhone audibility: **NOT VERIFIED**.
- Rank A acoustic root cause: **NOT PROVEN**.
- Authenticated private HTTPS iPhone audibility: **NOT VERIFIED**.
- Host-mediated `ui/message` audio audibility and privacy: **NOT VERIFIED**.
- B1-B4: **open**.
- Strict Voice V1: **2/9**.

## Validation and counters

This is a documentation-only deliverable. No source, test or route file changed,
so no test suite is claimed as new evidence. `git diff --check` is required
before the report commit.

| Operation | Count |
|---|---:|
| Deployments or Render/Auth0 changes | 0 |
| Cloudflare, Worker, route or D1 requests | 0 |
| MiniMax/provider calls or application secret reads | 0 |
| ShenShu live MCP/connector/audio calls | 0 |
| Real iPhone tests or Rank A/Web Audio retries | 0 |
| Manual Actions dispatches or merges | 0 |
| Other Asteria repositories modified | 0 |

The official GitHub control-plane connector was used in-process for PR/CI
metadata, the public MCP Apps specification read, and later Draft PR publication.
It did not call ShenShu, Render, Auth0, Cloudflare, D1, a provider or a live
audio service. No credential value was printed, logged or written to the
repository.

**BLOCKED for Rank B secure private delivery. The authorized offline analysis is
COMPLETE. Stop and await total-control acceptance; no implementation or device
run is implied by this report.**
