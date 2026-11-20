# nujli. — coding assistant handoff

## Purpose

**nujli. (Impact Revealed.)** helps humanitarian organizations turn their own public or explicitly authorized project information into source-linked Impact Pages. Organizations review drafts and approve content before publishing; donors explore published projects for free through a map, evidence pages, and media-supported project views.

This file was prepared from the repository, its existing `replit.md` and acceptance notes, and the Agent conversation context available in this session. A separate archived-transcript search was not available here, so do not treat this as a complete export of every past Agent conversation. No application code, settings, database records, secrets, or deployment were changed to create this handoff.

## Product and trust rules

- Never invent a project, figure, date, location, media item, permission, or donor attribution. Keep exact source links and explain missing or conflicting evidence.
- The only evidence labels are **Organization Reported**, **Corroborated**, and **Independently Reviewed**. AI extraction or consistency checks do not constitute independent review. Only a saved review by an authorized independent reviewer can produce that label.
- Keep locations at a safe broad-region level. Do not store beneficiary details or precise facility, shelter, distribution, or staff locations.
- Media must be authorized for use. An ordinary photo sequence is not a 360° reconstruction. Use the evidence-only view when spatial media is unavailable. Do not substitute stock or generated humanitarian imagery.
- Donor date filters describe reported updates or publication dates; they do not imply that a donor’s gift funded a particular result without a legitimate allocation record.
- Publication requires organization review and permission confirmation. Drafts must remain private. A checkout redirect or client-provided success state must never grant paid access.
- Preserve the existing Palestine-focused visual identity and project features. Avoid broad rebuilds or replacing existing provider/catalog data without explicit approval.

## Repository map and stack

This is a pnpm TypeScript monorepo:

- `artifacts/nujli/` — React 19 + Vite web app, public and organization pages, donor map, project views, reviewer UI, and Visual Build.
- `artifacts/api-server/` — Express 5 API, Clerk authentication, organization/reviewer routes, generation worker, publication, Whop webhook, and billing logic.
- `lib/db/` — PostgreSQL connection, Drizzle schema and SQL migrations.
- `lib/api-spec/`, `lib/api-client-react/`, `lib/api-zod/` — API contract and generated clients/schemas.
- `lib/integrations-openai-ai-server/` — server-side OpenAI client currently configured through Replit AI Integrations.
- `attached_assets/` — supplied logo, prototype, and specification/reference files; retain these if the handoff needs their source material.
- `replit.md` — existing Replit-specific project notes. Check it against the current code when anything conflicts.

The frontend and API are separate services. Replit config uses frontend port `22110`, API port `8080`, and routes `/api` to the API service. The production frontend is built as static files; the API runs as a Node process.

## Run and test outside Replit

Use **Node.js 24** and **pnpm** (the repository includes `pnpm-lock.yaml`):

```sh
corepack enable
pnpm install --frozen-lockfile
```

Provide the required environment variables below through the new host’s secure environment-variable manager. Do not commit `.env` files or credentials. Run each service in its own shell:

```sh
PORT=8080 NODE_ENV=development pnpm --filter @workspace/api-server run dev
```

```sh
PORT=22110 BASE_PATH=/ NODE_ENV=development pnpm --filter @workspace/nujli run dev
```

The current Vite config does **not** define a local `/api` proxy. For local testing and production, configure a same-origin reverse proxy so `/api/*` reaches the API on port `8080` and the remaining routes reach the frontend. Preserve the raw request body for `/api/webhooks/whop`; webhook signature verification depends on it. Clerk proxy behavior is Replit-aware, so validate external sign-in and the Clerk proxy separately.

Useful checks:

```sh
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/api-server exec tsx --test src/lib/safety.test.ts
pnpm --filter @workspace/api-server exec tsx --test src/lib/immersion.test.ts
pnpm --filter @workspace/api-server exec tsx --test src/lib/publication-dates.test.ts
pnpm --filter @workspace/api-server exec tsx --test src/lib/public-demo-bootstrap.test.ts
pnpm --filter @workspace/api-server exec tsx src/lib/provider-smoke.ts
node scripts/src/nujli-browser-smoke.mjs
```

The provider smoke test makes a real AI/provider request; review its behavior and cost before running it. The browser smoke script requires a compatible Playwright/Chromium installation. Past Agent notes report a Replit browser environment where Chromium lacked WebGL 2; this prevented verification of spherical panorama rendering there.

`pnpm --filter @workspace/db run push` applies the Drizzle schema to the database named by `DATABASE_URL`. Use only against a disposable/development database until the new host’s migration and rollback plan is understood. Replit’s managed Publish-time schema behavior does not automatically transfer to another host.

## Implemented code versus verified behavior

### Implemented in the repository

- Public project map, project pages, evidence and source details, timeline, date filtering, organization workspace, review/publish controls, and reviewer routes.
- Server-side source fetching with URL/network safety checks, structured AI extraction, quote/source validation, persisted generation jobs, retries, and organization review. The generation endpoint checks paid/developer entitlement on the server.
- Media-aware viewer paths: panorama, ordinary photo/video journey, and evidence-only fallback. Hotspots attach to project evidence and require organization confirmation; they do not imply independent review.
- A single conceptual masjid Visual Build with a **simulated** funding slider. Simulated funding, any actual financial records, and documented construction progress must remain separate.
- A public Islamic Relief demonstration snapshot at `artifacts/api-server/src/data/palestine-public-demonstration.json`. On production startup, the API checks/imports this data-only, idempotently, without creating schema or customer data. The demo must remain clearly disclosed as independent and not endorsed by Islamic Relief. The former Myanmar demo was to remain archived, not public.
- An owner-only developer demo entitlement exists as a distinct access path; it explicitly does not claim a Whop payment or membership.

### Real integrations, with important limits

- **PostgreSQL:** the app uses PostgreSQL and Drizzle. Replit provisioned the current database. Database contents are not included in this code repository.
- **Clerk:** sign-in uses a Replit-managed Clerk tenant. Development and production users are separate. User identities and authentication settings live in Clerk, not in the app’s project tables.
- **OpenAI:** generation uses a server-side OpenAI SDK client, configured by the Replit AI Integrations proxy today. The code is not using a browser-side API key. A real generation was previously run on a test draft, but that does not prove the whole current organization-to-publication journey.
- **Whop:** the existing product is `https://whop.com/nujli-2/nujli-annual-impact-revealed/`. The app calls Whop through `@replit/connectors-sdk`, so this is currently tied to the Replit Whop connection.

### Blocked or not fully verified; do not overstate

- **Payments are blocked.** The latest recorded API probe after the owner changed key permissions still returned 403 for `plan:basic:read`; membership access also returned an authorization error. Price/terms, checkout creation, webhook-to-organization binding, and a complete test purchase/entitlement journey have not been verified. No test purchase was run. Do not create a replacement Whop product or unlock access based on a redirect.
- The hosted Whop product link is not proof of checkout configuration, successful payment, or entitlement. The connected Replit key may not be the key whose permissions were edited.
- The owner demo bypass is not a substitute for paid entitlement and must not be exposed to ordinary organizations. `NUJLI_DEMO_OWNER_EMAIL` is production configuration; remove or deliberately replace this mechanism for an external production launch.
- The demo record is sourced from Islamic Relief public reporting/IATI and is not an Islamic Relief-approved product page. No authorized project panorama or project photo set was established. A historical official video link has had browser playback limitations; verify the source and playback rather than promising it.
- A prior live-site map outage was addressed in code with the production demonstration bootstrap. Always check the actual new-host database and public API after migration; code or a development preview alone does not prove the public marker is present.
- Reviewer UI and authorization code exist, but no independent reviewer was provisioned in the recorded project context. Do not mark claims independently reviewed without a real saved reviewer decision.
- Full end-to-end payment, mobile-device, assistive-technology, and cross-browser acceptance is not established. Past media tests found panorama rendering blocked in the available browser by lack of WebGL 2; one real WebM sample played, while its Ogg source did not decode in that browser. These sample-media tests were not humanitarian project evidence.
- File uploads and PDF/document parsing are **not implemented**. Organizations provide public URLs; media remains pending until permission is reviewed. There is no app object-storage bucket to migrate.
- The Visual Build is a conceptual interactive illustration, not a custom 3D reconstruction or proof of construction.

## Environment-variable names

Names only; values belong in the new host’s secret manager. The list is based on source/config inspection, not on copying Replit values.

**Required by the current app/configuration:**

- `DATABASE_URL`
- `PORT`
- `BASE_PATH` (frontend build/dev config)
- `NODE_ENV`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `WHOP_COMPANY_ID`
- `WHOP_PRODUCT_ID`
- `WHOP_WEBHOOK_SECRET`

**Conditional or optional in current code:**

- `NUJLI_DEMO_OWNER_EMAIL` — production owner-demo allowlist; reassess/remove before launch outside Replit.
- `VITE_CLERK_PROXY_URL` — optional frontend Clerk proxy configuration.
- `LOG_LEVEL` — optional API logging level.
- `REPL_ID`, `REPLIT_DEV_DOMAIN` — Replit runtime values used for Replit-only development plugins; not portable requirements.

`SESSION_SECRET` appears in the Replit secret inventory available during handoff, but a source scan did not find the application reading it. Confirm before deciding whether it can be dropped. `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, and `PGDATABASE` are standard database variables, but this repository explicitly requires `DATABASE_URL`.

## Replit-specific services and migration checklist

1. **Database:** provision an external PostgreSQL database, export both development and production data you need, restore into a staging database, run schema checks, and verify organizations, private drafts, published projects, evidence, updates, media URLs/permissions, memberships/orders, webhook deduplication records, jobs, and audit records. Then test rollback and backups. No database dump was included in this handoff.
2. **Authentication:** create or select an external Clerk instance and configure the app’s keys, allowed origins, sign-in/sign-up URLs, email delivery, and proxy behavior. Replit-managed Clerk environments have separate user stores; do not assume Replit accounts or sessions transfer. Plan a tested account migration or user re-verification/password-reset process.
3. **AI:** replace the Replit AI Integrations proxy configuration with a provider endpoint and credentials supported outside Replit, then rerun source-grounding, failure, rate-limit, and privacy tests. Never expose the AI secret to the browser.
4. **Whop:** create/authorize a server-side credential for the same existing product, configure required read/checkout/membership access and signed webhook delivery at the new `/api/webhooks/whop` URL, then test in a safe test environment. Verify active, failed, canceled, expired, duplicate, and mismatched-membership cases before enabling paid generation. Keep the current product; do not duplicate the catalog.
5. **Hosting/network:** deploy the static Vite frontend and Node API, route `/api` on the same origin, allow the API to reach PostgreSQL and providers, preserve webhook raw bodies, configure TLS, health checks, rate limits, logs, and domain/DNS. Replit workflow, autoscale, artifact routing, and `replit.app` URL settings are not portable.
6. **Media and assets:** there is no runtime upload bucket to copy. Preserve `attached_assets/` and `artifacts/nujli/public/` logo/favicon assets in the code backup. Project media is referenced by URL, so verify source availability and reuse permissions after migration. Obtain separate copies only where the owner has rights and the app actually stores them.
7. **Public demo and data safety:** verify the Gaza demonstration’s disclosure, attribution, broad-region marker, source links, media empty state, and public visibility on the new host. Never restore private test records or turn the archived Myanmar record into a public listing.
8. **Cutover:** run the new deployment in staging first, then test sign-in, owner demo access policy, paid organization flow, generation, editing, publication, donor map, reviewer separation, date filter, and mobile widths. Only switch DNS or disable Replit after data and recovery checks pass.

### Back up or move separately

- **Database contents** — separately from Git; the repository contains schema/migrations and a demo bootstrap, not a complete export of the live database.
- **Clerk tenant/users/settings** — separately from the app database and code.
- **Replit Secrets, shared/production configuration, and integration connections** — they are not portable through Git. Recreate/reissue them securely in the new platform; never copy secret values into this file or source control.
- **Whop webhook configuration and provider key permissions** — configure against the new callback URL and test signature verification.
- **Domain and deployment configuration** — DNS ownership, certificates, host settings, and production service variables require separate cutover work.
- **Any independently stored user files** — none were found in the app code; check the Replit project’s storage/asset panes before closing the project in case someone added files outside the repository.
- **Repository and history** — preserve the Git remote/history as well as the working tree. Include `attached_assets/` if the new assistant needs the original prototype/spec references.

## Recommended next work

1. Resolve the Whop connection against the existing product and prove verified pricing, checkout, webhook binding, and server entitlement with a test transaction.
2. Fix/recheck the last-known workspace typecheck/build issues before external deployment; an earlier Replit task list flagged type errors preventing reliable builds.
3. Make an external-provider/local development setup reproducible (environment template with names only, same-origin `/api` proxy, Clerk and AI configuration, safe DB setup).
4. Perform a verified database export/restore rehearsal and document a rollback path.
5. Complete donor and organization acceptance on real authorized project records, including mobile and accessibility checks. Keep unavailable media and WebGL-dependent panorama behavior explicitly blocked until tested in supported environments.

