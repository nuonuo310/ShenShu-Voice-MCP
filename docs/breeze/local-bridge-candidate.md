# Breeze local bridge — offline candidate

Base: `1cf9c3f8f7d196fdb9d46ab6204bcb69f80dbe2f`, the silver desktop 04 deployment.
Work branch: `codex/breeze-local-bridge-20261111`. No online deployment or D1 migration performed.

## Owner-verified local evidence

Windows Breeze v0.1.6, HEAD `87b43667ca5597f826441991e416a279ed7373b9`.
Q8_0, UHD 770 Vulkan, saved voice `shenshu_04_natural`, seed 7, cfg 1.2.
Server listens only on `127.0.0.1:8080`, WebSocket disabled.
Owner ran multipart `/v1/audio/speech` and heard/saved a 24kHz WAV via a test wrapper.
First complete request: 30.44 seconds / 4.48 seconds audio. Streaming measurement:
first returned bytes 7.66 seconds; complete 29.20 seconds / 4.48 seconds audio.
The first-byte measurement is NOT first audible playback and proves no realtime performance.
No claim that iOS playback is repaired, or that a dedicated GPU is the sole bottleneck.

## Data flow

Verified ChatGPT OAuth owner → explicit `speak_shenshu_local_breeze` → encrypted D1 job.
Windows worker makes outbound HTTPS POSTs → separately authenticated claim → local
loopback Breeze multipart request → bounded 24kHz PCM → band-limited 16kHz PCM WAV
→ encrypted D1 result parts → manifest marked ready by atomic owner/claim check.
The new independent silver resource polls READ ONLY, receives bytes through `_meta`,
then uses existing Web Audio play/pause/progress. Explicit star click signs/saves to
the EXISTING private favorites tables; full text, source, stable ID and completion
time survive reload. MiniMax favorites retain their existing receipt digest shape.

No new public audio URL, no local inbound bridge port, no provider fallback, and
no paid admission/reservation/grant table writes. The queue holds transient delivery
results, not automatic favorites. A model can enqueue text only after an explicit
local-voice request; ordinary chat must not call it.

## Files and boundaries

- `src/breeze/local-adapter.js`: exact frozen Chinese preset, loopback validation,
  no redirects/retries; 60-second/size/format checks and actual resampling.
- `src/breeze/job-store.js`, `db/d1/008_breeze_jobs.sql`: encrypted text/audio,
  owner-scoped idempotency, atomic claim, staged parts and completion publication.
- `src/breeze/worker.js`: writes a private attempt marker before synthesis; upload
  failure never triggers synthesis again. Ambiguous attempts remain closed.
- `src/breeze/worker-http.js`, `runtime.js`: separate worker-token verifier maps
  one worker to one canonical owner. Worker JSON cannot select an identity.
- `scripts/breeze/worker-once.mjs`: executable outbound client; `--loop` polls
  every 3 seconds after each completed/idle attempt and stops on unknown failures.
- `src/breeze/app-surface.js`, `ui/breeze-pending.js`: distinct tool/resource identity,
  read-only polling; manual play; no automatic paid voice submission.
- Existing `server.js`, protected shell and MCP composition receive optional Breeze
  injection. Default-off or incomplete configuration leaves existing tools/routes alone.
- Existing collection codec has explicit `allowBreeze` opt-in and authenticates
  provenance. Existing silver builder supports both sources only when enabled.

Cloud worker credentials are NOT ChatGPT user OAuth tokens. The Windows worker
does not need MiniMax API keys, Cloudflare credentials, or the encryption master key.
Only the configured owner can queue work claimable by that worker. Another OAuth
owner cannot read its jobs/audio. The worker is trusted to synthesize the assigned
text, not to prove a particular TTS engine cryptographically.

## Failure semantics

Worker polling heartbeat expires in 30 seconds. A new local request reports
unavailable when no recent heartbeat exists; it does not silently choose MiniMax.
Heartbeat is evidence of a reachable worker, not proof the Breeze server is healthy.
During a long generation the heartbeat can expire: additional requests are then
reported unavailable rather than queued behind an indefinitely busy computer.
Unclaimed jobs expire after 20 minutes. A claim expires after 15 minutes to
`unknown`, NEVER to queued. Local synthesis timeout is 10 minutes; uploads/polls
have 30-second network bounds. No automatic resynthesis of any ambiguous job.
Audio upload can be retried only with the same claim and original WAV bytes.
Attempt markers are never cleared automatically. A failed upload currently stops
the worker; spool-based upload recovery is not implemented.

## Validation and release gate

Tests cover format/pitch/duration and anti-aliasing, exact preset/loopback, enqueue
deduplication, competing claims, expiry freeze, owner isolation, SQLite reopen,
partial upload, conflicting result rejection, encrypted storage, one synthesis on
upload failure, authenticated HTTP, SDK tool/resource visibility and DOM playback
plus favorite readiness. Fake local synthesis only; no MiniMax or owner PC calls.
Final test counts are reported in the PR and handoff.

Still NOT proven: real Windows worker → real HTTPS/D1 → ChatGPT polling → audible
playback → favorite/reload. UI DOM success is not audible host acceptance.

### Desktop acceptance repair (2026-11-11)

The owner reported a completed 2.8-second local generation and a ChatGPT card
showing the text, duration and ready status. Clicking play left the Web Audio
diagnostic at context not-created/decode not-started. The generated Breeze UI
accepted the record but the final playback function still allowed only MiniMax
and private fixtures. The repair adds Breeze to that guard only when allowBreeze
is enabled; the default MiniMax UI and base template are unchanged.

The DOM regression now clicks the real button, checks decoded original bytes,
source.start, 50% progress and stop, rather than checking readiness alone. It also
reopens a completed request by reading its existing result, with no enqueue or
synthesis, then plays those same bytes. Real audible playback remains unverified.
Windows worker files do not change in this repair. Keep the same request key for
acceptance recovery; do not issue another generation to repair playback.

Before any online rollout:
1. Retain existing exact live SHA and a manual rollback path. No branch merge.
2. Review/approve this candidate, provision a separate random 32-byte worker token
   privately and bind its canonical owner server-side. Never put tokens in chat,
   URLs, screenshots or repository files.
3. Apply additive `008` only to the existing qualification database, never budget-test.
4. Configure `SHENSHU_BREEZE_ENABLED=1`, `SHENSHU_BREEZE_APPROVED_SHA` exact commit,
   `SHENSHU_BREEZE_WORKER_PRINCIPAL`, `SHENSHU_BREEZE_WORKER_TOKEN`; retain silver
   and collection flags. Existing master key/D1/auth stay unchanged.
5. Configure local Node 24 worker environment: `SHENSHU_BREEZE_QUEUE_ORIGIN` HTTPS,
   same private worker token, `SHENSHU_BREEZE_WORKER_STATE` private persistent folder,
   optionally `SHENSHU_BREEZE_LOCAL_ORIGIN` (loopback only).
6. Render environment edits MUST use Save only. Its environment connector can
   trigger a wrong-branch deploy even with auto-deploy off. Use Manual Deploy →
   Deploy a specific commit, approved SHA identical to candidate. Existing desktop
   approved-SHA guard must be updated consistently to preserve MiniMax availability.
7. Refresh ChatGPT tools. Confirm worker online/nonbillable resource before requesting
   one new local voice. Then explicit favorite and open a new gallery to replay.

Disable Breeze flag/restore approved live configuration to roll back. Existing
MiniMax model/voice/speed/budget and its generation adapter remain unchanged.
Keep published favorites. Queue deletion/retention migration is not implemented;
before sustained use define bounded retention for encrypted jobs/parts and owner
revocation. First rollout must remain a bounded acceptance test, not unattended use.
