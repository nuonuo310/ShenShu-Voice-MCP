# P2X — Voice MCP qualification checkpoint (2026-10-21)

## Verified source and CI
- Desktop and iPhone: operator-confirmed manual playback of fixed nonbillable WAV via OAuth MCP host bridge and Web Audio. This is NOT actual MiniMax speech.
- Real D1 Console: operator-reported reservation/grant uniqueness, PRAGMA foreign_keys=1, foreign_key_check no violation rows, test namespace collision count 0. These are read-only observations, not real concurrency evidence.
- GitHub Actions manual D1 read-only preflight: operator reported green success after configuring a separate Cloudflare D1 Read token and account/database IDs as GitHub Secrets. Exact run logs not independently retrieved; do not overstate provenance.
- PR #57 bounded unmounted concurrency core merged 35881a3. PR #58 hard-scoped dryrun write adapter merged 9ec776b. PR #59 grant issue principal binding merged 51f4366. PR #60 scoped adapter + core fake-D1 integration merged b848b9e. PR #61 single-use in-process request guards merged 6de21ac; CI #283 PASS.
- PR #55 postflight read-only verifier merged a35fcb7; PR #56 cross-principal audit fix merged 70f1acc. PR #54 opt-in read-only GitHub workflow merged 5840627.

## Current gates / STOP
- Real D1 concurrent writes have NOT been executed. No paid MiniMax calls, no real voice route enabled. Do not infer production authorization from passing fake tests.
- Existing GitHub CF_D1_READONLY_API_TOKEN is READ ONLY; never use it for writes. Render's existing write-capable token must not be copied or rotated for this qualification.
- Proposed real test batch is fixed to dryrun_qualification_p2x_20261020_a, day 2026-10-20, run ID p2x20261020a, 12 distinct requests, limit 3; at most 3 reservations + 3 grants, no retries. User agreed to this bounded nonbillable scope; exact live execution still requires validating target, credentials and safety gates.
- Scoped adapter's single-use sets are per process, NOT durable across process restarts. Database uniqueness is a necessary separate control.
- 12 in-flight requests cannot be rolled back if network fails. Ambiguous outcome => STOP, read-only evidence, no retry or automatic cleanup.
- Current scoped adapter is unmounted; no GitHub write workflow, no public MCP write tool, and no production activation.

## Next work
1. Independently review SQL reserve/issue/consume and hard-scoped adapter against exact live schema and D1 HTTP semantics; add targeted regression tests for concurrency and ambiguous outcomes.
2. Design an isolated manual GitHub Actions write runner with separate least-privilege write token, explicit one-time admission, and bounded immutable run ID. Do not activate or dispatch until reviewed.
3. Wire read-only postflight with exact namespace and fail-closed interpretation; capture observed rows and no retry.
4. After a separately reviewed live D1 qualification PASS, review verified OAuth principal -> durable consumed grant -> MiniMax integration and explicit billable user consent.

## User interaction rule
Do as much read-only/code/CI work as possible without operator steps. Ask user only when a concrete console action or explicit billing/write approval is needed. Never request secrets in chat.
