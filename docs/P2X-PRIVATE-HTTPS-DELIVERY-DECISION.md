# P2X private HTTPS audio delivery decision — NOT DEPLOYED

## Observed evidence
- Existing ChatGPT voice bubble has played a fixed HTTPS fixture on iPhone, per user report.
- OAuth private fixture tool returned a synthetic WAV record, but playback failed with NotSupportedError, HTMLMediaElement error code 4 and readyState 0 on iPhone (2026-10-20). The data: inline WAV source is suspect, but error does not prove CSP alone.
- PR #9 Blob URL probe CI failed an existing test that explicitly forbids blob URLs; it remains draft and must not be merged without a separate policy review.
- PR #10 offline one-time ticket prototype CI #164 succeeded, but the in-memory Map is NOT durable or suitable for Render deployment.

## Architectural constraint
An HTML <audio> element fetching HTTPS audio cannot generally attach a bearer Authorization header by itself. A plain public URL containing a secret token in the query string is forbidden. A browser fetch with Authorization followed by Blob URL may face iframe CSP/media-src restrictions and requires independent mobile verification. OAuth authentication of the MCP tools/call request does NOT automatically authenticate a separate media element request.

## Next implementation gate
1. Prototype server-side authorized media retrieval over HTTPS using an authenticated request path with no credentials in query parameters. Choose a transport that the ChatGPT MCP Apps iframe actually supports, and document exact media/CSP behavior before deploying.
2. Durable one-time issuance/consume state must be atomic and shared across Render instances. Audio bytes need private, expiring storage; do not store large audio blobs in D1 reservation rows.
3. Verify wrong-user, expired, replayed, concurrent fetch, unauthorized access, cache-control no-store, content-type, byte limits and no accidental public access.
4. Only after an actual iPhone test passes can this path be marked delivery PASS. Do not attach MiniMax until separate paid admission gates pass.

## Explicitly prohibited
Do not reuse the in-memory ticket Map in production, expose permanent audio links, put OAuth/bearer/ticket secrets in URL, enable paid voice, touch Call/Voice-Worker or claim private audio delivery already works.
