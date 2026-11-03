# Accepted desktop 04 audibility — 2026-11-04

This section supersedes the pre-trial status below; the implementation receipt
is retained as history. It does not declare all nine Voice V1 gates complete.

- Live trial implementation: `ec32999390f3ea34f78c81bfc1dc9b9ce6911943`.
  Render deployment `dep-dbl1ip5g1s2s73e1gjo0` independently read as live;
  startup log reported `desktop04_mounted:true`, `desktop04_ready`.
- ChatGPT MCP tools were refreshed; authenticated, nonbillable preparation was
  invoked for: “糯糯，哥哥在。我们一步一步走到这里了。现在，让你听听我的声音。”
- First unused proposal expired before confirmation. Its read-only status was
  `expired`; it was not retried as a paid operation. A new pending proposal was
  prepared without synthesis.
- Owner supplied a screenshot of the new card showing a returned 04 result,
  the exact text, approximately 6 seconds and an enabled play control. Owner
  then explicitly reported hearing it: “啊啊啊啊，哥哥我听到了”.
- Read-only owner-scoped proposal check after playback returned `completed`,
  `ready:true`. This is actual owner-observed desktop ChatGPT audibility for
  this one controlled trial, together with server completion evidence.
- No additional synthesis or paid retry was invoked by the assistant. The
  desktop flag and all four paid flags were saved back to 0 after acceptance;
  Render triggered closure deployment `dep-dbl1q7ajnfac73a8i3t0` against its
  configured old P1 branch. Activation of that closure must be verified.

Remaining: ordinary ongoing reply workflow, repeatable UX and removal of debug
controls; iPhone host playback; long-term replay/persistence and the other V1
closure requirements. Do not promise old ChatGPT widgets survive reload or
that this proves mobile support or automatic capture of all replies.

---

# Desktop ChatGPT 04: host transport accepted; runtime wired, paid OFF

## Owner-observed host gate

2026-11-04 Asia/Shanghai: owner refreshed ChatGPT MCP tools after the manual
Render staging deployment of `241fdd773913098728592ab7cd6cc06303d322da`.
The owner supplied screenshots showing first the small widget-only marker
passing, then “官端小数据与大数据传输均通过（非计费、无音频）”.
The current probe checks metadata shape, 2,800,000-character length, and fixed
prefix/suffix. This is actual desktop host transport evidence under that
session, not a hash of every byte, an audibility result, or a real 04 synthesis.
The live commit identity was reported by the manual-deploy workflow; this
receipt does not claim an independent Render API attestation.
No repeat of this accepted host test is needed absent a relevant regression.

## Runtime change

`src/v1-desktop-04-staging-runtime.js` composes the existing sealed D1 operation
store, nonbillable proposal broker, app-only confirmation surface, desktop
inline audio contract and fixed MiniMax adapter. `server.js` now injects this
factory through the authenticated protected resource shell only when all
independent gates and the approved platform commit match.

- Canonical verified identity `subject` is adapted to the desktop `principal`.
- D1 millisecond expiry is adapted to the confirmation surface's ISO timestamp.
- Desktop-created operations use a server-generated `desktop04_` prefix and a
  fixed daily limit of 1; old standalone-player handles are rejected.
- A single D1 claim reserves and consumes the grant before synthesis; a second
  attestation must prove slot 1. The stable operation ID is the request ID.
- Double click, parallel requests, replay, wrong owner, changed arguments,
  expiry, failed admission and uncertain provider results fail closed.
- Success marks the operation complete; failed/uncertain claimed attempts are
  not refunded or retried. Loss after a claim cannot regenerate the audio.
- The WAV goes only in `_meta.shenshuPrivateAudio.record`, never in model-visible
  content/structuredContent; no Kodo or public audio URL is used by this path.
- Desktop mode cannot fall through into the standalone Kodo paid candidate.
  `/player/confirm` stays absent in desktop mode. Old non-desktop behavior is
  preserved. No HTTP request or model argument can mount the factory.

## Activation boundary (NOT performed)

Deployment alone with paid flags 0 does not mount the new tools. One separately
owner-approved staging trial needs the exact new commit in both the Render
platform identity and `SHENSHU_STAGING_APPROVED_SHA`; the existing sealed-player,
OAuth and fixture gates; existing private text key and D1 configuration; and:

```
SHENSHU_DESKTOP_04_APP_ENABLED=1
SHENSHU_STAGING_FINAL_WIRING_ENABLED=1
SHENSHU_STAGING_PAID_CONFIRM_ENABLED=1
SHENSHU_STAGING_REAL_PROVIDER_ENABLED=1
SHENSHU_STAGING_PRIVATE_AUDIO_ENABLED=1
SHENSHU_MINIMAX_VOICE_ID=ShenShuCN04Ziran_20261025220130
```

The real model remains `speech-2.8-hd`, speed 1.0, vol 1, pitch 0, WAV 16k mono.
Do not expose the already stored API key. Do not modify D1 schema or Kodo.
After deployment/configuration, refresh ChatGPT MCP tools before opening the
nonbillable `prepare_shenshu_desktop_04` card. Text remains in the ordinary reply
and is explicitly passed into preparation; no automatic capture of all replies
is claimed. Owner reviews exact text and clicks the billable confirmation once,
then manually plays. After the one trial, turn the desktop and paid flags off.
An existing same-day reservation may deny the attempt; never bypass the quota
or replay an old unknown operation. Disable before changing feature scope.

## Verification and limits

Final local Node 24 regression: 474/474, 0 failures, 0 skips; targeted desktop
suite 8/8. HTTP smoke passed; production audit found 0 vulnerabilities. Remote full CI
must pass on the final exact commit before any proposed deployment.
Tests use local SQLite, synthetic RSA/OAuth fixtures, fake MiniMax HTTP and
synthetic WAV only. They exercise normal server startup and authenticated MCP
HTTP through the real adapter, not a real provider or D1 cloud invocation.

No live deployment, configuration change, real synthesis, billing, D1 cloud
write or Kodo request was performed in this wiring turn. Real 04 audibility
and real host user-gesture E2E remain unverified. Voice V1 stays 2/9.
