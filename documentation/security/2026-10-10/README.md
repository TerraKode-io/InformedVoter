# InformedVoter — Security & E2E Assessment (2026-10-10)

**Commit:** `5d1decdffb55d43957763e04f3198ddc82e3c2a7` · **Branch:** `main` · **Working tree at start:** clean
**Assessment date:** 2026-10-10 · **Assessor:** automated opencode session acting as QA / appsec reviewer
**Target tested dynamically:** `https://knowyourgov.us` (LIVE production, operator-authorized, non-destructive)

> This is a point-in-time assessment. It does **not** certify the application as free of
> vulnerabilities. Coverage limitations and unverified controls are stated explicitly below.

---

## 1. Scope & boundaries

### In scope
- All first-party source under `src/`, `prisma/`, and checked-in deployment config
  (`Dockerfile`, `docker/caddy/Dockerfile`, `docker-compose.*.yml`, `next.config.mjs`).
- 30 pages, 37 API route files (14 cron jobs, 2 AI actions), middleware, rate limiter,
  auth helper, sanitizer, error handler/classes, external clients.
- Non-destructive dynamic testing of the live site: page rendering, API contracts,
  authorization, validation, rate limiting, security headers, accessibility.
- Dependency, secret, SAST, container/config scanning.

### Explicitly out of scope / not tested
- **Destructive actions:** no DoS/load/brute-force/credential-stuffing, no persistence,
  lateral movement, or real-data exfiltration.
- **Mutation of production data:** no valid subscriber created, no real email sent,
  no meeting submission written, no paid AI endpoint invoked with a valid credential.
- **Infrastructure controls not visible from the repo:** OPNsense DNAT/filter rules,
  Cloudflare rules, Proxmox hypervisor, TLS private key, host crontab, UFW, fail2ban,
  Umami. Reviewed only where config files exist; otherwise **unverified**.
- **Network timing side-channels:** constant-time comparison verified by code review only
  (no noisy timing measurements, per instruction).
- **Session/auth flows:** the app has **no first-party login/session**; there is no
  cookie-authenticated user area, so session/CSRF/IDOR on user accounts is largely N/A.

### Environment
- Workstation: Windows 11, PowerShell 5.1. Repo is on a UNC share
  (`\\10.10.20.50\Shared\git\InformedVoter`); a **local copy** was made under
  `%LOCALAPPDATA%\Temp\opencode\InformedVoter` for builds and test execution (UNC
  breaks npm/Next tooling).
- The live origin (`iv-app`, Proxmox VM 264 behind Cloudflare → OPNsense DNAT) and data
  tier (`iv-data`, VM 265, VPC-only Postgres/Redis) were **not directly touched**; only
  the public HTTPS surface was exercised.

---

## 2. Versions recorded

| Component | Version |
|---|---|
| Node.js / npm | 24.19.0 / 11.17.0 |
| Next.js / React | 16.2.1 / 19.2.4 |
| Prisma / @prisma/client | 5.22.0 |
| TypeScript | 5.9.3 |
| Tailwind CSS | 4.2.x |
| Vitest | 4.1.8 |
| @anthropic-ai/sdk | 0.85.0 |
| sanitize-html | 2.17.4 |
| Playwright | 1.64.0 |
| Chromium / Firefox / WebKit | 156 headless shell / 157.0 / 27.2 |
| gitleaks | 8.30.1 |
| Trivy | 0.75.0 |
| osv-scanner | 2.6.0 (scalibr 0.5.2) |
| Semgrep | 1.180.0 |

Standards frameworks and versions are listed in `STANDARDS_MAPPING.md`.

---

## 3. How to reproduce

### E2E suite
From the repository root (a normal local checkout; not the UNC share):

```powershell
npm ci
npm i -D "@playwright/test@1.64.0" "@axe-core/playwright"
npx playwright install chromium firefox webkit
$env:E2E_BASE_URL = "https://knowyourgov.us"   # or an isolated staging URL
npx playwright test
```

The suite is copied under `documentation/security/2026-10-10/`:

```
playwright.config.ts
e2e/
  routes.ts          # discovered route catalogue
  helpers.ts         # console/overflow/image helpers
  smoke.spec.ts      # route rendering, deep links, 404, responsiveness, media
  headers.spec.ts    # security headers + CORS posture
  a11y.spec.ts       # axe (WCAG 2 A/AA) + keyboard/landmarks
  journeys.spec.ts   # cookie persistence, navigation, subscribe validation
  api.spec.ts        # API contracts, authz, validation, rate limit, defect regressions
```

**Projects:** `chromium-desktop`, `firefox-desktop`, `webkit-desktop`, `mobile-chrome`
(Pixel 7), `mobile-safari` (iPhone 14), and a single-purpose `api` project (Chromium).

> ⚠️ Running the suite against the live site exercises the `/api/subscribe` rate limiter
> (7 invalid-input POSTs — no data written, no email sent). Point `E2E_BASE_URL` at an
> isolated environment where possible.

### Scanners (run against the local source copy)
```powershell
npm audit --json
gitleaks dir <repo> --report-format json
gitleaks git <repo> --log-opts="--all"
osv-scanner scan source -r <repo>
semgrep scan --config auto <repo>/src
trivy fs --scanners vuln,misconfig,secret <repo>
```

### Existing project checks
```powershell
npm.cmd test        # Vitest — 33 passed
npm.cmd run build   # Next production build — success
npm.cmd run lint    # FAILS — see finding F-6
```

---

## 4. Artifact index

| Artifact | Contents |
|---|---|
| `README.md` | this file |
| `E2E_REPORT.md` | route/journey/browser coverage matrix, pass/fail totals |
| `THREAT_MODEL.md` | assets, trust boundaries, scenarios, controls |
| `SECURITY_REMEDIATION_REPORT.md` | prioritized findings, code-review defects, scanner dispositions |
| `RED_BLUE_MATRIX.md` | per-scenario preventive control, observed detection, gaps |
| `REMEDIATION_PLAN.md` | ordered fixes, owners, acceptance criteria, regression checks |
| `STANDARDS_MAPPING.md` | OWASP/NIST control traceability |
| `artifacts/SCAN_SUMMARY.md` | machine-generated scan tallies (redacted) |
| `e2e/`, `playwright.config.ts` | runnable suite |

Raw scanner outputs (may contain internal filenames) and the local secrets-bearing copy
are intentionally **not** committed; secrets are never disclosed in any artifact.

---

## 5. Limitations & disclosures

- Dynamic tests ran against **production**; only non-destructive requests were used.
- WebKit mobile/desktop exercises the CSP violation caused by Cloudflare's injected
  analytics beacon (finding F-5), which is environment-specific.
- Firefox does not surface the image-optimizer 400s as console errors, so F-2's console
  symptom appears on Chromium/WebKit projects only (the underlying defect is universal).
- No assessment of host/network/hypervisor configuration beyond checked-in files.
- Secret scanning covers the working tree and full git history; it cannot attest to
  secrets stored in external systems (Cloudflare, Resend, Anthropic, FEC, etc.).
