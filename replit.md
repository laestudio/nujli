# nujli.

Impact Revealed. Humanitarian organizations publish source-backed Impact Pages for donors to explore without an account.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/nujli run dev` — managed frontend workflow
- `pnpm --filter @workspace/api-server exec tsx --test src/lib/safety.test.ts` — deterministic safety checks
- `pnpm --filter @workspace/api-server exec tsx src/lib/provider-smoke.ts` — real public fetch and AI provider smoke test; synthetic input is never saved
- `node scripts/src/nujli-browser-smoke.mjs` — browser interaction checks; requires compatible Playwright Chromium system libraries
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml`: API contract; rerun codegen after edits.
- `lib/db/src/schema/`: domain schema; `lib/db/drizzle/`: generated SQL migration.
- `artifacts/api-server/src/lib/`: source fetching, extraction worker, billing, ownership, evidence validation.
- `artifacts/api-server/src/routes/`: public, organization, reviewer and signed webhook endpoints.
- `artifacts/nujli/src/`: public and organization UI.

## Architecture decisions

- PostgreSQL is the publication source of truth; no demo humanitarian records are seeded.
- Evidence extraction is deliberately conservative: exact quotes, literal statistics, source-supported ISO or explicit named-month dates; unsupported items are excluded or fail validation.
- Only extracted evidence text is persisted, not whole source pages. Publication still requires human privacy and permission review.
- Payment access fails closed on provider errors and missing webhook configuration. A redirect never establishes entitlement.
- Managed production schema changes happen through Publish, not startup DDL.

## Product

Public world map and project evidence pages, organization review/publishing interface, reviewer inbox, and conceptual masjid funding simulation. Live paid journey remains acceptance-blocked until Whop permissions, signing secret and transaction testing are resolved.

## User preferences

Always report acceptance items using PASS, FAIL, BLOCKED or NOT TESTED. Do not claim paid/generation journeys work based solely on UI or provider setup.

## Gotchas

- Clerk identities authenticate users; only trusted Clerk public metadata with `role: reviewer` grants review access. No self-assignment or public role-grant endpoint. No reviewer has been provisioned yet.
- Whop webhook path: `/api/webhooks/whop`. Requires `WHOP_WEBHOOK_SECRET`; verify raw request bytes before parsing.
- Connected Whop account currently rejects `plan:basic:read` on the selected existing product. Do not replace the product to work around permission failures.
- File upload and PDF parsing are not implemented; additional public report pages or direct raster-photo/video URLs are supported with explicit per-media permission review.
- Local interaction runner was blocked by Chromium/Nix shared-library mismatch. Screenshot inspection is not end-to-end testing.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
