# P2 — Live MiniMax voice: code staged, tool CLOSED

The public Render `/mcp` presently uses **No authentication** and runs the non-billable `preview_shenshu_voice` tool. Keep this unchanged.

## Implemented

- `src/minimax-adapter.js`: single MiniMax API call, fixed WAV output and validator, no automatic retry.
- `src/live-voice.js`: an isolated paid-core function with **mandatory authorize callback**, one-time grant flag, byte and duration guards, no logging and no public audio hosting.
- Offline fake-TTS tests only. These make **zero paid MiniMax calls**.

## Explicitly NOT implemented

- No public `speak_shenshu` MCP tool, no OAuth identity provider, no per-user usage quota ledger, no credential provisioning, no provider-side billing guard.
- No deployed live audio generation, and no proof ChatGPT's iframe will accept an inlined WAV payload of up to 2 MB.
- No production audio archive, no shared favorites, no autoplay or segmentation.

## Gate before connecting paid functionality

1. Add an authenticated MCP transport or trusted identity gateway with verified user principal. Do not treat tool arguments, arbitrary prompts or a user-supplied Boolean as identity.
2. Add an atomic, durable one-time budget reservation and upper bound on total daily calls. Requests denied without a grant must never reach MiniMax.
3. Test the chosen audio delivery path in ChatGPT on desktop and iPhone: short audio first, ensure size and CSP compliance. Avoid permanent public audio links and bearer tokens in query parameters.
4. Provide secrets only through the trusted deploy environment, NEVER GitHub commits, screenshots or tool arguments.
5. Keep `/mcp` MOCK until a separately confirmed authenticated route is ready. Preserve original Asteria-Call/Voice-Worker and gallery.
6. Get explicit approval before the first paid end-to-end attempt.

Security of future integration is **NOT** implied by the existence of the staged core.
