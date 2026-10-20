# P2X — Voice delivery and paid-call binding gate (design only)

Status: DESIGN / NOT AUTHORIZED TO ENABLE PAID SPEECH.

## Verified baseline
- OAuth -> D1 nonbillable admission dry-run PASS (reported once, 2026-10-20); paid_voice_enabled=false.
- Existing public /mcp player supports fixture HTTPS MP3 and inline/hosted short WAV tones; this does NOT establish private authenticated audio delivery or live MiniMax playback.
- Existing MiniMax adapter and live-voice core are isolated, not registered on paid MCP.

## Hard blockers before a billable smoke test
1. Server-owned authorization: verify OAuth on every request; reserve durable per-principal/day budget; issue and consume one-time D1 grant server-side before exactly one upstream call. No client-provided allowed/oneTime flags; bind request ID, verified principal and invocation. A second consumption or concurrent duplicate must fail closed.
2. Uncertain outcomes: after grant consumed, upstream timeout, disconnect or unknown response must NOT automatically retry, refund or issue a second grant. Persist sufficient nonsecret status for reconciliation without exposing principal or tokens.
3. Budget: default 3 paid attempts per verified user UTC day, fail closed on store errors; account for shared MiniMax upstream budget separately.
4. Audio: test a nonbillable realistic speech fixture through a private authenticated, short-lived delivery path on ChatGPT desktop and iPhone. No permanent public audio URLs, credentials in query strings, or public endpoint exposing generated voice. Validate format, duration, size, playback and CSP. Existing public fixture player is not a substitute.
5. Negative tests: no/expired/wrong-scope OAuth, forged identity, parallel duplicate request/grant, replay, limit exhausted, D1 unavailable, D1 timeout, consume failure, upstream timeout, oversized/invalid audio, mobile playback denial.
6. Release: paid tool absent by default; inspect actual OAuth tools/list before and after changes. Never put MiniMax key into GitHub, tool args or results. Require user's explicit permission for first billable request and no automatic retry.

## Current work authorization
Offline contract review, fixture tests and implementation in a separate PR only. No deployment, D1 live mutations, MiniMax secret provisioning, or billable calls. Preserve Asteria-Call/Voice-Worker freeze.

## Source review notes
- src/paid-budget-gate.js currently returns an allowed/oneTime-shaped object after reserveAtomic, but does not itself consume a durable one-time grant.
- src/live-voice.js checks those object fields and calls synthesize; this is not a production-proof binding.
- src/d1-paid-store.js contains reserve/issue/consume SQL; wiring into the paid voice invocation remains unimplemented.
- ui/mcp-bubble.html accepts fixture/hosted-tone paths only; it explicitly rejects unrecognized generated audio sources.
