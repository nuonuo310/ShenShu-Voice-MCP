# Voice V1 S1 - iPhone private audio route decision (2026-10-26)

**STATUS: COMPLETE FOR THE AUTHORIZED OFFLINE ROUTE-DECISION SCOPE.
IPHONE PRIVATE AUDIBILITY REMAINS UNVERIFIED. B1 REMAINS OPEN. V1 REMAINS 2/9.**

This report compares the only two V1-deliverable private playback mechanisms
supported by the current evidence: the existing in-memory Web Audio route and a
future authenticated ephemeral HTTPS media-element route. It deliberately does
not claim a root cause for the silent Web Audio observation, add a speculative
third transport, deploy anything, or invoke a real host, connector, provider or
cloud service.

## Opening gate

| Check | Recorded value |
|---|---|
| Repository | `nuonuo310/ShenShu-Voice-MCP` |
| Origin | `https://github.com/nuonuo310/ShenShu-Voice-MCP.git` |
| Task worktree | `C:/Users/Administrator/Desktop/_codex-worktrees/voice-v1-s1-audio-route-decision-20261026/ShenShu-Voice-MCP` |
| Task branch | `codex/voice-v1-s1-audio-route-decision-20261026` |
| Exact authority parent | PR #126 head `9b938724f94f3053b6267f9fd90567da07e8de96` |
| Task starting HEAD | `9b938724f94f3053b6267f9fd90567da07e8de96` |
| Tracked worktree state at gate | clean |
| PR #127 | open Draft; head `c6845e36ac3526e4660848c648588b36c885f199`; base `9b938724f94f3053b6267f9fd90567da07e8de96`; mergeable `clean` |
| PR #127 CI | run `40332422259`, check `test`, conclusion `success` |
| PR #126 | open Draft; head `9b938724f94f3053b6267f9fd90567da07e8de96`; base `791182dcbc2571f53cb19a0d04b45ec18cf0756e`; mergeable `clean` |
| PR #126 CI | run `40217414173`, check `test`, conclusion `success` |
| Stack parent | PR #125 is open Draft on `work/voice-v1-closure-s1-s2-20261023`; no merge occurred |

The construction envelope names `src/generated-host-delivery.js`; the file that
actually exists at the authority commit is
`src/generated-host-delivery-candidate.js`. That candidate and its tests were
read. This naming mismatch is recorded as an envelope bookkeeping gap, not as
permission to rename or expand the generated-audio surface.

The authority states that `9b938724f94f3053b6267f9fd90567da07e8de96` is already
deployed to Render staging. This session did not contact Render, so deployment
identity is authority-reported rather than independently re-read here.

## Evidence ledger

### E1 - private fixture through an HTML media data URL failed

Before PR #126, `preview_private_fixture` converted validated WAV bytes into a
`data:audio/wav;base64,...` URL, assigned it to `HTMLAudioElement.src`, called
`load()` and later `play()`. On iPhone this reached `NotSupportedError`, media
code `4`, `readyState` `0`, with no audible sound.

This is reproducible source-level evidence that the data-URL media-element
route was not usable in that observation. It does not establish whether the
decoder, media URL policy, CSP, iframe sandbox or another host rule caused it.

### E2 - the current Web Audio route decoded and started, but was silent

PR #126 bypassed the media element for the private fixture. On the iPhone
observation the UI reported the `s1-ios-media4-20261026` marker, the
`web-audio-private-fixture` path, a direct click, a running context, a resolved
resume, successful decode of `0.70s 48000Hz 1ch`, a started source, and source
ended. No sound was heard.

These facts prove successful JavaScript execution, graph creation, decoding and
source completion. They do not prove acoustic output and do not identify the
silent layer. A completed source is not an audibility PASS.

### E3 - public HTTPS WAV was audible after the iPhone output setting was restored

The fixed public `preview_oauth_hosted_tone_control` HTTPS WAV was initially
silent. The operator then observed that the iPhone speaker/output setting had
been switched off, restored it manually, played the public control again, and
heard sound. The speaker then remained normal.

This is an operator observation, not an application or plugin route trace. It
proves that the ChatGPT iPhone host can render a public HTTPS WAV in the tested
state and that a device-level output setting was a real confound. It does not
prove that the app switched audio routes, that private authenticated HTTPS is
playable, or that the earlier Web Audio run would still have been silent with
the same output setting.

### E4 - authentication and acoustic output are independent

Auth0 reauthentication occurred when the connector prompted, and OAuth allowed
tool invocation. OAuth success proves admission to the protected MCP surface,
not media authorization and not acoustic output.

### Evidence boundary

Proven:

- public HTTPS WAV playback worked in the observed iPhone state after output was
  restored;
- the private data-URL HTML media route failed with media code 4;
- the private Web Audio route decoded and started but was silent in its one
  observation;
- the current UI has no public URL or fetch in the private Web Audio click path;
- the current protected UI CSP has `connectDomains:[]` and only the exact
  Render origin in `resourceDomains`.

Not proven:

- whether Web Audio would have been audible after output restoration;
- whether authenticated private HTTPS over `<audio>` is playable in the ChatGPT
  iPhone sandbox;
- whether any Blob/object URL would be allowed by the host's `media-src`;
- the root cause of E1 or E2;
- iPhone audibility of any V1 generated/bridged private audio.

## Ranked routes

### Rank A - retain the existing in-memory Web Audio route for one bounded check

This is the only currently implemented V1-safe private route and therefore the
first candidate. No source change is justified by the present evidence.

Exact current mechanism:

1. `preview_private_fixture` authenticates the protected MCP tool request and
   returns bounded validated WAV bytes in `structuredContent.record`.
2. `ui/mcp-bubble.html` validates RIFF/WAVE, PCM format, duration and byte
   bounds again and retains the bytes only in memory.
3. A direct user click creates and resumes `AudioContext`, copies the bytes,
   calls `decodeAudioData()`, creates one buffer source, connects it to
   `context.destination`, and starts it once.
4. Playback performs no tool call, fetch, URL creation, provider request, D1
   access or retry.

Security properties:

- no public or permanent audio URL;
- no bearer, capability or audio bytes in a URL, log or diagnostic;
- no automatic retry and no automatic playback;
- bounded in-memory data, one active source and explicit stale-result guard;
- exact private source and PCM validation fails closed;
- no provider, quota or billing action.

Why it ranks first:

- it is already implemented and device-reachable with the existing markers;
- it does not add infrastructure, credentials, routes or storage;
- it remains consistent with the current `connectDomains:[]` boundary;
- the single silent observation is confounded by an independently observed
  iPhone output setting, so abandoning the route would overstate the evidence.

Exact source edits now: **none**.

One iPhone nonbillable verification, only under separate authorization:

1. On the already-authorized staging candidate, first confirm the iPhone's
   current physical output/speaker state without changing app code.
2. Confirm the protected UI markers, invoke `preview_private_fixture` exactly
   once, and tap play exactly once.
3. Record the complete nonsecret diagnostic and audible yes/no. A running
   context, successful decode or ended source is not an audible PASS.

STOP criteria: if it is silent, record the line and stop. Do not tap twice,
switch tools, redeploy or infer a new root cause in the same acceptance.

Rollback: no deployment or code rollback is needed for this decision. If a
future authorized deployment is involved, the rollback target is
`878f4e863d7f32484dc5b03ddae1cfed8937b39a`; the current single staging
candidate remains `9b938724f94f3053b6267f9fd90567da07e8de96`.

Remaining uncertainty: E2 remains a real silent observation. Rank A is a
candidate for one discriminating check, not an audibility PASS.

### Rank B - authenticated ephemeral HTTPS media element, design-only

This is the bounded fallback if a Web Audio check with confirmed output remains
silent. It is not implementable from present evidence because the host-owned
credential transport for a media-element request is unresolved.

Provisional exact edit surface, only if separately authorized after the missing
transport evidence is supplied:

- `src/staging-authenticated-mcp.js`: after protected-tool authentication,
  return a nonsecret source discriminator and an application-origin media URL;
  do not return a public, permanent or bearer-bearing URL;
- a server route using `src/private-https-audio-response.js` semantics: load
  only the authenticated subject's bounded WAV, return `audio/wav`, exact
  `Content-Length`, `Cache-Control: private, no-store, max-age=0`,
  `X-Content-Type-Options: nosniff`, `Content-Disposition: inline`, no redirect
  and no caller-selected path;
- `ui/mcp-bubble.html`: validate the exact HTTPS origin/path and assign it to
  the media element with explicit click playback only;
- focused tests for wrong subject, expiry, replay, concurrent fetch, malformed
  bytes, no public discovery, no token logging, no tool/provider action on play
  and no false audible success;
- keep the existing public MOCK and hosted-tone control unchanged.

Required security properties:

- authentication/authorization is bound to one verified principal;
- an issuance is short-lived and consumed atomically once in a store shared by
  all serving instances;
- replay, expiry, wrong-subject and concurrent retrieval fail closed;
- no bearer, raw secret or long-lived capability is placed in a URL or log;
- no open redirect, arbitrary path fetch, public listing or durable public
  object;
- bounded WAV revalidation and bounded response size;
- no provider, D1 quota mutation or billing path.

Why it is blocked:

- `HTMLAudioElement.src` cannot attach the protected request's OAuth
  `Authorization` header;
- a capability in the URL is a bearer-like secret and conflicts with the
  no-secret-in-URL/log boundary;
- cross-site cookies in the ChatGPT iPhone iframe are unproven and would need
  SameSite, third-party-cookie, CSRF and session-binding review;
- a Blob/object URL made from host-bridge bytes is not a third route and is not
  selected here: it still requires host `media-src` support for Blob URLs,
  while the current CSP contract describes origin-based `resourceDomains` and
  no iPhone evidence exists for this path;
- `resourceDomains` helps a media-element origin request but does not create an
  authenticated media transport.

One iPhone nonbillable verification, only after the credential transport and
staging candidate are independently approved:

- confirm markers and invoke a fixed nonbillable private WAV once;
- tap play once and record audible yes/no plus the exact nonsecret diagnostic;
- prove that an expired, replayed and wrong-subject fetch fails closed offline
  before any device test.

STOP criteria: no audible sound, any credential leakage, any replay acceptance,
any new infrastructure requirement outside the approved design, or any public
audio discovery means STOP. Do not add a third transport or retry on device.

Rollback: retain `9b938724f94f3053b6267f9fd90567da07e8de96` as the last
private-fixture candidate and `878f4e863d7f32484dc5b03ddae1cfed8937b39a` as the
staging rollback baseline. No Rank B route should be deployed until its exact
candidate and rollback are separately approved.

## Decision

Select **Rank A for one bounded confirmation only**. Do not implement Rank B
now. The current evidence supports neither a Web Audio root-cause claim nor the
conclusion that authenticated private HTTPS is playable. Rank A is preferred
because it preserves the proven security boundary, adds no infrastructure and
can be checked once in the existing iPhone host after the output confound is
explicitly controlled.

There is no new deployment recommendation. The single staging candidate is the
existing `9b938724f94f3053b6267f9fd90567da07e8de96`; this task did not alter or
deploy it. The public hosted-tone control is not private-audio evidence.

## Acceptance and V1 status

- Private-fixture iPhone audibility: **NOT VERIFIED**.
- Web Audio versus output-routing attribution: **NOT PROVEN**.
- Authenticated private HTTPS iPhone audibility: **NOT VERIFIED**.
- V1 generated/bridged iPhone audio: **NOT VERIFIED**; B1 remains open.
- B2-B4 remain open.
- Strict Voice V1: **2/9**.

## Validation and counters

This is a documentation-only decision. No source or test file changed, so no
broad suite was rerun and no syntax claim is made beyond the unchanged
authority tree. `git diff --check` is required before the report commit.

| Operation | Count |
|---|---:|
| Deployments / Render or Auth0 changes | 0 |
| Cloudflare, Worker, route or D1 requests | 0 |
| MiniMax/provider or application secret reads | 0 |
| Live MCP/connector invocations | 0 |
| Real iPhone tests or retries | 0 |
| Manual Actions dispatches or merges | 0 |
| Other Asteria repositories modified | 0 |

A preconfigured GitHub workflow credential was used in-process only for the
authorized branch push and Draft PR API workflow. It was not printed, logged,
persisted in the repository, passed to tests, or included in evidence.

**COMPLETE for the offline route-decision scope. The next device check remains
separately authorized and STOP-bounded.**
