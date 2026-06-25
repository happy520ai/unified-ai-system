# Unified AI System — AI Gateway Workbench

Local-first AI Gateway Workbench for bounded gateway operations, Mission Control, and workforce dry-run flows.

> **Status**: Local self-use / development. Not production deployment. No public API guarantee.

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Syntax check
pnpm -r --if-present check

# Run ai-gateway-service tests
pnpm --filter @unified-ai-system/ai-gateway-service test

# Run forge-core tests
pnpm --filter @unified-ai-system/forge-core test

# Start the service
pnpm --filter @unified-ai-system/ai-gateway-service start
```

The service starts at `http://127.0.0.1:3000` by default. Visit `/ui` for the web console.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                    UI Layer                      │
│  Web Console (/ui) · Mission Control · Workforce │
├─────────────────────────────────────────────────┤
│                  HTTP Server                     │
│  REST API · WebSocket · SSE · Auth Middleware    │
├─────────────────────────────────────────────────┤
│               Business Logic                     │
│  Gateway Service · Knowledge RAG · Forge Engine  │
│  Provider Selection · Enterprise Governance      │
├─────────────────────────────────────────────────┤
│                  Adapters                        │
│  OpenAI · NVIDIA · MiMo · Gemini · Groq · ...   │
├─────────────────────────────────────────────────┤
│                Infrastructure                    │
│  SQLite · Redis · pino Logger · Prometheus       │
└─────────────────────────────────────────────────┘
```

### Packages

| Package | Description |
|---------|-------------|
| `apps/ai-gateway-service` | Main AI gateway service (HTTP, providers, knowledge, workforce) |
| `apps/agent-console` | Upper-level interaction console |
| `packages/forge-core` | Goal-driven autonomous coding engine |
| `packages/shared-utils` | Shared utilities (error envelopes, timeouts, helpers) |
| `packages/shared-contracts` | Public protocol types |
| `packages/shared-config` | Shared configuration contracts/defaults |
| `packages/shared-sdk` | Shared client and adapter surfaces |
| `packages/codex-context-gateway` | Codex context sub-gateway |
| `packages/taiji-beidou-engine` | Taiji/Beidou capability engine |
| `packages/model-routing-engine` | Model routing engine |

---

## Development

### Project Structure

```
unified-ai-system/
├── apps/
│   ├── ai-gateway-service/    # Main gateway service
│   └── agent-console/         # Interaction console
├── packages/                   # Shared libraries
├── tools/                      # Build & verification scripts
├── docs/                       # Documentation & design docs
├── .github/workflows/          # CI/CD
├── AGENTS.md                   # Agent operation rules
└── package.json                # Root workspace config
```

### Key Commands

```bash
# Verify secret safety
pnpm run verify:phase107a-secret-safety

# Health check
pnpm run health:phase12a

# Safe regression matrix
pnpm run verify:safe-regression-matrix

# Anti-entropy audit
node tools/anti-entropy-audit.js
```

### Testing

- **ai-gateway-service**: `pnpm --filter @unified-ai-system/ai-gateway-service test` (node:test)
- **forge-core**: `pnpm --filter @unified-ai-system/forge-core test` (node:test, 107 test files)
- Both run automatically in CI on push/PR to main/master.

### Code Style

- ESM modules (`"type": "module"`)
- 2-space indentation, LF line endings (see `.editorconfig`)
- pino structured logging (not console.log)
- Error responses use `createErrorEnvelope` from `@unified-ai-system/shared-utils`

---

## Configuration

The service is configured via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_GATEWAY_PORT` | HTTP server port | `3000` |
| `AI_GATEWAY_HOST` | HTTP server host | `127.0.0.1` |
| `LOG_LEVEL` | pino log level | `info` |
| `NODE_ENV` | Environment mode | `development` |

Provider API keys are stored in `providers-config.json` (gitignored, never committed).

---

## Security

- API keys are never committed to git (`.gitignore` + `verify:phase107a-secret-safety`)
- Key masking in API responses, cache, and evidence files
- SQL injection prevention via prepared statements
- Path traversal prevention (double validation)
- Rate limiting per route
- Security headers (CSP, X-Frame-Options, etc.)

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

---

## Documentation

- [User Manual](docs/USER_MANUAL.md)
- [Operation Manual](docs/OPERATION_MANUAL.md)
- [Delivery Guide](docs/DELIVERY_GUIDE.md)
- [Agent Operation Rules](AGENTS.md)
- [Anti-Entropy Principles](docs/principles/ANTI-ENTROPY-META-LAW.md)

---

## License

See [LICENSE](LICENSE).
