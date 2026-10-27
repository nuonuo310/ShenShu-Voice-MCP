# Voice V1 P2 — D1 explicit-confirm qualification readiness (2026-10-27)

Authority: ShenShu Total Control. Exact parent PR #144 HEAD 72c6a58be308544e3b5388632120453efb2da7e2; PR CI run 40533096965 success. Existing P1 authenticated standalone player was audibly confirmed on iPhone Safari and desktop for fixed nonbillable WAV. User has stable 04 cloned voice but no new generated speech yet. V1 2/9; B1–B4 OPEN. Paid P2 OFF.

## Goal: finish minimum executable D1 gate, not another general architecture study
One bounded OFFLINE readiness/implementation cycle for real D1 atomic confirmation before any paid provider use. Read PR #144 explicit-confirm module, pending/confirm state machine, player Auth0/CSRF and protected MCP verifier; read existing D1 001/002/003 migration, historical Worker/admission adapters, A0–A5 safety plan, current qualification D1 identity and frozen nine gates. Do not assume unmerged historical Worker source exists in current tree.

Define/implement smallest dormant D1-backed operation state + atomic claim contract for user-confirmed generation: nonbillable MCP initiate/status only; same-origin signed player session + Origin/CSRF protected explicit confirm; canonical principal; durable pending and one-use claim; atomic quota/grant + operation transition where necessary. Test retries, duplicate clicks, concurrent confirms, reconnect, Render restart, ambiguous response and unknown provider outcome. No model-accessible confirm path, no client-authored billing authority. If D1 REST API cannot provide required transaction/atomicity, STOP rather than approximating with separate non-atomic calls. Include exact migration requirements and rollback/closure, and a fixed nonbillable live qualification request matrix that is *separately authorized later*.

A0–A5 must remain independent approvals: read-only identity reconciliation, test credentials, exact reviewed build, temporary closed-by-default route, strictly bounded real D1 nonbillable qualification, then close/revoke. No test traffic until A5 closure ready. Never touch old forbidden D1. No MiniMax/provider call. No paid activation. No deployment.

## Explicit boundaries
No Qiniu/Kodo provisioning yet: the account shows Singapore 10GB free standard storage, but egress/overage and account no-card billing remain unverified. Do not make storage choice part of this D1 operation qualification. Preserve P1 working staging, no new UI features or login changes. A real paid E2E remains separate explicit authorization, after D1 and storage/identity gates.

## Deliverable
Verify repo/origin, clean isolated worktree, exact parent, PR #144 CI, historical schema evidence. Deliver docs/v1-closure/V1-P2-D1-CONFIRM-QUALIFICATION-20261027.md plus only necessary narrow dormant code/migrations/tests, one stacked Draft PR. If code changes Node24 full zero-skip suite, focused tests, smoke, syntax, diff check, normal CI. If blocked give one concrete missing capability/next decision, not a report carousel. Report exact HEAD/tree/PR/CI, COMPLETE/BLOCKED/DECISION REQUIRED and V1 2/9. STOP.

## Absolute prohibitions
No real Cloudflare/D1/Worker/R2/Kodo/Render/Auth0 API requests or mutations, no provider/MiniMax, real MCP, deployment, secrets, manual Actions dispatch, merge, other Asteria repos. One offline cycle only.
