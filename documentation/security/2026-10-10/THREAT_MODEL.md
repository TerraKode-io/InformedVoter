# Threat Model — InformedVoter (2026-10-10)

Method: asset-driven, boundary-first review aligned to OWASP ASVS L2, OWASP WSTG,
OWASP Top 10 (2021) / API Top 10 (2023) / LLM Top 10 (2025), and NIST SP 800-30-style
scenario enumeration. Confidence reflects evidence actually collected.

## 1. System summary

Public, unauthenticated civic-information website. Next.js 16 App Router; a single
Node runtime serves pages + REST API; middleware rate-limits `/api/*`; a Postgres/Redis
data tier is VPC-isolated. Cron jobs ingest external data and call Claude; Resend sends
email. There is **no end-user authentication/session** and no write-capable user area.

## 2. Assets

| Asset | Sensitivity | Location |
|---|---|---|
| Subscriber records (email, state, demographics, tokens) | PII | Postgres `Subscriber` |
| `CRON_SECRET`, API keys (Anthropic, FEC, Congress, Legiscan, Google Civic, Resend, CF) | Secret | `.env` on `iv-app`; some on workstation share |
| Postgres / Redis data | Confidential | `iv-data` VPC-only |
| Claude API budget | Cost | external |
| Site availability / SEO integrity | Reputational | public |
| Ingested external content (bills, cases, agendas, addresses) | Untrusted | external → DB → browser |

## 3. Trust boundaries & assumptions

| # | Boundary | Control | Assumption / risk |
|---|---|---|---|
| B1 | Internet → Cloudflare → OPNsense DNAT → `iv-app` | CF proxy + source-locked DNAT | Only Cloudflare source IPs reach origin (verified via network repo, **not** re-tested) |
| B2 | Client → `/api/*` middleware | Redis rate limit; Bearer/`?secret` for AI/cron | Fails **open** if Redis down |
| B3 | `iv-app` → `iv-data` | VPC `vmbr2`, UFW allow 5432/6379 from `.19` | DB/Redis bind VPC only (documented) |
| B4 | App → external APIs (Claude, FEC, Congress, Legistar, Google Civic) | TLS, timeouts, `remotePatterns` | External content is untrusted |
| B5 | External content → browser render | `sanitize-html` (judicial/case/justice), React escaping, JSON-LD `<` escaping | Prompt-injection via AI summary text is possible |
| B6 | Cron host → `/api/cron/*` | `CRON_SECRET` Bearer; Redis lock | `?manual=true` deliberately blocked in production |
| B7 | Contributor → repo/host | gitignore | Live `.env`/`.creds` on a shared share (H-1) |

## 4. Attacker profiles

- **A1 Unauthenticated remote** — the primary profile; can call any public page/API.
- **A2 Authenticated-less abuser** — same as A1, focused on expensive endpoints (AI, ingest).
- **A3 Malicious external content publisher** — influences bill/case/agenda text rendered
  to users or fed to Claude (prompt injection).
- **A4 Insider/network peer** — can read the shared git share or origin host files (H-1).
- **A5 Authenticated cron/operator** — holds `CRON_SECRET` (trusted).

## 5. Scenarios & controls (summary; see RED_BLUE_MATRIX for evidence)

| Scenario | Risk | Control | Verified? |
|---|---|---|---|
| Abuse AI/cron endpoints without secret | High | Middleware Bearer + route `verifyCronSecret` | **Yes (401/403 dynamic)** |
| Trip rate limits / enumerate | Low | Redis fixed-window, tiered | **Yes (429 dynamic)** |
| Inject SQL via query/path params | High | Prisma parameterized queries; no `*Unsafe` | Static yes; dynamic N/A |
| Stored/reflected XSS via external HTML | High | `sanitize-html` + React escaping + JSON-LD escape | Static + semgrep yes |
| Open redirect / SSRF | High | No user-controlled redirects; fixed upstream hosts; client-ID regex | Static yes |
| Secret extraction from repo | High | gitignore; history clean | **Yes (gitleaks)** |
| Dependency/known-CVE exploitation | High | (pending) | **Yes (npm/OSV/Trivy)** |
| Prompt injection → harmful output | Medium | `<user_content>` wrapping, JSON parse, nonpartisan prompt | Static only (unverified live) |
| DoS via unbounded queries/pagination | Medium | `take` caps, `limit<=100`, batch sizes | Static yes |
| Cron duplicate work / duplicate emails | Medium | Redis `SET NX EX` lock | Static yes |
| Info leak via errors/logs | Medium | `withErrorHandler` redaction; error-logger | Partial (F-1 bypasses it) |
| Cache poisoning / middleware bypass (Next CVEs) | High | Framework patch | **Open (S-1)** |
| PII in logs | Low | error-logger avoids PII | **Gap**: `send-digest` logs emails (H-5) |
| Clickjacking / MIME / transport | Low | CSP frame-ancestors, nosniff, HSTS | **Yes (headers)** |

## 6. Highest-risk themes

1. **Framework/runtime patch level** — `next@16.2.1` carries a critical advisory cluster
   (middleware bypass, cache poisoning, RCE-class) that is directly relevant to this
   app's architecture (self-hosted middleware + cache + image optimizer).
2. **Error-handling inconsistency** (F-1) — client errors returned as 500 and structured
   logging bypassed by redundant local `try/catch`.
3. **External-content rendering & AI ingestion** — mitigated but only lightly verified;
   prompt-injection and sanitizer-scheme edge cases remain partially unverified.
4. **Secrets on a shared filesystem** (H-1) — not in VCS, but exposed on the share.

## 7. Residual risk & unverified areas

- Infrastructure controls (B1/B3/B6 host side, TLS, CF, Proxmox) — **unverified** here.
- Redis fail-open and lock semantics verified by code only.
- AI output safety and prompt-injection resistance — static only; no live AI calls.
- Live email/subscription lifecycle — not executed.
