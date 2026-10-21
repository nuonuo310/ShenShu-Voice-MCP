# Continuous construction envelope v1 — first real ShenShu voice readiness

Status: DRAFT / NOT AUTHORIZED FOR AGENT EXECUTION. Owner: ShenShu total control. Target repo: nuonuo310/ShenShu-Voice-MCP. This envelope follows Shenshu-Continuity/rules/CONTINUOUS_CONSTRUCTION.md and VERIFIABLE_WORK.md.

## Stage objective
Deliver an independently reviewable, strictly non-executing first-real-voice readiness candidate. Prioritize a single explicitly approved MiniMax audition over full production paid concurrency rollout. Do NOT make a real paid call in this envelope.

## Opening gate
- Verify repository exact owner/name and main HEAD at start; record SHA in final report rather than assuming a fixed HEAD.
- Inspect server.js, src/minimax-adapter.js, src/contract.js, current OAuth bridge, D1 admission and paid gate files, tests, and docs/P2X-QUALIFICATION-CHECKPOINT-20261021.md.
- Confirm working tree/branch cleanliness and record any unrelated changes; stop on drift that affects frozen contracts.

## Authorized autonomy
- Read, implement, refactor locally within src/, test/, and task-specific docs/ as needed.
- Run offline tests, fix ordinary test/lint/fixture failures, rerun and collect evidence without asking for each repair.
- Create a task branch, commit, push, and draft PR only. No merge, deployment or production enablement.
- May produce a fully offline fake-fetch rehearsal for exactly one future TTS call, with no real keys, network, billing, or database writes.

## Frozen boundaries
- Preserve existing working iPhone/desktop WAV bridge and OAuth MCP behavior; do not replace player, change public contracts, or rework unrelated projects.
- Preserve D1 schema, principal ownership, uniqueness and grant consumption semantics; do not run real D1 writes or migrations.
- No access to secrets, creation of new credentials, MiniMax requests, external paid calls, Render changes, Cloudflare settings, GitHub Actions dispatch, or live write runners.
- Do not activate paid MCP route or publish audition tool; no user-provided principal or approval flags treated as authorization.

## Required work and evidence
1. Map actual first-audition call path from explicit human consent through verified identity, one-shot bounded quota gate, synthesizeMiniMax, WAV validation and existing player. Mark each implemented/unimplemented link, do not invent.
2. Build minimal offline-only integration candidate and tests for one-shot, timeout, duplicate requests, missing/wrong identity, over-limit audio, invalid upstream and replay; fail closed. Do not overengineer the production D1 concurrency track.
3. Inspect the voice ID source and configuration requirements without reading or logging real values. Flag any missing operator decision or secret as a gate.
4. Produce a concise readiness matrix: proven offline, requires real deployment verification, requires explicit billable approval. Include exact SHA, test commands, pass/fail, changed files and remaining blockers.

## STOP / total control decision required
Any architecture change, canonical state ownership change, public tool exposure, live credentials, real MiniMax or D1 write, billing, schema migration, merge/deploy, unexpected upstream contract, or missing proof that could lead to false PASS.

## End states
COMPLETE: offline candidate, tests, evidence and draft PR ready for total-control review.
BLOCKED: state exact blocker and what was not done; do not guess.
TOTAL CONTROL DECISION REQUIRED: present smallest decision and alternatives; do not proceed past boundary.

## Final report
Report status; opening gate repo/base/HEAD; exact changes; offline test evidence; draft PR and commit; user action required (if any); paid/network/database calls count; untouched frozen areas; unresolved blockers.
