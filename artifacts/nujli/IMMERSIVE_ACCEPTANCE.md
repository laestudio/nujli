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

## Verification

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

## Operating notes

- The database migrations add immersive configuration and publication history. Development schema was applied; production was not changed.
- Existing records with no recorded publication history remain undated for donation filtering until a future publication is actually recorded.
- Panorama hosts must allow cross-origin image loading. Unsupported dimensions, host restrictions and rendering failures are shown explicitly; media is not replaced with generated imagery.
- Correct media or claim content and save before reconfirming its spatial evidence. Saving continues to reset approval and unpublish, exactly as the existing review flow requires.
- The user authorized implementation before the separate initial acceptance was resolved. That acceptance is not implied by this delivery.
