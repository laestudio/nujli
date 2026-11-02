---
name: Integration compatibility
description: Non-obvious compatibility lessons for future integration and testing work
---
Do not assume integration reference examples match the installed Whop SDK: the installed major version may use a different generated client API. Check actual typings or use the documented connector proxy without exposing credentials.

**Why:** The template used older SDK conventions while the installed package used a different API layout.

**How to apply:** Verify provider request contracts and explicit API versions before changing billing code. Fail closed on unknown membership data.

Orval can generate colliding path-parameter and query-parameter type names for an operation combining both. Inspect generated exports rather than repeatedly changing barrels; codegen rewrites barrels.

**Why:** Barrel edits were overwritten by codegen, leaving the collision.

**How to apply:** Resolve naming at the generator/spec level. Keep browser iterable types enabled for generated Headers.entries calls.

The local downloaded Chromium runner may fail with missing shared libraries; adding arbitrary Nix library paths can instead produce a glibc ABI mismatch.

**Why:** Both errors occurred when attempting local interaction tests.

**How to apply:** Use a supported browser environment; do not report screenshot inspections as interaction tests.
