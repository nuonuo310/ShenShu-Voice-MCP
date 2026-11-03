# Voice V1 P2 — Real D1 and Kodo synthetic qualification (2026-10-30)

**Result: TWO BOUNDED REAL-CLOUD QUALIFICATION LANES PASS. The frozen Voice V1 gate count remains 2/9; paid production and paid staging still OFF.** These are user-supplied terminal receipts for one-time, local, synthetic-only cloud calls. Neither is an end-to-end real MiniMax test, a desktop/iPhone audible acceptance, or an independently retrieved cloud billing ledger. No secrets or plaintext audio are included here.

## Authority and prior safety boundaries

- Existing Draft/open PR #146. At time of verification, existing PR HEAD `342f962f997a831bf8fa7e36bfd0924d093c6d11`, CI run `40935069702` SUCCESS, Node24 414/414.
- First real Kodo stale-ETag conditional DELETE test had already STOPPED because the old `If-Match` was accepted; it remains **BLOCKED / do-not-rerun**, and is NOT rehabilitated by today's successful no-DELETE trial.
- Code path `src/p2-kodo-private-audio-backend.js` only sends encrypted PUT and owner GET. No DELETE, HEAD or LIST from app backend; Kodo one-day lifecycle handles physical retention separately from a 60–300s access TTL.
- The separate D1 qualification database UUID is `234913cd-8901-4607-8147-31c4a4317111`. **Forbidden** historical database UUID `c39a6895-7028-4f59-a100-1455b92c96c1` was not contacted.
- Only the user controlled credentials via local hidden prompts. No AK, SK, API Token, raw voice or decrypted WAV is saved in this receipt.

## Lane A — real Cloudflare D1 004+005 qualification: PASS

User invoked `scripts/qualify-d1-cloud-once.mjs --run` from the local Node24 project folder. Receipt:

- Synthetic run ID `bbcbea5b13d47735`. Real 004+005 schema and admission trigger preflight PASS.
- Three synthetic operations, each sealed in D1 (`text='sealed:v1'` with authenticated encrypted `sealed_text`); two competing claims of the same operation: **exactly one admission** and a consumed grant. Replay: zero new grant.
- Same-owner daily quota denied, no extra grant/reservation; other owner admitted independently; unknown outcome terminal, no refund or automatic retry.
- Read-only postflight: **3 operation rows / 2 reservations / 2 consumed grants**.
- **22 HTTPS D1 requests, 9 writes, 5 claims, 7 seconds**, within authorized maxima of 36 HTTP, 12 writes, 5 claims, 15min. Provider calls **0**; MiniMax calls **0**; DELETE **0**.
- The one-time local marker must not be removed or rerun. Leave synthetic encrypted rows intact, do not change prior 004/005 migrations.
- User created short-lived account-level `Account.D1 Edit` token `shenshu-d1-qualification-once-20261030`, verified active locally, and **deleted it after successful D1 test**, confirmed by screenshot of only the three pre-existing tokens remaining. It did not confer database-level permission scoping; script pinned the specific qualification UUID.

## Lane B — real Kodo private owner WAV qualification: PASS

User invoked `scripts/qualify-kodo-owner-once.mjs --run` from the same local Node24 project using separately held Kodo child-user credentials.

- Private SG bucket `shenshu-voice-v1-sg-20261029`; region `ap-southeast-1`; prefix `shenshu/voice-v1/private-audio/`.
- Encrypted synthetic 440Hz WAV: **1 PUT** then owner's **GET** round-tripped exact WAV, foreign owner's GET returned no audio, expired owner GET returned null without sending DELETE.
- **4 logical requests / 4 physical HTTPS requests**, **30,314 bytes PUT**, **60,628 cumulative GET body bytes**, one encrypted test object, **5 seconds**, limits `1 PUT / 3 GET / 0 DELETE / 0 HEAD / 0 LIST`, max 256KiB PUT and 768KiB GET, no retries.
- MiniMax **0**. Test created no public URL; existing private-bucket configuration and no-DELETE IAM were verified by prior user screenshots. Synthetic object remains for prefix-scoped **one-day Kodo lifecycle deletion**; this is **not** a claim of precise 24-hour physical purge.
- Do not rerun this one-time trial or unlock marker; do not manually DELETE the synthetic object.

## What is now proved, and what remains OPEN

**Proved narrowly:** current synthetic real D1 concurrency/quota/grant single-admission within request budget; real private encrypted owner Kodo PUT→GET/foreign isolation/expired denial within request budget, with no app-level DELETE.

**Still OPEN:** deployment of the *paid* staging-only confirmation module, with independently approved exact SHA and secure secrets/real D1+Kodo configuration; checking the actual browser button and owner session boundary; one separately authorized fixed MiniMax04 (`speech-2.8-hd`) call with explicit maximum spending and no retry; validated real WAV delivered via authenticated private player and actually audible by the owner on both desktop and iPhone. First distinguish a controlled paid staging route deployment from a paid provider call. Current normal `server.js` does **not** mount the paid candidate (`/player/confirm` stays 404). Do not enable an MCP-generated paid tool or auto-confirmation. Existing production, Call, Asteria and Nightvoyage stay unchanged.

**Next total-control decision:** authorize a *bounded paid-staging integration activation* only after exact entrypoint/rollback and credential review; separate MiniMax authorization afterward. No additional open-ended fake cloud qualification. Voice V1 2/9 until the frozen nine gates have actual evidence.
