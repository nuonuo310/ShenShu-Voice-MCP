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
