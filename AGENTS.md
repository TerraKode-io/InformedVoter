<!-- From: c:\Shared\git\InformedVoter\AGENTS.md -->
# AGENTS.md — InformedVoter

> This file is the single source of truth for AI coding agents working on this project.  
> If you modify the build process, folder structure, or security model, update this file.

---

## Project Overview

**InformedVoter** (`https://knowyourgov.us`) is a nonpartisan US civic information platform. It surfaces data about Congress, the Supreme Court, federal agencies, campaign finance, elections, and local government — explained in plain English, often with AI-generated summaries.

The stack is **Next.js 16 + TypeScript** (App Router, Turbopack), **Tailwind CSS v4**, **self-hosted PostgreSQL** via Prisma, **self-hosted Redis** for rate limiting, and **Anthropic Claude** for bill, case, candidate, and local-meeting analysis.

---

## Technology Stack

| Layer | Technology | Version / Notes |
|-------|-----------|-----------------|
| Framework | Next.js | 16.2+, App Router, Turbopack in dev (`next dev --turbopack`) |
| Language | TypeScript | 5.9+, strict mode, `"@/*"` maps to `./src/*` |
| Styling | Tailwind CSS | v4 (`@import "tailwindcss"` in `globals.css`), `@tailwindcss/postcss` |
| ORM | Prisma | 5.22, PostgreSQL only; `postinstall` runs `prisma generate` |
| DB | PostgreSQL (self-hosted) | 16, Docker container on the data VM (`iv-data`); no connection pooler needed |
| Cache / Rate-limit | Redis (self-hosted) | `ioredis`; middleware runs on the Node runtime; falls open if unset |
| AI | Anthropic SDK | `claude-haiku-4-5` for cheap tasks, `claude-sonnet-4-5` for complex analysis |
| Email | Resend | Verification + digest emails |
| State Management | TanStack Query | React Query v5 for server-state caching |
| Icons | Lucide React | |
| Animations | Framer Motion | |
| Hosting | Self-hosted Proxmox | 2 VMs (`iv-app` + `iv-data`), Docker Compose, Caddy (Cloudflare Origin CA TLS), host crontab |
| Analytics | Umami (self-hosted) | Container on `iv-app`; script injected in `layout.tsx` |

---

## Project Structure

```
prisma/
  schema.prisma          # 30+ models — political, legislation, finance, judicial, subscribers, local
  seed.ts                # Initial state + election seeding
  seed-governors.mjs
  seed-elections.mjs

src/
  app/                   # Next.js App Router (pages + API routes)
    api/                 # REST endpoints (34 route files)
      cron/              # Scheduled sync / analysis jobs (13 jobs, ~5000 total lines)
      ai/                # On-demand AI analysis (bills, candidates)
      local/             # Local government: meetings, municipalities, templates, submissions
      scotus/            # Supreme Court data API (cases, justices)
      subscribe/         # Email subscription flow (subscribe, verify, demographics)
      ...                # search, bills, candidates, agencies, health, district-lookup, etc.
    local/               # Local Information hub
      page.tsx           # City/zip search, grassroots CTA
      rules/page.tsx     # First Amendment speaking rules & case law
      city/[id]/         # City detail: city hall, council location, upcoming meetings
      meeting/[id]/      # Meeting detail: agenda, AI templates, restrictions
      templates/page.tsx # Template library for public comment
    state/[stateAbbr]/   # State hub + 8 sub-pages
      page.tsx           # State overview
      senators/page.tsx
      representatives/page.tsx
      governor/page.tsx
      bills/page.tsx
      bills/[billId]/page.tsx
      elections/page.tsx
      voter-info/page.tsx
    judicial/            # SCOTUS dashboard, cases, justices
      page.tsx
      cases/[...slug]/page.tsx
      justices/[slug]/page.tsx
    candidate/[candidateId]/  # Candidate detail pages
    compare/             # Side-by-side candidate comparison
    agencies/            # Federal agency directory
      page.tsx
      [slug]/page.tsx
    polling-places/      # Polling place finder
    about/               # About page
    contact/             # Contact page
    privacy/             # Privacy policy
    layout.tsx           # Root layout with SEO meta, skip-link, providers
    globals.css          # Tailwind v4 import + CSS custom properties + base reset
    providers.tsx        # TanStack Query client wrapper
    sitemap.ts           # Dynamic sitemap
    robots.ts            # robots.txt
    error.tsx            # Global error boundary
    not-found.tsx        # 404 page
    # loading.tsx removed — root Suspense boundary prevented 404 status codes

  components/
    ui/                  # Reusable badges, cards, selectors, disclaimers
    layout/              # Header, Footer, Navigation
    features/            # Page-specific sections (map, filters, tables, forms)
      local/             # Local-government-specific components (currently empty)
    seo/                 # JSON-LD structured data

  lib/
    db.ts                # Singleton PrismaClient (dev-safe global reuse)
    rate-limit.ts        # Fixed-window rate limiter backed by Redis
    ai/claude-client.ts  # Claude prompts for bills, riders, candidates, court cases, speaking templates
    auth.ts              # Timing-safe cron secret verification helper
    resend.ts            # Email client setup
    email/               # HTML email templates (verification, digest)
    sanitize.ts          # sanitize-html wrapper for external HTML (avoids ESM/CJS crash in serverless)
    utils.ts             # General helpers (cn, formatDate, formatCurrency, slugify, party/status colors)
    agencies.ts          # Static agency catalog
    fec.ts               # FEC / OpenFEC helpers
    pac-catalog.ts       # PAC metadata
    local/               # Local government API clients
      legistar-client.ts # Granicus/Legistar API wrapper

  hooks/
    useUserState.ts      # Persist selected state in a browser cookie (`selected-state`, 1-year expiry)

  types/
    index.ts             # Shared TypeScript types & enums (mirror Prisma enums)

  data/
    us-states.ts         # SVG path data for the interactive US map

documentation/           # Comprehensive project docs (14 markdown files)
  01_PROJECT_OVERVIEW.md
  02_ARCHITECTURE.md
  ...
  13_VERCEL_SUPABASE_MIGRATION.md

.creds/
  creds.md               # Infrastructure credentials (gitignored, local-only)

.deprecated/             # Old VPS/Docker config (gitignored)
  .agents/               # Agent IDE config
  .claude/               # Claude Code settings
  .continue/             # Continue IDE config
  Dockerfile             # Multi-stage production build (VPS-only)
  docker-compose.yml     # Production stack definition (VPS-only)
  nginx/                 # Nginx configs (VPS-only)
  scripts/               # VPS deployment scripts
  under-construction/    # Standalone maintenance page (VPS-only)
  README.md              # What's in this folder
```

---

## Build & Development Commands

| Command | Purpose |
|---------|---------|
| `npm install` | Installs deps + runs `prisma generate` via `postinstall` |
| `npm run dev` | Local dev server with Turbopack (`next dev --turbopack`) |
| `npm run build` | Production build (`next build`) |
| `npm start` | Start production server (`next start`) |
| `npm run lint` | ESLint (`next lint`) |
| `npm run db:push` | Push Prisma schema to database (`prisma db push`) |
| `npm run db:seed` | Run `prisma/seed.ts` via `tsx` |
| `npm run db:studio` | Open Prisma Studio |

### Important Build Notes
- `postinstall` triggers `prisma generate`. The client is generated at install time.
- **CI/CD:** Vercel Git integration auto-deploys on every push to `main`.

---

## Database & Migrations

- **Prisma schema** is the single source of truth (`prisma/schema.prisma`).
- There is **no formal migration system** in use — the project relies on `prisma db push` for schema updates.
- If you add a model or change a field, run `npm run db:push` and then update the seed files if needed.
- The schema covers:
  - **Political:** `State`, `Candidate`, `CandidatePolicy`
  - **Legislation:** `Bill`, `BillVote`, `BillCosponsor`
  - **Campaign Finance:** `CandidateFinance`, `CandidateTopDonor`, `CandidateTopIndustry`, `CandidateExpenditure`, `IndependentExpenditure`, `CandidateContributionBySize`, `CandidateContributionByState`
  - **Elections:** `Election`, `VoterInfo`, `VoterInfoDeadline`, `StatePollingLocator`
  - **Judicial:** `Justice`, `CourtCase`, `CaseVote`, `JusticeFinancialDisclosure`, `JusticeGift`, `JusticeReimbursement`, `JusticeInvestment`
  - **Local Government:** `Municipality`, `LocalMeeting`, `MeetingAgendaItem`, `SubmittedMeeting`
  - **Users & Subscribers:** `User`, `UserBookmark`, `Subscriber`
  - **PACs:** `Committee`, `PacContribution`
  - **Ops:** `DataSyncLog`

---

## Environment Variables

Copy `.env.example` to `.env` and fill in values.

**Required:**
- `DATABASE_URL` — self-hosted PostgreSQL (`postgresql://informedvoter:<pass>@10.39.112.20:5432/informedvoter`, reached over the VPC)
- `REDIS_URL` — self-hosted Redis (`redis://:<pass>@10.39.112.20:6379`, reached over the VPC)
- `ANTHROPIC_API_KEY` — Claude AI access
- `NEXT_PUBLIC_BASE_URL` — e.g. `https://knowyourgov.us`
- `CF_API_TOKEN` — Cloudflare DNS token (Caddy Let's Encrypt DNS-01)

**Optional (for data sync):**
- `CONGRESS_GOV_API_KEY`, `LEGISCAN_API_KEY`, `FEC_API_KEY`, `GOOGLE_CIVIC_API_KEY`, `COURTLISTENER_API_TOKEN`
- `CRON_SECRET` — Secret for `/api/ai/*` auth and cron auth (Bearer header or `?secret=` query param)
- `RESEND_API_KEY` + `EMAIL_FROM`
- `NEXT_PUBLIC_UMAMI_SCRIPT_URL` + `NEXT_PUBLIC_UMAMI_WEBSITE_ID` — self-hosted analytics

**Dev-only:**
- `ALLOW_MANUAL_CRON=true` — **Never in production.** Allows `?manual=true` to bypass cron auth for local dev.

**Dangerous:**
- `ALLOW_MANUAL_CRON=true` — **Never set in production.** Allows `?manual=true` to bypass auth on cron routes for local dev.

---

## API & Middleware

### Middleware (`src/middleware.ts`)
Runs on the **Node.js runtime** (`config.runtime = "nodejs"`, required by ioredis) on **all** `/api/*` routes:

| Route Prefix | Rate Limit | Auth |
|--------------|-----------|------|
| `/api/ai/*` | 300 req / 60s | Bearer token via `CRON_SECRET` (timing-safe compare) |
| `/api/cron/*` | 300 req / 60s | Middleware: `?secret=` query param OR Bearer header. Route handler: `verifyCronSecret()` (Bearer header). Defense-in-depth. |
| `/api/subscribe` (POST) | 5 req / 60s | None |
| All other `/api/*` | 60 req / 60s | None |

- Rate limiting uses self-hosted Redis (`ioredis`) fixed-window counters. If Redis is unavailable, it **fails open** (allows all requests).
- Client IP detection prefers `cf-connecting-ip`, then `x-real-ip`, then the **rightmost** entry in `x-forwarded-for` (hardest to spoof).

### API Route Conventions
- Route handlers live in `src/app/api/<route>/route.ts`.
- `GET`, `POST`, etc. are exported as named async functions.
- Cron jobs are grouped under `src/app/api/cron/<job-name>/route.ts`.
- On-demand AI endpoints are under `src/app/api/ai/<action>/route.ts`.

### Health Check
`GET /api/health` returns `{ status: "ok" | "degraded" }` with HTTP 200 (healthy) or 503 (database down).

---

## Security Model

1. **Rate Limiting** — Redis-backed, per-IP, tiered limits (see Middleware above).
2. **Cron Authentication** — Defense-in-depth with two layers:
   - **Middleware** (`src/middleware.ts`): Inline `timingSafeCompare`. AI routes require `Authorization: Bearer <CRON_SECRET>`. Cron routes accept a Bearer header OR a valid `?secret=<CRON_SECRET>` query param.
   - **Route handlers** (`src/lib/auth.ts`): `verifyCronSecret()` uses Node.js `crypto.timingSafeEqual` for Bearer header comparison. Performs dummy comparison on length mismatch to prevent length leakage.
3. **Security Headers** — Set in `next.config.mjs`:
   - `Content-Security-Policy` (strict, with `unsafe-inline` for scripts/styles)
   - `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Strict-Transport-Security` (with `preload`), `Permissions-Policy`
4. **Input Sanitization** — `sanitize-html` for rendering external HTML. Allowed tags are restricted to safe markup in `src/lib/sanitize.ts`. Replaced `isomorphic-dompurify` (which crashed in serverless due to `jsdom` → `parse5@8` ESM-only dependency).
5. **Database Isolation** — PostgreSQL binds the VPC address on `iv-data` and is reachable only from `iv-app` (`10.39.112.19`). No public route to the database; the app VM sits on VLAN 100 behind a Cloudflare-source-locked DNAT.
6. **Error Sanitization** — All API routes wrapped with `withErrorHandler` / `withCronErrorHandler` (`src/lib/api-error-handler.ts`). Raw errors, stack traces, subsystem names ("Prisma", "Redis", "Claude"), and internal codes (P2002) are NEVER exposed to clients. Typed error hierarchy in `src/lib/errors/` with `AppError` base + 8 domain subclasses.

---

## AI Integration (`src/lib/ai/claude-client.ts`)

Claude is used for five analysis types:

1. **`analyzeBill`** — Plain-English summary, key provisions, fiscal impact, political context.  
   Model: `claude-haiku-4-5`, max 15k bill text.
2. **`detectRiders`** — Flags unrelated provisions buried in legislation.  
   Model: `claude-sonnet-4-5`, max 20k text.
3. **`analyzeCandidatePolicy`** — Balanced policy analysis with supporter / critic perspectives.  
   Model: `claude-sonnet-4-5`.
4. **`analyzeCourtCase`** — Plain-English SCOTUS summary + real-world impact.  
   Model: `claude-haiku-4-5`.
5. **`generateSpeakingTemplate`** — Grassroots speaking template for city council agenda items.  
   Model: `claude-sonnet-4-5`. Generates professional or assertive (First Amendment) tone scripts with hard facts and suggested questions.

All functions return typed JSON parsed from Claude responses.  
The client includes `extractJson()` to handle markdown code fences in model output.

---

## Data Sync (Cron Jobs)

Cron jobs are triggered by the host crontab on `iv-app` (see `scripts/cron-setup.sh`).  
All cron routes live in `src/app/api/cron/<job>/route.ts`.

| Job | Schedule | Source |
|-----|----------|--------|
| `sync-members` | Daily 6:00 AM | Congress.gov |
| `sync-scotus` | Daily 5:00 AM | Oyez + CourtListener |
| `sync-bills` | Daily 7:00 AM | Congress.gov + LegiScan |
| `sync-votes` | Daily 8:00 AM | Congress.gov |
| `analyze-bills` | Daily 12:00 PM | Claude AI |
| `analyze-cases` | Daily 2:00 PM | Claude AI |
| `analyze-candidates` | Daily 1:00 PM | Claude AI |
| `sync-campaign-finance` | Weekly (Mon 9:00 AM) | OpenFEC |
| `sync-elections` | Weekly (Mon 10:00 AM) | Google Civic |
| `sync-voter-info` | Monthly (1st, 11:00 AM) | State sources |
| `sync-pac-contributions` | Weekly (Wed 10:00 AM) | FEC |
| `sync-local-meetings` | Daily 4:00 AM | Legistar / Granicus |
| `send-digest` | Daily 3:00 PM | Resend email |

Sync results are logged to the `DataSyncLog` table.

---

## Testing

### Automated Tests (Vitest)

The project uses **Vitest** for unit testing. Tests live in `src/lib/__tests__/`.

| Command | Purpose |
|---------|---------|
| `npm test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

**Current test coverage:**
- `src/lib/__tests__/errors.test.ts` — AppError base class + 8 subclasses, toJSON(), toLogObject()
- `src/lib/__tests__/api-error-handler.test.ts` — withErrorHandler, withCronErrorHandler, error mapping (Prisma, Anthropic, network, generic)
- `src/lib/__tests__/error-logger.test.ts` — structured logging, PII awareness, logUnexpected

### Manual Testing
See `documentation/10_TESTING.md` for a comprehensive manual testing checklist covering core pages, API endpoints, cron jobs, and interactive features.

---

## Code Style Guidelines

- **Path alias:** Always use `@/` imports (e.g., `@/lib/db`, `@/components/ui/PartyBadge`).
- **TypeScript:** Strict mode is on. Avoid `any`. Prefer explicit return types on exported library functions.
- **Comments:** Use `// ─────────────────────────────────────────────` section dividers in complex files.
- **Formatting:** Follow existing indentation (2 spaces). No enforced formatter config is present.
- **Prisma:** Add `@@index` on foreign keys and frequently filtered columns. Use `Decimal @db.Decimal(18, 2)` for currency.
- **CSS:** Custom properties are defined in `:root` inside `globals.css`. Tailwind utilities are preferred for layout; custom properties are used for the color palette and typography scale.
- **Accessibility:** Skip-to-content link is in `layout.tsx`. Use `focus-visible` outlines. Headings use serif font for authority/trust.
- **Server vs Client Components:** Default to Server Components. Use `"use client"` only for interactivity (forms, state, browser APIs, TanStack Query).

---

## Deployment

### Self-hosted Proxmox (Current)
Two VMs on `pve` (`10.10.10.100`), fully separate from TerraKode:

- **`iv-app`** (VMID 264) — VLAN 10 mgmt (`10.10.10.130`) + VLAN 100 (`10.10.100.117`, public DNAT origin) + VPC (`10.39.112.19`). Runs Caddy (TLS), the Next.js app, and Umami.
- **`iv-data`** (VMID 265) — VLAN 10 mgmt (`10.10.10.131`) + VPC (`10.39.112.20`). Runs PostgreSQL 16 + Redis 7.

Ingress: `Cloudflare (proxied, Full strict) → 50.184.245.19:80/443 (source-locked to cloudflare_ips) → 10.10.100.117`. Database/Redis are VPC-only.

Deploy: `./scripts/deploy.sh` on `iv-app` (builds `docker-compose.app.yml`). Data tier: `docker compose -f docker-compose.data.yml up -d` on `iv-data`. Cron: `scripts/cron-setup.sh`. Full runbook: `documentation/14_ONPREM_DEPLOYMENT.md` and the network repo's `03-SERVICES/informedvoter-civic.md`.

### Vercel + Supabase (Deprecated)
The project was migrated off Vercel + Supabase. `vercel.json` and the Supabase configs are removed; migration history: `documentation/13_VERCEL_SUPABASE_MIGRATION.md`.

---

## Common Pitfalls for Agents

- **Do not assume a test runner exists.** Verify before writing tests.
- **Prisma client reuse:** Use the exported `prisma` from `@/lib/db`. Do not instantiate `new PrismaClient()` in random files — it leaks connections in dev.
- **Redis fallback:** Rate limiting silently allows all traffic when Redis is down. This is intentional for local dev, but confirm Redis is wired up in production.
- **Cron auth (defense-in-depth):** Middleware checks `?secret=` or the Bearer header for cron routes. Route handlers additionally enforce `verifyCronSecret()` (Bearer header). Both use constant-time comparison. Manual triggers blocked in production. Local dev can use `ALLOW_MANUAL_CRON=true` + `?manual=true`.
- **Distributed locks:** AI analysis and digest cron jobs use Redis `SET NX EX` locks to prevent duplicate work and duplicate emails.
- **External API keys:** Many data-sync features fail gracefully when API keys are missing. Check for key presence before making expensive calls.
- **Local meeting data is fragmented.** There is no unified national API for city council meetings. Coverage requires building adapters for multiple platforms (Legistar, CivicPlus, etc.).
- **Middleware runtime:** `src/middleware.ts` must stay on the Node.js runtime (`config.runtime = "nodejs"`) because the rate limiter uses `ioredis`. Moving it to Edge will break rate limiting.
- **Cookie-based state selection:** `useUserState` stores the user's selected state in a cookie (`selected-state`), not localStorage. It is read client-side only after hydration to avoid SSR/hydration mismatches.
