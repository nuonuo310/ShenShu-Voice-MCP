# Desktop 04 — speech only when requested

The owner heard a real 04 reply in desktop ChatGPT on 2026-11-04. After asking
why a second confirmation was necessary, she explicitly chose this policy:
ask for voice in chat → generate 04 → click play. Ordinary chat remains text.
This supersedes the initial one-per-day, click-each-card trial policy.

## Everyday use

When the owner clearly asks to hear a short reply, keep that exact text in the
chat and invoke `speak_shenshu_desktop_04`. Do not use it for ordinary chat or
infer a request for speech from general affection. The server-only standing
policy flag must be enabled before this tool is even registered.

The card performs the existing component-only metadata and capacity checks,
then automatically makes one authenticated app-side generation request. There
is no second confirmation button for this requested-speech mode. Playback
still requires the owner to press play; no autoplay is added. The old prepare
preview remains nonbillable/manual and is not the normal on-request entry.

Each explicit owner request gets one stable `requestKey` (8–128 allowed ASCII
identifier characters). Keep it unchanged for that request's retries. The
server derives owner-bound stable handle and operation ID, stores sealed exact
text, and rejects changed text on the same key. Concurrent preparation or a
process restart cannot create another operation for the same request. A used,
expired or uncertain operation never regenerates on retry. A genuinely new
owner request gets a new key; do not change keys to retry uncertain outcomes.

Ten segments per UTC day is the fixed cap for the standing on-request policy,
resetting at 08:00 Beijing time. Existing daily reservations count. The D1
schema already permits up to 20 slots, so no cloud migration is necessary;
only the explicitly enabled desktop policy accepts 10. Default legacy stores
retain their former maximum. The single-statement claim and consumed-grant
trigger, fixed 04 voice/model and no-retry provider adapter remain unchanged.

Preparing the request itself does not consume paid quota, but presenting its
card can start the authorized generation after preflight. This is why the
speech-request tool is annotated as potentially billable and is used only for
explicit requests. The assistant must not call the app-only confirmation tool
directly. Audio returns only through component `_meta`, not model-visible
fields or a public URL. No Kodo upload is added.

Each text still has the existing 800 UTF-8-byte bound. Do not silently truncate
a longer reply or split it into paid calls. Playback in the loaded card may be
repeated without synthesis. Audio retention after refresh/reopening is not
promised. Unknown provider outcomes stay used and do not refund the slot.

## Deployment and stop

Existing service: `srv-dbcgcsom7kps739tfpo0`, My Workspace
`tea-dbb28o5g1s2s73e0bfb0`. Its reviewed branch is `deploy/desktop-04-v1`;
autoDeploy stays OFF. Render env-update MCP automatically deploys the configured
branch. Verify that branch and its reviewed SHA before any config update.

Keep the existing exact-SHA, OAuth, sealed D1, fixed voice and independent paid
gates. Additionally enable `SHENSHU_DESKTOP_04_ON_REQUEST_ENABLED=1` only with
the owner's standing authorization. It selects the 10-slot store and registers
the requested-speech tool; omitting it preserves the old manual one-slot mode.
Update the approved SHA with the reviewed release SHA before deployment.
Verify live SHA, `desktop04_ready`, `desktop04_on_request_enabled:true` and
`desktop04_daily_limit:10`, then refresh ChatGPT MCP tools once.

Normal use needs no Render toggle/redeploy per reply. To disable on-request
speech, set its policy flag to 0. To stop all paid desktop generation, set the
desktop flag and all four paid flags to 0 and verify paid tools absent. Preserve
all completed/unknown D1 evidence. Never clear quota to make another attempt.

## Validation and remaining limits

Local Node 24: 484/484 pass, zero failures/skips; HTTP smoke passes. New tests
cover no-click generation only after both host probes, no generation on failed
metadata, concurrent/stable request identity, factory recreation, changed-text
rejection, exactly 10 admissions and denied 11th/12th, and no uncertain retries.
Only synthetic local SQLite/JWT/WAV and fake provider transport were used.
No additional real synthesis was made while implementing the requested mode.

The previously accepted real audio playback path is retained. Rendered
light/dark screenshots were not locally verified because the browser binary
was unavailable and its download failed. The new requested-speech UX still
needs its first owner-host check after deployment. This does not declare all
nine Voice V1 gates complete or establish iPhone support/long-term replay.
