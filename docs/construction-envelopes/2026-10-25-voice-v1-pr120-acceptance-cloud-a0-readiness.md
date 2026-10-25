# Voice V1 — PR #120 acceptance and nonbillable Cloud A0 readiness (2026-10-25)

Authority: ShenShu total control. This is a bounded handoff for DeepSeek, NOT authorization for live qualification. Preserve strict Voice V1 2/9 and blockers B1–B4.

## Fixed baseline and opening gate

Repository: nuonuo310/ShenShu-Voice-MCP. Authority parent is Draft PR #120 head `498e806a582c636f1c0a9e627432e3fd61d2c9c5`, stacked on PR #119 `c0a437c9a0fbb36b6819aceed5c22f7f2ce11e8d` and PR #118 `ed9fba65014a455e303698ba7d54d63bc8752c0b`. PR #120 CI run `40196715043` succeeded for Node 20 and Node 24. Recheck all refs, current CI, worktrees, uncommitted changes, open PR dependencies and exact repository origin before acting. Never reset, clean, stash, rebase, merge or rewrite existing worktrees. Read the authoritative package `docs/construction-envelopes/2026-10-25-voice-v1-trusted-ingress-idempotency-readiness.md`, `docs/v1-closure/TRUSTED-INGRESS-IDEMPOTENCY-DECISION-20261025.md`, V1 closure plan, and relevant continuity rules if accessible. Mark unavailable external rules UNVERIFIED rather than inventing them.

## Mission — acceptance, not another broad simulation sprint

1. Independently review PR #120 against its sole authority package and PR #118 baseline. Build a claim-to-evidence matrix for: verified Auth0 principal on /paid-mcp only; no caller-supplied identity; strict scope/audience/JWKS; operation_id binding to principal/action/text digest; duplicate, conflict, crash, lost response and UTC rollover behavior; one-shot grant and D1 atomic-batch assumption; signer-to-Worker HMAC trust; and route isolation. For each claim distinguish source code, offline test, GitHub CI, user-reported cloud state, and independently verified live state.
2. Inspect the actual public /mcp and protected /paid-mcp call paths, identity resolver, signer and qualification Worker; identify the exact missing adapter/ownership boundary. Do not assert real Auth0 principal, stable ChatGPT retry behavior, D1 cloud atomicity, private audio persistence or live key equality from synthetic tests.
3. Prepare a narrowly scoped Cloud Gate A0 packet: **read-only, zero-request** verification of account, dedicated Worker, deployed version, D1 binding/schema identity and disabled workers.dev/Version/Preview/custom routes. Use only operator-approved read-only evidence; this package itself must not access Cloudflare. Specify evidence fields, safe redaction, discrepancy STOP conditions and what cannot be verified without Cloudflare.
4. Prepare separate future approval packets, NOT actions, for: A1 secret generation/injection; A2 deployment/version; A3 temporary route enablement; A4 capped nonbillable signed requests; A5 route closure/key revocation. Each gate needs explicit total-control approval after evidence review. No gate inherits approval from another.
5. Carry forward ceilings as planning limits, not permission: 24 Worker HTTP, 18 D1-touching, 10 admission, 32 row writes, 512 rows read, 64 statements, 256 KiB, 20 minutes, zero provider. Verify exact deployed identities against evidence rather than assuming identifiers in documents remain current. Document rollback and fail-closed behavior.
6. Assess whether a *small unmounted offline-only* contract test would close a specific evidence gap; implement only if justified and without production wiring, schema change or cloud activity. Otherwise deliver documentation only. Do not duplicate existing 360/360 and 50/50 coverage without a concrete reason.

## Absolute prohibitions

No real secrets, token/JWKS private material, HMAC key creation or injection; no Cloudflare API, dashboard mutation, D1 read/write, Worker request/deploy, route or Preview enablement; no Render/Auth0 changes; no public MCP changes; no MiniMax/provider or paid API calls; no manual Actions dispatch; no merge; no Asteria-Call or Asteria-Voice-Worker edits. This document does not authorize cloud Gate A0 execution. Stop on ambiguous worktree, mismatched authority, unsafe dependency, or requirement for live evidence.

## Delivery

Write `docs/v1-closure/PR120-ACCEPTANCE-CLOUD-A0-READINESS-20261025.md` with claim/evidence table, precise blocker list, next independently approvable Gate A0 operator checklist, future A1–A5 dependency map and rollback plan. If necessary add narrowly isolated dormant tests only. Use a fresh isolated task branch from the exact authority head and open one Draft PR stacked on this authority branch; verify Node 24 full suite (including SQLite without skips), focused tests if modified, smoke, syntax, diff check, standard CI and final HEAD. Report COMPLETE / BLOCKED / TOTAL CONTROL DECISION REQUIRED, exact hashes/PR/CI, all real cloud/provider counters 0, strict V1 2/9. Do not declare live acceptance.
