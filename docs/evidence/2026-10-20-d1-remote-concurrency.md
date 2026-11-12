# D1 remote concurrency probe — operator-reported result

Status: **REMOTE DATABASE PROBE PASS (operator-reported)**, not production admission approval.

The user ran the checked-in `scripts/d1-remote-concurrency.mjs --execute-remote` on their Windows host with an existing authenticated Wrangler session, targeting dedicated Cloudflare D1 test database `shenshu-voice-budget-test`.

Reported terminal result:

```json
{
  "attempts": 8,
  "limit": 3,
  "admitted": 3,
  "denied": 5,
  "uncertain": 0,
  "rows": 3,
  "valid": true,
  "remoteCloudD1Test": true
}
```

Interpretation: eight concurrent requests for a new isolated principal yielded three admitted slots, five denials, no uncertain results, and three observed rows. No over-admission was observed.

Evidence quality: user-provided terminal output. This document is NOT independently authenticated Cloudflare execution telemetry and contains no database secrets, account IDs, or tokens. No second probe has been run for this record.

Limitations / next gates:
- Does not validate OAuth identity or authorization and cannot prove strangers are blocked.
- Does not prove paid-MiniMax one-time invocation binding or protect shared upstream account balances.
- Does not validate production Worker bindings, audio delivery, or worst-case concurrency behavior beyond this single observed probe.
- Public Render MCP must remain non-billable; no `speak_shenshu` registration, no MiniMax key provisioning, no Call modifications.
- Draft PR stays unmerged pending actual authentication integration and gate review.
