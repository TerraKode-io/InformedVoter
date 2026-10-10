# Remediation Plan — InformedVoter (2026-10-10)

Ordered by risk. Effort: S ≤ 0.5d · M ≤ 2d · L > 2d.
Owner roles are recommendations, not assignments.

## Wave 1 — Critical / high (do first)

| Order | Finding | Action | Owner | Effort | Depends on | Acceptance criteria | Regression check |
|---|---|---|---|---|---|---|---|
| 1 | S-1 | Upgrade Next to latest patched 16.x (`npm i next@16.2.x`), rebuild, redeploy `iv-app` | App eng + Platform | M | freeze window | `npm audit` no critical; middleware still rate-limits; app healthy | `npm test`, `npm run build`, full Playwright, re-run osv |
| 2 | H-1 | Rotate Anthropic/FEC/etc. keys possibly exposed; move secrets to a manager; restrict share ACLs; remove `.creds/` | Platform/Sec | M | — | secrets not on share; keys rotated; history still clean | `gitleaks dir` clean |
| 3 | S-2 | `npm audit fix`; upgrade `js-yaml`, `postcss`, `sanitize-html`, `@anthropic-ai/sdk` | App eng | M | after #1 | audit high/critical = 0 | build + suite |
| 4 | F-1 | Delete redundant local `try/catch` in the 5 routes; let `withErrorHandler` map errors | App eng | S | — | invalid input ⇒ 400 + `X-Request-Id`; `logError` runs | F-1 `test.fail()` block flips green |

## Wave 2 — Medium functional/SEO

| Order | Finding | Action | Owner | Effort | Acceptance criteria | Regression check |
|---|---|---|---|---|---|---|
| 5 | F-2 | Add `www.congress.gov` (+`congress.gov`) to `images.remotePatterns` | App eng | S | member photos 200; no console errors | `F-2` regression flips green |
| 6 | F-3 | `export const dynamic = "force-dynamic"` (or `revalidate`) in `sitemap.ts` | App eng | S | sitemap contains `/state/`, justices, cases, candidates | `F-3` regression flips green |
| 7 | F-4 | Add `<label>`/`aria-label` to `/local` form controls | Frontend/A11y | S | axe critical = 0 on `/local` | `a11y.spec.ts` passes |
| 8 | S-3 | Upgrade sanitizer + explicit `allowedSchemes`; add sanitizer unit tests | App eng | S | payload tests neutralized | unit tests |

## Wave 3 — Low / hardening

| Order | Finding | Action | Owner | Effort |
|---|---|---|---|---|
| 9 | F-5 | Allow `static.cloudflareinsights.com` in `script-src` **or** disable CF Web Analytics | Platform | S |
| 10 | F-6 | Add flat `eslint.config.mjs`; change script to `eslint .`; wire into CI | App eng | S |
| 11 | F-8 | Implement `/search` or remove the JSON-LD `SearchAction` | App eng | S–M |
| 12 | H-2 | Delete `.deprecated/` from the shared tree | Platform | S |
| 13 | H-4 | Caddy non-root + HEALTHCHECK; move Redis password off CLI; pin prisma CLI in builder; fix Postgres version comment | Platform | M |
| 14 | H-5 | Replace subscriber email with opaque id in digest error log | App eng | S |
| 15 | H-6 | Align manual-cron env checks to `development` | App eng | S |
| 16 | H-7 | Add alerting/metrics on Redis outage + 429 rate | Platform | M |
| 17 | H-3 | Tighten CORS to expected origins; consider CSP nonces; strip `X-Powered-By` | App eng/Platform | M |

## Product / infra decisions required
- **AI cost/abuse policy** for `/api/local/template` (5/hr/IP) and `/api/ai/*` — decide
  whether an additional per-IP daily quota or CAPTCHA is warranted (product decision).
- **CSP strictness** — adopting nonces may require Next config changes; weigh against
  `unsafe-inline` (H-3).
- **Cloudflare Web Analytics** — keep (allow origin) vs remove (change CSP) (F-5).

## Regression strategy
1. Gate every wave on `npm.cmd test` + `npm.cmd run build` + the Playwright suite.
2. `test.fail()` regression tests (F-1/F-2/F-3/F-5/F-8) act as the acceptance switch:
   they turn red-as-failure once the fix lands, signalling the fix took effect.
3. Add gitleaks + `npm audit` + Semgrep to CI to prevent drift.

## Out of scope for this plan
Infrastructure changes to OPNsense/Cloudflare/Proxmox (only proposed where repo files
exist; hostside changes require network-repo change control).
