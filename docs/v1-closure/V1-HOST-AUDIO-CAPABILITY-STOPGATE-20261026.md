# Voice V1 - Host Audio Capability/Privacy STOP Gate (2026-10-26)

## Receipt

- Offline stop-gate engineering: **COMPLETE**.
- ChatGPT-embedded private playback: **BLOCKED** on host support and privacy/persistence evidence.
- Overall disposition: **TOTAL CONTROL DECISION REQUIRED** for the V1 playback-entrypoint amendment.
- Voice V1 remains **2/9**. Gates B1-B4 remain **OPEN**.
- No audio message was sent. No real MCP/connector, provider, deployment, Render/Auth0, Cloudflare/D1, Worker, secret operation, manual Actions dispatch, merge, or other Asteria repository change occurred.

## Authority and opening gate

- Repository: `nuonuo310/ShenShu-Voice-MCP`.
- Origin: `https://github.com/nuonuo310/ShenShu-Voice-MCP.git`.
- Authority package: PR #131, head `b363d88b5d3d18cab2aaf0c376bb07215024ac8e`, tree `01b4b18ffc627a3a4aee4f45fad60260a4ba658d`.
- Package file: `docs/construction-envelopes/2026-10-26-voice-v1-host-audio-capability-stopgate.md`.
- Exact parent: PR #130 head `1222b4e6cd1b4ab827924cdf6023f8f8cebb8c1e`.
- PR stack: #130 is an open Draft based on `0187a8169f2ef831d143b3813f0efa16da4e1bbf`; #131 is an open Draft based on the exact #130 head. Both are unmerged.
- Authority CI: run `40345190782`, job `121650122105`, conclusion `success`.
- Delivery work used the isolated worktree `C:\Users\Administrator\Desktop\_codex-worktrees\voice-v1-s1-host-audio-capability-stopgate-20261026\ShenShu-Voice-MCP`, starting clean at the authority head.
- Local runtime: Node `v24.19.0`; resolved SDK packages in this worktree: `@modelcontextprotocol/ext-apps@1.7.5` and `@modelcontextprotocol/sdk@1.32.2`. The repository declares ranges without a lockfile, so the package version is evidence for this offline tree, not a frozen staging guarantee.

## Evidence reviewed

Prior device evidence remains binding: private Web Audio decode/playback completed twice on iPhone while silent, including a run after the user confirmed normal speaker/output state. A public hosted HTTPS WAV became audible after output was restored. That proves only public hosted audio, not authenticated/private playback through the MCP Apps iframe. Rank A was not retested.

The installed MCP Apps SDK schema and documentation establish only protocol expressiveness:

- `McpUiHostCapabilitiesSchema` permits optional `message.audio` as a capability marker.
- `McpUiMessageRequestSchema` permits an `audio` content block containing base64 `data` and `mimeType`.
- `App.sendMessage()` is documented as adding a message to the host chat interface/conversation thread, with `role: "user"`; it is not documented as local-only playback.
- The same capability area also exposes `hostInfo` and `hostContext`; these can contain host metadata and must not be rendered.

This does not prove that ChatGPT on iPhone advertises `message.audio`, renders a playable control, produces sound, or treats `ui/message` audio as private/non-persistent. In particular, the documented conversation-thread behavior means an audio message may enter chat history and model context. No host guarantee was found that would authorize such a send.

## Implemented offline stop-gate

The only code change is a dormant, nonsecret capability-readiness display in the existing shared UI, activated only by the server-side authenticated staging specialization:

- `ui/mcp-bubble.html` now retains the `ui/initialize` result just long enough to inspect `hostCapabilities.message.audio`.
- The authenticated resource renders exactly one of `宿主音频消息能力：已宣告（未发送音频）` or `宿主音频消息能力：未宣告（未发送音频）`.
- The public bubble never renders this host capability line, even if a test host advertises it.
- No `hostInfo`, `hostContext`, principal, token, URL, tool identifier, version string, or raw capability object is displayed, logged, or retained.
- No `ui/message` or `sendMessage` call was added. No audio bytes are constructed. No playback path, network request, server route, CSP domain, or server behavior changed.

The change is useful as a fail-closed gate: an absent marker is a definitive negative observation for that host session; a present marker proves only advertisement, not playback or privacy.

## Verification

- Full Node 24 suite: **251 passed, 0 failed**.
- Focused protected UI/resource suite: **16 passed, 0 failed**.
- Adjacent bridge/CSP/contract suites: **15 passed, 0 failed**.
- Runtime tests resolve a fake `ui/initialize` response containing fake sensitive `hostInfo`/`hostContext`, prove only the fixed audio-capability boolean is rendered, and prove no `ui/message`, audio playback, or Web Audio context is created.
- Static checks prove the public UI contains no `ui/message`, `sendMessage`, or `hostInfo` use.
- `git diff --check`: clean.

## Future device acceptance plan

This plan is not authorization to deploy, retest Rank A, or send audio. It requires separate approval and one device session maximum with no retries.

1. Deploy only the exact reviewed diagnostic candidate to authenticated staging, then open its resource in ChatGPT on iPhone.
2. Read the fixed capability line without invoking any audio tool.
3. If `未宣告`, stop: the embedded audio-message route is unsupported in that host session.
4. If `已宣告`, record only that advertisement. Do not infer rendering, audibility, privacy, or persistence.
5. Any later fixed synthetic-tone `ui/message` probe requires independent privacy/persistence authorization, and the audio must be treated as a user chat message because that is what the SDK documents. A visible transcript check can show conversation insertion, but the iframe cannot prove model-context exclusion or host retention policy. If the host cannot supply that guarantee, stop rather than send.

## Sole next-step recommendation

Do **not** continue adding ChatGPT-embedded private-playback experiments for V1. The total-control decision should adopt a **scope amendment for one user-launched authenticated playback entrypoint outside the MCP Apps iframe** - for example, a dedicated authenticated playback surface where the bearer is supplied through a normal authorization/session boundary, never a URL token, and audio is not inserted into the chat thread. That entrypoint would require separate design, authority, deployment, and device evidence; it is not implemented here and must not be counted as V1 completion.

The only currently valid staging candidate is the diagnostic diff in this Draft delivery. It is not deployed.
