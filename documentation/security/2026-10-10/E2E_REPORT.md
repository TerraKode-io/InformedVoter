# E2E Report — InformedVoter (2026-10-10)

**Engine:** Playwright 1.64.0 · **Target:** `https://knowyourgov.us`
**Projects:** chromium-desktop, firefox-desktop, webkit-desktop, mobile-chrome (Pixel 7),
mobile-safari (iPhone 14), api (Chromium) · **Flakes:** 0 (no retries configured)

## 1. Totals

| Metric | Count |
|---|---|
| Test executions | 278 |
| Passed (incl. 9 expected-to-fail regressions) | 249 |
| Skipped (intentional, browser/viewport or chatty-bar guards) | 16 |
| **Unexpected failures** | **13** |
| Flaky | 0 |

Unexpected failures are **all genuine product defects** (not test defects):

| Failure | Projects | Root cause |
|---|---|---|
| `no critical axe violations on /local` | 5 | F-4: `label` + `select-name` (unlabelled form controls) |
| `renders state-ca-senators` | 4 (Chromium/WebKit-based) | F-2: `/_next/image` 400 for congress.gov member photos → console errors |
| `renders state-ca-representatives` | 4 (Chromium/WebKit-based) | F-2 (same) |

Three `test.fail()` regression tests track the sitemap (F-3), congress.gov images (F-2)
and CSP/Cloudflare beacon (F-5); they currently pass **because** the defects are present.

## 2. Browser / viewport coverage

| Project | Device | Status |
|---|---|---|
| chromium-desktop | Desktop Chrome | ran |
| firefox-desktop | Desktop Firefox | ran |
| webkit-desktop | Desktop Safari | ran |
| mobile-chrome | Pixel 7 | ran |
| mobile-safari | iPhone 14 | ran |
| api | Desktop Chrome (request-only) | ran |

All three engines and both desktop/mobile viewports are available and exercised.

## 3. Route coverage matrix

All 26 public routes below were requested on every UI project. Status is the HTTP
document status; H1 asserted where a stable heading exists.

| Route | Status | Notes |
|---|---|---|
| `/` | 200 | H1 "Your Government, In Plain English" |
| `/about` | 200 | |
| `/bills` | 200 | paginated list |
| `/elections` | 200 | |
| `/judicial` | 200 | |
| `/judicial/cases/2024/23-1141` | 200 | detail page (sanitized HTML) |
| `/judicial/justices/clarence_thomas` | 200 | detail page (sanitized HTML) |
| `/local` | 200 | **a11y violations (F-4)** |
| `/local/rules` | 200 | |
| `/local/templates` | 200 | |
| `/voter-info` | 200 | |
| `/polling-places` | 200 | |
| `/compare` | 200 | |
| `/agencies` | 200 | |
| `/agencies/epa` | 200 | |
| `/pac-recipients` | 200 | |
| `/pac-recipients/aipac` | 200 | |
| `/privacy` | 200 | |
| `/contact` | 200 | |
| `/state/ca` | 200 | dashboard |
| `/state/ca/senators` | 200 | **console 400s (F-2)** |
| `/state/ca/representatives` | 200 | **console 400s (F-2)** |
| `/state/ca/governor` | 200 | |
| `/state/ca/bills` | 200 | |
| `/state/ca/elections` | 200 | |
| `/state/ca/voter-info` | 200 | |
| `/this-route-does-not-exist-xyz` | **404** | correct real 404 |

## 4. Journey coverage

| Journey | Result |
|---|---|
| Deep links `/`→`/bills`, `/`→`/judicial`, `/local`→`/local/rules` + browser back | pass |
| selected-state cookie persists and drives `/state/{abbr}/{section}` nav hrefs | pass |
| No cookie ⇒ state-scoped nav resolves to `/#select-state` | pass |
| Desktop primary nav hrefs (Home/PAC/Local/About exact; state-scoped dynamic) | pass |
| Mobile drawer opens as `role="dialog"` | pass |
| Subscribe bar rejects invalid email client-side (no POST) | pass |
| Responsive: no horizontal overflow on `/` and `/state/ca` | pass |
| Media: home images not broken | pass |
| Keyboard: skip-link (#main-content), landmarks banner/main/contentinfo, labelled nav | pass (skip-link excluded on WebKit — browser limitation) |
| Accessibility: axe WCAG 2 A/AA on `/`, `/bills`, `/state/ca`, `/judicial` | pass |
| Accessibility: axe on `/local` | **fail (F-4)** |
| JSON-LD advertised `/search?q=` target | **404** (tracked as `test.fail`, SEO defect F-8) |

## 5. API coverage

| Endpoint | Assertion | Result |
|---|---|---|
| `GET /api/health` | `{status:"ok"}`, 200 | pass |
| `GET /api/bills` | `limit=99999` capped ≤100 | pass |
| `GET /api/bills?chamber=BAD` | 400, sanitized body | pass |
| `GET /api/bills?stateAbbr=ZZ` | 404 | pass |
| `GET /api/candidates?officeType=BAD` | 400 | pass |
| `GET /api/search?q=california` | 200, `{bills,candidates}` | pass |
| `GET /api/search?q=a` | expected 400 | **500 (F-1)** |
| `GET /api/scotus/cases?term=abc` | expected 400 | **500 (F-1)** |
| `GET /api/district-lookup` (no address) | expected 400 | **500 (F-1)** |
| `GET /api/polling-places` (no address) | expected 400 | **500 (F-1)** |
| `POST /api/subscribe` invalid email | expected 400 | **500 (F-1)** |
| `GET /api/local/meetings` (no param) | 400 structured (`INVALID_REQUEST`) | pass |
| `GET /api/local/municipality` (no param) | 400 structured | pass |
| `POST /api/ai/analyze-bill` no/wrong token | 401 | pass |
| `GET /api/ai/analyze-bill` | 401 (auth before method check) | pass |
| `GET /api/cron/sync-members` no/wrong secret | 401 | pass |
| `GET /api/cron/sync-members?manual=true` | **403** in production | pass |
| `POST /api/subscribe` burst | 429 within 8 requests | pass |
| Error bodies | no `Prisma`/`Redis`/stack/`P2002` leakage | pass |

## 6. Security-header coverage

CSP (`default-src 'self'`, `frame-ancestors 'none'`, `base-uri 'self'`,
`form-action 'self'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, HSTS (`max-age=31536000; preload`),
`Permissions-Policy` — all present. Documented weaknesses: `script-src 'unsafe-inline'
'unsafe-eval'`, `X-Powered-By: Next.js`, `Access-Control-Allow-Origin: *` on `/api/*`
(findings H-3). Cloudflare's injected `static.cloudflareinsights.com` beacon is blocked
by CSP (F-5).

## 7. Classification of failures

- **Product defects (13 failing + 9 tracked by `test.fail()`):** F-1, F-2, F-3, F-4, F-5, F-8.
- **Test defects fixed during assessment:** nav-href assumption, case slug, `goBack`
  race, native email validation, WebKit skip-link focus, mobile drawer selector.
- **Environmental:** WebKit Tab-focus behavior; Cloudflare beacon injection.
- **Flakes:** 0 (no retries used).

## 8. Gaps

- No authenticated/session area exists to test (no login).
- Paid AI endpoints (`/api/ai/*`) were validated for authz only; their functional
  behaviour was **not** exercised (cost, and requires the `CRON_SECRET`).
- Subscribe/verify/demographics/unsubscribe happy paths and digest delivery were **not**
  run against production (would create/send real records/email). Covered by code review.
- Local city/meeting detail pages with real IDs were not enumerated exhaustively.
