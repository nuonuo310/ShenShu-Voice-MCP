# Breeze daily / kiss / breath — manual local audition candidate

Owner scope: only daily, kiss and breath. Baseline is PR #149 commit
`e57eb8a13e27c72d3f3e5335f06353405ec794c6`. Independent branch;
no deployment branch edits, merge, Render configuration, migration, paid request
or real Call. Other emotions have no buttons, IDs or usable placeholders.

## Behavior and boundaries

- `src/breeze/presets.js` is the single immutable configuration. Omitted
  `presetId` resolves to daily; explicitly unknown IDs fail before HTTP.
- daily retains the exact old multipart fields: shenshu_04_natural, seed 7,
  cfg 1.2 and the unchanged natural Chinese daily instruction.
- kiss and breath both use seed 7 / cfg 2.0, but have distinct instructions
  and text rules. By default exactly one appropriate tag must occur between spoken text;
  mixed, duplicate, unknown or trailing tags are rejected. Event text cannot
  begin with 爱爱. Kiss requires an established kiss action before the tag and
  rejects explicit sound-effect/narration wording. Breath must have spoken text
  before and after the pause. The validator enforces structural prerequisites,
  not acoustic quality; only human listening can assess voice and naturalness.
- Q8_0 / Intel UHD 770 Vulkan are owner-declared existing server settings,
  not settings this adapter changes or independently probes.
- `synthesizeLocalBreeze({text,presetId,...})` supports the new argument.
  The existing worker and ChatGPT tool continue to expose only their original
  daily behavior. No event parameter is added to model-visible tools, Call,
  automatic emotion routing, queue schema or cloud favorites.
- An **independent local audition page** reuses the cat bubble markup, CSS and
  SVG. It contains the manual three-choice list and native browser audio
  playback controlled by the bubble. It does not change the embedded cloud
  player's collection controls or add audition entries to the cloud gallery.
  Event integration into ChatGPT/Call is not part of this first manual closure.

## Local flow

Manual selection + edited text -> POST /api/generate `{id,text,presetId?}` ->
validate -> persist an attempt BEFORE synthesis -> one loopback multipart POST
/v1/audio/speech -> existing actual 24k PCM to 16k WAV conversion -> local
request.json + audio.wav + result.json -> explicit click to play -> optional
human review.json. No autoplay, batch generation or automatic retries.

An existing ID returns its stored result, including failed/unknown attempts;
changed text or preset with the same ID conflicts. A process-wide busy gate
prevents concurrent local audition requests. No automatic synthesis repair for
an upload/playback/load error. After uncertain completion use Refresh records
first; do not create another attempt just to fix the player. The separate
chat worker can still contend for Breeze's one synthesis slot: do not submit
chat generation during audition. Busy rejection is retained without retry.

## Privacy

Server listens only on 127.0.0.1:8082; Host + Origin/Fetch-Site checks, per-process
page token for every API/audio read and write, no CORS, no-store and no external
assets. No public or permanent audio URL. Model endpoint remains 127.0.0.1:8080.
No cloud credentials are needed or read. Ordinary generation logs contain only
presetId, seed, cfg, status; original text and review notes are never logged.

Private output defaults to `%LOCALAPPDATA%\ShenShu\BreezeAuditions` on Windows.
Each random ID directory retains request.json (text, exact instructions/rules,
parameters, owner-declared hardware), audio.wav, result.json (duration/hash/state)
and, after human action, review.json. These are private local audition artifacts,
not ordinary logs; keep them in the user's local profile, do not commit/upload.
Unix directories/files use 0700/0600; Windows inherits the user's profile ACLs.
No deletion or pruning job. Override only this audition output with
SHENSHU_BREEZE_AUDITION_DIR; never change/delete the existing worker attempts.

## Starting on the owner's computer

Download this candidate's exact commit ZIP from the private repository and
extract it into a **new** folder, leaving the running bridge installation intact.
Runtime uses Node 24 built-ins; no npm install, model reinstall or cloud deploy.
Keep the existing Breeze model window open until it says listening on 8080.
From a fresh PowerShell window, invoke:

```powershell
& 'PATH-TO-EXTRACTED-REPOSITORY\scripts\breeze\start-audition.ps1'
```

Open http://127.0.0.1:8082/ after the URL appears. Port override:
SHENSHU_BREEZE_AUDITION_PORT. Endpoint override supports loopback only.
The page is private to the local computer; other devices cannot use it.
Stop with Ctrl+C; original worker, cloud player and MiniMax remain independent.
No Render approved-SHA update is needed. Rollback: close this audition server;
original route was not replaced. Existing cloud worker may keep its old adapter.

## Stability protocol — HUMAN REVIEW PENDING

The page includes three distinct natural sentences for kiss and three for breath.
Buttons fill text only; each generation is explicitly manual. Keep default daily
for a baseline check, then audition all six one at a time. Listen to the whole
clip and record: same ShenShu voice/no sudden change; natural/not exaggerated;
action or breath integrated into speech; clarity; no narration/effect impression
or mechanically appended ending. Kiss must be the current speaker's action.

The page enables candidate review after playback ends; accepting requires all
five checkboxes. Rejection can retain failing axes and private notes. Each verdict
covers **only that candidate**, never changes preset status to stable. Failed or
ambiguous attempts remain visible and cannot be silently regenerated with that ID.

No real model is reachable in this execution environment. Automated tests use
synthetic PCM and mocked fetch; they do NOT establish six real generations,
audible naturalness, hardware performance or stability. Those six owner-computer
audios and reviews must still be produced. Real Call stays closed pending a
separate decision after local stability review.

## Files and validation

- src/breeze/presets.js — central presets/text rules
- src/breeze/local-adapter.js — additive presetId, exact daily compatibility
- src/breeze/audition-candidates.js — six manual candidates
- src/breeze/audition-server.js — private loopback server + local persistence
- src/breeze/audition-ui.js / ui/breeze-audition.js — manual cat player + review
- scripts/breeze/audition.mjs / start-audition.ps1 — explicit local launch
- test/breeze/presets.test.js — params/rules, boundary rejection, persistence,
  restart/idempotency/failure/busy, log privacy, browser click flow and no autoplay

Automated validation results are recorded in the PR delivery receipt. No actual
browser visual screenshot or real Breeze audio is represented by DOM tests.

## Kiss instruction comparison v2 — pending real listening

Owner reports: initial kiss candidate had weak scene continuity; a manually
revised sentence retained appropriate pace and warmth but the event sounded
like a soft hum, without a clear kiss. These are owner listening reports, not
independent audio inspection. First candidate was marked needs adjustment by
the owner. No stable-support finding.

Change only kiss instruction for the next comparison: remove inherited daily
instruction prefix and explicitly describe a brief lip-action sound with
continuous voice, pacing and warmth before/after. Same revised text, voice,
seed 7 / cfg 2.0; daily, breath, UI and all generation paths unchanged. Existing
local request.json files retain the old exact instruction, enabling comparison.
No real new generation or listening performed in this environment.

## Kiss instruction comparison v3 — pending real listening

Owner subsequently regenerated the 78-point text and reported similar delivery
with a clear kiss still present. Changing only one short opening phrase retained
a clear kiss but the spoken delivery felt more daily. These are listening
reports; no bit-identical reproduction, stable preset or root-cause proof claimed.

V3 adds one instruction passage for continuous soft, lightly smiling delivery
and adult voice identity. V2 lip-action instructions, voice, seed, cfg, daily and
breath are unchanged. Compare on the most recent opening-phrase variant, with
identical text; do not also change the sentence. New V3 audio is NOT_RUN here.

## Manual kiss cue comparison — tag OR literal mwah

The owner heard two kiss-like sounds when both `[亲吻]` and `mwah` were
supplied, with daily/lightly smiling delivery. It is a listening report, not
proof that each cue independently fired. The preceding V3 tag-only attempt
was judged warm with good pace but an ambiguous hum-to-vowel event.

The page now offers a secondary control only under kiss: `tag` (default) or
`mwah`. This is NOT a fourth preset or an automatic emotion option. Only the
manual audition API/adapter accepts optional `kissCue`; model-visible tool,
cloud worker, daily and breath remain unchanged. Unknown cue or cue specified
for non-kiss fails. In tag mode require one embedded `[亲吻]` and reject a
literal mwah; in mwah mode require one embedded whole-word mwah (case-insensitive)
and no bracketed tags. Both need preceding kiss-action text, following speech
and context before 爱爱. No silent replacement, injected sound file or extra
generation. Candidate-fill buttons explicitly select tag mode.

The instruction is byte-identical across both cue choices (including its
existing tag wording); only input text changes. Same voice/seed 7/cfg 2.0. This
is a controlled text-cue experiment, not a promise that a literal word becomes
a nonverbal event. Human review must reject read-aloud letters/syllables, two
events, timbre changes or lost warmth. In particular, no automatically chosen
cue and no new Call access.

New private request manifests retain kissCue and exact text/parameters; history
labels the choice. Old manifests read as tag and all old clips remain playable,
including past mixed-cue attempts. Default tag request digests remain unchanged;
new mwah digests bind the cue. Existing IDs never synthesize again.

Validation: full local suite 529/529 PASS, including literal/tag exclusivity,
unknown/non-kiss cue rejection, exact unchanged multipart instruction/params,
manual selector payload, no selection-triggered synthesis, persisted cue,
idempotent replay and conflicting same-ID cue. Real new mwah-only listening
remains NOT_RUN in this environment. Original source model card and C++ runtime
README explain inline descriptive events but do not guarantee a stable kiss:
https://huggingface.co/BreezeBlue/Breeze-TTS-2/blob/main/README.md
https://github.com/HoppouAI/Breeze-TTS-2.cpp/blob/main/README.md
