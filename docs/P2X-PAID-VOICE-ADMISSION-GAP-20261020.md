# P2X real speech admission review — 2026-10-20 (NOT AUTHORIZED TO BILL)

## Verified completed
- Fixed synthetic WAV: OAuth-protected app-only MCP host bridge -> Web Audio -> audible on desktop AND iPhone, user-confirmed. PR #37 merged e498e57; PR #38 merged dea35b1.
- src/minimax-adapter.js already builds MiniMax speech-2.8-hd request, single upstream attempt and validates WAV.
- src/live-voice.js stages paid synthesis with mandatory authorize callback; no paid MCP tool is exposed.
- src/d1-http-paid-store.js exposes atomic reserve, issue and consume operations; src/d1-admission-dry-run.js exercises a separate dryrun_ namespace, NOT real paid budget.

## Critical blockers before first paid voice
1. createLiveVoice trusts an injected authorize callback returning {allowed:true, principal, oneTime:true}. This shape alone is not proof of a consumed durable grant. Production integration MUST construct the callback server-side from cryptographically verified OAuth principal plus D1 reserveAtomic/issue/consume, bound to one invocation, and reject reuse. Do not expose or accept caller-provided grant booleans.
2. Paid D1 namespace needs separate real-concurrency, replay, failure and per-principal UTC-day limit tests; dry-run PASS is not sufficient evidence of real paid authorization. Preserve no-refund-on-uncertain-upstream policy.
3. Paid tool registration must remain closed until all gates, including explicit user authorization for first billable request, pass. No auto-retry and no silent paid invocation.
4. Generated audio output must use already-proven host-bridge + Web Audio route, not legacy HTMLAudioElement data: URI or public permanent URL. Validate payload size, no secret leakage and iPhone manual playback. Actual MiniMax audio format compatibility remains unverified.
5. Confirm actual configured voiceId and model without disclosing secrets. Shared upstream account budget must be accounted for separately from per-user D1 limit.

## Exclusive next implementation step
Build **offline fake-MiniMax** end-to-end integration tests: verified OAuth principal -> D1 mock durable reserve/issue/consume -> exactly one fake synthesize -> bounded generated WAV bridge record. Prove all denial/replay paths cannot reach synthesize. Do NOT activate production tool, access D1 real quota, or call MiniMax.

## Historical caution
Older docs refer to PostgreSQL and absence of OAuth; those are historical checkpoints, not current P2X staging status. Trust current code/CI and newest CURRENT-STATE entries.
