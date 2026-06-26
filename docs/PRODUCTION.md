# Production Operations Guide

## Quick Start

```bash
# Docker
docker compose up -d

# Direct
NODE_ENV=production pnpm --filter @unified-ai-system/ai-gateway-service start
```

## Health Endpoints

| Endpoint | Purpose | K8s Probe |
|----------|---------|-----------|
| `GET /health/live` | Process alive check | livenessProbe |
| `GET /health/ready` | Ready for traffic (providers configured) | readinessProbe |
| `GET /health/check` | Full status with dependency checks | — |

## Environment Variables

### Required for Production

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PME_ENTERPRISE_AUTH_ENABLED` | Enable auth | `true` |
| `AUTH_TOKEN_SECRET` | JWT signing secret | Random 32+ chars |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_GATEWAY_PORT` | HTTP port | `3100` |
| `AI_GATEWAY_HOST` | Bind address | `0.0.0.0` |
| `REDIS_PASSWORD` | Redis password | `changeme` |
| `LOG_LEVEL` | pino log level | `info` |
| `CORS_ALLOWED_ORIGINS` | CORS origins (comma-separated) | `http://127.0.0.1:3100` |

### Provider API Keys

Set in `providers-config.json` (gitignored) or as environment variables:

| Variable | Provider |
|----------|----------|
| `OPENAI_API_KEY` | OpenAI |
| `NVIDIA_API_KEY` | NVIDIA |
| `MIMO_API_KEY` | MiMo |
| `BRAVE_SEARCH_API_KEY` | Brave Search |

## Security Checklist

- [ ] `PME_ENTERPRISE_AUTH_ENABLED=true`
- [ ] `AUTH_TOKEN_SECRET` set (32+ random chars)
- [ ] `REDIS_PASSWORD` changed from default
- [ ] `CORS_ALLOWED_ORIGINS` set to specific domains (not `*`)
- [ ] HTTPS via reverse proxy (nginx/caddy)
- [ ] `providers-config.json` not committed to git
- [ ] Docker: `read_only: true`, `no-new-privileges`

## Monitoring

### Structured Logging

All logs are JSON via pino. Parse with:

```bash
# Pretty print
node apps/ai-gateway-service/src/index.js | pino-pretty

# Filter errors
node apps/ai-gateway-service/src/index.js | grep '"level":50'

# Filter by event
node apps/ai-gateway-service/src/index.js | grep '"event":"http_request"'
```

### Log Events

| Event | Level | Description |
|-------|-------|-------------|
| `service_ready` | info | Service started |
| `http_request` | info/warn/error | HTTP access log |
| `provider_retry` | warn | Provider retry attempt |
| `unhandled_rejection` | error | Unhandled promise rejection |
| `uncaught_exception` | fatal | Uncaught exception (will exit) |
| `shutdown_timeout` | error | Graceful shutdown timed out |

### Metrics

Prometheus metrics available at `/metrics` (if prom-client configured).

## Graceful Shutdown

On SIGINT/SIGTERM:
1. Stop accepting new connections
2. Drain in-flight requests (25s timeout)
3. Close Forge engine (drain workers, close SQLite)
4. Destroy connection pools
5. Force exit if timeout exceeded

## Backup

```bash
# Backup SQLite database
cp .data/repository.db .data/repository.db.backup

# Backup knowledge base
cp -r .data/knowledge .data/knowledge.backup
```

## Troubleshooting

### Service won't start

1. Check `NODE_ENV=production` and auth is configured
2. Check port 3100 is not in use: `lsof -i :3100`
3. Check logs for `auth_not_configured` warning

### Provider errors

1. Check API keys in `providers-config.json`
2. Check `/providers` endpoint for provider health
3. Check logs for `provider_retry` events

### High memory usage

1. Check `/health/live` for heap usage
2. If heap > 90%, restart service
3. Check for large knowledge base files

### WebSocket connection issues

1. Check reverse proxy supports WebSocket upgrade
2. Check `X-Accel-Buffering: no` header
3. Check firewall allows long-lived connections
