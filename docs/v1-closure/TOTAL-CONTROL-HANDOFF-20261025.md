# ShenShu Voice MCP — total control handoff (2026-10-25)

This is a handoff to the next ShenShu total-control conversation, not authorization to execute or merge. User is worried a DeepSeek instruction may have been mixed with a simultaneously running Asteria-Call Codex task. First reassure and verify; do not infer conflict from terminal current directory.

## Relationship and responsibilities
The user calls the assistant 哥哥/沈述. Assistant acts as total control: owns direction, boundaries, read-only verification, gate decisions and instructions. DeepSeek/Codex are execution windows, not decision makers. User prefers full construction envelope committed in GitHub and a short copyable command. User explicitly asked not to lose continuity at window capacity.

## Voice MCP baseline
Repository `nuonuo310/ShenShu-Voice-MCP` (private). V1 strict DONE LINE **2/9**, only gates 1 and 8; B1 iPhone player progress but no audible sound, B2 real Cloudflare D1 atomic admission not proven, B3 cloud fail-closed/private durable result delivery not proven, B4 real approved MiniMax E2E zero. No emotion TTS, auto voice, smart long text split, favorites/history expansion.

D1 qualification DB `shenshu-voice-v1-qualification-20261024` UUID `234913cd-8901-4607-8147-31c4a4317111`, three business tables (001 reservations, 002 grants, 003 operations), two explicit indexes, seven autoindexes, 0 business rows, `PRAGMA foreign_key_check` 0 rows, user-observed. Old `shenshu-voice-budget-test` is forbidden.

Cloudflare account ID `5a1af7ea0ef8f8aea6365306d775a894`, user reports Free/no-card. Qualification Worker `shenshu-voice-v1-qualification-20261024` deployed once with Wrangler 4.152.0 from PR #111 code, cloud version `2320fd44-294c-4789-91bd-c20694254eca`. User dashboard: Ready, Production workers.dev OFF, Preview Version URLs OFF, routes/domains 0, DB binding 1, 0 invocations/errors. No HMAC secret or activation tuple. PR #114 added `preview_urls:false` to repo manifest; CI and operator dry-run passed but **not redeployed**. Current cloud Worker stays dormant. Do not touch other Asteria Workers.

PR #116 HMAC route plan: 24 Worker HTTP / 18 D1-touching / 10 admission / 32 row writes / 512 reads / 64 statements / 256 KiB / 20 min / 0 provider, offline only. PR #118 offline synthetic signer, HEAD `ed9fba65014a455e303698ba7d54d63bc8752c0b`, CI #363 success, 360/360 Node24, Draft/unmerged. Real principal provenance, stable operation_id ingress, secure real key injection remain open.

Latest authority PR #119, branch `docs/voice-v1-trusted-ingress-idempotency-readiness-20261025`, HEAD `c0a437c9a0fbb36b6819aceed5c22f7f2ce11e8d`, Draft/unmerged. Construction envelope `docs/construction-envelopes/2026-10-25-voice-v1-trusted-ingress-idempotency-readiness.md`: offline-only review of verified Auth0/MCP principal, stable operation_id and idempotency, HMAC lifecycle; no real key, cloud, Worker, D1, Render/Auth0 mutation, MiniMax or merge. **No matching DeepSeek Voice MCP completion receipt has yet been verified in this conversation.** GitHub PR #119 remains authority-only, not proof of completed execution.

## Potential cross-project confusion
User pasted a different receipt: `COMPLETE_OFFLINE_STARTUP_DIAGNOSIS`, authority `998a930c3118261e1339fb3e738ef06f5212626f`, branch `codex/call-v1-acceptance-23h`, HEAD `774a8c808b2907ff52cbbcf4b957231ccbc7f32c`, isolated worktree `C:\Users\Administrator\.codex\worktrees\call-v1-acceptance-23h\Asteria-Call`. PowerShell 7.6.5 read-only startup confirmed, Windows PowerShell 5.1 GRANT_READ_PARSE blocked, 11/11 processes, 232/232 assertions, zero side effects, no PR. `LIVE_ACCEPTANCE_23=NOT_AUTHORIZED`, `LIVE_CALL_V1=NOT_AUTHORIZED`, production streaming C/BLOCKED. This belongs to **Asteria-Call**, not Voice MCP. Screenshot terminal footer showed current directory `...\ShenShu-Voice-First-Audition` and a CALL-V1 task title, but this alone does not prove code crossover. User thinks she may have pasted wrong instruction into DeepSeek while Codex was also running Call. DO NOT claim a conflict or dismiss possibility without inspecting actual operations.

## Next safe action
1. Calmly acknowledge user anxiety and preserve continuity.
2. Ask for or inspect the actual DeepSeek session command/receipt and, if accessible, verify both repositories' exact remotes, worktree lists, branch/HEAD/status, PRs, commits and modified paths. **Read-only only**; no reset/stash/clean/switch/merge/re-run.
3. If Asteria-Call receipt came from Codex, treat as separate offline diagnosis; do not authorize live gate. If DeepSeek actually ran Call instead of Voice, identify it as wrong task, preserve evidence, then reissue correct #119 Voice envelope only after confirming safe worktree and user desire.
4. Maintain Voice V1 2/9 and all cloud/prod gates closed until separate approvals.

## Interaction style
Warm, steady, concise. User values a capable total-control assistant who notices her worry before technical explanation. Prefer short instructions in a copyable block, but do not force user to repeat lengthy context. At window handoff, carry both the emotional continuity and exact engineering truth.
