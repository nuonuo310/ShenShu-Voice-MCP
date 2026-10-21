# Staging host smoke — desktop user-observed evidence (2026-10-21)

Status: **DESKTOP MANUAL AUDIO AUDIBLE — USER CONFIRMED. LIMITED HOST SMOKE PASS.** This is not a production release or paid synthesis PASS.

## Grounded identifiers
- Source commit deployed: `3552ec2ee418cc2654968e5630f1790f98f2ccdb` (v7 staging isolation candidate, PR #81).
- Dedicated free Render staging service: `shenshu-voice-mcp-staging.onrender.com`; staging identity `https://shenshu-voice-mcp-staging.onrender.com/paid-mcp`.
- Existing Auth0 issuer with separate staging API audience and `voice:speak` user-delegated authorization for a dedicated staging SPA client.
- `SHENSHU_AUTH_MCP_ENABLED=1`, `SHENSHU_PRIVATE_FIXTURE_ENABLED=1`, `SHENSHU_D1_ADMISSION_DRY_RUN_ENABLED=0`; nonbillable test-only.
- Render staging deploy of this commit reported LIVE. Production service not changed in this smoke.

## Observations and evidence limits
1. The user successfully connected the distinct `ShenShu Voice Staging` ChatGPT MCP OAuth connector. A real `verify_shenshu_login` call returned `authenticated:true`, `paid_voice_enabled:false`.
2. The user called `preview_private_fixture` in the actual ChatGPT desktop host. The protected player UI rendered, showed exact marker `v6-host-smoke-20261021`, and displayed `NONBILLABLE TEST · 生成形状 WAV` button.
3. The user clicked the nonbillable generated-shape WAV button. The UI displayed `NONBILLABLE TEST 生成形状记录已交付；请点击播放。`; screenshot supplied in conversation.
4. The user then clicked play and explicitly reported **“有声音”** (audible). This is direct user-observed desktop playback evidence for the staging fixture path, not independent audio capture.
5. The original `private-inline` legacy path previously showed a media loading failure in the same host; the generated Web Audio test path succeeded audibly. Do not claim legacy path repaired.

## Classification
- OAuth actual host login: PASS (verified tool response).
- Protected MCP Apps UI resource load: PASS (user screenshot).
- Generated-shape fixed synthetic WAV delivery in actual host: PASS (visible result, user screenshot).
- Generated-shape explicit-click audible desktop playback: **USER-CONFIRMED PASS**.
- Browser console/CSP and raw network capture: NOT COLLECTED.
- iPhone generated-shape playback: NOT TESTED.
- Real MiniMax/provider voice ID and paid TTS: NOT TESTED / NOT AUTHORIZED.
- D1 reads/writes or paid quota: NOT PERFORMED in this test; no provider or D1 tool invoked.
- Production deployment/merge: NOT PERFORMED.

## Next gate
Repeat exactly one NONBILLABLE generated-shape WAV delivery + explicit play on iPhone in the existing staging connector; collect version marker, delivery label, audible yes/no and error text. If it fails, stop; do not retry blindly. Do not enable paid provider, D1, production deploy, or merge. Following iPhone evidence, total control independently decides whether to advance to a separate billable audition authorization.

Evidence recorded as user observation and screenshot report; do not relabel as automated or independently captured host proof.
