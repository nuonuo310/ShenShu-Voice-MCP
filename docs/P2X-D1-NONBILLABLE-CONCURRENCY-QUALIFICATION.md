# P2X — Real Cloudflare D1 nonbillable concurrency qualification plan

Status: PLAN ONLY / STOP. No live D1 operations authorized by this document. No MiniMax calls.

## Scope and isolation
- Use existing verified OAuth principal only as an input to derive a dedicated test namespace, never the real paid principal. Test records WILL be durable D1 writes even if no MiniMax credits are spent.
- Use unique run-scoped IDs with a bounded maximum, and explicitly record UTC day and test-run identifier outside any secret-bearing logs. Never re-use historical dry-run request IDs.
- Run in a dedicated non-production D1 database when possible. If using the existing database, first inspect schema, unique indexes, namespace collision risks and record retention policy; obtain explicit operator approval for durable writes.
- Do not use or reset live paid reservations; no deletion or cleanup of historical evidence without approval.

## Qualification cases
1. Baseline schema and index read-only inspection. Confirm uniqueness of request_id, grant_id and (principal,day_utc,slot). Missing index => STOP.
2. One dry-run request: reserve -> issue -> consume, then verify consumed state with a read-only query. This is a database write, requires approval.
3. Reuse the same request ID: zero additional reservations; same grant consumed twice: exactly one successful transition. Require explicit bounds and approval.
4. Concurrent requests for one isolated principal/day with limit 3: at most 3 successful unique slots; no duplicates; no missing or ambiguous result treated as success.
5. Distinct principals/days: isolation; no cross-subject grant consumption.
6. Inject timeouts and transport failures with a fake HTTP client first; real network uncertainty must never automatically retry or refund.

## Admission and STOP gates
- Explicit approval required before any real D1 writes, even in dry-run namespace. If approval is absent, perform read-only review only.
- Maximum 12 reservation attempts in one approved test run, no automatic retries, no MiniMax or paid voice tool, no real quota principal.
- Stop immediately on missing uniqueness guarantees, unknown schema, unexpected cross-principal effects, any real paid quota change, or ambiguous API outcome.
- Store sanitized counts, observed result IDs and error categories; never store tokens, account IDs, private text or API credentials.
- This plan does NOT authorize production paid voice. Separate security review and explicit user consent are mandatory for the first billable call.

## Current evidence
- PR #41: serialized fake D1 concurrency model PASS, not real D1.
- Prior OAuth -> D1 dry-run single-call verified, but no real concurrent test has been confirmed.
- PR #42/#43/#44: offline server-owned admission, fake D1 HTTP and signed test OAuth chain PASS; no real MiniMax calls.
