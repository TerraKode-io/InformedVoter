# Scan Summary (redacted) — 2026-10-10

Machine-generated tallies. Raw reports retained outside version control.

## Dependency vulnerability scan

### `npm audit` (package-lock.json)
```
info 0 · low 2 · moderate 10 · high 12 · critical 1 · total 25
```
Direct dependencies with advisories: `next` (critical), `js-yaml` (high),
`postcss` (high), `eslint-config-next`/`@next/eslint-plugin-next` (high),
`@anthropic-ai/sdk` (moderate), `sanitize-html` (moderate), `resend` (moderate),
`vitest`/`@vitest/coverage-v8` (moderate).
Transitive: `sharp` (high), `browserslist` (high), `braces` (high),
`brace-expansion` (high), `micromatch` (high), `fast-glob` (high), `nanoid` (high),
`source-map-js` (high), `@babel/core` (low), `esbuild` (low), `uuid` (moderate),
`@humanfs/node` (moderate), `baseline-browser-mapping` (moderate), `svix` (moderate).

### `trivy fs` (non-dev dependencies)
```
CRITICAL 3 · HIGH 27 · MEDIUM 22 · LOW 3
Affected packages (CRITICAL/HIGH): browserslist, js-yaml, nanoid, next, postcss, sharp, source-map-js
Misconfigurations: docker/caddy/Dockerfile -> DS-0002 (image user should not be 'root', HIGH),
                   DS-0026 (no HEALTHCHECK, LOW)
Secrets: .env.local (1) — gitignored, not committed
```

### `osv-scanner scan source`
`package-lock.json` packages with OSV IDs (deduplicated): `@anthropic-ai/sdk`,
`@babel/core`, `@humanfs/node`, `@vitest/mocker`, `baseline-browser-mapping`,
`brace-expansion` (×2 ranges), `braces`, `browserslist`, `esbuild`, `js-yaml`,
`nanoid`, `next`, `postcss` (×2), `sanitize-html`, `sharp`, `source-map-js`,
`uuid`, `vitest`.

## Secret scanning

### `gitleaks git` (full history, 104 commits)
```
no leaks found
```

### `gitleaks dir` (working tree, source-only copy)
```
32 findings — all in gitignored files:
  .env, .env.local, .creds/creds.md, .deprecated/scripts/*.py
Rules: generic-api-key x27, gcp-api-key x2, anthropic-api-key x2, jwt x1
```
No secret values are reproduced here. These files are **not tracked** by git.

## SAST

### `semgrep --config auto` (src)
```
35 findings:
  javascript.lang.security.audit.unsafe-formatstring  x30  -> false positive (console.log template literals)
  typescript.react...react-dangerouslysetinnerhtml     x5  -> reviewed; all sanitized or JSON-LD (see report)
```

## Project checks

| Check | Result |
|---|---|
| `npm run build` | success (production) |
| `npm test` (Vitest) | 33 passed / 33 |
| `npm run lint` | **fails** — `next lint` removed in Next 16; no ESLint flat config exists (F-6) |
