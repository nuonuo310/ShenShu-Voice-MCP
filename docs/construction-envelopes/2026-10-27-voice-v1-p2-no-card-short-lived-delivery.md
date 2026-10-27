# Voice V1 P2 — no-card short-lived private delivery GO/NO-GO (2026-10-27)

Authority: ShenShu total control. Parent PR #139 HEAD `8d971704161b2d82553eb3689f8588c18631a531`. User explicitly requires no payment card and no new paid storage/billing; R2 provisioning approval is suspended. P1 private nonbillable fixed WAV audibly passed desktop and iPhone Safari. P2 remains offline-only, V1 2/9, B1–B4 open.

## Single goal and hard STOP
Within one offline cycle, determine whether existing Render free Web Service plus already-provisioned D1 (paid admission/idempotency metadata ONLY, no WAV) can deliver an occasional-use V1 with short-lived per-principal in-memory audio and an explicit user-triggered local save/download option, without unsafe duplicate billing. If feasible, implement the minimum dormant offline candidate and tests. If paid synthesis can complete but audio may be lost before authenticated retrieval due to restart/sleep, analyze whether fail-closed unrecoverable result is an acceptable bounded limitation for the user's chosen occasional-use product; do not pretend it is durable or guaranteed. If no safe, understandable model exists, return BLOCKED with exactly one next decision. Do not invent a new storage platform or add further route families.

## Opening gate
Verify exact repo/origin, clean isolated worktree, parent SHA, PR #139 and CI. Read P1 and P2 modules, `src/p2-private-result-store.js`, `src/v1-offline-paid-pipeline.js`, protected MCP/auth identity and existing D1/operation adapters from authoritative historical stacks (read-only), current Render staging/free service metadata, V1 closure plan and Cloud A0 decisions. Clearly separate what is proven by code from live behavior.

## Required design and constraints
- One canonical Auth0 principal across ChatGPT MCP request and standalone player; never accept client-supplied principal, operation ID, model, voice, grant or replay authority.
- D1 records operation status/unique stable operation ID and one-use admission; enforce no second provider call across retry, concurrent requests, reconnect or Render restart. If stable server-owned operation identity cannot be derived/persisted safely, STOP and report BLOCKED rather than fake it.
- Audio only in bounded in-memory cache for one principal, latest one result, <=2 MiB validated WAV, max 300s logical TTL, eviction/zeroization best effort, no unbounded accumulation, no public URL or bearer query, no chat audio message, no cross-user fetch, no automatic retries. Do not claim memory persists through spin-down or deploy.
- On restart after provider success but before user retrieval, D1 must show a consumed/unknown/undeliverable operation; never retry automatically or charge again for the same operation. User-facing state must honestly say audio unavailable. Any manual new generation must be a separate explicit action and new quota charge.
- User-initiated local save only after authorized retrieval; downloaded audio on device is outside server retention guarantee. Validate `Content-Disposition`, cache/privacy headers and avoid leaking audio into logs. On iPhone Safari, download UX is not proven by offline tests.
- No card, no R2, no paid Render DB/disk, no new infrastructure. No MiniMax calls in this round, no D1 real SQL, no production/deployment or live MCP. P1 fixed fixture and public MOCK unchanged.
- No expansion to voice gallery, PWA, Asteria Chat, streaming or subscription billing.
- Prefer a narrow prototype if safety can be established. Tests must include restart/replay, principal isolation, TTL, expiry, concurrent duplicate operation, unknown provider outcome, missing audio, explicit local save, quota preservation and no automatic retry.
- Strict V1 9 gates unchanged. Mark whether the absence of durable media violates the current V1 scope and ask total-control to accept/reject an explicit short-lived best-effort delivery limitation; never silently lower gate 6 or 7.

## Deliverable
One `docs/v1-closure/V1-P2-NO-CARD-SHORT-LIVED-DELIVERY-20261027.md`, optional narrow code/test diff only if justified, one stacked Draft PR. If code changes: Node24 full zero-skip, focused tests, smoke, syntax/diff, normal CI. Otherwise diff and normal CI. Report COMPLETE/BLOCKED/TOTAL CONTROL DECISION REQUIRED, exact HEAD/PR/CI, user-visible limitation, one next decision. No live Render/Auth0/Cloudflare/D1/Worker/provider/real MCP/secret/deploy/merge/manual Actions. Voice V1 2/9. STOP.
