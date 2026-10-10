# Security Remediation Report — InformedVoter (2026-10-10)

Baseline: OWASP ASVS 5.0 L2 (per applicable requirements), OWASP Top 10 2021,
API Top 10 2023, LLM Top 10 2025; NIST SSDF SP 800-218, CSF 2.0, SP 800-115.
No certification/compliance claim is made.

**Status legend:** Confirmed = reproduced with evidence · Static = code-review only ·
Hypothesis = unverified · FP = false positive.

---

## Executive summary

The application is well-structured for security: unauthenticated public surface only,
no user sessions, Prisma-parameterized data access, cron/AI endpoints defended by
timing-safe Bearer auth in two layers, tiered Redis rate limiting, a strict sanitizer on
all external HTML, and a complete security-header set. Dynamic testing confirmed correct
authorization (401/403), correct rate-limit enforcement (429), and sanitized error bodies.

The material risks are: (1) **an outdated framework patch level** — `next@16.2.1` carries
a critical advisory cluster (middleware/proxy bypass, cache poisoning, RCE-class) directly
applicable to this self-hosted App Router deployment; (2) **inconsistent error handling**
where a redundant local `try/catch` turns client-validation errors into 500s and bypasses
the structured logger; (3) **exposure of live secrets on a shared filesystem** (gitignored,
not committed, but readable on the share); and (4) several **functional/SEO defects**
(broken congress.gov images, empty dynamic sitemap, unlabelled form controls on `/local`).

No high-severity application vulnerability (injection, auth bypass, XSS, SSRF) was
confirmed. The framework advisory cluster and secrets-on-disk are the top priorities.

---

## Finding index

| ID | Title | Category | Sev | Conf | Status |
|---|---|---|---|---|---|
| S-1 | `next@16.2.1` critical advisory cluster | Supply chain | High | High | Confirmed |
| S-2 | Other direct dependency advisories | Supply chain | High/Med | High | Confirmed |
| S-3 | `sanitize-html` URI-scheme advisories | Supply chain | Medium | Med | Static |
| S-4 | `sharp`/libvips transitive advisories | Supply chain | Medium | Med | Confirmed |
| H-1 | Live secrets present on shared filesystem | Secrets | High | High | Confirmed |
| F-1 | ValidationError → HTTP 500; logging bypass | Error handling | Medium | High | Confirmed |
| F-2 | congress.gov member images blocked (400) | Functional | Medium | High | Confirmed |
| F-3 | Sitemap statically generated without DB | Functional/SEO | Medium | High | Confirmed |
| H-2 | Offensive/privesc scripts retained in tree | Hygiene | Low | High | Confirmed |
| F-4 | `/local` critical accessibility violations | Accessibility | Low-Med | High | Confirmed |
| F-5 | CSP blocks Cloudflare analytics beacon | Config | Low | High | Confirmed |
| F-8 | JSON-LD advertises non-existent `/search` | SEO | Low | High | Confirmed |
| F-6 | `npm run lint` broken; no ESLint config | Build/QE | Low | High | Confirmed |
| H-3 | CSP unsafe-inline/eval; X-Powered-By; CORS `*` | Hardening | Low | High | Confirmed |
| H-4 | Container/config hardening gaps | Infra config | Low | High | Confirmed |
| H-5 | Subscriber email logged on digest error | Logging/PII | Low | High | Confirmed |
| H-6 | Manual-cron env check inconsistency | Authz | Info | High | Confirmed |
| H-7 | Redis fail-open rate limiting | Availability | Info | High | By design |
| FP-1 | Semgrep `unsafe-formatstring` ×30 | SAST | — | High | FP |
| FP-2 | Semgrep `dangerouslySetInnerHTML` ×5 | SAST | — | High | Reviewed safe |

---

## High-priority findings

### S-1 — `next@16.2.1` carries a critical advisory cluster
- **Category:** Supply chain · **Severity:** High · **Confidence:** High · **Status:** Confirmed
- **Evidence:** `npm audit` (`next` = critical) and `osv-scanner` list 31 GHSA advisories
  for `next@16.2.1`, including middleware/proxy bypass via segment-prefetch and dynamic
  route parameter injection, cache poisoning of SSG/ISR and RSC responses, image-optimizer
  DoS/SSRF, and multiple RCE-class issues (Windows-hosted, Image Optimization AVIF,
  `next/og`). `npm audit` reports a fix is available within the 16.x line; `osv-scanner`
  emitted 31 `GHSA-*` IDs for the installed version.
- **Location:** `package.json` (`"next": "^16.2.1"`) / `package-lock.json`.
- **Prerequisites:** Remote, unauthenticated; exploitability varies per advisory
  (middleware bypass is directly relevant to this deployment's `/api/*` protection).
- **Expected vs actual:** Expected an up-to-date Next 16 patch; actual is a version with
  numerous unpatched advisories. **Exact per-CVE applicability must be validated against
  each advisory** since some require specific features (i18n, Turbopack locale, AVIF).
- **Impact / blast radius:** Potential middleware auth bypass (would expose AI/cron
  routes), cache poisoning (cross-user content substitution / persistent DoS), SSRF, RCE.
  Blast radius: whole app VM.
- **Root cause:** Dependency drift; `^16.2.1` allowed but lockfile pinned to a vulnerable
  release.
- **Controls effectiveness:** None at the app layer; ingress hardening (Cloudflare-only)
  and lack of user sessions reduce some impact.
- **Proposed fix:** Bump to the latest patched 16.x: `npm i next@16.2.x`
  (`npm audit fix` reports availability), verify build + tests, redeploy. Apply the
  framework's guidance for any feature-flagged mitigation as interim.
- **Compatibility risk:** Minor/patch within 16.x should be low; re-run the E2E suite.
- **Temporary mitigation:** Enable Cloudflare WAF rules; ensure middleware bypass paths
  are not relied on as the sole control for cron (route-level `verifyCronSecret` already
  provides defense-in-depth).
- **Regression check:** `npm.cmd test`, `npm.cmd run build`, full Playwright suite,
  re-run `npm audit`/`osv-scanner`.
- **References:** OWASP A06:2021 (Vulnerable & Outdated Components) / A03:2021;
  NIST SSDF PW.4/PS.3; CWE-1395. CVSS: per-advisory (defer to vendor GHSA vectors).

### S-2 — Other direct dependency advisories
- **Category:** Supply chain · **Severity:** High/Medium · **Status:** Confirmed
- **Evidence (direct):** `js-yaml@4.1.1` (high; quadratic DoS), `postcss@8.4.31/8.5.15`
  (high; XSS via unescaped `</style>`, sourcemap arbitrary file read), `@anthropic-ai/sdk@
  0.85.0` (moderate; insecure default file permissions in local memory tool),
  `sanitize-html@2.17.4` (moderate; see S-3), `resend` (moderate), `vitest` (moderate,
  dev), `eslint-config-next` (high, dev).
- **Location:** `package.json` / `package-lock.json`.
- **Prerequisites:** Varies; `postcss` at build time; `js-yaml` only if untrusted YAML is
  parsed (js-yaml is a runtime dependency — verify no untrusted YAML path); `@anthropic-ai
  /sdk` file-permission issue is low-impact server-side.
- **Impact:** Build-time/DoS/information-disclosure classes; none confirmed reachable in
  production request paths, but patch regardless.
- **Root cause:** Drift.
- **Fix:** `npm audit fix` (non-breaking) where possible; upgrade `js-yaml`, `postcss`,
  `sanitize-html`, `@anthropic-ai/sdk` to fixed releases; replace `eslint-config-next`
  after the lint fix (F-6).
- **Regression check:** build, tests, suite, re-audit.
- **References:** A06:2021; CWE-1395, CWE-400, CWE-79.

---

## Medium-priority findings

### H-1 — Live secrets present on a shared filesystem
- **Category:** Secrets management · **Severity:** High (exposure) · **Confidence:** High · **Status:** Confirmed
- **Evidence:** `gitleaks dir` flagged 32 items in **gitignored** files present in the
  working tree: `.env` (3), `.env.local` (6), `.creds/creds.md` (2), and
  `.deprecated/scripts/*.py` (1 each). Rules hit: `generic-api-key`, `anthropic-api-key`
  (`x2`), `gcp-api-key` (`x2`), `jwt`. **`gitleaks git` over 104 commits: no leaks.**
- **Location:** repo working tree on `\\10.10.20.50\Shared\git\InformedVoter` (UNC share).
- **Prerequisites:** Any principal with read access to the share (A4).
- **Expected vs actual:** Expected secrets to live only on the servers / a secret store;
  actual `.env`/`.env.local`/`.creds` with live keys sit on a multi-user share. Not in VCS.
- **Impact / blast radius:** If the share is readable by unintended accounts, API keys
  (Anthropic, FEC, etc.) and DB/Redis/CRON secrets are exposed → cost abuse, data access.
- **Root cause:** Local dev config co-located with a network-shared working tree.
- **Controls effectiveness:** `.gitignore` prevented VCS exposure (good) and history is
  clean; file-permission controls on the share are the weak point.
- **Fix (proposed, not applied):** Move secrets to a manager (e.g., 1Password/Bitwarden
  Secrets, or per-host `.env` only). Restrict share ACLs. Rotate any key that may have
  been read. Remove `.creds/` from the working tree; ensure `.deprecated/` is deleted.
- **Temporary mitigation:** Tighten share permissions; rotate high-value keys.
- **Regression check:** `gitleaks dir`/`git` in CI; secret-scanning pre-commit hook.
- **References:** OWASP A02/A05:2021; NIST SSDF PS.1/PS.2; CWE-538, CWE-312.

### F-1 — `ValidationError` swallowed by local `try/catch` → 500 and logging bypass
- **Category:** Error handling / correctness · **Severity:** Medium · **Confidence:** High · **Status:** Confirmed
- **Evidence (dynamic):** expected 400, observed 500 — `/api/search?q=a`,
  `/api/scotus/cases?term=abc`, `/api/district-lookup` (no address),
  `/api/polling-places` (no address), `POST /api/subscribe` (invalid email). Routed
  through `withErrorHandler` correctly return structured 400 (`/api/local/meetings`,
  `/api/local/municipality` → `{code:"INVALID_REQUEST"}`).
- **Location:** e.g. `src/app/api/search/route.ts:79-82`,
  `src/app/api/scotus/cases/route.ts:54-57`, `src/app/api/district-lookup/route.ts:129-132`,
  `src/app/api/polling-places/route.ts:136-139`, `src/app/api/subscribe/route.ts:82-85`;
  helper `src/lib/api-error-handler.ts:164-207`.
- **Prerequisites:** None (any caller sending invalid input).
- **Expected vs actual:** Expected the `AppError` mapping in `withErrorHandler` to produce
  HTTP 400 with `X-Request-Id` and `Cache-Control: no-store`; actual is a generic 500 with
  no request-id and no structured `logError` record.
- **Impact / blast radius:** Client errors misreported as server errors; monitoring/alerting
  noise; loss of structured redacted logging and request correlation for these routes.
  No confidentiality/integrity impact.
- **Root cause:** Redundant per-route `try/catch` that returns 500 before the wrapper sees
  the thrown `ValidationError`.
- **Controls effectiveness:** The wrapper is correct but bypassed on ~5 routes.
- **Proposed fix:** Remove the local `try/catch` blocks (let `withErrorHandler` handle all
  errors), or re-throw `AppError` instances. Example:
  ```ts
  // before
  } catch (error) { console.error("[search] ...", error);
    return Response.json({ error: "Internal server error" }, { status: 500 }); }
  // after — delete the local catch entirely; keep withErrorHandler(..., {route})
  ```
- **Compatibility risk:** None; behaviour becomes more correct.
- **Temporary mitigation:** none needed.
- **Regression check:** the `validation status-code defect (expected-to-fail)` block in
  `e2e/api.spec.ts` flips green when fixed.
- **References:** API Top 10 2023 API8 (Security Misconfiguration) / API4; CWE-755,
  CWE-209. Not CVSS-scored (correctness/observability defect).

### F-2 — congress.gov member images blocked by image optimizer (HTTP 400)
- **Category:** Functional defect · **Severity:** Medium · **Confidence:** High · **Status:** Confirmed
- **Evidence (dynamic):** `/state/ca/senators` and `/representatives` issue
  `GET /_next/image?url=https%3A%2F%2Fwww.congress.gov%2Fimg%2Fmember%2F...&w=96&q=75`
  which return **400**; Chromium/WebKit log console errors. Reproduced with the
  `probe.spec.ts` network capture and the `page`/`api` projects.
- **Location:** `next.config.mjs:54-73` `images.remotePatterns` lists
  `theunitedstates.io`, `bioguide.congress.gov`, `*.oyez.org`, `oyez.org` — **not
  `www.congress.gov`**.
- **Prerequisites:** None (any visitor on those pages).
- **Expected vs actual:** Expected member photos to render; actual broken images + console
  errors. Note `img-src` CSP also omits congress.gov, but images are proxied same-origin,
  so the missing remotePattern is the operative cause.
- **Impact / blast radius:** Degraded UX on all member/representative pages (many images);
  console noise; possible SEO/image issues.
- **Root cause:** Host not added to `images.remotePatterns`.
- **Fix (proposed, not applied):**
  ```js
  images: { remotePatterns: [
    { protocol: "https", hostname: "theunitedstates.io" },
    { protocol: "https", hostname: "bioguide.congress.gov" },
    { protocol: "https", hostname: "www.congress.gov" },   // add
    { protocol: "https", hostname: "congress.gov" },       // optional
    { protocol: "https", hostname: "*.oyez.org" },
    { protocol: "https", hostname: "oyez.org" },
  ]}
  ```
- **Compatibility risk:** Low.
- **Regression check:** `F-2` `test.fail()` in `e2e/api.spec.ts`.
- **References:** CWE-703 (improper check); OWASP A05:2021. Not a security vuln.

### F-3 — Sitemap statically generated at build time without DB → empty dynamic sections
- **Category:** Functional/SEO · **Severity:** Medium · **Confidence:** High · **Status:** Confirmed
- **Evidence:** live `/sitemap.xml` contains **28 `<loc>` entries** (8 static + 21 agency),
  with **0** `/state/`, `/judicial/justices/`, `/judicial/cases/`, or `/candidate/` URLs,
  though the DB has 7,181 bills, 30 justices and candidates. `src/app/sitemap.ts` queries
  Prisma in a function that Next prerenders; the Docker build stage runs `npm run build`
  **without `DATABASE_URL`** (`Dockerfile:40`), so the queries throw and are caught,
  returning `[]`, and the result is cached statically.
- **Location:** `src/app/sitemap.ts:27-98`; `Dockerfile:9-40`.
- **Expected vs actual:** Expected a complete sitemap; actual omits all dynamic content.
- **Impact:** SEO/discoverability; search engines never learn about state/justice/case/
  candidate pages.
- **Root cause:** Static generation of a DB-dependent route at image-build time.
- **Fix (proposed, not applied):** `export const dynamic = "force-dynamic";` (or
  `export const revalidate = 3600;`) in `src/app/sitemap.ts`, so it renders at request
  time with DB access. Alternatively provide `DATABASE_URL` at build time.
- **Regression check:** `F-3` `test.fail()`; assert `body` contains `/state/`.
- **References:** CWE-703; OWASP A05:2021.

### S-3 — `sanitize-html` URI-scheme advisories (reachability assessed)
- **Category:** Supply chain / XSS · **Severity:** Medium · **Confidence:** Medium · **Status:** Static
- **Evidence:** npm audit/OSV flag `sanitize-html@2.17.4` for incomplete URI-scheme
  validation via `action`/`formaction`/`data`/`poster`/`background`, an SVG SMIL URI-list
  bypass, and a `</textarea/>` allowedTags bypass.
- **Reachability:** `src/lib/sanitize.ts` allows only
  `a: ["href","rel","class","title"]` and `*: ["class"]` (plus a tag list); it does **not**
  allow `action/formaction/poster/background/data`, and sanitize-html's default
  `allowedSchemes` blocks `javascript:`. So the named attributes are not rendered by this
  config **= not reachable** for those vectors. The `</textarea/>` bypass concerns
  `allowedTags` handling and should still be patched defensively.
- **Fix:** Upgrade `sanitize-html` to the fixed release; keep the explicit attribute
  allowlist; consider adding `allowedSchemes: ["http","https","mailto","tel"]` explicitly.
- **Regression check:** unit test feeding `<a href="javascript:alert(1)">` and
  `</textarea/>`-based payloads through `sanitizeHtml`, asserting neutralization.
- **References:** OWASP A03:2021; CWE-79, CWE-20.

### S-4 — `sharp`/libvips transitive advisories
- **Category:** Supply chain · **Severity:** Medium · **Status:** Confirmed
- **Evidence:** `sharp@0.34.5` inherits libvips (`CVE-2026-33327/…`), libheif and librsvg
  advisories; used by Next image optimization.
- **Impact:** Image-decoding memory-safety issues; relevant because the image optimizer
  handles remote images (after F-2 is fixed, attacker-influenced URLs reach `sharp`).
- **Fix:** Update `sharp`/libvips via Next patch (bundled) and keep image optimization
  behind the `remotePatterns` allowlist.
- **References:** CWE-787; OWASP A06:2021.

---

## Low-priority findings & hardening

### H-2 — Offensive/privesc scripts retained in the working tree
`S:\...\.deprecated\scripts\` contains `brute_su.py`, `escalate.py`, `find_secrets.py`,
`check_exploits.py`, etc. (untracked, gitignored). Retained tooling of this nature should
not live in a shared tree; delete and keep such utilities out-of-band. (CWE-506.)

### F-4 — `/local` critical accessibility violations
axe reports `label` and `select-name` (critical impact) on `/local` across all 5 UI
projects — form controls without accessible names. Fix: associate `<label>`/`aria-label`
with each input/select. Regression: `e2e/a11y.spec.ts`.

### F-5 — CSP blocks the Cloudflare-injected analytics beacon
Cloudflare auto-injects `https://static.cloudflareinsights.com/beacon.min.js`, which the
CSP `script-src` does not permit; WebKit logs the refusal (and analytics won't record).
Fix: either add `https://static.cloudflareinsights.com` to `script-src` or disable
Cloudflare Web Analytics for the zone. Regression: `F-5` `test.fail()`.

### F-8 — JSON-LD advertises a non-existent `/search`
`src/components/seo/JsonLd.tsx:45-51` publishes a `SearchAction` targeting
`/search?q={search_term_string}`, but no `/search` route exists (returns 404). Fix:
implement the route or remove the `potentialAction`. Regression: `journeys.spec.ts`.

### F-6 — `npm run lint` is broken and no ESLint config exists
`package.json` runs `next lint`, removed in Next 16 (fails: "Invalid project directory …
\lint"); no `eslint.config.*`/`.eslintrc` is present despite `eslint` +
`eslint-config-next` being installed. Fix: add a flat `eslint.config.mjs` and change the
script to `eslint .`. Regression: CI runs the lint script.

### H-3 — Header/transport hardening
`script-src 'unsafe-inline' 'unsafe-eval'` (weakened XSS defense), `X-Powered-By: Next.js`
disclosure, and `Access-Control-Allow-Origin: *` on all `/api/*`. No cookie auth exists,
so CORS `*` is low impact, but tighten to expected origins. Consider CSP nonces.

### H-4 — Container/config gaps
- `docker/caddy/Dockerfile` runs as root (Trivy DS-0002) and has no `HEALTHCHECK` (DS-0026).
- `docker-compose.data.yml` passes the Redis password on the CLI (`--requirepass
  ${REDIS_PASSWORD}` and in the healthcheck) → visible via process list / `docker inspect`;
  prefer `REDIS_ARGS`/config file with restricted perms.
- `Dockerfile:18` uses `npm ci --omit=dev --ignore-scripts` then `npx prisma generate`
  (prisma is a devDependency, so `npx` fetches an **unpinned** CLI at build time) →
  reproducibility/supply-chain risk. Install a pinned prisma CLI in the builder.
- Comment says PostgreSQL 16 but `docker-compose.data.yml` uses `postgres:17-alpine`.

### H-5 — Subscriber email logged on digest error (PII)
`src/app/api/cron/send-digest/route.ts:235` logs `Error sending to ${sub.email}`. PII in
logs contradicts the redaction intent of `error-logger.ts`. Log an opaque subscriber id.

### H-6 — Manual-cron environment-check inconsistency
Middleware allows `?manual=true` when `NODE_ENV !== "production"` + `ALLOW_MANUAL_CRON=true`;
route handlers allow it only when `NODE_ENV === "development"`. Defense-in-depth holds
(non-development, non-production envs still rejected by the route), but align the checks.

### H-7 — Redis fail-open rate limiting (by design)
`src/lib/rate-limit.ts:55-82` allows **all** traffic if Redis is unset/unreachable, and
`acquireLock` returns `true` (lock granted) on error. Intentional for dev; document the
production dependency and add monitoring/alerting on Redis loss.

---

## False positives & reviewed items

- **FP-1 Semgrep `unsafe-formatstring` ×30** — reviewers confirmed these are
  `console.log/error` with template literals (e.g. `analyze-cases/route.ts:84`), not
  `printf`-style sinks. Not exploitable.
- **FP-2 Semgrep `dangerouslySetInnerHTML` ×5** — all uses are safe:
  `judicial/cases/[...slug]/page.tsx:308/323/338` and
  `judicial/justices/[slug]/page.tsx:417` pass content through `sanitizeHtml`; the
  `JsonLd.tsx:21` sink escapes `<` to `\u003c` (`safeJsonLd`).
- **gitleaks hits in `.deprecated/scripts/*.py`** — script text matching `generic-api-key`,
  not live credentials (the `.env`/`.creds` hits are genuine; see H-1).

## Open hypotheses (unverified)
- Live prompt-injection resistance of `claude-client.ts` (`wrapUserContent` + JSON parse)
  — static controls look reasonable; not dynamically tested (would require paid calls).
- Reachability of individual Next advisories under this exact feature set — requires
  per-GHSA validation against 16.2.x.
- Infrastructure controls (B1/B3/B6) — not verifiable from the repo.
