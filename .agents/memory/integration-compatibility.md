---
name: Integration compatibility
description: Non-obvious compatibility lessons for future integration and testing work
---
The development Vite plugin pipeline can reject explicit JSX generic arguments even when TypeScript accepts them.

**Why:** A generic component call rendered a Babel syntax overlay after a clean typecheck.

**How to apply:** Prefer inferred JSX props with guarded callbacks when this happens. Confirm the transformed module serves successfully; typechecking alone does not verify rendering.

YouTube can serve a bot-confirmation challenge inside the test browser even when official oEmbed metadata and the official publisher embed are available.

**Why:** An iframe loading successfully did not establish actual video playback.

**How to apply:** Test playback separately from embed rendering, retain a direct provider link, and report provider-blocked playback honestly rather than changing security settings or rehosting media.

Do not assume integration reference examples match the installed Whop SDK: the installed major version may use a different generated client API. Check actual typings or use the documented connector proxy without exposing credentials.

**Why:** The template used older SDK conventions while the installed package used a different API layout.

**How to apply:** Verify provider request contracts and explicit API versions before changing billing code. Fail closed on unknown membership data.

Orval can generate colliding path-parameter and query-parameter type names for an operation combining both. Inspect generated exports rather than repeatedly changing barrels; codegen rewrites barrels.

**Why:** Barrel edits were overwritten by codegen, leaving the collision.

**How to apply:** Resolve naming at the generator/spec level. Keep browser iterable types enabled for generated Headers.entries calls.

The local downloaded Chromium runner may fail with missing shared libraries; adding arbitrary Nix library paths can instead produce a glibc ABI mismatch.

**Why:** Both errors occurred when attempting local interaction tests.

**How to apply:** Use a supported browser environment; do not report screenshot inspections as interaction tests.

The managed testing browser can explicitly disable graphics and offer no launch-argument control, even when its normal page and video checks work.

**Why:** A targeted capability probe returned no native WebGL2 context and the browser process used `--use-gl=disabled`; unsupported graphics was an environment limitation, not a viewer defect.

**How to apply:** Probe actual WebGL2 support before spherical-render acceptance. If it fails with fixed browser settings, report rendering/marker interaction as blocked and require a graphics-capable browser rather than repeating unchanged tests.

Injected browser responses may normalize missing cross-origin headers.

**Why:** Removing a CORS header did not cause a denial, whereas an explicit mismatched origin produced a genuine browser security rejection.

**How to apply:** Treat CORS fault injection as verified only when the browser's effective response behavior and explicit security diagnostic establish denial; a handler's intended headers or an image error alone are insufficient.
