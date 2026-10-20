# Optional remote Cloudflare D1 concurrency probe

This is an operator-only **test database** script, not a deployed Worker,
OAuth implementation or MiniMax integration. It uses the same SQL text as
`src/d1-budget-store.js`, with only script-generated safe test IDs.

`node scripts/d1-remote-concurrency.mjs` is a **zero-network dry run**.

Actual remote execution requires the owner's existing authenticated Wrangler
session and an installed `wrangler` CLI. It is deliberately not invoked by CI
or ChatGPT. Never paste Cloudflare API tokens into chat or GitHub.

After authentication and permissions are verified, the operator may run:

```
node scripts/d1-remote-concurrency.mjs --execute-remote
```

The script makes eight concurrent D1 SQL reservations using a fresh isolated
`probe_...` principal for the current UTC day with limit 3, and verifies
the stored row count. Errors never retry. It prints aggregate counts only.
Some operations can be rejected by SQLite contention; this counts as a safe
denial. The probe leaves its uniquely named test rows in the test database to
preserve auditability, and does not alter `test_owner` rows.

**Stop conditions:** Unexpected Wrangler output, D1 unavailability, >3
admissions, count mismatch, unknown slot values, or no successful reservation.
A failed remote result must never be used as evidence to enable paid TTS.

Cloud D1 database-level concurrency alone does not validate authentication,
one-time authorization consumption, Worker binding behavior, private audio
delivery, or safety of the live MiniMax path. All remain hard blockers.
