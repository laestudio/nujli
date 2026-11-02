# Immersive evidence acceptance

## Delivered scope

The existing project view and organization correction form are extended, not replaced.

- Mode A uses Photo Sphere Viewer for explicitly organization-confirmed, permission-approved equirectangular images. Loaded dimensions must be 2:1; failure produces an error and keeps the evidence list available. Aspect ratio alone never authorizes a panorama.
- Mode B is labeled **Photo journey / ordinary media**. Photos and videos are navigated manually; no reconstruction or autoplay is used.
- Mode C retains the existing evidence layout when no authorized media is available.
- Scenes and hotspots reference saved project evidence. Organizations confirm each hotspot, its position and limitations. Editing linked records revokes dependent confirmations in the editor; server checks prevent simultaneous evidence substitution and confirmation. Generation clears immersive confirmations.
- Before/after pairs require chronological, source-documented scene dates and a claim quoting both dates, plus organization confirmation.
- Donation-date filtering uses server-owned per-record first-publication dates. Unchanged evidence keeps its original publication date across row replacement and republication. Unknown historical dates are excluded, not invented. No financial attribution is made.
- The public-data demonstration also retains a separately labeled reported-entry-date filter for financial exploration. It composes with, but does not replace, publication-date donation filtering. Incoming financial charts, tables, source sheets and demonstration disclosures are preserved.
- The existing citations, independent reviews and evidence labels remain intact. Hotspot confirmation never confers independent-review status.
- The viewer offers keyboard controls, a list alternative, reduced-motion behavior, an evidence-only option, a persistent map link and mobile bottom-sheet evidence.

## Initial implementation verification (historical)

The following records the initial implementation checks, not a fresh build or
organization acceptance. The public explorer now contains a separately disclosed
public-data demonstration, so the original zero-project observation is historical.
See the public-media verification below for the current browser results.

| Status | Check |
| --- | --- |
| PASS | `pnpm run typecheck` across the workspace |
| PASS | 15 tests across `immersion.test.ts`, `publication-dates.test.ts`, and `safety.test.ts` |
| PASS | Database save/read round-trip, reference remapping, rollback on invalid edits, organization isolation, draft privacy and generation reset |
| PASS | Content-based publication ledger: unchanged republication preserves dates; client-supplied and event dates cannot establish publication |
| PASS | Both managed services start; health endpoint returns 200; unsigned organization-project request returns 401 |
| PASS | Public explorer screenshot renders; public summary has zero projects; no sample records were published |
| BLOCKED | Real authorized panorama rendering and video playback: no authorized published dataset exists |
| BLOCKED | Real dated before/after acceptance: no authorized comparison dataset exists |
| NOT TESTED | Signed-in organization editor interactions in a browser |
| NOT TESTED | Screen-reader and physical mobile-device testing of the new immersive controls |
| NOT TESTED | Paid organization journey; separate acceptance scope, not established by this work |

The database tests use clearly labeled SAMPLE drafts, never publish them, and delete their fixtures afterward. Typechecking and a screenshot are not end-to-end acceptance.

## Public-media verification — November 2, 2026 (UTC)

The user requested **“use public data”** instead of supplying organization media.
Real, explicitly reusable public files were therefore exercised through the actual
viewer in an isolated browser session. No records were saved, no media was added to
the Islamic Relief demonstration, and nothing was published.

| Status | Check |
| --- | --- |
| PASS | Original Poly Haven panorama loads at 8192 × 4096; source and permission recorded |
| BLOCKED | Textured 360 rendering and spatial marker interaction: retry confirms native WebGL 2 context creation fails; managed browser launches with `--use-gl=disabled` and exposes no launch-argument control |
| PASS | Ordinary photo journey, manual navigation, no autoplay, NASA image loading |
| PASS | Actual Wikimedia WebM video decodes at 640 × 480 and plays to its 1.56-second end |
| FAIL | Original Wikimedia Ogg cannot decode in the test browser (media error 4), despite HTTP 200; the viewer exposes its error |
| PASS | Confirmed-flag hotspot list/detail, source, unknown dates, limitations, and exclusion of unconfirmed points; **test inputs, not organization confirmations** |
| PASS | No-permitted-media mode retains map return and shows no media stage |
| PASS | Real square image is rejected as a panorama with evidence/source retained |
| PASS | Controlled video HTTP 503 shows an error without removing source/evidence |
| PASS | Actual NASA comparison images load with source-documented August 25, 2000 and August 19, 2014 dates and no donation attribution; **display verification only** |
| PASS | Targeted retry: actual panorama bytes with an explicitly nonmatching cross-origin header trigger Chromium's CORS rejection; source/evidence list retained. Controlled fault injection, not a source outage |
| BLOCKED | Organization-confirmed hotspots and source-backed project before/after acceptance: public reuse licenses do not establish those confirmations |
| NOT TESTED | Signed-in correction/save/reconfirmation flow, mobile/screen readers, paid organization journey |

Detailed methods, source permissions, limitations and reproducibility notes:
[Public-media verification report](PUBLIC_MEDIA_VERIFICATION.md).
The original organization acceptance remains unresolved; these results must not
be represented as full real-project acceptance.

## Operating notes

- The database migrations add immersive configuration and publication history. Development schema was applied; production was not changed.
- Existing records with no recorded publication history remain undated for donation filtering until a future publication is actually recorded.
- Panorama hosts must allow cross-origin image loading. Unsupported dimensions, host restrictions and rendering failures are shown explicitly; media is not replaced with generated imagery.
- Correct media or claim content and save before reconfirming its spatial evidence. Saving continues to reset approval and unpublish, exactly as the existing review flow requires.
- The user authorized implementation before the separate initial acceptance was resolved. That acceptance is not implied by this delivery.
