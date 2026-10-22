# Voice V1 S1 iPhone silent output — real host observation (2026-10-22)

Evidence class: USER-OBSERVED REAL IPHONE HOST; NOT a confirmed root cause or audible PASS.

## Pinned environment
- Staging Render service `shenshu-voice-mcp-staging.onrender.com`, deployed from `work/voice-v1-closure-s1-s2-20261023` at `878f4e863d7f32484dc5b03ddae1cfed8937b39a`.
- Separate OAuth staging connector; nonbillable synthetic generated-shape WAV; no real MiniMax.
- Current iPhone ChatGPT protected player shows `UI v6-host-smoke-20261021` and diagnostic `s1-20261023`.

## User-observed reproduction
- On iPhone, generated-shape WAV test record delivered; user tapped play several times.
- Visible diagnostic: `宿主 iOS · UI v6-host-smoke-20261021 · 路径 web-audio-generated · 手势 direct-click · ctx running · resume resolved · decode ok 0.70s 48000Hz 1ch · source started · ended no`.
- `ended no` is a snapshot during playback, not a final lifecycle assertion.
- User explicitly confirmed **still completely inaudible**. Previously older fixed bridge WAV also silent in same iPhone host. Media volume on, no Bluetooth, other videos audible.
- Desktop generated-shape WAV audible user-confirmed earlier (PR #82).

## Classification
- Identity/host UI/delivery: previously verified.
- iOS context resumed, decode and source start: screenshot-observed.
- iPhone speaker output: **FAIL (silent)**.
- Cause unknown; candidate iOS WebKit/ChatGPT embedded audio session routing vs hardware mute/category, not established.
- This observation narrows the failure beyond simple WAV format, suspended context or no source start. It does not establish sample output, audio session category or actual speaker routing.

## Total-control stop and next decision
- STOP further repeated manual taps and generic offline Web Audio retries. Preserve current staging deployment for rollback.
- Need a bounded architecture/diagnostic decision: investigate iOS WebKit audio-session category or alternate host-supported playback delivery only with distinct new evidence, and protect desktop path. If host limitation is not fixable within current MCP Apps resource, report BLOCKED rather than infinite iterations.
- S2 offline paid integration may proceed toward separately approved S3 qualification, independent of iPhone B1; no provider/D1/paid authorization granted here.
- Voice V1 remains 2/9 strict gates and B1 open. No production merge/deploy or MiniMax E2E.
