# Changelog

All notable changes to this project will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Security
- Migrated `xlsx` (2 high-severity CVEs, no fix) to `exceljs` — eliminates known vulnerability
- Upgraded `vitest` 4.1.7 → 4.1.9 — fixes 3 High + 1 Moderate vite vulnerabilities

### Fixed
- Fixed 48 broken test assertions in `neon-ui.test.js` and `neon-ui-performance.test.js` — `assert.ok(css).includes(...)` never actually verified content (returned void); now uses `assert.ok(css.includes(...))`
- Fixed `httpServer.js` deep path penetration — replaced `../../../../packages/` imports with proper package name references (`@unified-ai-system/shared-utils`, `@unified-ai-system/forge-core`)
- Fixed `writeCapabilityError` undefined in `httpServer.js` routeHelpers — was never imported but passed to route modules
- Unified 3 different error response formats into single `writeErrorResponse` using `createErrorEnvelope` from shared-utils
- Fixed 8 silent `.catch(() => {})` blocks — now log warnings via `console.warn` for observability

### Changed
- Replaced `console.log` with pino structured logger in core request path files (`httpLlmProviderAdapter.js`, `index.js`)
- Added `forge-core-test` job to CI workflow — 107 forge-core tests now run in CI

### Added
- `.editorconfig` — enforces LF line endings, UTF-8, 2-space indent
- `.gitattributes` — normalizes line endings, marks binary files
- `CHANGELOG.md` — this file
- `docs/principles/ANTI-ENTROPY-META-LAW.md` — system building meta-principles

### Removed
- 48 evidence PNG files removed from git tracking (still on disk, covered by .gitignore)

## [0.1.0-rc.1] — 2025-01-01

### Added
- Initial release candidate
- AI Gateway service with multi-provider support (OpenAI, NVIDIA, MiMo, Gemini, Groq)
- Knowledge RAG subsystem with document parsing (text, PDF, Word, Excel)
- Forge autonomous coding engine
- Web console UI with Mission Control
- Enterprise governance (auth, RBAC, audit)
- Workforce scheduling and agent management
- Prometheus metrics and health checks
- Docker support (Dockerfile + docker-compose)
- CI/CD via GitHub Actions

[Unreleased]: https://github.com/unified-ai-system/unified-ai-system/compare/v0.1.0-rc.1...HEAD
[0.1.0-rc.1]: https://github.com/unified-ai-system/unified-ai-system/releases/tag/v0.1.0-rc.1
