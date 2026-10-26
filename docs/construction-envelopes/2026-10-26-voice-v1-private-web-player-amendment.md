# Voice V1 — User-approved private web player scope amendment (2026-10-26)

Authority: ShenShu total control. The user explicitly selected option 3: one standalone authenticated private mobile web player for V1. This amends the playback entrypoint only; the nine V1 security and completion gates remain binding, with Gate 6 interpreted as authenticated private audio playable in the standalone browser on desktop AND iPhone rather than inside the ChatGPT MCP Apps iframe. No claim of V1 completion: 2/9, B1-B4 open.

## Product DONE
User requests one short voice generation through the ChatGPT MCP flow; trusted server authenticates, enforces per-user bounded quota and one-use grant, fixes model/voice, attempts provider at most once, validates bounded WAV, stores/delivers audio privately, and offers the user a deliberate authenticated entry into a standalone mobile-friendly playback page. The user logs in through a normal trusted session, sees only their own authorized audio, taps play and hears it on iPhone; desktop also works. No bearer/token/capability in URL, no publicly reachable audio file, no audio inserted into ChatGPT conversation as an audio content block, no auto-play, no automatic retry or duplicate provider charge. If a safe ChatGPT-to-player handoff cannot be demonstrated without URL secrets, design an authenticated inbox listing for the signed-in principal (latest bounded result) rather than a privileged deep link. ChatGPT can direct the user to the stable nonsecret player origin; the user opens it and authenticates. Occasional subsequent use requires separately approved daily/length/spend limits and safe stop control, not a full billing platform.

## NOT V1
No ChatGPT embedded private player, Asteria Chat integration, PWA/lockscreen widgets, native app, streaming calls, interruption, emotion voices, auto-speak, favorites, history/archive, multiple models/voices, commercial multi-user billing, or broad redesign. Reuse existing verified S2/offline pipeline and staging infrastructure; do not rebuild it.

## Task: bounded architecture-to-implementation readiness, not a new feasibility carousel
Read V1-CLOSURE-PLAN.md, PR #132 host stop gate, S1/S2 evidence, existing auth/private-audio modules, current Render staging and D1 contracts. Map exactly the minimum modules/routes/pages needed for one standalone player. Prefer a single authenticated origin and session boundary; examine CSRF, cookies, TTL, principal isolation, one-time/limited retrieval, MIME/size and browser audio playback. Never assume browser cookies, cross-origin login, private storage or real iPhone audibility from offline tests. Distinguish which current modules can be reused from which exact missing components must be built.

Produce one implementable 2-stage plan:
P1 nonbillable private fixed-WAV login + player on desktop/iPhone, with no D1 or provider;
P2 connect existing one-shot paid pipeline after independent D1/security gates, then one explicitly approved MiniMax E2E smoke and bounded daily usability.
One concrete staging deployment candidate after P1, one iPhone acceptance and STOP rule. No extra research PR loop. If P1 can be implemented safely offline with existing infrastructure and a narrow diff, implement it now; otherwise identify exactly one blocking dependency and STOP.

## Absolute restrictions
No live Render/Auth0, Cloudflare/D1, Worker, secrets, provider/MiniMax, real MCP invocation, deployment, route enablement, production main, merge or Asteria-Call/Visual-World changes. No public audio URLs, bearer URLs, chat audio content messages, provider retry or bypass of authentication.

## Delivery
Verify origin, exact PR #132 head cb35a9f3e6d4382499c29f9b1c5942c302ff53f2, clean isolated worktree, PR chain, CI. Add `docs/v1-closure/V1-PRIVATE-WEB-PLAYER-AMENDMENT-20261026.md`, minimal implementation/tests only if justified. If code changes run Node24 full zero-skip, focused security tests, smoke/syntax/diff, normal CI. One stacked Draft PR. Report COMPLETE/BLOCKED/TOTAL CONTROL DECISION REQUIRED, exact HEAD/PR/CI, next action, real operation counters 0, strict V1 2/9. Stop.
