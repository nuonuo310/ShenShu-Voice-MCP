# Voice V1 P2 — Stable operation identity recovery, offline only

Authority: ShenShu Total Control, 2026-10-27. Parent PR #140 HEAD 2a48c15c878ef314634675a7042327da1c5de529. V1 remains 2/9. P1 fixed private WAV playback was confirmed audibly on desktop and iPhone Safari. Paid P2 is NO-GO for lack of a trusted stable operation identity across automatic retry, reconnect and Render restart.

## Sole objective
Find and implement, if demonstrably safe in this narrow offline round, the minimum trusted operation identity contract for protected MCP initiation. Inspect actual MCP transport, the P2 injected operation resolver, and historical unmerged D1 operations schema/adapter. A new server-generated ID for each retry is not sufficient. JSON-RPC request ID is client-controlled and not known to survive reconnect. Do not assume transport retry invariants.

Prefer a small, explicit two-stage initiate/status/confirm flow if necessary: a confirmed charge attempt must be uniquely bound to verified Auth0 principal, exact text digest and server-created durable operation; retry, reconnect and restart may only recover status or reuse an already admitted operation, never create a fresh billable operation silently. Consider authenticated server-issued opaque handles, but rigorously demonstrate how they survive or are recovered after lost responses; never trust arbitrary client-supplied principal, ID, digest, grant or billing authority. Require explicit new user action to initiate another paid request after ambiguous outcome.

## Security acceptance
One explicit confirmed operation -> at most one MiniMax attempt across concurrency, retries, disconnect/reconnect and process restart. Durable atomic operation state, quota reservation and one-use grant must be proven separately against real D1 later; do not claim live D1 from offline SQLite. Fail closed for unknown provider outcome, no automatic refund/retry. No public/private audio or sensitive IDs in conversation/thread, URLs or logs. Do not silently relax any V1 gate. If API contract cannot deliver a stable trusted identity, return BLOCKED and a precise single product decision instead of fabricating a test PASS.

## Context / storage
User has no payment card, and R2/paid Render disk/database are not authorized. Qiniu Kodo Singapore screen-observed monthly free 10 GB standard storage is a separate conditional storage candidate, not an identity solution, and egress/overage charges remain unverified. Do not provision a Kodo bucket/key, write or upload objects, or conflate storage and idempotency.

## Required opening and deliverable
Verify correct nuonuo310/ShenShu-Voice-MCP origin, exact parent SHA, clean isolated worktree, PR #140 status/CI and authoritative V1 nine gates. Read P1, P2, protected MCP verifier and historical D1 operation state machine/migrations read-only. Make at most one bounded offline implementation and adversarial test pass, or stop with explicit blocker. Deliver docs/v1-closure/V1-P2-STABLE-OPERATION-IDENTITY-20261027.md, minimal code/test diff if justified, one stacked Draft PR. If code changes run Node24 full zero-skip suite, focused tests, smoke, syntax and diff-check, regular CI. Report exact HEAD/tree/PR/CI, limitations and only next gate. V1 remains 2/9. STOP.

## Prohibitions
No real Render/Auth0/Cloudflare/D1/Worker/R2/Qiniu API or changes, no deployments, no secrets, no real MCP calls, no MiniMax/provider request, no manual Actions dispatch, no merge, no modifications to other repos. Preserve P1 working staging player.