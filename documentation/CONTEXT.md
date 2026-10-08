# InformedVoter — Project Context

> **Last Updated:** 2026-10-08  
> **Purpose:** Paste this into a new AI chat session to bring it up to speed on the entire project.

---

## 1. What Is This?

**InformedVoter** (`https://knowyourgov.us`) is a nonpartisan US civic information platform — the "Wikipedia for government." It helps voters research representatives, track legislation, follow Supreme Court cases, explore campaign finance, find polling places, and prepare for local city council meetings — all explained in plain English, often with AI-generated summaries.

**Stack:** Next.js 16 + TypeScript + Tailwind CSS v4 + Prisma 5.22 + self-hosted PostgreSQL 16 + self-hosted Redis + Anthropic Claude + Resend email.

**Hosting History:** Vercel + Supabase → self-hosted VPS (Docker/Nginx) → back to Vercel + Supabase → **now migrated to self-hosted Proxmox (`pve`)**.

**Current Status:** Migrating to self-hosted Proxmox. Two VMs: `iv-app` (VLAN 10 mgmt + VLAN 100 public DNAT + VPC; Caddy + Next.js + Umami) and `iv-data` (VLAN 10 mgmt + VPC; PostgreSQL 16 + Redis 7). Public IP `50.184.245.19` via Cloudflare. See `documentation/14_ONPREM_DEPLOYMENT.md` and the network repo `03-SERVICES/informedvoter-civic.md`.

---

## 2. Tech Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Framework | Next.js 16.2+ | App Router, Turbopack in dev |
| Language | TypeScript 5.9+ | Strict mode, `@/*` → `./src/*` |
| Styling | Tailwind CSS v4 | `@import "tailwindcss"` in globals.css, no tailwind.config.js |
| ORM | Prisma 5.22 | PostgreSQL only, `postinstall` runs `prisma generate` |
| DB | PostgreSQL 16 (self-hosted) | Docker on `iv-data`, VPC `10.39.112.20`, no pooler |
| Cache / Rate Limit | Redis 7 (self-hosted) | `ioredis`, VPC `10.39.112.20`, Node-runtime middleware |
| AI | Anthropic SDK 0.85 | `claude-haiku-4-5` (cheap), `claude-sonnet-4-5` (complex analysis) |
| State Mgmt | TanStack Query v5 | Server-state caching with `staleTime: 5min`, `gcTime: 10min` |
| Email | Resend | Verification + digest emails |
| Icons | Lucide React | Exclusive icon library |
| Animations | Framer Motion | Entrance animations, tabs, mobile drawer, accordions |
| Hosting | Proxmox (self-hosted) | 2 VMs, Docker Compose, Caddy TLS (DNS-01), host crontab |
| Analytics | Umami (self-hosted) | Container on `iv-app`; script in layout.tsx |

---

## 3. Database (self-hosted PostgreSQL on `iv-data`)

**Engine:** PostgreSQL 16 (Docker container `iv-postgres`)  
**Address:** `10.39.112.20:5432` (VPC `vmbr2`, `10.39.112.0/20`) — reachable only from `iv-app` (`10.39.112.19`)  
**Database / user:** `informedvoter`  
**Password:** *(see `.creds/creds.md`)*

### Connection String
- **DATABASE_URL:** `postgresql://informedvoter:[PASSWORD]@10.39.112.20:5432/informedvoter?schema=public`

### Migration Source (Supabase, being retired)
- Former Supabase project `hzzcqcsgcreloxashaph` (us-east-1) is the **source** for the
  `pg_dump`/`pg_restore` migration. Once verified, it is decommissioned.

### Schema Status
- All tables come from `prisma/schema.prisma` via `prisma db push`.
- Seed scripts: `prisma/seed.ts`, `prisma/seed-governors.mjs`, `prisma/seed-elections.mjs`.

---

## 4. Database Schema (Prisma)

**File:** `prisma/schema.prisma` — 34 models across 7 domains.

### Key Models

| Model | Purpose |
|-------|---------|
| `State` | 50 US states + DC. Relations: candidates, bills, elections, voterInfo |
| `Candidate` | Elected officials & candidates. Relations: state, policies, bills (sponsored/voted/cosponsored), finance, PACs, bookmarks |
| `CandidatePolicy` | AI-generated policy analyses by category (10 categories). Unique on `(candidateId, category)` |
| `Bill` | Federal & state legislation. AI fields: `executiveSummary`, `detailedSummary`, `aiRiderAnalysis`, `hiddenClauses` (Json). Relations: sponsor, votes, cosponsors |
| `CourtCase` | SCOTUS cases from Oyez. AI fields: `aiSummary`, `aiImpactAnalysis`. Relations: votes |
| `Justice` | SCOTUS justices. Relations: votes, gifts, reimbursements, investments, financial disclosures |
| `CandidateFinance` | Campaign finance totals per cycle. Relations: topDonors, topIndustries, contributionsBySize/State, expenditures |
| `Election` / `VoterInfo` / `VoterInfoDeadline` | Election dates and state voter registration rules |
| `Committee` / `PacContribution` | PACs and their contributions to candidates |
| `Municipality` / `LocalMeeting` / `MeetingAgendaItem` | Local gov: cities, council meetings, agenda items with `templatePrompt` |
| `SubmittedMeeting` | User-submitted community meetings (pending review) |
| `Subscriber` | Email subscriptions with optional demographic profile (party, age, zip, issues, etc.) |
| `DataSyncLog` | Audit log for all cron sync jobs |

### Enums
`OfficeType`, `PolicyCategory`, `Chamber`, `BillStatus`, `VoteChoice`, `ElectionType`, `BookmarkEntityType`, `DonorType`, `ContributionSizeRange`, `ExpenditureCategory`, `SupportOrOppose`, `DeadlineType`, `SubscriberTopic`, `CaseStatus`

### Patterns
- All currency uses `Decimal @db.Decimal(18, 2)`
- Heavy use of `@@index` on foreign keys and filter columns
- Upsert-heavy sync jobs for idempotent reruns
- JSON fields for flexible data: `contactInfo`, `socialMedia`, `subjects`, `hiddenClauses`

---

## 5. Pages (App Router)

### Static / Marketing
- `/` — Homepage: interactive US map (`USStateMap`), `FederalAgenciesSection`, `HomepageLinks`
- `/about`, `/contact`, `/privacy` — ISR (revalidate 86400)

### State Hubs (`/state/[stateAbbr]/`)
All use `force-dynamic` for real 404s on invalid states.
- `/state/[stateAbbr]` — Dashboard with stats cards
- `/state/[stateAbbr]/senators` — US senators with votes & policies
- `/state/[stateAbbr]/representatives` — US reps with district badges
- `/state/[stateAbbr]/governor` — Governor profile
- `/state/[stateAbbr]/bills` — Bills with `BillsFilterBar` (search, chamber, status, subject)
- `/state/[stateAbbr]/bills/[billId]` — Bill detail with `BillDetailTabs` (Overview, Riders, Votes, Full Text)
- `/state/[stateAbbr]/elections` — Elections with days-until counter
- `/state/[stateAbbr]/voter-info` — Registration deadlines, ID requirements, early voting

### Candidates & Comparison
- `/candidate/[candidateId]` — Profile with `CandidateTabs` (Policy, Voting Record, Finance, Contact)
- `/compare` — Side-by-side comparison (client component, fetches `/api/candidates`)

### Judicial
- `/judicial` — SCOTUS dashboard (active justices, pending cases, recent decisions)
- `/judicial/cases/[...slug]` — Case detail with vote breakdown, AI summary
- `/judicial/justices/[slug]` — Justice profile with financial disclosures, gifts, ideology score

### Local Government
- `/local` — City/zip search, meeting submission (client component)
- `/local/city/[id]` — City hall info, council location, upcoming meetings
- `/local/meeting/[id]` — Meeting detail with agenda items, AI speaking templates (client)
- `/local/rules` — First Amendment speaking rules & case law
- `/local/templates` — Pre-built public comment templates with professional/assertive tone toggle (client)

### Utilities
- `/bills` — Federal bill listing (paginated)
- `/elections` — Nationwide upcoming elections
- `/agencies` — Federal agency directory with category filters
- `/agencies/[slug]` — Agency detail with live budget from USAspending.gov
- `/pac-recipients` — PAC catalog
- `/pac-recipients/[slug]` — PAC detail with contribution table
- `/polling-places` — Address-based polling place finder (client)
- `/voter-info` — Nationwide voter info basics

### SEO Files
- `sitemap.ts` — Dynamic sitemap from DB (states, justices, cases, candidates, agencies)
- `robots.ts` — Allows all except `/api/*`, `/api/cron/*`, `/api/ai/*`

---

## 6. API Routes

### Public Data APIs
- `GET /api/health` — Health check (`prisma.$queryRaw SELECT 1`)
- `GET /api/search?q=...` — Search bills & candidates
- `GET /api/bills` — Filtered bill listing with pagination
- `GET /api/candidates` — Filtered candidates (hard cap 200)
- `GET /api/agencies` — Agency catalog + USAspending.gov budget data (revalidate 24h)
- `GET /api/pac-recipients` — Aggregated PAC contributions by recipient

### Google Civic Proxies
- `GET /api/district-lookup` — Congressional district for address
- `GET /api/polling-places` — Polling locations for address

### AI APIs (Bearer auth or `?secret=` query param)
- `POST /api/ai/analyze-bill` — Claude `analyzeBill` + `detectRiders`, persists results
- `POST /api/ai/analyze-candidate` — Claude `analyzeCandidatePolicy`, upserts `CandidatePolicy`

### Local Gov APIs
- `GET /api/local/municipality?q=...` — City lookup by zip or name
- `GET /api/local/meetings?municipalityId=...` — Meeting list
- `GET /api/local/meeting/[id]` — Single meeting detail
- `POST /api/local/meetings/submit` — Submit community meeting (creates `SubmittedMeeting`)
- `POST /api/local/template` — Generate AI speaking template for agenda item

### SCOTUS APIs
- `GET /api/scotus/cases` — Case list (filter by term/status)
- `GET /api/scotus/justices` — Justice list (filter by active)

### Subscription APIs
- `POST /api/subscribe` — Email signup → sends Resend verification email
- `GET /api/subscribe/verify?token=...` — Verify email (returns HTML page)
- `POST /api/subscribe/demographics` — Optional demographic survey
- `GET/POST /api/unsubscribe` — Unsubscribe via token (returns HTML page)

### Cron Jobs (13 total)

All cron routes require `Authorization: Bearer <CRON_SECRET>` OR `?secret=<CRON_SECRET>` query param.

| Route | External Source | Schedule | What It Does |
|-------|----------------|----------|--------------|
| `sync-scotus` | Oyez + CourtListener | Daily 5AM | Justices, cases, votes, financial disclosures |
| `sync-members` | Congress.gov | Daily 6AM | Current members, deduped by bioguideId |
| `sync-bills` | Congress.gov + LegiScan | Daily 7AM | Bills, subjects, statuses (max 500/run) |
| `sync-votes` | Congress.gov + Clerk XML | Daily 8AM | Roll-call votes parsed from XML |
| `sync-campaign-finance` | OpenFEC | Weekly Mon 9AM | Finance totals, donors, expenditures (~50 candidates) |
| `sync-elections` | Google Civic | Weekly Mon 10AM | Election dates, infers PRIMARY/GENERAL/SPECIAL |
| `sync-voter-info` | Static dataset | Monthly 1st 11AM | Registration rules for all 50 states |
| `sync-pac-contributions` | OpenFEC | Weekly Wed 10AM | PAC contributions by candidate |
| `sync-local-meetings` | Legistar/Granicus | Daily 4AM | City council meetings, 90-day window |
| `analyze-bills` | Claude AI | Daily 12PM | Batch-analyze up to 10 unanalyzed bills |
| `analyze-candidates` | Claude AI | Daily 1PM | Batch-analyze 5 candidates × all policy categories |
| `analyze-cases` | Claude AI | Daily 2PM | Batch-analyze up to 5 decided SCOTUS cases |
| `send-digest` | Resend | Daily 3PM | Personalized email digests by state/topic |

All cron jobs log results to `DataSyncLog`.

---

## 7. External Integrations

| Service | Data | How It's Used |
|---------|------|---------------|
| **Congress.gov API** | Members, bills, votes, subjects | `sync-members`, `sync-bills`, `sync-votes` |
| **LegiScan API** | State/federal bills, full text, roll calls | `sync-bills` |
| **OpenFEC API** | Campaign finance, donors, expenditures, PACs | `sync-campaign-finance`, `sync-pac-contributions` |
| **Google Civic API** | Election dates, polling places, districts | `sync-elections`, `/api/polling-places`, `/api/district-lookup` |
| **Oyez API** | SCOTUS cases, justices, oral arguments | `sync-scotus` |
| **CourtListener API** | Justice financial disclosures | `sync-scotus` |
| **USAspending.gov API** | Federal agency budgets | `/api/agencies` |
| **Anthropic Claude** | AI summaries, rider detection, speaking templates | `claude-client.ts` (5 functions) |
| **Resend** | Transactional email | Verification + digest emails |
| **Legistar/Granicus API** | City council meetings, agendas | `sync-local-meetings` |

---

## 8. Key Files & Patterns

### State Management
- **`src/hooks/useUserState.ts`** — THE central hook. Reads/writes `selected-state` cookie (1yr, SameSite=Lax, Secure). Returns `{ userState, setUserState, isHydrating }`. Starts `null` to avoid hydration mismatches. **Dozens of components depend on this.**

### Database
- **`src/lib/db.ts`** — Singleton PrismaClient. Prevents connection leaks in dev via `globalThis` stash.
- **`prisma/schema.prisma`** — Single source of truth. Uses `directUrl` for Supabase direct connection.

### Rate Limiting
- **`src/lib/rate-limit.ts`** — Upstash Redis fixed-window counter. Edge-compatible. Fails open if Redis unavailable.

### AI
- **`src/lib/ai/claude-client.ts`** — 5 typed functions: `analyzeBill`, `detectRiders`, `analyzeCandidatePolicy`, `analyzeCourtCase`, `generateSpeakingTemplate`. Includes `extractJson()` for parsing markdown code fences.

### Auth
- **`src/middleware.ts`** — Rate limiting + cron auth on all `/api/*`. Supports `Authorization: Bearer` header (AI routes) AND `?secret=` query param (cron routes). `timingSafeCompare` masks length differences to prevent timing attacks.
- **`src/lib/auth.ts`** — `verifyCronSecret()` using Node `timingSafeEqual`. Performs a dummy constant-time comparison when token length differs to prevent secret-length leakage.
- **No user login system.** App is fully public. Subscribers identified by email + token.

### Components
- **Server Components (default)** — Most pages query Prisma directly.
- **Client Components (`"use client"`)** — Only when interactivity needed: forms, maps, tabs, tables, drawers, modals.
- **Layout:** `Header` (sticky, active-page pill animation), `Navigation` (mobile drawer with focus trap), `Footer`, `SubscribeBottomBar` (fixed bottom, 30s/50% scroll trigger), `StateRequiredBanner`.

### Styling
- Brand color: `#1B2A4A` (deep navy)
- Headings: Serif font for trust/authority
- Tailwind v4: No `tailwind.config.js`, config in `globals.css`

---

## 9. Deployment Architecture

### Target: Vercel + Supabase
```
User → Vercel Edge Network (CDN + SSL)
              ↓
        Next.js Serverless
              ↓
        ┌─────┴─────┐
     Supabase    Upstash
     Postgres    Redis
    (managed)   (managed)
```

### Files Removed for Migration
`.deprecated/Dockerfile`, `.deprecated/docker-compose.yml`, `.deprecated/nginx/`, `.deprecated/under-construction/`, `.deprecated/scripts/`

### Files Modified for Migration
- `prisma/schema.prisma` — Added `directUrl` for Supabase
- `next.config.mjs` — Removed `output: "standalone"`
- `src/lib/rate-limit.ts` — Restored `@upstash/redis`
- `src/middleware.ts` — Added Vercel IP detection + query param cron auth
- `src/app/layout.tsx` — Restored `@vercel/analytics`
- `vercel.json` — Created with 13 cron schedules
- `supabase/rls-policies.sql` — Restored + updated with new tables

---

## 10. Known Issues & Decisions Needed

| Issue | Context | Decision Needed |
|-------|---------|-----------------|
| **Loading UX trade-off** | Root `loading.tsx` removed to fix 404 statuses | Use inline `<Suspense>` with fallback JSX for granular loading states without breaking `notFound()` |
| **Optional API keys** | `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, data API keys not yet configured | Add when ready; app works without them (syncs skip missing sources) |
| ~~**No automated tests**~~ | **Vitest unit tests added** (33 tests). E2E (Playwright/Cypress) still needed | Add E2E tests? |
| **No formal DB migrations** | Uses `prisma db push` only | Switch to `prisma migrate dev` + Supabase migrations? |
| **No user auth** | App is fully public. No login/session system. | Keep it public, or add Supabase Auth later? |
| **Long cron timeouts** | `sync-campaign-finance` can run for minutes | Vercel Hobby = 10s timeout, Pro = 60s. Break into batches or use Edge Functions? |
| **Image domains** | `next.config.mjs` allows `theunitedstates.io`, `bioguide.congress.gov`, `*.oyez.org` | Verify these are still correct after migration |

---

## 11. Environment Variables

### Supabase (Known)
- `DATABASE_URL` — Supabase Connection Pooler (`?pgbouncer=true`)
- `DIRECT_URL` — Supabase Direct Connection (for migrations/seeds)
- `SUPABASE_URL` — `https://hzzcqcsgcreloxashaph.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY` — *(see `.creds/creds.md`)*
- `SUPABASE_SECRET_KEY` — *(see `.creds/creds.md`)*

### Required (Filled)
- `UPSTASH_REDIS_URL` — `https://large-bass-109072.upstash.io`
- `UPSTASH_REDIS_TOKEN` — *(see `.creds/creds.md`)*
- `CRON_SECRET` — Generate with `openssl rand -base64 32`

### Required (To Be Added to Vercel Dashboard)
- `DATABASE_URL` + `DIRECT_URL` — Supabase connection strings
- `UPSTASH_REDIS_URL` + `UPSTASH_REDIS_TOKEN`
- `CRON_SECRET`
- `NEXT_PUBLIC_BASE_URL` — `https://knowyourgov.us`
- `ANTHROPIC_API_KEY` — Claude AI access
- `CONGRESS_GOV_API_KEY`, `LEGISCAN_API_KEY`, `FEC_API_KEY`, `GOOGLE_CIVIC_API_KEY`, `COURTLISTENER_API_TOKEN`
- `RESEND_API_KEY` + `EMAIL_FROM`
- `NEXT_PUBLIC_BASE_URL` — `https://knowyourgov.us`

### Dangerous (Dev Only)
- `ALLOW_MANUAL_CRON=true` — **Never in production.** Allows `?manual=true` to bypass cron auth.

---

## 12. Credentials Storage

All sensitive credentials are stored in:
- **`.env`** — Environment variables (gitignored)
- **`.creds/creds.md`** — Structured credential log (gitignored)
- **`supabase/missing-tables.sql`** — Schema migration (committed, no secrets)
- **`supabase/rls-policies.sql`** — RLS policies (committed, no secrets)

**DO NOT commit `.env` or `.creds/`.** Both are in `.gitignore`.

---

## 13. Quick Commands

```bash
npm run dev              # Local dev with Turbopack
npm run build            # Production build
npm run db:push          # Push Prisma schema (uses DIRECT_URL)
npm run db:seed          # Run seed.ts
npm run db:studio        # Prisma Studio GUI
```

---

## 14. Next Steps (Immediate Action Items)

**Completed:**
- ✅ Supabase tables created (`Municipality`, `LocalMeeting`, `MeetingAgendaItem`, `SubmittedMeeting`)
- ✅ RLS policies applied
- ✅ Upstash Redis provisioned (`informedvoter-redis` in `us-east-1`)
- ✅ CRON_SECRET generated
- ✅ Middleware fixed for Vercel Cron Jobs
- ✅ Build passes
- ✅ All Vercel env vars configured
- ✅ Database connected (pooler endpoint corrected `aws-0` → `aws-1`)
- ✅ Security audit deployed (18 hardening measures)
- ✅ UAT completed (179 cases, 175 passes, 0 real failures)

**Remaining:**
1. **Add optional API keys** when ready: `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, data API keys
2. ~~**Add automated tests** — Jest/Vitest~~ ✅ **Vitest unit tests complete** (33 tests). **E2E tests** (Playwright) still needed
3. **Monitor:** Check `/api/health`, cron job logs, DataSyncLog table

**Recent Fixes (2026-06-05):**
- Phase 1–6: Complete error handling infrastructure (AppError hierarchy, typed wrappers, sanitized client responses, structured logging)
- Phase 3: All 33 API routes wrapped with `withErrorHandler` / `withCronErrorHandler`
- Phase 4: AI/external API clients sanitized (no raw error leakage)
- Phase 5: Vitest test suite (33 tests) + critical `fec.ts` API key security fix
- Phase 6: Documentation synced
- PAC recipients API now supports list-all mode (no `committeeIds` required)
- City 404 status fixed by removing root `loading.tsx` Suspense boundary
- Unsubscribe returns 400 for invalid tokens
- SCOTUS detail pages fixed (`isomorphic-dompurify` → `sanitize-html`)
- Security audit deployed (18 hardening measures)

---

## 15. File Structure Summary

```
src/
  app/                    # Next.js App Router (pages + API routes)
    api/                  # 30+ API routes including 13 cron jobs
    local/                # Local gov pages
    state/[stateAbbr]/    # State hub + 8 sub-pages
    judicial/             # SCOTUS dashboard
    candidate/[id]/       # Candidate profiles
    compare/              # Side-by-side comparison
    agencies/             # Federal agency directory
    layout.tsx            # Root layout with SEO, skip-link, providers
    globals.css           # Tailwind v4 + design tokens
    providers.tsx         # TanStack Query wrapper
    sitemap.ts, robots.ts # SEO primitives
  components/
    ui/                   # 8 reusable atomic components
    layout/               # Header, Footer, Navigation
    features/             # 20+ page-specific components
    seo/                  # JSON-LD structured data
  lib/
    ai/claude-client.ts   # 5 Claude AI functions
    email/                # HTML email templates
    local/legistar-client.ts # Granicus/Legistar API wrapper
    db.ts                 # Prisma singleton
    rate-limit.ts         # Upstash Redis rate limiter
    auth.ts               # Cron auth helper
    resend.ts             # Email client
    sanitize.ts           # sanitize-html wrapper (pure JS, no DOM)
    utils.ts              # cn(), formatters, color helpers
    agencies.ts           # 20 federal agencies (static catalog)
    fec.ts                # OpenFEC helpers
    pac-catalog.ts        # 23 notable PACs (static catalog)
  hooks/
    useUserState.ts       # Cookie-based state persistence (CRITICAL)
  types/
    index.ts              # Shared TS types & enums
  middleware.ts           # Rate limiting + cron auth on all /api/*
prisma/
  schema.prisma           # 34 models, single source of truth
  seed.ts                 # States + sample data
  seed-governors.mjs      # All 50 governors
  seed-elections.mjs      # 2026 elections + deadlines
supabase/
  rls-policies.sql        # Row Level Security policies
  missing-tables.sql      # Migration for local gov tables
documentation/
  CONTEXT.md              # This file — for AI session bootstrapping
  01_PROJECT_OVERVIEW.md  # Tech stack, deployment history, features
  02_ARCHITECTURE.md      # System diagrams, data flows, caching
  03_DATA_MODEL.md        # Database schema, enums, relationships
  04_ROUTING.md           # All pages and API routes
  05_FRONTEND.md          # Component hierarchy, user flows
  06_COMPONENTS.md        # Every component documented
  07_SECURITY.md          # Auth, rate limiting, headers, RLS guidance
  08_DEPLOYMENT.md        # Vercel + Supabase deployment guide
  09_FILE_STRUCTURE.md    # Directory tree, config files, scripts
  10_TESTING.md           # Manual testing checklist
  11_ONBOARDING.md        # Prerequisites, setup, troubleshooting
  12_CHANGELOG.md         # Feature history, known issues
  13_VERCEL_SUPABASE_MIGRATION.md # Step-by-step migration instructions
.creds/
  creds.md                # Infrastructure credentials (gitignored)
```

---

*End of context. Use this to plan architecture decisions, migration steps, new features, or refactoring.*
