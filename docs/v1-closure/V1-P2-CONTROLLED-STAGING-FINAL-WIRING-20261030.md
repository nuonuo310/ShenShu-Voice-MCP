# Voice V1 P2 controlled-staging final wiring (offline candidate)

Date: 2026-10-30. Status: **COMPLETE (offline candidate only)**. Voice V1 is
still **2/9**; paid voice remains **paid OFF**. This is not a paid-live qualification and is not a deployment.

## What was wired

`src/v1-p2-controlled-staging-candidate.js` composes only existing frozen
components into one reviewable, fail-closed future-staging candidate:

- protected ChatGPT MCP proposal -> owner-only `/player/pending`
- signed owner session + strict Origin/Fetch Metadata/CSRF explicit POST
- sealed **D1 004+005** atomic claim and one-use consumed grant
- server-side fixed MiniMax model/voice adapter, injected fake transport in tests
- Kodo lifecycle private latest-one store, encrypted, owner-only, short TTL
- signed-session `/player/audio` read with replay/unknown/expired fail closed

`server.js` does not import the candidate. The deployable `/player/confirm`
GET/POST remains **404**; public MOCK `/mcp` and the P1 fixed-WAV
`/player/audio` remain intact. The candidate is not reachable by a single
environment flag: it requires all four explicit staging flags, a validated
staging identity, an independently approved exact SHA equal to the running SHA,
validated server secrets, a Kodo bucket/master key and a fixed provider
key/voice.

## Safety evidence

- Tests use real local HTTP, Node 24 SQLite with 001/002/004/005, a fake S3
  protocol double and a fake MiniMax transport. **No real MiniMax**, **No real Kodo**, **No real D1**, **No Render**, **No Call**, IAM or secret operation.
- Kodo is GET/PUT only. Program code issues no **DELETE**, HEAD, LIST, If-Match,
  public URL or presigned URL. Physical removal is bucket **lifecycle** only.
- Owner isolation, wrong session/Origin/CSRF, expired proposals, double click,
  concurrent claim, quota refusal, provider failures, bad WAV, ambiguous PUT,
  failed GET, expiry and ciphertext tampering fail closed without a second
  provider attempt or retry.
- Starting authority for this round: `29110e145c93be7455e6e1d5ffaec79dca7fc3c7`.
  The committed HEAD is the one reported by Draft **PR #146** after this push.

## Future staging enablement checklist (NOT executed)

1. Obtain a separate total-control approval for the exact committed SHA.
2. Build/deploy that SHA only; do not assume the current Render LIVE SHA.
3. Record an explicit **rollback** to the prior P1 branch/image before changing
   environment; env edits may deploy an older branch even with autoDeploy=no.
4. Inject every secret only through the owner's secure channel. Never put AK/SK,
   provider keys, session/text/Kodo master keys in Git, CI, logs or chat.
5. Keep Kodo IAM without DELETE; keep the prefix lifecycle rule as the only
   physical-removal mechanism.
6. Independently qualify real D1 004+005 quota/concurrency and real object
   PUT/GET behavior under a separate approval.
7. Separately authorize exactly one real 04 MiniMax smoke with the fixed model
   and approved voice; treat its cost as a separate approval.
8. After that, require owner desktop and iPhone actual audible acceptance.
9. Keep all four staging flags OFF until each gate above is satisfied, and keep
   the paid entry closed if any check fails.

Offline tests passing is not evidence of real cloud concurrency, real Kodo
lifecycle timing, real synthesis quality or human audibility. Voice V1 remains
**2/9**.
