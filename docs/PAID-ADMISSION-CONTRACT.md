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

## P2B — PostgreSQL implementation candidate (NOT deployed)

Added `db/001_paid_voice_budget.sql` and `src/postgres-budget-store.js`.
The adapter accepts an injected PostgreSQL pool; production must supply its
own trusted database connection and run the migration. **No database credentials
or dependencies are configured here, and the public MCP does not import it.**

A single DB transaction inserts a unique request reservation and increments a
per-principal/day UTC counter using `INSERT ... ON CONFLICT ... DO UPDATE ...
WHERE used < limit`. PostgreSQL's conflicting row update locks the daily
counter for concurrent transactions. A duplicate request, daily limit refusal,
or exception triggers rollback; reservations are never refunded after a
successful commit because the upstream could have already billed.

Offline tests verify query order, refusal paths and parameterized SQL. A real
PostgreSQL concurrency/integration test, real OAuth identity proof, atomic
one-use grant consumption and authenticated audio delivery remain REQUIRED
before production. In particular, a caller-created `oneTime:true` object
is not an acceptable authorization credential.

