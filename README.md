# 最新施工状态（2026-10-19）

- **P1-MOCK 已部署并在 ChatGPT 中由用户确认听到声音**：现有 `/mcp` 注册的 `preview_shenshu_voice` 只返回固定英文样本，不调用 MiniMax。
- **P2 付费合成内核已暂存、未开放**：`src/minimax-adapter.js` 和 `src/live-voice.js`。后者要求外部可信、一次性的授权结果；当前无 OAuth、持久额度门禁和可靠的音频交付验证，所以绝不能接到当前 No-auth `/mcp`。
- GitHub CI 14/14 测试通过，MCP HTTP initialize smoke 通过。**不代表真实 TTS 已接通。**
- 下一步：先验证身份与额度配额，然后验证 ChatGPT UI 音频交付，最后在用户明确批准后做单次 MiniMax 付费测试。

详见 [LIVE-SECURITY-GATE](docs/LIVE-SECURITY-GATE.md)。

---

# ShenShu Voice MCP — isolated P0 scaffold

Status: **offline contract + chat bubble preview only**. This is NOT yet a working MCP endpoint, has NO MiniMax implementation and NO ChatGPT connection. No deployment has occurred.

## Why separate?

Keep `nuonuo310/Asteria-Call`, `nuonuo310/Asteria-Voice-Worker`, and `nuonuo310/ShenShu-Voice` unmodified. The Asteria Worker contract is a **read-only reference**, not a shared production dependency.

## Verified upstream behavior (read-only 2026-10-19)

The Asteria Voice Worker accepts `POST /assistant-voice`, `{ "text": ... }`, header-only bearer authentication, maximum 800 UTF-8 bytes, uses fixed MiniMax voice `speech-2.8-hd` by default, returns strictly validated 16 kHz mono 16-bit PCM WAV lasting .2–60 s. Its endpoint explicitly does not provide MCP, OAuth, CORS, or public TTS.

This project deliberately DOES NOT copy its production token or depend on its deployment. It shares only non-secret contract facts.

## P0 delivered in this scaffold

- Pure input contract and WAV validator, independent of Call.
- Voice-record contract for future MCP UI exchange.
- Offline preview of existing `voice-bubble` visual direction, with inert playback and favorite buttons clearly labeled.
- Node built-in tests; no network or paid API use.

Commands:

```bash
npm test
npm run dev
```

Open http://127.0.0.1:3187 (loopback only). For Windows PowerShell use `npm.cmd` if scripts are blocked.

## P1 authorized design (not implemented)

1. Register `speak_shenshu` MCP tool and `ui://shenshu/bubble` UI resource with MCP Apps SDK.
2. **Require verified user-specific authentication before any paid generation**; do not expose an unauthenticated public synth endpoint or place MiniMax API keys in UI, arguments, logs or git. Implement a bounded request budget and no silent retries.
3. In a new, separately deployed service call MiniMax with separately provisioned secrets. Use `speech-2.8-hd`, fixed approved voice ID, one call per explicit request; do not let a caller choose arbitrary IDs/models.
4. Strictly validate upstream response and WAV audio format; do not forward unexpected binary or upstream errors verbatim.
5. Provide short-lived, authorized HTTPS audio delivery, no public indefinite links and no credentials in URLs. A backend audio store must have explicit TTL and authorization.
6. Add MCP Apps bubble UI, playback/pause/progress, no autoplay. Treat "favorite" as disabled until verified shared persistence is available.
7. Test desktop/iPhone host playback against mock first; paid single-utterance smoke after explicit approval and environment gates.

## Risks and stop conditions

- No source changes to either Call repo or current voice gallery.
- No uncontrolled concurrent paid TTS requests, no retries on uncertain billing.
- Shared MiniMax account quotas can still affect Call even if code/runtime is isolated. Start with hard disabled-by-default and strict quotas; consider dedicated account/limit for genuine separation.
- Do not advertise any ChatGPT UI or live MCP success from this P0 scaffold.
- If missing credentials / auth / SDK-host compatibility / resource limitations, STOP and report rather than bypassing.

## Source references

- https://github.com/nuonuo310/Asteria-Voice-Worker
- https://github.com/nuonuo310/ShenShu-Voice
- https://apps.extensions.modelcontextprotocol.io/api/documents/Quickstart.html
