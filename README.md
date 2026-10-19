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
