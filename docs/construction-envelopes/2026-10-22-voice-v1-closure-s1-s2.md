# Voice V1 closure construction package S1+S2 — 2026-10-22

**Authority:** `docs/v1-closure/V1-CLOSURE-PLAN.md` at branch `docs/voice-v1-closure-control-20261022`. Follow Continuity continuous construction rule and 2026-10-22 V1 baseline. This is a bounded offline implementation package, not permission to deploy or bill.

## Objective
Reduce actual V1 blockers, not invent more features. Execute two independent tracks in one continuous offline session: S1 diagnose iPhone silence for both OAuth Web Audio bridge paths and implement the smallest supported fix/diagnostic; S2 integrate server-verified principal -> durable quota/reservation -> server-consumed one-use grant -> one fixed-model/voice fake MiniMax attempt -> validated private WAV record, with fail-closed, no retry, duplicate-charge tests. Report separate track results; do not allow S2 to claim real paid D1 proof.

## Opening Gate
Verify repo `nuonuo310/ShenShu-Voice-MCP`, local worktree map/cleanliness, origin/main SHA, open Draft PRs #68–#84, and latest relevant branch HEADs. In particular inspect #81 `3552ec2ee418cc2654968e5630f1790f98f2ccdb`, #84 v8 authority `980b7248d807327bceade7623a929a1ef9824500`, desktop evidence #82 and iPhone silent evidence #83. Read README, CURRENT-STATE, LIVE-SECURITY-GATE, paid admission gap, and exact V1 closure plan. Inspect real code and CI. If conflicting worktree or authority drift, STOP; never reset/stash/clean/move other worktrees. Prefer a new dedicated worktree/branch from verified closure authority; avoid cherry-picking old stacked PRs blindly.

## S1 iPhone output
Inspect both silent iPhone paths and common AudioContext/session logic. User reports volume on, no Bluetooth, other videos audible; desktop generated WAV audible. Diagnose suspended/interrupted state, user gesture timing, audio-session category, source.start/ended, UI progress vs speaker output. Add minimal nonsecret status instrumentation and/or conservative compatibility change only with source-backed rationale, preserving desktop path. Add fake iOS harness for interrupted/suspended/resume/decode/gesture/stale/duplicate and existing fixtures. Do not claim iPhone audible PASS from mocks. Produce one controlled manual iPhone test plan for separately authorized staging deploy; no repeated blind attempts.

## S2 paid pipeline (offline fake only)
Read `src/verified-identity.js`, `src/d1-http-paid-store.js`, `src/durable-paid-admission.js`, `src/live-voice.js`, `src/minimax-adapter.js`, offline first-audition/consent modules, protected staging server, private audio record contracts. Build minimal trusted server-side composition; reject client-supplied approval/principal, bind request ID/text digest, reserve atomically and consume grant before one fake provider attempt; fixed approved model/voice; no automatic retry or reservation refund on unknown outcome. Exercise concurrency, duplicate request/replay, day limit, grant mismatch, timeout/ambiguous provider, invalid WAV/size, secret nonexposure and public MOCK isolation. Do not register paid tool, deploy or access real D1/provider. If production consent durability requires schema or architecture change, document smallest decision and STOP only that track.

## Autonomy / allowed files
Task-scoped `src/`, `test/`, `ui/`, `docs/` only. May implement, run tests, fix ordinary failures, retest, commit/push dedicated branch and create Draft PR stacked on closure authority. Run targeted/full Node suites, JS/HTML syntax, diff check, and independent evidence report. No merge/rebase of predecessor PRs.

## STOP
No Render/Auth0/config changes, staging/production deploy, connector refresh, real host calls, D1 reads/writes/migrations, MiniMax calls, voice/key secret access, public or protected paid tool registration, GitHub Actions dispatch, or changing frozen OAuth/CSP/DB schema without total-control approval. Any real cost, credential, identity or architecture boundary => TOTAL CONTROL DECISION REQUIRED. Do not introduce emotion TTS, autoplay, segmentation, favorites, history or advanced animation.

## Delivery
Write `docs/v1-closure/S1-S2-IMPLEMENTATION-EVIDENCE.md` including exact branch/base/HEAD, changed files, tests and CI, S1 and S2 evidence levels, outstanding blockers, next S3 real-D1 qualification and S4 one approved MiniMax E2E smoke gates, counts of all real paid/cloud operations (expected 0). Return COMPLETE / BLOCKED / TOTAL CONTROL DECISION REQUIRED, plus the smallest decisions needed. Preserve 2/9 strict V1 gate count until independently verified.
