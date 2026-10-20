# P2X D1 real concurrency execution gate — approval required

This is an operator runbook, NOT an instruction to execute. Current status: STOP / no write authorization.

## Confirmed read-only preflight
- Operator-observed real D1 table definitions include PRIMARY KEY(request_id), UNIQUE(principal,day_utc,slot), PRIMARY KEY(grant_id), UNIQUE(grants.request_id), and a grant->reservation foreign key.
- In the operator's D1 Console connection, PRAGMA foreign_keys=1 and PRAGMA foreign_key_check returned no violations.
- No real concurrent D1 request test has been executed in this phase. Offline CI is not a substitute.

## Proposed bounded nonbillable write session (not yet approved)
- Prefer a separate non-production D1 database; if using the existing database, explicitly confirm its identity and existing test namespace occupancy before execution.
- One new run-scoped dryrun_ principal, one UTC date, limit=3 slots, at most 12 unique reservation attempts, no retries.
- At most 3 successful reservations and at most 3 corresponding grant issue+consume transitions, provided all unique constraints hold. Other requests must be refused.
- Expected maximum new rows: 3 reservation rows + 3 grant rows. Never delete or reset existing rows automatically.
- Collect counts and nonsecret run identifiers only; do not expose tokens, API keys or generated/private audio.
- No MiniMax, no paid voice route, no real quota principal, no payment authorization.

## STOP conditions
- Any schema mismatch, unexpected pre-existing run namespace occupancy, ambiguity about target D1 database, unexpected more than 3 successful slots, wrong-principal grant consumption, failed/ambiguous API response, or any impact on real paid quota => STOP immediately.
- Any error must be reported without automatic retry. No cleanup of durable evidence without separate approval.

## Operator approval required
Before the first D1 write, ask the operator to approve the exact target database (prefer staging), UTC day, test principal/run ID, at-most-12 attempt limit, at-most-6 durable rows, and no-retry policy. Approval of this runbook or GitHub merge is NOT execution approval.

## After approved execution
Record only observed pass/fail counts, query timing and error categories, and retain an explicit distinction between structural integrity and real concurrency behavior. Production paid MiniMax remains closed pending separate authorization.
