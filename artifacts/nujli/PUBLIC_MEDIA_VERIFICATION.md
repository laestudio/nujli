# Public-media viewer verification

**Run:** November 2, 2026, UTC (November 1 in America/Los_Angeles).
**Outcome:** Partial verification, not full immersive-project acceptance.

## Scope and method

The user directed “use public data” when asked for organization-authorized media.
Sources and explicit reuse terms were checked first; the machine-readable register
is `tests/public-media-sources.json`.

A single desktop browser pass imported the actual `ImmersiveViewer` and application
CSS through an in-memory interception of `/src/main.tsx`. The browser displayed
“TEST ONLY — real public media; no organization approval or humanitarian claims.”
The component and media loaders were not replaced. Successful media requests used
real remote files, not generated imagery, local replacement files, or stubbed
successful responses.

Project wrappers, confirmed flags and the comparison claim were explicitly marked
test inputs. They were not saved project evidence or organization confirmations.
No database writes, new application routes, approval changes, publication or
deployment were performed. Unrelated media was not attached to the Palestine
demonstration. Browser fault injection is distinguished below from natural errors.

## Source and permission register

### Panorama

- **Kloofendal 48d Partly Cloudy**, Greg Zaal / Poly Haven.
- [Original source](https://polyhaven.com/a/kloofendal_48d_partly_cloudy).
- [Original tonemapped JPG](https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/kloofendal_48d_partly_cloudy.jpg).
- [Publisher's explicit CC0 asset terms](https://polyhaven.com/license).
- Real photographed environment, not the rendered thumbnail or edited pure-sky
  variant. Capture date not established; not humanitarian or Palestine evidence.

### Video

- **Amaryllis opening**, Amada44, real silent flower time-lapse.
- [Source, authorship and copyright-holder public-domain dedication](https://commons.wikimedia.org/wiki/File:Amaryllis_opening.ogv).
- [Permission-page revision](https://commons.wikimedia.org/w/index.php?title=File:Amaryllis_opening.ogv&oldid=790241894).
- [Original Ogg](https://upload.wikimedia.org/wikipedia/commons/3/34/Amaryllis_opening.ogv).
- [Actual Wikimedia VP9 WebM derivative used for successful playback](https://upload.wikimedia.org/wikipedia/commons/transcoded/3/34/Amaryllis_opening.ogv/Amaryllis_opening.ogv.480p.vp9.webm).
- Capture date is unknown. The 2009 upload date was not used as a recording date.
  Not humanitarian evidence. No music or identifiable-person permissions involved.

### Dated observations

- **Aral Sea, Terra MODIS**, NASA Earth Observatory.
- [Source listing exact image dates and originals](https://science.nasa.gov/earth/earth-observatory/world-of-change/aral-sea/all-images/).
- [Context describing the same geographic subject across years](https://science.nasa.gov/earth/earth-observatory/world-of-change/aral-sea/).
- [Earlier original: August 25, 2000](https://assets.science.nasa.gov/content/dam/science/esd/eo/woc/images/aral/aralsea_tmo_2000238.jpg).
- [Later original: August 19, 2014](https://assets.science.nasa.gov/content/dam/science/esd/eo/woc/images/aral/aralsea_tmo_2014231.jpg).
- [NASA informational media use guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).
  These permit factual informational use subject to their terms, attribution,
  third-party rights exceptions and no implied endorsement; not an unrestricted
  grant for NASA branding or promotional use.
- Dates came from source captions, not filename inference. The comparison's test
  claim was assembled test text, not a verbatim NASA quotation or a confirmed
  humanitarian-project claim. No donation attribution or organizational endorsement.

## Observed results

| Status | Observation |
| --- | --- |
| PASS | Panorama original HTTP 200, 5,275,330 bytes, loaded dimensions 8192 × 4096 (2:1). |
| BLOCKED | Browser logged `PSVError: WebGL 2 is not supported`. No textured spherical render or spatial marker click established. |
| PASS | Confirmed-flag media hotspot opened through the list; real caption/source, unknown capture/publication dates, test organization/project labels and explicit limitations appeared. Unconfirmed point absent; detail closed. Confirmation flags here are mechanical inputs only. |
| PASS | Ordinary-media label, manual journey navigation, no autoplay; real NASA image loaded at 720 × 720. |
| FAIL | Original Ogg: HTTP 200, application/ogg, 1,027,659 bytes, but browser media error 4, no decoded dimensions or progress. This is a codec/browser limitation, not evidence of a network outage. |
| PASS | WebM derivative: HTTP 200, video/webm, 96,346 bytes, decoded 640 × 480, duration 1.56 seconds. Manual playback advanced to 1.56 seconds and ended. This is a separate successful format check, not a fix to the original Ogg URL. |
| PASS | Pending/rejected-only inputs yielded evidence-only mode, no media stage, map link retained. |
| PASS | Real square NASA image loaded at 720 × 720 and was explicitly rejected as non-2:1. Evidence/source remained available. |
| PASS | A deliberately injected video HTTP 503 produced an explicit media error while retaining source/evidence; the browser visibly identified it as a controlled fault. |
| PASS | Both actual dated NASA images loaded at 720 × 720 with their date quotes, source links and the no-financial-impact/no-donation-attribution disclosure. Test claim and confirmation caveats were visible. |
| BLOCKED initially; PASS on retry below | Initial CORS experiment removed Access-Control-Allow-Origin, but the test harness rewrote that header to the app origin. Image loading succeeded; that initial attempt did not establish denial. The targeted retry below supersedes this gap. |
| PASS | Separate screenshot of unchanged public explorer showed the disclosed Palestine demonstration and no unrelated test media. |

## Reproducibility and evidence

Local diagnostic output is under the ignored, deployment-excluded directory
`generated-artifacts/public-media/`:

- `replay.js`: in-memory fixture module and browser observations. This is a
  diagnostic capture, not a standalone automated suite. Its optimized React
  module URLs must be derived again for a new Vite session.
- `results.json` and `report.md`: measured results.
- `screenshots/README.md`: browser observation screenshot references; these are
  session references, not durable image files.
- `explorer-unchanged.jpg`: actual saved screenshot of the public explorer.
- `retry-report.md` and `retry-results.json`: targeted retry capability probes,
  exact CORS diagnostic and screenshot reference.

The source register and this report are retained in version control; large media,
browser wrappers and diagnostic output are not bundled with the production app.
To repeat, use a supported browser against the managed frontend workflow, intercept
only the entry module in that browser, import the real component/CSS, and use the
source register. Never seed or publish these test wrappers. Confirm media decode
and actual playback, not just successful HTTP responses.

## Targeted retry — November 2, 2026 (UTC)

The user requested a retry of only the two blocked browser checks. No unrelated
flows were rerun, and no application code, records, media or published content
was changed.

### CORS failure handling: PASS

The retry fetched the same real Poly Haven original (HTTP 200, `image/jpeg`,
5,275,330 bytes; upstream Access-Control-Allow-Origin `*`) and fulfilled its actual
bytes with `Access-Control-Allow-Origin: https://not-the-app.invalid`.
Unlike removal of the header, the explicit mismatch produced a real Chromium
security rejection:

> has been blocked by CORS policy: The 'Access-Control-Allow-Origin' header has a
> value 'https://not-the-app.invalid' that is not equal to the supplied origin.

The request failed with `net::ERR_FAILED`. The viewer showed its source-load error
while retaining the evidence-list item and Poly Haven source link. The browser
diagnostic independently confirms the effective nonmatching header; the blocked
request did not expose a page-level response event. This was controlled CORS
fault injection, not a source outage, HTTP error or decode error.

Browser screenshot reference `mslpri` records the test-only disclosure, load error,
source link and evidence list. As with the initial pass, this is a session
observation reference, not a durable screenshot file.

### Spherical rendering and spatial marker interaction: BLOCKED

Chromium 140.0.7339.16 returned null from its native
`canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false })` probe.
VERSION, RENDERER and VENDOR were consequently unavailable. The managed browser
process explicitly uses `--use-gl=disabled`; the available browser-context
controls cannot alter its launch arguments, so a supported SwiftShader
configuration was not available. No graphics support was spoofed, application
fallback bypassed or arbitrary local browser installed.

The panorama's original file loading and evidence-list interactions remain
established, but actual textured spherical rendering and spatial marker
click-to-details still require a WebGL-2-capable browser. Retrying this unchanged
browser configuration would not resolve that capability gap.

## Acceptance boundaries and unresolved checks

1. Repeat only spherical rendering/marker interaction in a WebGL-2-capable browser.
2. Genuine browser CORS denial and retained evidence/source behavior are now
   established by the targeted retry; the initial failed injection is retained
   above as historical context.
3. Organization-confirmed hotspot positions and project comparisons still require
   a participating organization's records. Public reuse rights alone cannot supply
   them. No signed-in editor, save/read/reconfirmation, or full project acceptance
   is established by this in-memory component test.
4. No fresh workspace typecheck, database regression run, mobile/screen-reader or
   paid-organization test was performed here. Those historical or separate checks
   must not be inferred from this report.
