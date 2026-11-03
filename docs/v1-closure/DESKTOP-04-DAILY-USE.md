# Desktop 04 — occasional use

The owner heard one real 04 reply in the desktop ChatGPT card on 2026-11-04.
That accepted audio path and the fixed voice/model remain unchanged. This
cleanup prepares ordinary use; it does not claim all Voice V1 gates complete.

## What the owner does

Ask for a short reply to be read aloud. The assistant keeps the text in chat
and prepares the same exact text in a nonbillable confirmation card. Review it,
click confirmation once, then click play. Playback in the loaded card may be
repeated without another synthesis. The card does not promise audio retention
after refresh or reopening. Each text is bounded by the existing 800 UTF-8-byte
contract; do not silently truncate a longer reply or split it into paid calls.

One generated segment per UTC day remains the fixed cap, resetting at 08:00
Beijing time. Preparing a card alone does not consume paid quota. Same-day
existing completed/unknown reservations continue to count; never clear or
bypass them to make a second attempt. An expired unused card can be prepared
again without synthesis. A used or uncertain card must never be regenerated.

## Cleanup

- Dedicated `ui://shenshu/desktop-04-bubble-v1.html` resource, separate from the
  diagnostic fixture. Debug controls, capability dumps and unused favorite are
  hidden; light/dark text colors and the confirmation panel are readable.
- Exact text, confirmation and play remain. Confirmation panel is hidden after
  audio arrives; metadata/size preflight still runs before charging is enabled.
- Expired proposals explicitly say expired and keep the card visible/disabled,
  rather than reporting a generic invalid result. No RPC is sent for them.
- Known expiry, used-card and quota denials have bounded, safe result codes.
  Unknown provider/network outcomes still stop without retry or refund.
- Host RPC silence has a 90-second timeout. Late replies are ignored; the
  timeout never retries a provider operation.

## One-time deployment setup

Existing Render service: `srv-dbcgcsom7kps739tfpo0`, My Workspace
`tea-dbb28o5g1s2s73e0bfb0`. Do not create a new service.

The existing configured branch is an old P1 branch. The Render env-update MCP
also deploys that configured branch automatically, even with autoDeploy OFF.
Therefore first change the service branch to the reviewed release branch
`deploy/desktop-04-v1`; keep automatic deployment OFF. The release branch must
remain pinned to its reviewed code commit. Only after checking that service
setting, merge the reviewed exact SHA plus desktop/paid enable flags into the
existing environment. Preserve all existing secret values. This will deploy the
correct branch with the new configuration. Verify live SHA, `desktop04_ready`
and `desktop04_mounted:true`, then refresh ChatGPT MCP tools once.

Normal use thereafter needs no Render toggles or redeploy per reply: only an
explicit click in each card can synthesize, and the durable daily cap applies.
Deployment/configuration readiness does not authorize the assistant to call
confirmation itself. The owner clicks it in the card. No automatic synthesis,
new provider calls or additional paid trial is part of this cleanup.

Emergency stop: set desktop flag and all four paid flags to 0. The same env
update may deploy the release branch but it will start with paid tools absent.
Verify login reports paid disabled. Keep old completed/unknown D1 evidence.

## Validation and actual rollout state

Local Node 24: 477/477 pass, zero failures/skips; HTTP smoke passes. Coverage
includes authenticated HTTP clean-resource delivery, expiry visibility, quota
messaging, host timeout, late replies, no automatic retry, sealed admission,
concurrent/replayed confirmations, and fake provider failures.
Browser screenshot validation is not claimed: this runtime had no browser
binary and the attempted headless browser download was invalid. Rendered
light/dark appearance must be checked in the owner host after deployment.
No local preview script is included in the deliverable.

The previous one-trial shutdown deployment `dep-dbl1q7ajnfac73a8i3t0` was
independently verified live and OAuth login reported paid disabled. This
cleanup has not yet altered Render's branch or re-enabled paid generation.
