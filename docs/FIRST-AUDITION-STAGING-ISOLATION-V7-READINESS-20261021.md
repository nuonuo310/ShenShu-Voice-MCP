# First Audition Staging Isolation v7 Readiness - 2026-10-21

## Status

**Offline implementation and verification complete. No cloud/account action, deployment, connector operation or live-host test was performed.**

This record implements the code-only scope in `docs/construction-envelopes/2026-10-21-first-audition-staging-isolation-v7.md`. The production protected-resource identity remains the default and is unchanged. A separately named staging origin can now select a distinct, host-bound audience only through an explicit, fail-closed configuration.

## Authority and opening gate

| Item | Recorded value |
|---|---|
| Repository | `nuonuo310/ShenShu-Voice-MCP` |
| Remote | `https://github.com/nuonuo310/ShenShu-Voice-MCP.git` |
| Authority branch | `docs/first-audition-staging-isolation-v7-20261021` |
| Authority commit | `acc5a4cebb0f880c8cce06404504cc1f0e539df9` |
| Envelope | `docs/construction-envelopes/2026-10-21-first-audition-staging-isolation-v7.md` |
| Parent v6 PR | #79, Open Draft, head recorded as `c310ab9f44cc5becf99acb4e7aaa2696acf23c41` |
| v6 CI reference | Run `39649547766` completed successfully before v7 |
| Task branch | `work/first-audition-staging-isolation-v7` |
| Implementation commit | `678f2b832bd0d1d37878838819c79781d18a7456` |
| Implementation diff | 3 files changed, 360 insertions, 20 deletions |
| Prechange baseline | 220 tests passed, 0 failed |

The post-v6 worktree was clean, one worktree was registered, the requested authority ref resolved exactly, and no unrelated change was present at the opening gate.

## Implementation

The change adds `src/protected-resource-identity.js` and connects it to `src/protected-resource-shell.js`. Existing exports `PAID_RESOURCE`, `RESOURCE_METADATA_URL`, `PAID_PATH`, `RESOURCE_METADATA_PATH` and `AUTH0_ISSUER` retain their exact production string values and meaning.

The resolver produces one mutually consistent identity object containing:

- the protected-resource audience;
- the protected-resource metadata URL;
- the RFC 9728 discovery document;
- the `WWW-Authenticate` challenge;
- the stable Auth0 issuer and existing `voice:speak` scope.

The same object feeds the metadata route, unauthenticated challenge, staging JWT verifier audience and optional paid diagnostic audience. No URL is reconstructed independently in those paths.

### Production parity

With `SHENSHU_STAGING_RESOURCE_MODE` absent, empty, `0` or `false`, production behavior is the existing identity:

```text
PAID_RESOURCE         = https://shenshu-voice-mcp.onrender.com/paid-mcp
RESOURCE_METADATA_URL = https://shenshu-voice-mcp.onrender.com/.well-known/oauth-protected-resource/paid-mcp
AUTH0_ISSUER          = https://dev-nwr87q0tnrbjeapr.us.auth0.com/
scope                 = voice:speak
```

The exact production discovery document remains:

```json
{
  "resource": "https://shenshu-voice-mcp.onrender.com/paid-mcp",
  "authorization_servers": ["https://dev-nwr87q0tnrbjeapr.us.auth0.com/"],
  "scopes_supported": ["voice:speak"],
  "bearer_methods_supported": ["header"]
}
```

The exact production 401 challenge remains:

```text
Bearer resource_metadata="https://shenshu-voice-mcp.onrender.com/.well-known/oauth-protected-resource/paid-mcp", scope="voice:speak"
```

When staging mode is off, setting a staging origin in the environment or sending `Host`, `Forwarded`, `X-Forwarded-Host` or `X-Forwarded-Proto` cannot alter the production identity. An unknown staging-mode value fails closed rather than silently selecting production.

### Staging identity

Staging requires all of the following:

```text
SHENSHU_STAGING_RESOURCE_MODE=1
SHENSHU_STAGING_ORIGIN=https://shenshu-voice-mcp-staging.onrender.com
```

The origin is a code-level exact allowlist, not an arbitrary URL setting. The staging identity is then:

```text
audience              = https://shenshu-voice-mcp-staging.onrender.com/paid-mcp
resource_metadata_url = https://shenshu-voice-mcp-staging.onrender.com/.well-known/oauth-protected-resource/paid-mcp
issuer                = https://dev-nwr87q0tnrbjeapr.us.auth0.com/
scope                 = voice:speak
```

The staging audience is therefore distinct from the production audience and bound to the staging hostname. The Auth0 issuer remains stable; no second issuer is introduced.

The allowlist rejects, among other inputs, absent or malformed values, HTTP, username/password, path, query, fragment, an explicit port, IP literals, localhost, wildcards, Unicode/IDN spelling tricks, the production hostname, unexpected staging hostnames, trailing slashes and case variants. The environment value must match the exact allowlisted ASCII origin byte-for-byte.

If staging mode is on but the origin is missing or invalid, both protected routes return HTTP 503 with a generic `resource_identity_unavailable` body. They do not serve production metadata, do not fall back to the production audience and do not affect the public `/mcp` route.

### Non-secret configuration

| Purpose | Name | Value |
|---|---|---|
| Explicit staging mode | `SHENSHU_STAGING_RESOURCE_MODE` | `1` on staging only |
| Exact staging allowlist | `SHENSHU_STAGING_ORIGIN` | `https://shenshu-voice-mcp-staging.onrender.com` |
| Existing OAuth gate | `SHENSHU_AUTH_MCP_ENABLED` | `1` on staging test service |
| Existing private fixture gate | `SHENSHU_PRIVATE_FIXTURE_ENABLED` | `1` on staging test service |

Do not set either staging variable on the production service. Do not set `SHENSHU_AUTH_STATIC_JWKS_TEST_ONLY` or `SHENSHU_AUTH_PUBLIC_JWKS_JSON` on a deployed staging service; the static-JWKS path is only for local tests with generated keys. No secret or public-JWKS content is stored in this report.

## Operator setup after separate authorization

None of these account or infrastructure steps was executed in v7:

1. Create a separate Render staging service whose public hostname is exactly `shenshu-voice-mcp-staging.onrender.com`. If that service name or origin is unavailable, do not widen the environment allowlist; stop for a new total-control decision because arbitrary origins are intentionally rejected.
2. Configure the staging service from this branch only after a new deployment authorization. Set the four non-secret values above. Never place staging mode on the production service.
3. In Auth0, create or designate a separate API/resource server whose identifier is exactly `https://shenshu-voice-mcp-staging.onrender.com/paid-mcp`, with the existing `voice:speak` scope. Keep the existing tenant issuer.
4. Authorize the intended staging OAuth client for that staging API and confirm the issued access token has the exact staging `aud` value. Keep client secrets and tokens out of chat and repository files.
5. With separate OpenAI/ChatGPT connector authorization, create a new staging connector for the staging `/paid-mcp` endpoint. Do not refresh or modify the production connector.
6. Run only a later authorized host smoke. Confirm discovery, challenge, OAuth audience, app-only fixture gating and fixed-WAV playback on staging before considering any production action.

## Offline verification

All commands were run locally without external service calls:

| Check | Result |
|---|---|
| New v7 identity/shell test | 8 passed, 0 failed |
| Targeted auth/protected/UI/CSP regression set (16 files) | 67 passed, 0 failed |
| Full `node --test` | 228 passed, 0 failed, 0 skipped |
| Baseline before v7 edits | 220 passed, 0 failed |
| `node test/smoke-server.mjs` | All 3 sections passed |
| `node --check` on changed JS and test files | Pass |
| `git diff --check` | Pass |

The full suite now has eight additional tests over the 220-test baseline. The v7 tests specifically cover:

- exact default constants, discovery document and challenge;
- flag absent/false with a malicious origin override and hostile forwarding headers;
- missing, malformed, insecure, production, wrong-host, IP, localhost, port, userinfo, path/query/hash, wildcard, IDN and case-variant staging inputs;
- generic fail-closed protected responses without production or staging identity leakage;
- a valid staging origin changing audience, metadata and challenge consistently;
- production-audience JWTs rejected at staging and staging-audience JWTs rejected at production using only generated local RSA test keys;
- staging scope and issuer checks remaining enforced;
- the resolver containing no provider, D1, secret, file-read or ambient `process.env` dependency.

The targeted regression set also retains the app-only/private-flag-gated protected fixture, public `/mcp` composition, fixed-tone, hosted-tone, private-fixture, CSP and generated Web Audio checks.

## Not run

| Activity | State |
|---|---|
| Render service creation, configuration or deployment | NOT RUN |
| Auth0 API, application, grant or setting change | NOT RUN |
| ChatGPT connector creation or refresh | NOT RUN |
| Staging discovery over the internet | NOT RUN |
| ChatGPT desktop or iPhone test | NOT RUN |
| Real MiniMax or any paid voice call | NOT RUN |
| Real D1 read, write, migration or qualification | NOT RUN |
| GitHub Actions dispatch | NOT RUN |
| Merge, promotion or deployment | NOT RUN |

## Abort and rollback

- **Staging configuration failure:** stop or disable the staging service first. Do not simply remove `SHENSHU_STAGING_RESOURCE_MODE` while the staging endpoint remains reachable, because default mode is intentionally the production identity. An invalid staging value is a safe fail-closed state while access is being removed.
- **Unexpected staging identity:** do not test OAuth. Stop the staging service, capture non-secret discovery/challenge evidence, and return to total control.
- **Production parity concern:** the production service must have both staging variables absent. If staging mode was ever set there by mistake, remove it, restart, and verify the exact production discovery document and 401 challenge before any further operation.
- **Code rollback:** revert implementation commit `678f2b832bd0d1d37878838819c79781d18a7456` on a separately authorized branch; no data migration is involved.
- **Auth0/Render cleanup:** deletion or alteration of staging resources requires separate account authorization and is not part of this envelope. Production resources and the production connector remain untouched.

## Remaining decisions

- Account-specific selection and creation of the exact staging Render hostname remain operator actions outside v7.
- Creation of the distinct Auth0 API/audience, staging OAuth client grant and ChatGPT connector remains outside v7.
- Real host, desktop and iPhone evidence remains NOT RUN. The code commit is ready for that later environment, but this report does not claim host success.
- Draft PR URL, current head and CI run are recorded in the final task receipt after this docs-only readiness commit is pushed.
