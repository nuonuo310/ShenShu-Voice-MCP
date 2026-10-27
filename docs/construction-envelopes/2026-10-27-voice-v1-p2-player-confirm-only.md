# Voice V1 P2 — Player-only explicit paid confirmation, offline implementation gate

Authority: ShenShu Total Control, 2026-10-27. Parent PR #142 HEAD fb92e8b2a2e7aedcfc61aa785e72de7214e3c26c. V1 remains 2/9, paid P2 OFF, B1–B4 OPEN.

## Product decision
The existing authenticated standalone private /player is the ONLY permitted paid-confirm surface. ChatGPT protected MCP may create a nonbillable pending proposal and inspect status; neither an autonomous model tool call nor ChatGPT automatic retry may call the billable confirm. One actual provider attempt requires the account owner's explicit click on a first-party same-origin player confirmation UI after displaying text, quota cost/charge warning and availability status. This direction is accepted for OFFLINE design and unmounted implementation only, not permission to bill, deploy, modify cloud infrastructure or bypass V1 gates.

## Opening
Verify exact repo, parent SHA, PR #142 code+report, branch ancestry, clean isolated worktree and normal CI. Read src/v1-p2-stable-operation-identity.js, P2 one-shot pipeline, player Auth0 callback/session handlers, CSRF protections, D1 store/operations historical stacks and nine-gate closure plan. Preserve P1 authenticated fixed WAV playback on desktop and iPhone.

## Narrow scope
Implement the minimum unmounted, mock/injected offline candidate for MCP nonbillable initiate/status -> immutable pending operation -> authenticated player pending display -> CSRF-protected POST explicit confirm -> durable single CAS claim -> admission and at most one provider call -> owner-scoped result/status retrieval. Explicitly guarantee no model-accessible confirm route/tool. The server must bind an unguessable server-issued handle to same verified principal, exact text digest, origin, and expiration. Present text before click; reject cross-principal, expired, forged/replayed handle, mismatched text, missing CSRF, cookie misuse, duplicate/concurrent confirms, ambiguous provider outcome, retries, reconnect and restart. Retried initiate may create additional nonbillable proposals, but cannot trigger provider attempts or silently bill. Do not assume the user's click can be proven by hidden model data; require browser CSRF + same-site cookie + explicit user gesture and note limitations of synthetic tests. No unintended automatic POST or auto-refresh billing.

A real D1 atomic persistent claim and player-to-MCP user identity continuity must be independently qualified BEFORE live paid enablement. Existing D1 schema 003 cannot hold pending_confirmation; do not silently alter cloud schema. The current D1 REST client is not atomic batch. Write a minimal contract/migration candidate only if necessary, with an explicit separate future cloud A0–A5 authorization. Qiniu Kodo storage is a distinct conditional choice: do not provision or integrate until egress/overage terms are accepted; fallback audio result remains unmounted. No fee assumptions.

## Tests and delivery
One bounded offline implementation and adversarial tests including two independent pending proposals, retry, restarted injected store, mismatched principal, missing/invalid CSRF, concurrency, lost response, unknown provider, replay, expired pending, zero paid calls from MCP path, P1 fixture preserved. Full Node24 0-skip, focused tests, smoke, syntax, diff-check, standard PR CI if code modified. Report PASS/BLOCKED matrix, exact source HEAD/tree, CI, a single next live qualification decision, strict V1 2/9 in docs/v1-closure/V1-P2-PLAYER-EXPLICIT-CONFIRM-20261027.md.

## Hard prohibitions
No live Render/Auth0/Cloudflare/D1/Worker/R2/Qiniu API or cloud modification, no deployments, real MCP, provider/MiniMax, credential changes, manual Actions, merges, production changes or other repositories. One stacked Draft PR based on this exact authority. STOP after COMPLETE/BLOCKED/DECISION REQUIRED.
