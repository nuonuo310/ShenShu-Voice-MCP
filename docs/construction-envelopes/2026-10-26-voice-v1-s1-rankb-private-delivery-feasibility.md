# Voice V1 S1 — Rank B private delivery feasibility and narrow implementation decision

Authority: ShenShu total control, 2026-10-26. Parent is PR #128 exact head `e902cb29e18ebf91882a28814273c09a4753cc68`. This is a single bounded offline engineering task; NOT cloud/deploy/provider authorization. Immutable V1 nine gates, strict 2/9, B1-B4 open.

## Evidence and binding decision
iPhone native ChatGPT private fixture failed twice on already-deployed staging `9b938724f94f3053b6267f9fd90567da07e8de96`: first Web Audio ran/decode/source ended but silent; second after user positively checked speaker/output state still silent. STOP Rank A repeat attempts. Public OAuth hosted HTTPS WAV became audible after user restored speaker/output; this proves only public hosted tone, not private HTTPS. Earlier private data: WAV HTMLMediaElement failed NotSupportedError code 4. No additional Web Audio retest.

## Mission
Read `docs/v1-closure/S1-IOS-AUDIO-ROUTE-DECISION-20261026.md`, `docs/v1-closure/V1-CLOSURE-PLAN.md`, existing `src/private-https-audio-response.js` if present, protected MCP tool/resource code, `ui/mcp-bubble.html`, and current staging contract. Independently identify whether **one** minimal privacy-safe Rank B route is possible in the actual ChatGPT MCP Apps iframe without public audio URLs or secrets in URLs/logs.

Check transport constraints explicitly: HTMLAudioElement cannot set OAuth bearer header; current resourceDomains and CSP do not establish media authorization; cookie/SameSite/third-party context cannot be assumed; Blob/object URLs must be supported by actual host policy, not presumed; one-time capability URLs may leak bearer-like secrets and are not authorized. Consider whether a host-provided authenticated resource/blob route is actually supported by existing MCP Apps APIs and code, with grounded evidence. If no feasible secure transport is established, report BLOCKED with one precise missing proof and one minimal nonbillable way to obtain it; do not implement a speculative endpoint.

If a secure path can be proved offline, implement ONLY a dormant staging-only private audio prototype with fixed fixture, no real provider, no D1, no new persistent service, no public permanent URL. Include authentication, expiry/replay/subject isolation as applicable, MIME/size validation, CSP and no-leak tests. Keep existing public mock unchanged. Provide one exact iPhone acceptance procedure and one rollback. Do not create additional routes or transport families.

## Hard stop and limits
One offline investigation/implementation cycle only. No endless diagnostic rounds. Do not revisit Rank A, re-test Web Audio, or broaden V1 scope. If the only viable path requires new cloud infrastructure, insecure URL token, unverified cross-site cookies or production changes, STOP with total-control decision rather than constructing it.

## Opening gate and delivery
Verify exact repo, origin, parent commit, clean isolated worktree, PR stack, CI and staging deployed SHA. Never reset/clean/stash/rebase/merge others' work. Produce `docs/v1-closure/S1-RANKB-PRIVATE-DELIVERY-FEASIBILITY-20261026.md`; optional narrow code/tests only if justified. Run focused/full Node24 tests if code changes; normal CI. Open one Draft PR stacked on this authority branch. Report COMPLETE/BLOCKED/TOTAL CONTROL DECISION REQUIRED with exact HEAD, tree, PR, CI, changes, unresolved trust boundary, next actionable choice. Real Render/Auth0/Cloudflare/D1/Worker/MiniMax/MCP calls, secrets, deployments, route changes, manual Actions dispatch and merges = 0. Voice V1 2/9.
