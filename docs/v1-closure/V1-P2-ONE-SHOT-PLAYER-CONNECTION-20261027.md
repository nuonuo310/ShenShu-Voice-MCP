# Voice V1 P2 - one-shot pipeline to standalone private player (2026-10-27)

## Receipt

- Bounded offline P2 implementation: **COMPLETE**.
- Cloud qualification for real D1 atomicity, private durable storage, live
  Auth0/MCP principal continuity and real MiniMax output: **BLOCKED** by design.
- Strict Voice V1 remains **2/9**. B1-B4 remain **OPEN**.
- Real deployment, Render/Auth0/Cloudflare/D1/Worker/MiniMax/MCP/secrets,
  manual Actions dispatch and merges in this task: **0**.

The delivery HEAD, Draft PR and CI are reported in the final total-control
receipt rather than self-referenced in this committed document.

## Authority and opening gate

- Repository: `nuonuo310/ShenShu-Voice-MCP`.
- Origin: `https://github.com/nuonuo310/ShenShu-Voice-MCP.git`.
- Authority: PR #136, commit
  `58ece60b35d77c997f43f161f642ebeb31e85286`, file
  `docs/construction-envelopes/2026-10-27-voice-v1-p2-one-shot-player-connection.md`.
- Parent baseline: PR #135 HEAD
  `a35e0136e788ad8eb0a1d591acad56ee4b644ffc`.
- PR #136 is an open Draft with base
  `codex/voice-v1-p1-auth-session-security-review-20261027`, head
  `docs/voice-v1-p2-one-shot-connection-20261027`, and
  `mergeable_state=clean`. CI run `40503213763` is **success**.
- PR #135 head is `a35e0136...`; CI run `40373443348` is **success**. Its
  total-control comment `6424918704` records user-confirmed audible private
  fixed nonbillable WAV playback on desktop and iPhone Safari for the staging
  candidate `a35e0136...`.
- Staging service `https://shenshu-voice-mcp-staging.onrender.com` returned
  `/player` HTML byte-for-byte equal to UI blob
  `e477297ffd8292b81f96493a3a04355abfec0156`, the unchanged player page at
  `a35e0136...` and `58ece60...`. The exact deployed commit remains an
  operator-reported value from the #135 acceptance comment because the service
  exposes no build SHA; no deployment or Render change was performed.
- Work was performed from a fresh isolated clone checked out at the authority
  commit. The pre-existing Desktop `ShenShu-Voice-MCP` directory was not the
  target repository and was not modified.

## Implemented offline

### Canonical principal bridge

`src/canonical-principal.js` now defines one opaque principal derivation from
the trusted issuer and verified Auth0 `sub`. Both the protected MCP verifier
and the standalone player callback call this exact function; neither accepts a
caller-supplied principal.

The P2 composition additionally requires a server-owned operation resolver that
returns both a stable operation ID and the expected canonical principal. Before
any quota or provider side effect, the verified MCP subject must exactly equal
that principal; a mismatch fails closed. The fixed tests sign an MCP JWT and
run the real player callback with the same Auth0 `sub`, proving that both paths
land on the same canonical principal. A different player subject cannot load
the first subject's result.

### One-shot composition

`src/p2-one-shot-player-connection.js` composes the reviewed offline paid
pipeline:

1. one explicit bounded text request;
2. server-owned operation ID and principal binding;
3. atomic daily reservation and one-use grant consumption;
4. exactly one fixed `speech-2.8-hd` provider attempt with a server-fixed voice;
5. bounded 16 kHz mono PCM WAV validation;
6. storage of only the validated audio in the injected private result store.

Caller-supplied principal, operation ID, model, voice, grant or replay key is
rejected before admission. Reusing the same server-owned operation ID is denied
by the paid store before a second provider attempt. An uncertain provider
outcome and invalid audio are attempted once, fail closed, remain consumed and
are never refunded or retried. A private-store failure after the provider
attempt also fails closed without retry.

### Private result retrieval

`src/p2-private-result-store.js` defines a dormant injected backend contract and
the player loader. The adapter:

- accepts only a canonical principal;
- validates the WAV and stores no request text or bearer;
- keeps at most the latest one result per principal by backend contract;
- defaults to a 300-second TTL, bounded to 30-900 seconds;
- purges expired rows before retrieval;
- rejects a backend row whose principal does not match the session principal.

`createP2PlayerAudioLoader()` is passed through the existing
`handlePrivateWebPlayer(..., {loadAudio})` injection point used by `/player`.
The P1 fixed fixture remains the default loader; no P2 module is mounted by
`server.js`. The focused integration test exercises the real player session,
the real `/player/audio` handler and an injected in-memory backend only.

## Security and acceptance matrix

| Requirement | Offline result |
|---|---|
| Same canonical MCP/player principal | PASS - one shared derivation and cross-path signed fixture |
| Reject principal mismatch | PASS - fails before reservation/provider |
| No caller authority fields | PASS - strict two-key input; extras rejected |
| One provider attempt per operation | PASS - one attempt; same operation ID replay denied |
| Unknown provider result | PASS - one attempt, consumed grant, no retry/refund |
| Fixed model and voice | PASS - server wiring only |
| Bounded WAV | PASS - exact 16 kHz mono PCM WAV and 2 MiB ceiling |
| Subject-scoped retrieval | PASS - other signed-in subject receives no audio |
| Short TTL and deletion | PASS - expiry removes the result; bounded TTL |
| No unbounded history | PASS by contract - latest result only per principal |
| No public URL/bearer in URL | PASS - same-origin authenticated `/player/audio` |
| No audio in chat thread | PASS - generation result contains no audio/base64/text/principal |
| No raw token/audio logs | PASS - no logging path added |
| P1 fixed fixture preserved | PASS - default loader unchanged |

## Verification

- Runtime: Node `v24.19.0`.
- Focused P2 suite: **9 passed, 0 failed, 0 skipped**.
- Affected P1/identity/paid-pipeline regression: **35 passed, 0 failed**.
- Full Node 24 suite: **272 passed, 0 failed, 0 skipped, 0 todo**.
- `node --check` for changed implementation, server and test files: PASS.
- `node test/smoke-server.mjs`: MCP initialize, public tools, protected
  metadata and fail-closed paid entry PASS.
- `git diff --check`: clean.

## Not claimed / cloud gate BLOCKED

- No real D1 reservation, grant issue or consume was exercised.
- No durable private audio backend exists in this repository; only the
  injected contract and an offline test backend exist.
- No real Auth0 login, no live MCP token-to-player session observation and no
  proof that the deployed transport supplies the required stable server-owned
  operation ID.
- No real MiniMax request, provider WAV, private cloud retrieval or
  desktop/iPhone playback of generated speech.
- The service does not expose its exact deployed SHA; deployment identity is
  operator-reported plus HTML content parity, not a cryptographic deployment
  attestation.

## Changed files

- `src/canonical-principal.js` - shared exact principal derivation and mismatch guard.
- `src/verified-identity.js` - uses the shared canonical principal.
- `src/private-web-player.js` - uses the shared canonical principal.
- `src/p2-one-shot-player-connection.js` - dormant one-shot/player composition.
- `src/p2-private-result-store.js` - TTL/subject-scoped result contract and loader.
- `test/v1-p2-one-shot-player-connection.test.js` - focused P2 integration and adversarial tests.
- `docs/v1-closure/V1-P2-ONE-SHOT-PLAYER-CONNECTION-20261027.md` - this evidence.

## Sole next gate

Separately authorize one bounded real qualification of the D1 paid namespace,
a private durable audio backend, and the authenticated transport's stable
server-owned operation ID / principal-continuity proof. Only after that gate
passes may a separately approved single real MiniMax E2E and desktop/iPhone
playback verification be attempted. Keep Voice V1 at 2/9 until that evidence
exists.
