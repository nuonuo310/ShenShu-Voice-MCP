# P2X browser-auth media transport decision (2026-10-20)

## Evidence and status
- PR #14 offline Bearer-header HTTP media route CI #171 PASS; route is NOT mounted. This proves server-side header validation only, not playback.
- User-reported iPhone private inline WAV failure: NotSupportedError, media code 4, readyState 0.
- Existing public HTTPS fixture plays in the ChatGPT bubble. Reuse UI; do not treat this as proof of private HTTPS playback.

## Browser transport constraint
HTMLAudioElement.src is a URL load and does not expose a standard way to attach a custom Authorization: Bearer header. A protected /audio endpoint that requires Bearer cannot be consumed directly by setting audio.src. OAuth for MCP tools/call does not automatically authorize media src loads.

## Candidate gate: authenticated fetch -> local media
A sandboxed MCP Apps iframe might be able to call fetch(url,{headers:{Authorization:Bearer...}}), then use a Blob URL or MediaSource to play returned bytes. This requires: (a) a safe host-approved credential transport (do not expose the MCP OAuth token to UI JS by default), (b) explicit CSP connect/media permissions, (c) CORS correctness, (d) iPhone WebView playback validation, (e) bounded private data and cleanup. Without a safe credential path, do NOT implement this as production.

## Decision
No production route or audio ticket URL is authorized yet. Do not put bearer/ticket tokens into URL or a permanent public endpoint. Do not silently use cookie auth without CSRF, SameSite, iframe partitioning and session binding review. Do not use the offline in-memory ticket store in production.

## Next exclusive engineering action
Build an isolated browser/CSP compatibility test for nonsecret fixture data, or verify an officially supported MCP Apps authenticated resource transport. Keep it offline until the client transport is evidenced. Only then select private delivery architecture and test on iPhone. Do not enable MiniMax, paid tools, D1 quota mutations or change the Call/Voice-Worker freeze.
