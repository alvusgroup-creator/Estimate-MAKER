# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev                          # Next dev server (http://localhost:3000)
npm run build                        # prisma generate + prisma migrate deploy + next build (same command Vercel runs) — also the type-check
npm test                             # vitest run — unit tests (src/**/*.test.ts); npm run test:watch for watch mode
npm run lint                         # eslint (flat config, eslint-config-next core-web-vitals + typescript)
npx prisma migrate dev --name <n>    # create + apply a migration (uses DIRECT_URL via prisma.config.ts)
npx prisma generate                  # regenerate client into src/generated/prisma (gitignored — run after clone/schema change)
SEED_USER_ID=<supabase auth uuid> npx prisma db seed   # runs tsx prisma/seed.ts; needs a real auth user id to log in
```

Tests exist only for pure logic (`calc.test.ts`); nothing touches the DB. Copy `.env.example` → `.env` first; `RESEND_API_KEY` may stay empty (email becomes a console no-op).

## Stack notes that differ from defaults

- **Next 16**: `src/proxy.ts` is the middleware (Next 16 renamed it `proxy`). It refreshes the Supabase cookie and redirects unauthenticated users; public paths are `/login`, `/e/*`, `/api/public/*`. Read `node_modules/next/dist/docs/` before assuming App Router APIs.
- **Prisma 7** with `prisma-client` generator + `@prisma/adapter-pg`. Import from `@/generated/prisma/client` and `@/generated/prisma/enums`, never `@prisma/client`. Runtime uses pooled `DATABASE_URL` (`src/lib/prisma.ts`); CLI uses `DIRECT_URL`.
- **Supabase** is Auth + Storage only (`logos`, `job-photos` buckets). All app data goes through Prisma, not supabase-js.
- **PDF** is browser print-to-PDF (`src/app/e/[token]/print-trigger.tsx`, `?print=1`); there is no server-side PDF renderer.
- **AI**: `src/lib/ai/recommend.ts` uses the Anthropic SDK with `zodOutputFormat` for structured output; model from `AI_MODEL`. Our key, never the customer's.
- Product copy/README are in Portuguese; UI strings and code are in English (US contractor audience).

## Architecture

**Multi-tenancy.** `requireOrg()` in `src/lib/auth.ts` is the only tenancy boundary: it resolves the Supabase user → `User` → `Organization` and redirects to `/login` or `/onboarding`. Every server action/query in the authenticated area must call it and filter by `organizationId: orgId` (ownership is checked with `findFirst({ where: { id, organizationId } })`, not `findUnique`). MVP is 1 user per org, but `User → Organization` is N:1 so team support needs no migration.

**Data flow.** Server components load via `src/lib/*/queries.ts`, convert Prisma rows to plain DTOs in `src/lib/estimates/dto.ts` (Decimal → number happens *only* there), and pass them to client components. Mutations are `"use server"` actions in `src/lib/{estimates,clients,services,settings,photos}/actions.ts` that validate with Zod schemas from `src/lib/estimates/schemas.ts`, then `revalidatePath`.

**Estimate math.** `src/lib/estimates/calc.ts` is the single implementation of totals, used by the browser live preview, the server on save, and the seed. Totals are **persisted** on write (`buildWriteData` in `estimates/actions.ts`) and never recomputed on read. Line items are **snapshots** (name/price copied; `serviceItemId` is a soft reference that bumps `usageCount`).

**Documents.** One `Estimate` table holds both kinds (`kind = ESTIMATE | INVOICE`; invoices link back via `sourceEstimateId`). Numbers are `prefix + org counter` snapshotted at creation. `src/components/templates/estimate-document.tsx` is a pure presentational component with three layouts (CLEAN/BOLD/CLASSIC) sharing one data contract; it renders identically in the editor preview, the public page, and print.

**Public link `/e/[token]`.** `publicToken` is the credential — no auth. The page records VIEWED (SENT→VIEWED), lets the customer accept (typed name = signature) or decline via `actions.ts`, rate-limits by IP and token (`src/lib/rate-limit.ts`, in-memory per instance), and emails the contractor inside `after()` via `src/lib/email/notify.ts` (must never throw). Drafts are visible only to the signed-in owner.

**Status lifecycle.** DRAFT → SENT → VIEWED → ACCEPTED | DECLINED | EXPIRED (invoices add PAID). Every transition writes an `EstimateEvent`. Expiry is lazy: `expireStaleEstimates()` runs from list/detail pages, no cron.

**Localization hooks.** `currency`, `locale`, `taxLabel`, `taxRate` live on the org and are copied onto each estimate so Canada/Portugal can be added without a rewrite — don't hardcode `$`/`USD`/"Sales Tax"; use `formatMoney` and the org/estimate fields.

## Skills

Project-pinned skills in `.agents/skills/` (restored via `skills-lock.json`): `supabase` and `supabase-postgres-best-practices`. Load the latter before any schema/migration/RLS change.
