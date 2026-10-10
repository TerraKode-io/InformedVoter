# E2E run summary (redacted) — 2026-10-10

Target: `https://knowyourgov.us` · Playwright 1.64.0

```
stats: expected 249 · skipped 16 · unexpected 13 · flaky 0 · total 278
duration: ~141 s
```

## Unexpected failures (grouped)

| Spec | Test | Projects | Count |
|---|---|---|---|
| a11y.spec.ts | no critical axe violations on /local | chromium, firefox, webkit, mobile-chrome, mobile-safari | 5 |
| smoke.spec.ts | renders state-ca-senators (/state/ca/senators) | chromium, webkit, mobile-chrome, mobile-safari | 4 |
| smoke.spec.ts | renders state-ca-representatives (/state/ca/representatives) | chromium, webkit, mobile-chrome, mobile-safari | 4 |

All 13 map to confirmed product defects:
- `/local` → `label`, `select-name` (F-4)
- senators/representatives → `/_next/image` 400 for congress.gov photos (F-2)

## Expected-to-fail regression tests (currently passing as "expected failures")
- F-1 validation status code (5 checks) — `api.spec.ts`
- F-2 congress.gov image resolves — `api.spec.ts`
- F-3 sitemap includes `/state/` — `api.spec.ts`
- F-5 CSP permits Cloudflare beacon — `api.spec.ts`
- F-8 `/search` JSON-LD target resolves — `journeys.spec.ts`

## Skips (intentional)
- Desktop-only nav / cookie tests on mobile projects.
- Mobile-drawer test on desktop projects.
- WebKit skip-link focus (browser limitation).
- Subscribe bar guard when the bar is dismissed/delayed.
