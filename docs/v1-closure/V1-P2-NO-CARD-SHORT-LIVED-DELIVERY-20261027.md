# Voice V1 P2 - no-card short-lived delivery GO/NO-GO (2026-10-27)

**STATUS: BLOCKED. The authorized offline GO/NO-GO review is complete. Paid
Voice V1 P2 is NO-GO on the current Render Free plus D1 stack because no trusted
server-owned operation identity survives the relationship between an automatic
transport retry and the original paid operation. Process-local audio can be
played repeatedly and saved by the user while the same Render process remains
alive, but that mechanism cannot be promoted to a paid path without a safe
retry/reconnect/restart contract. No Render request, Auth0 change, real D1 SQL,
MiniMax/provider call, real MCP call, deployment, secret operation, merge or
manual Actions dispatch occurred. Strict Voice V1 remains 2/9; B1-B4 remain
OPEN.**

The implementation decision is deliberately conservative: no source or test
change is made. Adding an in-memory adapter around the current injected result
store would make the storage mechanics testable, but it cannot manufacture the
missing operation identity and would repeat the fake-store failure the current
authority package was created to stop.

## Authority and opening gate

- Repository: `nuonuo310/ShenShu-Voice-MCP`.
- Origin: `https://github.com/nuonuo310/ShenShu-Voice-MCP.git`.
- Sole authority: commit
  `8e9fc6b00bfd362e6e04501f89c3d9ac6abc8de0` on branch
  `docs/voice-v1-p2-no-card-short-lived-delivery-20261027`, file
  `docs/construction-envelopes/2026-10-27-voice-v1-p2-no-card-short-lived-delivery.md`.
- Parent baseline: PR #139 HEAD
  `8d971704161b2d82553eb3689f8588c18631a531`.
- The authority commit has exactly that parent. Opening HEAD was the authority
  commit in a detached, isolated worktree. The tracked worktree was clean and
  there was no stash. The only untracked path was the already-installed
  `node_modules/`, which is not part of this change.
- PR #139 is an open Draft. Its base is
  `docs/voice-v1-p2-cloud-qualification-gate-20261027` at
  `e806ecf7e08e24f924211eb438a48256e906c282`; its head is `8d97170...`.
  Standard `pull_request` CI run `40508997069` and job `122205614985` are
  **success**. PR #138 is also an open Draft, and its CI run `40505769595` is
  **success**. CI is repository regression evidence, not Render, Auth0, D1 or
  provider qualification.

### PR #139 base-invalid diagnosis

No repository-side invalid base was found. The base branch exists at the exact
recorded SHA, the GitHub compare from base to PR #139 head is `ahead_by: 1` and
`behind_by: 0`, and a direct PR read reports `mergeable: true`,
`mergeable_state: clean` and `rebaseable: true`.

An initial bulk PR-list response exposed `mergeable: null`, which is GitHub's
normal pending-recalculation state for computed mergeability, not a missing or
rewritten base. A subsequent direct read completed as `clean`. The PR timeline
contained no base/head change, deletion or reopen event. The observed base
invalid presentation was therefore transient/stale mergeability state, not a
broken branch dependency. No history was rewritten and no base was changed.

## GO/NO-GO decision

### GO only for media mechanics on one warm process

While the same Render process is alive and has not evicted the result, the
existing private player can support:

- one latest generated WAV per canonical principal, bounded to 2 MiB;
- one logical 300-second result lifetime;
- authenticated same-origin repeated playback with no additional provider call;
- an explicit user-triggered local download/save once the authenticated bytes
  have been retrieved.

This is a best-effort delivery mechanism, not durable storage. It disappears on
process replacement, redeploy, crash, memory pressure or Free-service idle
spin-down. The exact idle interval is provider-owned and was not re-tested in
this offline task.

### NO-GO for paid P2

The paid path is not safe to enable because the server cannot currently
associate an automatic retry, reconnect or a request arriving after a process
restart with the original operation. A fresh operation ID would create a new D1
reservation and could cause a second billable provider attempt. The current
transport has no proven stable correlation token that survives those events.

The construction envelope correctly forbids solving this by accepting a
caller-supplied operation ID. Using only the text digest or a time bucket would
instead merge intentional repeated utterances, changing product semantics and
still not forming a durable operation identity. Neither workaround is accepted.

## PASS / BLOCKED matrix

| Requirement | Current evidence | Verdict |
| --- | --- | --- |
| Existing Render Free can hold bytes in process memory | The private player accepts an injected loader and the P2 test backend is process-local | **GO as ephemeral mechanics only** |
| Repeated playback without another provider call | `/player/audio` reads the authenticated latest result; `no-store` prevents durable browser caching but does not charge again | **PASS (offline design)** |
| Explicit user save/download | Bytes already retrieved by the authenticated session can be returned as an attachment; current handler emits inline disposition | **PARTIAL - narrow UI/header work required; iPhone unproven** |
| Latest one result per principal | Backend contract and focused test backend retain one row per principal | **PASS (offline contract/test backend only)** |
| 300-second logical TTL and expiry deletion | Default 300 s, validated 30-900 s range, expiry test passes | **PASS (offline test backend only)** |
| Canonical Auth0 principal on MCP and player | Both paths call the same `SHA-256(issuer NUL sub)` derivation; signed fixture test passes | **PASS (offline); live identity BLOCKED** |
| D1 single-statement daily reservation | First-free-slot SQL has a unique replay key and bounded slots | **PASS (source/offline SQL only)** |
| D1 cross-statement operation atomicity | Reservation, issue, consume and operation state are separate calls in the current adapters | **BLOCKED - no real D1 proof** |
| Stable server-owned operation ID | P2 tests inject a constant resolver; no mounted resolver or transport guarantee exists | **BLOCKED - unique gate** |
| No second provider call on automatic retry/reconnect/restart | Only proven when the same operation ID is injected; real retry correlation is unknown | **BLOCKED** |
| Provider success followed by process loss | Could consume one grant and lose the WAV, but the current authority tree has no mounted operation-state record | **PARTIAL fail-closed; delivery unrecoverable** |
| Honest unavailable state | Player maps missing/expired audio to `audio_unavailable` | **PASS (offline response behavior)** |
| Real D1/Render/Auth0/provider qualification | Zero live operations were authorized or performed | **BLOCKED / NOT AUTHORIZED** |

## Why the existing code does not close operation identity

`src/p2-one-shot-player-connection.js` requires
`resolveServerOperation(trustedRequest)` to return a stable opaque
`operationId` and the expected canonical principal before admission. The
operation ID becomes the D1 request ID. That is a sound boundary only if a
retry resolves to the same ID.

The focused P2 suite does not test that property. Its resolver is a stub:

```js
resolveServerOperation: async () => ({
  operationId,
  principal: operationPrincipal,
})
```

It proves that a deliberately repeated constant ID is denied before a second
provider attempt. It does not prove that the live ChatGPT/MCP transport returns
the same ID after a timeout, reconnect or process replacement.

The historical unmerged transport-idempotency stack contains a stronger D1
operation state machine, but its contract permits a **client-provided**
`operation_id` and records that no ChatGPT/MCP guarantee of retry reuse, tool
argument preservation or cross-reconnect intent persistence has been observed.
The new authority explicitly forbids that ingress. Reusing that stack unchanged
would therefore contradict the current task.

Both current MCP transports are stateless:

- `server.js` uses `sessionIdGenerator: undefined` on the public fixture route.
- `src/staging-authenticated-mcp.js` also uses `sessionIdGenerator: undefined`
  on the protected route.

There is no server-owned session handle, durable request cursor or trusted
transport idempotency key in the current authority tree. The MCP JSON-RPC
request ID cannot be promoted to authority because it is client-chosen and is
not guaranteed to survive reconnect.

## Short-lived delivery model that is technically bounded but not GO

The only no-card, no-R2 model consistent with the envelope is:

1. keep at most one WAV per canonical principal in a process-local map;
2. validate a 16 kHz mono PCM WAV and reject anything over 2 MiB;
3. set a logical 300-second expiry and delete expired entries on access;
4. serve only through the authenticated same-origin `/player/audio` session;
5. allow repeated playback while the bytes remain present;
6. offer a separate authenticated save action with
   `Content-Disposition: attachment`, never a bearer in the URL;
7. release and best-effort overwrite the buffer on expiry or replacement;
8. never retry synthesis after an unknown provider or storage outcome.

This model is small and honest, but item 8 is not enforceable without a stable
operation identity. A process restart erases the in-memory cache while D1 keeps
the consumed reservation/grant. A retry without the original operation ID can
reserve again and produce a second charge. Therefore the model cannot be called
a safe paid delivery design yet.

## Failure and restart disposition

| Event | Billing outcome | Audio outcome | Safe with current evidence? |
| --- | --- | --- | --- |
| Failure before server admission | No charge | None | Yes |
| Failure after reservation but before provider | No provider charge; a D1 slot may remain consumed | None | Fail-closed for billing |
| Provider succeeds, process dies before memory write | At most one provider call | Lost | Only if retry is bound to the same operation ID; **not proven** |
| Provider succeeds and result is cached | One provider call | Available until TTL or process loss | Yes while warm |
| Player repeats GET while cached | No provider call | Same bytes replayed | Yes |
| Process restarts after caching | No new charge by itself | Lost | Best-effort limitation only |
| Automatic retry after restart with a new ID | Potential second charge | New attempt, if admitted | **NO - duplicate billing risk** |
| Cache miss or expiry | No new charge | `audio_unavailable`; manual new generation would be a new action | Honest but not recovery |
| User downloads the WAV | No server charge | User-controlled device copy | Outside server retention |

The D1 reservation and grant adapters never refund an uncertain outcome. That is
correct billing behavior. It is not sufficient for operation continuity: a
consumed row proves that *some* attempt was admitted, not which retry request is
the same logical operation.

## Render Free and D1 boundary

This review did not contact Render or Cloudflare. The repository contains no
persistent-disk configuration, and the existing P2 result backend is an injected
test backend rather than a mounted storage service. Project history records the
staging player on Render Free; that external state is not cryptographically
attested in this document.

Consequences are independent of the exact idle timer:

- process memory is lost on restart, redeploy, crash or spin-down;
- D1 can retain only metadata and cannot replace the lost WAV;
- a warm instance can serve a 300-second result, but cannot promise it will
  remain warm for all 300 seconds;
- after loss, the only honest response is `audio_unavailable`, with no automatic
  retry or refund.

The existing D1 `001`/`002` reservation and grant tables remain the paid
admission boundary. An operator-observed qualification database has a `003`
operations table, but the authority tree does not contain that migration or the
mounted operation adapter. Historical source at
`6c20a7e7e038c6d910a8073d8db5dc0b64f0a3e9` requires an explicitly atomic
batch client; the current REST client accepts one query result and is not that
adapter. None of this was exercised against real D1.

## User-visible limitations

If this mechanism were later exposed, the user must be told all of the
following before any paid action:

1. Audio is available only for about 300 seconds and only while the same Render
   process remains alive.
2. A restart, redeploy, crash, memory eviction or idle spin-down may permanently
   lose the audio before retrieval.
3. The server will not silently retry or refund an uncertain paid attempt.
4. A lost result is shown as unavailable; asking again is a separate explicit
   action and may consume a new quota slot and incur a new provider charge.
5. Repeated playback is free only while the cached result exists.
6. Saving the WAV downloads a user-controlled local copy, which is outside the
   server's 300-second retention guarantee.
7. Desktop and iPhone generated-audio audibility and iPhone save/download UX are
   not proven by offline tests.
8. This best-effort behavior is not equivalent to durable private delivery and
   must not be counted as V1 gate 6 or gate 7 evidence.

## Impact on frozen Voice V1

The absence of durable media is an explicit product-scope limitation. It does
not silently lower the immutable nine gates:

- gate 6 remains unproven for generated audio on desktop and iPhone;
- gate 7 remains blocked because duplicate-charge prevention across retry,
  reconnect and restart is not established;
- gate 2 remains unqualified against real D1;
- gate 4 cannot be guaranteed without a stable operation identity;
- gates 3 and 5 have offline modules only;
- gate 9 remains unauthorized.

Strict Voice V1 remains **2/9** (gates 1 and 8 only). B1-B4 remain OPEN.
Accepting a short-lived best-effort audio product would require an explicit
total-control scope decision, but even that decision would not cure the missing
operation identity.

## Verification and real-operation counters

Documentation-only verification at the authority commit:

- Node `v24.19.0`.
- Full `node --test`: **273/273 pass**, 0 fail, 0 skip, 0 todo.
- `node test/smoke-server.mjs`: PASS for MCP initialize, public tools,
  protected metadata and fail-closed paid entry.
- `git diff --check`: PASS.

Real operations in this task:

- Render requests, reads of live service settings, deployments, restarts or
  environment changes: **0**
- Auth0 calls, token/cookie reads or tenant changes: **0**
- Cloudflare API calls, D1 reads/writes/migrations or Worker requests: **0**
- R2 buckets, objects or credentials: **0**
- MiniMax/provider calls or billing changes: **0**
- Real MCP/connector calls, secrets, merges or manual Actions dispatches: **0**

The delivery HEAD, Draft PR and normal CI identifiers are reported in the PR
body and final total-control receipt, not embedded in this self-referential
document.

## Singular next action

**Accept this NO-GO and keep paid P2 dormant.** Do not substitute a nonbillable
mock, text-hash deduplication or a caller-supplied operation ID for real
qualification. Reopening paid P2 requires a new authority that first supplies or
proves a trusted operation identity stable across automatic retry, reconnect and
Render restart; until then P2 remains BLOCKED and Voice V1 remains 2/9.

STOP for ShenShu total-control adjudication.
