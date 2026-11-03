# Voice V1 P2 非计费 MCP 到只读播放器闭环（2026-10-28）

**RECEIPT: COMPLETE for the bounded offline implementation. Deployment is not
performed. Voice V1 remains 2/9; paid P2 remains OFF.**

Authority: PR #146, commit `69140a3b428b394fac48fc56eab489be60b785a8`, file
`docs/construction-envelopes/2026-10-28-voice-v1-nonbillable-mcp-player-closure-v1.md`.
Fixed base: `docs/voice-v1-p2-d1-confirm-qualification-20261027` at
`8c3ede3e3f3e2ef4d8387436019d3dd3d2a4a22d`.

## Delivered

- A protected MCP proposal facade exposes only `prepare_shenshu_voice` and
  `check_shenshu_voice_proposal`; it has no confirm, grant, quota or provider
  method.
- The same owner-scoped operation store and canonical principal are used by
  the MCP proposal path and the authenticated player pending view.
- `/player/pending` renders the owner's exact proposal text and expiry, labels
  it `尚未生成`, and states that this is a read-only nonbillable preview.
- `/player` has a small link to `/player/pending`.
- The page has no form, submit button, script, auto-refresh or auto-play. All
  proposal text is HTML-escaped and responses are no-store with strict CSP and
  frame denial.
- `/player/confirm` is not mounted and returns 404 for both GET and POST.
- The public MOCK `/mcp` tool list is unchanged. Proposal tools appear only on
  the staging protected route with trusted server-side closure injection.

## Safety

- Real D1, Cloudflare, Render, Auth0, MiniMax, Qiniu/Kodo, R2 and other cloud
  services: 0 calls.
- Deployments, secrets, credential changes, schema changes and paid provider
  calls: 0.
- The server intentionally does not synthesize a D1-backed closure because the
  current 004 text column is plaintext and no private-at-rest policy is
  approved. An environment flag alone cannot enable the bridge; tests inject a
  local SQLite fixture explicitly.
- Local SQLite is used only as a 004 semantic model; it is not Cloudflare D1.

## Verification

- Runtime: Node `v24.19.0`.
- Full suite: **332 tests, 332 pass, 0 fail, 0 skipped, 0 todo**.
- Focused nonbillable closure suite: **10 pass, 0 fail**.
- Covered: signed JWT to MCP proposal, same canonical principal in the player
  session, owner-only visibility, exact-text escaping, expiry, wrong
  issuer/audience/scope, forged/missing identity, invalid handle/text,
  caller-supplied authority fields, SQLite 004 persistence and restart,
  store/configuration failure without memory fallback, public MOCK isolation,
  P1 fixed-WAV regression and unreachable confirm route.
- `node test/smoke-server.mjs`: PASS.
- `node --check` for `server.js`, `src/minimax-adapter.js` and the new modules:
  PASS.
- `git diff --check`: PASS.
- GitHub default `pull_request` CI at implementation head `655f65cb`: run
  `40729121589`, job `122960307269`, conclusion `success`. The final
  documentation-only head is revalidated by the same PR check before handoff.

## Remaining real blockers, in order

1. `TOTAL CONTROL DECISION REQUIRED`: approve the private-at-rest text policy
   and key custodian for the real 004 proposal text, or explicitly keep this
   surface synthetic/local only.
2. Only after that approval: authorize staging wiring/credentials and one
   bounded deployment qualification. No deployment is authorized here.
3. Only after staging delivery: separately authorize one capped real 04
   MiniMax smoke and private audio playback qualification.

This receipt does not claim staging availability, paid-chain completeness or a
Voice V1 completion beyond the frozen nine-gate status.
