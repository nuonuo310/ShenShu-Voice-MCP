# Breeze compact cat bubble — offline candidate

Approved concept: short pale mist-blue speech bubble, small peeking tabby, two pawprints and yarn; soft shallow shading, no glass lens or thick capsule, no visible progress bar. Play/pause, waveform and total duration stay visible. Favorite and 沈述声音馆 stay below the face. The SVG cat is a scalable line-art recreation of the approved visual, not an exact raster reproduction.

## Isolation and files

Based on `afbdfcae3218e16ea66de2b0531a83d635cab947` (the undeployed Breeze playback/style repair). Independent branch `codex/breeze-cat-bubble-20261112`; no changes to the linked deployment branch or existing PR #148 branch.

- `src/breeze/app-surface.js`: Breeze resource becomes `ui://shenshu/breeze-cat-v3.html` so existing cached silver cards do not mask the new appearance. Applies the Breeze-only presentation after the existing trusted player builder.
- `src/breeze/cat-ui.js`, `ui/breeze-cat.css`, `ui/assets/breeze-cat.svg`: compact 260px maximum face, 52px minimum height (about one third lower), 16 waveform bars, borderless favorite star, cat/tail/paws/yarn, total duration and accessible play/pause labeling. CSS only targets the Breeze document. The existing hidden progress hook remains for the shared collection renderer; there is no visible seek track.
- `scripts/preview-desktop-collection.mjs`: adds optional `--breeze` to the existing synthetic preview host; default silver output stays unchanged. No second favorites backend.
- `preview/breeze-cat-offline.html`: self-contained synthetic-tone demonstration. Local browser storage is a demo saved/not-saved flag only, not production storage or private voice credentials.
- `test/breeze/bridge.test.js`, `test/breeze/cat-ui.test.js`: playback regression adapted to the cat layout, cache/resource isolation, pinned MiniMax input hashes, favorites success/remove/reload/failure and original-audio playback after failure.

## Unchanged data flow and permission boundary

Owner OAuth → existing encrypted Breeze job → outbound Windows worker → existing local synthesis → private result → same Web Audio playback. This patch changes no job, worker, provider, model, sampling, voice preset or quota code. Reopening the original ready request reads the original bytes; it does not generate again. No paid fallback.

The star reuses `desktopCollection` and existing authenticated favorite save/get/list/remove RPCs. Owner validation and encrypted D1 persistence remain server-side. Audio, full text, timestamp and stable ID retain their existing format and source-bound receipt. No new public audio URL, external image/font request, principal lookup, token, permission grant or database migration.

## Verification

Full offline suite: 520/520 PASS, 0 fail/skip. Synthetic tone only; no real provider request. Existing tests exercise exact original decoded bytes, play/stop, progress, same-request reopen, encryption and owner isolation. New tests exercise favorite failure without regeneration and unchanged MiniMax renderer inputs.

Browser visual acceptance is PENDING: headless Chromium cannot launch in this execution environment (socket operation denied); the separate browser also rejects local-file URLs. No screenshot or real-device narrow-width claim is made. The stylesheet constrains width and contains a narrow-window rule, but actual 280/320/390px layout must still be reviewed with the preview.

Generate preview from the repository:

    node scripts/preview-desktop-collection.mjs --export preview/breeze-cat-offline.html --breeze

Download/open that HTML locally, click the synthetic-tone play button, favorite, open the gallery, reload, load the favorite and play again. This tests preview interactions only; production persistence uses private D1, not localStorage. Do not mistake this tone for the saved Breeze voice.

## Rollout after visual review

No deployment performed. No change to Render settings. Keep the current live commit and environment as rollback evidence. Once the candidate is visually accepted and exact-head CI passes, use Render Save only for both existing approved-SHA keys (`SHENSHU_BREEZE_APPROVED_SHA`, `SHENSHU_STAGING_APPROVED_SHA`) and manually deploy that exact commit. Never deploy the old linked branch accidentally. No worker redownload or DB migration is needed.

After deployment, refresh tools and open the original acceptance request with its unchanged requestKey/text; the new v3 card reads the existing ready audio. Confirm audible local playback and private favorite/reload on the real host. Those live acceptance steps remain pending. MiniMax must keep the existing silver appearance and unchanged paid generation path.

## Owner preview revision

The first owner screenshot showed a bordered favorite star, too much height and length, and the cat overlapping the synthetic-preview note. Revised to a fixed maximum width of 260px and minimum face height of 52px; waveform/decorations reduced proportionally. The favorite reset uses a more specific selector to override the shared toolbar button border. Preview note gets separate clearance. Width remains fixed (bounded by viewport), not duration-driven. No playback/collection transport changes.

Second owner spacing revision: favorite star raised 9px overall (toolbar gap 7px removed plus 2px visual offset) and shifted 8px left, retaining the 36px interactive area. Cat reduced from 72×67 to 65×60px (about 10%), with its paws anchored to the upper edge. No audio or favorites behavior change.
