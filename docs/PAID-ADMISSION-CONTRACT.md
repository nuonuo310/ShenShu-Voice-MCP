# Paid admission contract — not activated

The deployed `/mcp` endpoint still only exposes the non-billable `preview_shenshu_voice` tool.

`src/paid-budget-gate.js` provides a strict **interface** for a future authenticated paid MCP operation, **not a deployed authentication system**. Its test store is in-memory only and must never be used in production.

## Required production guarantees

- Verify identity cryptographically in a trusted reverse proxy or OAuth flow. Reject tool-supplied names, claimed identities, unsigned headers and authentication absent/expired.
- Configure a durable, transactional store implementing `reserveAtomic`. Reserve a per-principal UTC daily count and unique request ID together, atomically. For production, use SQL transaction with unique request ID plus a serialized counter update; do not use local process memory on Render.
- Never refund reservations on failed/unknown upstream attempts: a provider may still charge. Do not automatically retry uncertain outcomes.
- Reserve before calling MiniMax. The auth gate must be applied to *every* paid entry point including background requests.
- Default to disabled, limit initially 3 attempts/day (adjust only with user approval). Budget limit must also account for the **shared** MiniMax Call account: a voice MCP limit cannot guarantee a separate money pool.
- Do not pass the MiniMax key, voice ID, authentication bearer or user credentials into ChatGPT-visible MCP arguments, tool results, iframe data or source control.
- Treat one-time grants as untrusted if a caller can fabricate the result. In production, bind reservation identity to invocation and consume it server-side, rather than accepting a `{oneTime:true}` object from the client.
- Complete validated audio delivery (short-lived/private, no public permanent URLs) and ChatGPT UI testing before enabling.
- Keep the original Asteria-Call and Asteria-Voice-Worker unmodified.

**CURRENT STATUS:** gate contract + isolated tests only. **NOT permission to enable live generation.**
