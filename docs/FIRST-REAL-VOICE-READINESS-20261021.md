# First real voice readiness candidate — 2026-10-21

Status: **OFFLINE CANDIDATE READY FOR TOTAL-CONTROL REVIEW. NOT BILLABLE, NOT DEPLOYED, NOT MOUNTED.**

Authority: `docs/construction-envelopes/2026-10-21-first-real-voice-readiness-v1.md` at
commit `2635c3f170682dddccfe47f6fafa2bc44e759557`.

## Opening gate

| Check | Recorded value |
|---|---|
| Repository | `nuonuo310/ShenShu-Voice-MCP` |
| `origin/main` at start | `1cef5ada7f6af0b912b7d5bba2c42f4f776bb828` |
| Authorized base | `2635c3f170682dddccfe47f6fafa2bc44e759557` |
| Task branch | `work/first-real-voice-readiness` |
| Worktree at start | Clean; no unrelated tracked changes |
| Frozen-contract drift | None observed in `server.js`, OAuth bridge, D1 schema/store, UI, workflows, or public tool registration |

The host relocated the working directory during execution and removed the original
Git worktree metadata. Git operations were restored from the same verified remote,
base commit and branch tip without changing repository content. The remotes and SHAs
above were rechecked after recovery.

## Actual first-audition call path

No deployed path is marked complete merely because an offline primitive exists.

| Link | Actual evidence | Status | Remaining gate |
|---|---|---|---|
| Explicit human consent | Offline candidate requires a server-owned `claimOperatorConsent` callback. It is bound to the verified opaque principal, action, text byte count and request ID, and must return `allowed:true` and `oneTime:true`. `approved`, `consent` and principal fields supplied by the caller are ignored. | **CONTRACT ONLY — no deployed consent UI or durable consent ledger** | Operator must define and provision the human-consent source before activation |
| Verified identity | `src/verified-identity.js` verifies RS256 issuer/audience/lifetime and requires `voice:speak`; offline signed-JWT tests pass, including wrong audience, expired token, wrong scope and caller-forged fields. | **OFFLINE PASS** | Real Auth0 token, JWKS and deployed `/paid-mcp` verification are not exercised here |
| One-shot quota | The candidate fixes the daily limit to `1` and calls the existing server-owned admission callback into `reserveAtomic`. The offline fake-D1 suite proves one slot per principal/day and duplicate-request refusal. | **OFFLINE PASS** | No real D1 write was made; real deployment/schema verification remains closed |
| One-use grant | Offline fake D1 performs reserve -> issue -> consume and rejects a second consume or replayed `grant_id`. | **OFFLINE PASS** | Real D1 grant state and cross-instance behavior remain unverified |
| MiniMax call | `src/minimax-adapter.js` performs one attempt with no retry and a bounded timeout. The candidate calls it only with an injected fake fetch and refuses `globalThis.fetch`. | **OFFLINE PASS** | Real MiniMax request requires explicit billable approval |
| WAV validation | `validateWav` enforces RIFF/WAVE, 16 kHz mono 16-bit PCM, `0.2–60 s`, `2 MB` upper bound and exact structure. Tests include over-duration audio rejection. | **OFFLINE PASS** | Actual MiniMax audio compatibility remains unverified |
| Generated record | `createLiveVoice` returns a bounded inline base64 WAV record with `source:"minimax"` and `generated:true`. | **OFFLINE PASS** | Delivery to the deployed player is not connected |
| Existing player | The player still accepts only fixed `fixture`, `private-fixture`, `tone-fixture` and `hosted-tone` sources. A generated `source:"minimax"` record falls through to `unsupported_audio_result`. | **NOT WIRED — deliberately unchanged** | Requires a separately reviewed delivery decision and real desktop/iPhone verification; do not claim playback PASS |

Server-side execution order in the candidate is: verified identity -> consumed
operator consent -> reservation -> grant issue -> grant consume -> one fake
synthesize -> WAV validation -> inline record. No consent, store or fetch call is
reached for a missing or invalid identity.

## Voice ID and configuration gate

Only source names and validation behavior were inspected; no real secret or voice
value was read, printed or logged.

| Requirement | Current source | Status |
|---|---|---|
| MiniMax endpoint | Hard-coded `https://api.minimaxi.com/v1/t2a_v2` | Implemented in adapter |
| Model | Default `speech-2.8-hd` from the adapter | Fixed by code; operator should still confirm the intended model |
| Voice ID | Required non-empty invocation value; no production value or environment binding is present in the repository | **OPERATOR DECISION / MISSING CONFIGURATION SOURCE** |
| API key | Required non-empty invocation value; no `MINIMAX_API_KEY` or equivalent environment binding is present in the repository | **SECRET GATE — must remain outside Git and logs** |
| Voice label | Display label `沈述` in `src/contract.js` | Not a voice ID and not proof of the configured provider voice |

No deployment secret was accessed. A future activation must inject both values from
a separately reviewed operator-controlled environment; they must never be MCP
arguments, client-visible output or repository content.

## Readiness matrix

| Capability | Proven offline | Requires real deployment verification | Requires explicit billable approval |
|---|---|---|---|
| Signed OAuth identity and `voice:speak` scope | Yes | Yes — real Auth0 token/JWKS through the deployed endpoint | No |
| Explicit human consent | Contract and fail-closed tests only | Yes — trusted consent source and one-time ledger | Yes — the human audition itself |
| One-slot reservation and duplicate-request denial | Yes — fake D1 only | Yes — real D1 write path and schema | Yes |
| One-use grant issue/consume and replay denial | Yes — fake D1 only | Yes — real D1 and cross-instance behavior | Yes |
| Single MiniMax attempt, timeout and no retry | Yes — fake fetch only | Yes | Yes — one paid provider call |
| WAV format, size and duration validation | Yes | Yes — actual MiniMax response compatibility | Yes |
| Inline generated record | Yes | No | Yes |
| Existing player playback of generated audio | **No** | Yes — delivery design plus desktop/iPhone test | Yes |

## Offline evidence

Commands:

```powershell
node --test test/first-audition-offline-candidate.test.js
node --test
git diff --check
```

| Run | Result |
|---|---|
| Untouched baseline before changes (with declared dependencies installed offline) | 165 passed, 0 failed |
| Targeted first-audition suite | 11 passed, 0 failed |
| Full suite after changes | 176 passed, 0 failed |
| `git diff --check` | Pass; no whitespace errors |

Targeted coverage proves:

- exactly one fake synthesis after identity, one-time consent, reserve, issue and consume;
- missing, expired, wrong-audience or insufficient-scope identity stops before consent, D1 and fetch;
- caller-supplied principal, `approved:true` or `consent:true` cannot replace server-side authorization;
- no consent, failed consent and consent-store failure stop before D1 and fetch;
- a second distinct audition on the same UTC day is denied after one fetch;
- duplicate request IDs are denied by durable reservation semantics;
- a replayed `grant_id` is denied before a second synthesis;
- an upstream timeout is one attempt only and leaves the reservation unrefunded;
- over-duration audio and invalid upstream responses fail closed without retry;
- construction refuses real `globalThis.fetch`, an empty API key or an empty voice ID.

## Non-execution counters

| Category | Count |
|---|---|
| Real MiniMax requests | 0 |
| Paid calls / billing | 0 |
| Real D1 reads or writes | 0 |
| Database migrations | 0 |
| Secret values read or logged | 0 |
| Deployments, Render/Cloudflare changes, Actions dispatches | 0 |
| Application network calls | 0 (all fetch calls are injected in-memory fakes) |

GitHub was contacted only for normal repository fetch and PR workflow after the
worktree metadata was lost.

## Changed files

- `src/first-audition-offline-candidate.js` — sealed, unmounted offline rehearsal.
- `test/first-audition-offline-candidate.test.js` — adversarial offline integration tests.
- `docs/FIRST-REAL-VOICE-READINESS-20261021.md` — this readiness record.

Untouched: `server.js`, public and protected MCP registration, OAuth bridge and UI,
player, D1 schema/SQL ownership semantics, workflows, package manifest, and all
other projects.

## Remaining blockers

1. **Explicit consent source:** no deployed operator consent UI, record or one-time ledger exists.
2. **Generated-audio player path:** the existing player intentionally rejects `source:"minimax"`; wiring it is a delivery-architecture decision and must not be inferred from these tests.
3. **Real OAuth deployment:** a real Auth0 token, JWKS refresh and `/paid-mcp` scope check have not been exercised in this envelope.
4. **Real D1 admission:** no live write was made; durable schema/ownership and cross-instance behavior still need the separately governed qualification.
5. **Provider credentials and voice ID:** operator-controlled configuration source is absent from the repository and must be provisioned outside Git.
6. **One billable audition:** still requires explicit total-control approval after the preceding gates, with no retry on uncertain billing.

This candidate is not permission to mount a paid tool, deploy, merge, or call MiniMax.
