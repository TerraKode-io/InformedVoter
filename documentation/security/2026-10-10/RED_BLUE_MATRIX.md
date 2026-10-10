# Red/Blue Matrix — InformedVoter (2026-10-10)

Each scenario: expected preventive control → expected detection signal → observed
behaviour (with evidence) → gaps (prevent/detect/alert/respond/recover) → proposed
countermeasure → regression test. Only non-destructive proofs were used.

| # | Red scenario | Expected prevention | Expected detection | Observed (evidence) | Gaps | Countermeasure | Regression test |
|---|---|---|---|---|---|---|---|
| R1 | Call `/api/ai/*` without credentials | Middleware Bearer `CRON_SECRET` + timing-safe compare | 401 + (should be) auth-failure logging | **401** for missing & wrong Bearer; GET also 401 (api.spec) | No app-level auth-failure metrics/alerting observed | Add structured auth-failure counter | `api.spec.ts` authz block |
| R2 | Call `/api/cron/*` without/wrong `?secret` | Bearer **or** `?secret` (middleware) + route `verifyCronSecret` | 401 + cron log | **401** both cases | none major | — | `api.spec.ts` authz block |
| R3 | Use `?manual=true` on cron in production | Middleware 403 + route `NODE_ENV!=='development'` reject | 403 + log | **403** (sync-members) | Env-check wording differs between layers (H-6) | Align checks to `development` everywhere | `api.spec.ts` |
| R4 | Burst the public API to enumerate/abuse | Fixed-window Redis limit (60/60s; subscribe 5/60s; AI 300/60s) | 429 + `Retry-After` | **429** within 8 subscribe POSTs | Fail-open if Redis down (H-7); no alert on Redis loss | Alert on Redis outage; monitor 429 rate | `api.spec.ts` rate-limiting block |
| R5 | SQL injection via query/path params | Prisma parameterized queries; enum allowlists; numeric coercion | none needed | All inputs handled by Prisma; **no `$queryRawUnsafe`** anywhere; only tagged-template `$queryRaw` in crons | none | maintain; add SAST gate | Semgrep gate + review |
| R6 | XSS via external HTML (Oyey/Justices/cases) | `sanitize-html` allowlist + React escaping + JSON-LD `\u003c` | CSP report | Only sanitized/JSON-LD sinks; sanitizer config omits dangerous attributes (S-3 reachability low) | Sanitizer version has scheme advisories | Upgrade sanitizer; unit-test payloads (S-3) | unit test + `a11y/journeys` |
| R7 | Reflected XSS via filter/search params | React escaping; no `dangerouslySetInnerHTML` on params | CSP | `BillsFilterBar` reads params into state (escaped) | none | — | Semgrep |
| R8 | SSRF / open redirect | No user-controlled redirects; fixed upstream hosts; Legistar client regex `/^[a-zA-Z0-9_-]+$/` | — | Confirmed by review; district/polling use fixed Google URLs | none | — | static review |
| R9 | Token/secret timing oracle | Constant-time compare (middleware loop; `crypto.timingSafeEqual` + dummy compare in `auth.ts`) | — | Code review confirms constant-time + length-padding; **not** network-timed (per instruction) | none | — | unit test of `verifyCronSecret` |
| R10 | Steal secrets from VCS | gitignore; no committed secrets | secret-scan CI | **gitleaks git: 0 leaks** over 104 commits | Secrets on shared disk (H-1) | Rotate + restrict ACLs + secret scanning | gitleaks in CI |
| R11 | Exploit known framework CVE (middleware bypass, cache poisoning, RCE) | Patch framework | — | `next@16.2.1` vulnerable (S-1) | **Unpatched** | Upgrade Next 16.x; WAF interim | re-audit + full suite |
| R12 | Prompt-inject via ingested content → bad AI output | `<user_content>` wrap + strip closing tag + JSON parse + nonpartisan system prompt | — | Controls present (`claude-client.ts:60-77`); **live not tested** | Output validation is shape-only; no content safety filter | Add output validation/moderation; cap tokens | unit test with injection strings |
| R13 | Abuse pagination / heavy queries | `take` caps, `limit<=100`, batch sizes | — | `/api/bills?limit=99999` capped ≤100 (api.spec) | none confirmed | maintain | `api.spec.ts` |
| R14 | Duplicate cron work / duplicate emails | Redis `SET NX EX` lock (600s) | 423 + log | Code review confirms lock; not triggered live | Lock release relies on TTL (no owner-token release) | Verify lock semantics; add metrics | unit test of `acquireLock` |
| R15 | Extract internals via error bodies | `withErrorHandler` redaction (no Prisma/Redis/stack) | `logError` JSON | Error bodies sanitized (api.spec); **but F-1 bypasses wrapper on 5 routes** | F-1 leaves 500s w/o request-id/structured log | Remove local try/catch (F-1) | F-1 regression block |
| R16 | PII scraping from logs | error-logger avoids PII | — | **Gap:** `send-digest` logs subscriber email (H-5) | PII in logs | Log opaque id | code review |
| R17 | Clickjacking / MIME sniff / downgrade | CSP `frame-ancestors 'none'`, `X-Frame-Options`, nosniff, HSTS preload | — | All present (headers.spec) | — | — | `headers.spec.ts` |
| R18 | Inconsistent CSP with CF analytics | — | CSP report | Beacon blocked (F-5) | Analytics broken + console errors | Allow origin or disable CF analytics | F-5 regression |

## Blue-team control appraisal

| Control | Preventive | Detection | Response/Recovery | Assessment |
|---|---|---|---|---|
| Cron/AI auth (2 layers) | Strong | None observed | n/a | Verified dynamic; add alerting |
| Rate limiting | Strong when Redis up | 429 emitted | Fails open (H-7) | Verified; document dependency |
| Error redaction | Strong design | `logError` JSON | bypassed by F-1 | Fix F-1 |
| Input validation | Strong (allowlists) | n/a | wrong status codes (F-1) | Fix F-1 |
| Output sanitization | Strong | n/a | n/a | Upgrade sanitizer (S-3) |
| Supply chain | weak (drift) | scanner-only | n/a | Upgrade deps (S-1/S-2) |
| Secrets | gitignore ok | scanner | disk exposure | H-1 |
| Headers | Strong | n/a | n/a | CSP weakness (H-3) |

**Unverified (monitoring/infra):** server logs are only visible via code; no live log
pipeline, alerting, or SIEM was accessible. Detection claims are therefore
**code-inferred**, not observed. Synthetic log-marker inspection was not possible.
