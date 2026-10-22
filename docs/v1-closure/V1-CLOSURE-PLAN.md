# Voice V1 Closure Plan — 2026-10-22

Authority: ShenShu Voice total control. Governing: `nuonuo310/Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md` and `continuity/v1-closure-baselines-2026-10-22.md`. This is a V1 scope/freeze baseline, NOT evidence of production completion.

## V1 DONE LINE — immutable nine gates
1. ChatGPT protected MCP authenticates a verified principal.
2. Every real TTS request passes durable atomic quota/reservation and a server-consumed one-use grant.
3. Server fixes approved MiniMax model and voice; caller cannot select.
4. One explicit text request causes at most one billable upstream attempt, no automatic retry.
5. Provider response/WAV meets format, duration and size bounds.
6. Authenticated private audio delivery is audibly usable on desktop AND iPhone with explicit play.
7. Failure/ambiguous billing state fails closed; replay and duplicate charge prevented.
8. Public MOCK /mcp remains isolated from paid route.
9. Exactly one separately and explicitly authorized real MiniMax end-to-end smoke yields bounded nonsecret evidence.

Freeze only when all nine have concrete evidence; no later feature can move this line.

## CURRENT STATUS — conservative 3/9 verified
- Gate 1: actual staging ChatGPT OAuth `verify_shenshu_login` returned `authenticated:true`, `paid_voice_enabled:false`. Verified staging identity, not proof of paid integration.
- Gate 8: public MOCK vs protected route separation is source/offline verified; staging deployment is separate.
- Gate 6 partial: actual desktop OAuth protected generated-shape NONBILLABLE fake WAV user-confirmed audible (PR #82); actual iPhone new and old Web Audio bridge silent despite UI/progress (PR #83). Historical older iPhone audible fixed WAV report does not overrule current regression.
- Gates 2,3,4,5,7: modules and offline fake tests exist, but actual combined trusted paid path not mounted/qualified.
- Gate 9: zero authorized real MiniMax E2E smoke; explicit approval required later.
- Counting: 3/9 strict gates = gate 1, gate 8 and limited existing validated WAV format contract gate 5 *as an offline format-validator gate only*. Gate 5 is NOT provider-output-verified; if requiring end-to-end provider validation, strict full E2E count is 2/9. Never claim 3/9 fully production-proven. This distinction must be retained in all reports.

## V1 BLOCKERS — four independent domains
B1. iPhone private generated/bridge audio: UI and progress but silent; isolate iOS host/Web Audio output and obtain user-confirmed audible result for V1 path. No blind repeated taps.
B2. Paid admission and trusted wiring: verified principal -> durable D1 atomic reservation -> server-side one-use grant consumption -> one fixed MiniMax request -> validated WAV private record. No caller-authorized booleans. Prove concurrent/replay/day-limit/uncertain-upstream and no retry. Real paid D1 qualification must be separately gated.
B3. V1 fail-closed and private-audio evidence: ensure no duplicate charge on replay, timeout, uncertain response; no public permanent audio URL, bearer or secret leakage, no public MOCK regression. This is acceptance hardening of B2 and B1, not an unlimited new subsystem.
B4. One explicit user-approved real MiniMax E2E smoke with fixed approved model/voice, maximum spend and bounded audit; NOT authorized by this plan.

## REMAINING SLICES — four, no perpetual expansion
S1: iPhone silent-output diagnostic + minimal bounded fix, offline proof, then separately approved staging deployment and one iPhone manual verification. Close B1 only with audible observation.
S2: integrate verified OAuth principal, durable quota/reservation/one-use grant, fixed MiniMax adapter and generated private record in a fail-closed *offline* candidate. Run duplicate/replay/concurrency/timeout/uncertain billing tests. This closes offline implementation portion of B2/B3; actual D1 and cloud activation remain separately authorized.
S3: one bounded staging qualification of real D1 paid namespace and private delivery, with explicit architecture/credential/cloud approval, independent review and rollback; no MiniMax call. Close B2/B3 only with concrete proof.
S4: exactly one separately approved billable MiniMax E2E smoke, with capped request, fixed model/voice, desktop+iPhone private playback, and evidence. Close B4 and remaining gate 6/9.

If S1 cannot produce new evidence after one bounded attempt, STOP for total-control decision; no endless iOS retries. S2 may proceed offline independently but must not deploy while B1 unresolved.

## NOT IN V1 / LATER
Emotion TTS, auto-read every assistant reply, automatic calling, long-text intelligent segmentation, favorites, audio history/archive, multiple voices/models, full commercial billing platform, advanced animation, mass/multi-tenant production release. Do not pull these into V1 without direct proof they block a stated gate.

## Frozen boundaries
- Production `main`, live `shenshu-voice-mcp.onrender.com`, original Call/Worker/Gallery remain untouched until explicit total-control authorization.
- Staging Render `shenshu-voice-mcp-staging.onrender.com` currently deployed at `3552ec2ee418cc2654968e5630f1790f98f2ccdb` on Free, auto deploy off, distinct Auth0 staging audience and test connector. Current nonbillable probe does not authorize provider or D1.
- All #68–#84 stacked/side Draft PRs require dependency review before merge. Do not merge as a batch or treat PR CI as production proof.
- No provider key/voice ID exposure; real D1 writes and paid MiniMax calls require separate explicit approvals.
- Continuous construction autonomy limited to bounded offline changes, tests, evidence and Draft PR.

## FREEZE CONDITION
All nine gates evidenced at specified proof level; four blocker domains zero; final one-time approved real provider smoke PASS with desktop/iPhone audible; fail-closed/duplicate-charge/private audio tests PASS; public MOCK unchanged; authoritative commit and deployment identified; bounded evidence archived; total control declares Voice V1 FREEZE and stops expanding scope.

## Audit uncertainty
The current GitHub remote exposes PR topology and code, but local Windows worktree state was not independently checked in this turn. The historical CURRENT-STATE contains older checkpoints. No v8 implementation result has been received; PR #84 is an authority envelope, not completed fix. The above is a closure plan, not a claim that a new implementation package has run.
