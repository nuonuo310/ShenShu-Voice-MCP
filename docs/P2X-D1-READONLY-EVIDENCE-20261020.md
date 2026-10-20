# P2X — D1 read-only schema evidence checkpoint (2026-10-20)

**Evidence provenance:** operator-reported output from Cloudflare D1 Console. This is not an independently fetched API response. No live D1 query was executed by this repository change.

## Observed schema and checks

- `paid_voice_reservations`: `request_id TEXT PRIMARY KEY NOT NULL`; `UNIQUE(principal, day_utc, slot)`; `slot` constrained between 1 and 20. Nonunique supporting index `paid_voice_reservations_by_owner_day` on principal/day.
- `paid_voice_grants`: `grant_id TEXT PRIMARY KEY NOT NULL`; `request_id TEXT NOT NULL UNIQUE`; `state` constrained to `issued` or `consumed`; foreign key from request_id to reservation request_id. Supporting nonunique principal/state index.
- `PRAGMA foreign_keys` returned `1` in the observed Console connection. This does not guarantee every separate connection is configured identically.
- `PRAGMA foreign_key_check` executed successfully with no violation rows reported. This is a snapshot, not a concurrency or historical consistency proof.

## Remaining qualification gates

- Do not infer successful concurrent reservation semantics solely from schema/indexes. Verify actual Cloudflare D1 execution behavior with a separately authorized bounded test run.
- The existing `dryrun_` namespace avoids the real principal but still creates durable rows. A real concurrency test requires explicit operator approval and a fixed write budget.
- Before any write, confirm run-specific namespace, existing occupancy, intended UTC day, and whether a dedicated test database is available. Prefer separate non-production D1.
- Ensure the service-side admission callback consumes a grant before any synth invocation, never retries ambiguous writes, and never accepts user-provided principal/grant flags.
- Do not enable MiniMax or paid MCP tools based on this checkpoint. No production release approval is implied.

## Next step (no user action yet)

Prepare a bounded nonbillable qualification script and its offline tests, with a dry-run/read-only mode that prints SQL and expected invariants but cannot write without an explicit separately approved execution gate. Preserve existing D1 data; no cleanup or resets.
