# ShenShu Voice MCP — CURRENT CONSTRUCTION STATE

Last verified: 2026-10-20 (read-only GitHub inspection before this checkpoint).
Status authority: actual GitHub HEAD + CI + code > this document > conversation recollection.
This file is the FIRST ENTRY for any assistant or coding agent resuming this project.

## Immutable reference at checkpoint creation

- Repository: `nuonuo310/ShenShu-Voice-MCP`, branch `main`.
- Reviewed HEAD before this checkpoint: `204f7c5521cdf72bbe40c12146a91a60f9c59212`.
- CI at that SHA: completed, success. Historical README reports 14/14 tests.
- This checkpoint itself adds a commit; do **not** mistake the reviewed HEAD above for the future branch tip.
- Deployment previously reported: `https://shenshu-voice-mcp.onrender.com/mcp`; verify live state independently before action.
- ChatGPT connection previously reported as `沈述声音MCP`; user confirmed MOCK audio playback. Do not treat this as live TTS success.

## Finished and verified

1. Independent repo exists and can be read/written.
2. P0 input/WAV contracts and offline bubble exist.
3. P1 MOCK HTTP MCP `/mcp`, tool `preview_shenshu_voice`, UI resource `ui://shenshu/voice-bubble-v1.html` implemented; ChatGPT mock sample playback previously user-confirmed.
4. MiniMax fixed-voice `speech-2.8-hd` adapter and isolated paid-core staged, NOT exposed to users.
5. Paid admission contract, in-memory offline tests, PostgreSQL atomic reservation candidate and SQL migration staged. CI is green at reviewed HEAD.
6. Original `Asteria-Call`, `Asteria-Voice-Worker` and `ShenShu-Voice` are separate, protected workstreams. Do not edit or redeploy them for this project.

## Current STOP: identity / paid admission gates (P2, NOT released)

- Public Render `/mcp` remains **NO AUTH** and MOCK ONLY.
- No verified OAuth or other cryptographic user principal for paid operations.
- No deployed PostgreSQL pool/migration, no real parallel-transaction test, no deployed durable quota.
- No server-side atomic single-use grant bound to an invocation.
- No approved, authenticated/private short-lived audio delivery proven in ChatGPT on iPhone.
- No live MiniMax request, no payment credentials committed, and no paid `speak_shenshu` tool enabled.
- Daily paid reservation target is initially 3 attempts per verified user/day, not active. Shared upstream MiniMax quotas remain a separate consideration.
- Keep no-auth `preview_shenshu_voice` available while designing secure path. Do not accidentally expose `speak_shenshu`.

## Next authorized sequence — no shortcut

1. **IDENTITY FIRST**: inspect latest main and current deployed Render state; design and test authenticated identity verification for every paid route. No trust in caller-chosen name, tool args, unsigned headers, or client `oneTime:true`.
2. **DURABLE ADMISSION**: verify actual PostgreSQL concurrent reservations, duplicate request rejection, per-principal/day limits, one-time grant consumption; ensure paid calls cannot bypass reservation.
3. **AUDIO DELIVERY**: mock with realistic audio, test authenticated short-lived output and ChatGPT iframe/CSP/iPhone playback. No publicly permanent audio and no tokens in URL.
4. **DEPLOY STAGING + VERIFY**: keep live paid tool disabled; run CI/integration and independently inspect HTTP tools/list and authorization behavior.
5. **REAL PAID SMOKE**: ask user's explicit authorization for one billable MiniMax generation; only after all previous gates pass, no retry on uncertain results.

## Mandatory resumption protocol

Before advising or writing code on EACH future work session:
- Read `docs/CURRENT-STATE.md`, `docs/LIVE-SECURITY-GATE.md`, `docs/PAID-ADMISSION-CONTRACT.md`.
- Check GitHub current `main` HEAD, changed files since recorded checkpoint, latest CI, and deployed route status if available.
- State in plain Chinese: `已完成 / 当前卡点 / 本次唯一下一步 / 不得触碰`.
- If repo and checkpoint differ, report the discrepancy; update checkpoint based on evidence, do NOT overwrite newer code.
- Never tell user to redo GitHub/Render/MCP setup without verifying that a resource is missing.
- Do not request user to remember technical terms or source-control state.
- No secrets in GitHub; no production paid tool on no-auth MCP; never touch Call freeze.
