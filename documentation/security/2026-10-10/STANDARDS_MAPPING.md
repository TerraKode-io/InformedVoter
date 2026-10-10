# Standards Mapping — InformedVoter (2026-10-10)

Frameworks referenced (versions verified from primary sources at assessment time).
Where a version could not be confirmed against an official source, that is noted.

| Framework | Version used | Source |
|---|---|---|
| OWASP ASVS | 5.0 (L2 baseline) | owasp.org/www-project-application-security-verification-standard |
| OWASP WSTG | 4.2 | owasp.org/www-project-web-security-testing-guide |
| OWASP Top 10 | 2021 | owasp.org/Top10 |
| OWASP API Security Top 10 | 2023 | owasp.org/API-Security |
| OWASP Top 10 for LLM Apps | 2025 | genai.owasp.org |
| OWASP Cheat Sheet Series | current | cheatsheetseries.owasp.org |
| NIST SSDF | SP 800-218 (v1.1) | csrc.nist.gov |
| NIST CSF | 2.0 | nist.gov/cyberframework |
| NIST SP 800-115 | current | csrc.nist.gov |
| NIST SP 800-63B | current (identity) | pages.nist.gov/800-63-4 |

> Status values: **verified** (evidence), **partial**, **failed**, **unverified**,
> **N/A**. No compliance/certification claim is made; this is a scoped technical mapping.

## OWASP ASVS 5.0 — applicable Level 2 items

| ID (theme) | Requirement | Applies | Evidence | Status |
|---|---|---|---|---|
| V1 Architecture | Trust boundaries, defense in depth | Yes | THREAT_MODEL; 2-layer cron auth | verified |
| V2 Authentication | Strong auth where required | Partial | Only service auth (cron/AI); no user auth | N/A (no user auth) |
| V3 Session | Session mgmt | No | No sessions/cookies for auth | N/A |
| V4 Access Control | Deny-by-default for privileged routes | Yes | 401/403 dynamic (api.spec) | verified |
| V5 Validation | Server-side input validation | Yes | allowlists, enum checks, bounds | partial (F-1 status codes) |
| V5 Encoding | Context output encoding | Yes | React escaping; sanitizer; JSON-LD escape | verified |
| V7 Error/Logging | No sensitive data in errors/logs | Yes | sanitized bodies; **but H-5 PII log + F-1 log bypass** | partial |
| V8 Data Protection | Secrets not in VCS | Yes | gitleaks git clean; **H-1 disk exposure** | partial |
| V9 Communications | TLS, HSTS | Yes | headers.spec (HSTS preload) | verified (origin TLS infra unverified) |
| V10 Malicious code | No malicious code | Yes | review; **H-2 privesc scripts present** | partial |
| V12 Files/Resources | Upload/file handling | Partial | No user upload; image proxy | N/A |
| V13 API | Methods, authz, rate limit | Yes | api.spec | verified |
| V14 Config | Headers, deployment config | Yes | headers.spec; **H-3/H-4 gaps** | partial |
| V15 Secure coding | Parameterized queries, safe parsing | Yes | Prisma; no unsafe raw SQL | verified |

## OWASP Top 10 (2021)

| Risk | Relevance | Status |
|---|---|---|
| A01 Broken Access Control | Cron/AI protected (2 layers) | verified |
| A02 Cryptographic Failures | HSTS/TLS; secrets mgmt gap | partial (H-1) |
| A03 Injection | Prisma parameterization; sanitizer | verified (S-3 sanitizer advisory) |
| A04 Insecure Design | Caps, locks, defense-in-depth | verified |
| A05 Security Misconfig | Headers good; CSP/CORS gaps | partial (H-3) |
| A06 Vulnerable Components | **next + deps outdated** | **failed (S-1/S-2)** |
| A07 Auth Failures | N/A (no user auth) | N/A |
| A08 Integrity Failures | Unpinned prisma in build | partial (H-4) |
| A09 Logging Failures | Redaction good; F-1/H-5 gaps | partial |
| A10 SSRF | Fixed hosts; client regex | verified |

## OWASP API Security Top 10 (2023)
- API1 BOLA / API2 Broken Auth: **verified** (cron/AI 401/403; no object auth needed — public data).
- API3 Property Authorization: module-scoped Prisma selects limit fields — verified.
- API4 Resource Consumption: caps + rate limits — verified.
- API5 BFLA / API7 SSRF / API8 Misconfig: 401/403 verified; **API8 partial** (CORS `*`, error status codes F-1).
- API9 Inventory: route inventory produced (E2E_REPORT) — verified.

## OWASP LLM Top 10 (2025) — applicable items
- **LLM01 Prompt Injection:** mitigations present (`<user_content>` wrapping, closing-tag
  strip, JSON parse). **Unverified live** (no paid AI calls).
- **LLM02 Insecure Output Handling:** AI output persisted and rendered — pages escape/sanitize.
  **Partial.**
- **LLM05 Improper Output Handling / LLM06 Sensitive Info Disclosure:** system prompt
  confined; no user PII sent to Claude (bill/case text only). **verified (static).**
- **LLM10 Unbounded Consumption:** `max_tokens` set; batch caps; per-IP 5/hr on templates.
  **verified.**

## NIST SSDF (SP 800-218)
| Practice | Evidence | Status |
|---|---|---|
| PO.1/PO.2 roles & requirements | repo governance (AGENTS.md), this assessment | partial |
| PS.1 protect all forms of code | gitignore; gitleaks; **disk exposure H-1** | partial |
| PS.2 verify release integrity | lockfile; unpinned build tool H-4 | partial |
| PS.3 archive & provenance | git history clean | verified |
| PW.4 reuse well-secured software | **outdated deps S-1/S-2** | **failed** |
| PW.7 review code | this review | verified |
| PW.8 test executable code | Vitest + Playwright suite | verified |
| RV.1 identify vulns | npm audit/OSV/Trivy/Gitleaks/Semgrep | verified |
| RV.2 assess/prioritize | this report | verified |

## NIST CSF 2.0
- **ID** (asset/risk inventory): produced — verified.
- **PR** (protect): headers, authz, validation — partial (deps, secrets).
- **DE** (detect): structured logging exists; no live monitoring accessible — **unverified**.
- **RS/RC**: incident response/recovery infra out of scope — **unverified**.

## Application vs organizational/infrastructure
**Application controls** (verified here): route authz, rate limiting, validation,
encoding/sanitization, error redaction, headers, dependency posture.
**Organizational/infrastructure** (NOT verifiable from repo): Cloudflare/OPNsense rules,
Proxmox, host crontab, UFW/fail2ban, TLS private key, Umami, monitoring/SIEM, backups,
key-rotation policy (beyond detecting on-disk exposure).

## Claim limits
Passing scans do **not** imply ASVS L2 verification, NIST compliance, or OWASP
certification. Several requirements are N/A (no user authentication) or unverified
(infrastructure/monitoring). Residual risks: unpatched framework (S-1), secrets on the
shared filesystem (H-1), and unverified AI/live service behaviour.
