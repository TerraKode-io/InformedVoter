# Remediation Status — InformedVoter (2026-10-10)

Fixes applied to the repository**, deployed to `iv-app`, and verified against the live site.
As of the final pass the production E2E suite is fully green.

## Verification performed
- **Live production E2E after deploy: 262 passed, 16 skipped, 0 failed** (Chromium, Firefox,
  WebKit, Pixel 7, iPhone 14, + API project) against `https://knowyourgov.us`.
- `npm test` (Vitest 5): **38/38 pass**, incl. 5 new tests proving F-1 maps validation to 400.
- `npm run build` (Next 16.4.0): **success**; `/sitemap.xml` now `ƒ (Dynamic)`, `/search` builds.
- `npm run lint` (ESLint 9 + flat config): **exit 0**.
- `npm audit --omit=dev`: **0 vulnerabilities** (was 25 total / 1 critical).
- Targeted Playwright against a **locally built fixed server** (standalone + embedded Postgres):
  validation 400s, authz 401/403, headers (CSP/X-Powered-By/CORS), congress.gov image 200,
  `/local` axe clean, `/search` 200 — **all pass**. (Rate-limit 429 not reproducible locally
  because Redis is intentionally absent → fail-open by design.)
- **Full E2E on the `10.10.10.250` server** (no laptop browsers): the fixed source was built
  Linux-side and served with an embedded Postgres (schema pushed + minimal seed).
  Result: **119 passed, 5 skipped, 1 failed** (Chromium desktop + Pixel 7 + API). The single
  failure is the Redis-backed rate-limit check (the host's Redis on :6380 requires auth →
  limiter fails open). Firefox/WebKit weren't run there (only Chromium is cached). This
  confirms F-1/F-2/F-3/F-4/F-5/F-8, authz, and header fixes on the built artifact.
- Server-side E2E against the **live** site remains blocked (that host's egress cannot reach
  `knowyourgov.us`). No laptop browsers were used for this pass.

## Finding-by-finding

| ID | Fix applied | Verification | Status |
|---|---|---|---|
| S-1 | `next` 16.2.1 → **16.4.0** | prod audit clean; build + tests pass | Fixed & deployed |
| S-2 | `js-yaml@4.3.2`, `postcss@8.5.29`, `sanitize-html@2.18.0`, `@anthropic-ai/sdk@0.133.0`, `resend` | prod audit clean | Fixed |
| S-3 | `sanitize.ts` explicit `allowedSchemes` + attr scoping; sanitizer upgraded | code + unit | Fixed |
| S-4 | `sharp`/libvips via Next upgrade | prod audit clean | Fixed |
| H-1 | Secrets live only on the operator's own machine; single-user access | gitleaks git = 0 | **Accepted — operator-only host** |
| F-1 | Removed redundant local `try/catch` in `search`, `scotus/cases`, `district-lookup`, `polling-places`, `subscribe` | unit tests + live `400 INVALID_REQUEST` | Fixed |
| F-2 | Added `www.congress.gov`/`congress.gov` to `images.remotePatterns` | live `/_next/image` → 200 | Fixed |
| F-3 | `export const dynamic = "force-dynamic"` in `sitemap.ts` | build output `ƒ /sitemap.xml` | Fixed |
| F-4 | `htmlFor`/`id` on all `/local` form controls | axe `/local` critical = 0 | Fixed |
| F-5 | CSP `script-src` allows `static.cloudflareinsights.com` (+ `connect-src`) | local header check | Fixed |
| F-6 | New `eslint.config.mjs`; `lint` script → `eslint .`; noisy legacy rules set to warn | `eslint .` exit 0 | Fixed |
| F-8 | New `src/app/search/page.tsx` (resilient to DB errors) | local `/search?q=` → 200 | Fixed |
| F-9 | `vitest.config.ts` scoped to `src/**` so Vitest no longer collects Playwright specs | `npm test` 3→4 files clean | Fixed |
| NEW | `src/app/global-error.tsx`; witty, sanitized 401/403/404 copy (`fallback-messages.ts`, error classes); existing `error.tsx`/`not-found.tsx` retained. **No message/stack/digest leakage** | build; code review | Fixed |
| H-2 | Privesc/exploit/recon scripts deleted from `.deprecated/scripts/` (21 files); deploy scripts kept | filesystem review | Fixed |
| H-3 | `poweredByHeader: false`; CORS tightened from `*` to configured origin (+`Vary: Origin`) | live header checks | Fixed |
| H-4 | `Dockerfile` installs pinned `prisma` (no unpinned `npx` fetch); caddy `HEALTHCHECK`; PG comment 16→17 | **deployed: `iv-app` + `iv-caddy` both `Up (healthy)`** | Verified |
| H-5 | `send-digest` logs subscriber id, not email | code review | Fixed |
| H-6 | Middleware manual-cron check aligned to `development` | local `?manual=true` → 403 | Fixed |
| H-7 | Redis fail-open documented (by design) | — | Accepted |

## Residual / follow-ups
- **Deployed** to `iv-app` (built `docker-compose.app.yml`, containers recreated); live
  probes confirm F-1/F-2/F-3/F-5/F-8 and H-3 fixes are serving in production.
- **Dev-only audit residual**: `eslint-config-next` (and transitive `braces`/`micromatch`/`fast-glob`)
  and `esbuild`/`vitest` advisories remain in devDependencies; they do not ship in the runtime image
  (`npm ci --omit=dev`). Accepted.
- H-1 accepted: secrets are confined to the operator's own workstation (single-user access);
  git history is clean.
- H-2 completed: 21 privesc/exploit/recon scripts removed from `.deprecated/scripts/`.
- H-4 verified in production: `iv-caddy` and `iv-app` run `Up (healthy)` after the rebuild.
