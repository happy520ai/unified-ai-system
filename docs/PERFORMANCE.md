# Performance Baseline

## Startup

| Metric | Value |
|--------|-------|
| Cold start | ~3s |
| Memory at idle | ~120MB RSS |
| Time to ready | ~5s |

## API Response Times (local, no LLM call)

| Endpoint | p50 | p95 | p99 |
|----------|-----|-----|-----|
| `/health/live` | <5ms | <10ms | <20ms |
| `/health/ready` | <10ms | <20ms | <50ms |
| `/providers` | <50ms | <100ms | <200ms |
| `/workforce/plan` | <100ms | <200ms | <500ms |

## API Response Times (with LLM call)

| Endpoint | p50 | p95 | p99 |
|----------|-----|-----|-----|
| `/chat` (non-streaming) | 1-3s | 5-10s | 15-30s |
| `/chat/stream` (first token) | 200-500ms | 1-2s | 3-5s |

## Concurrency

| Metric | Value |
|--------|-------|
| Max concurrent connections | 1000 (Node.js default) |
| Request timeout | 120s |
| Keep-alive timeout | 5s |
| Headers timeout | 125s |

## Resource Limits (Docker)

| Resource | Limit |
|----------|-------|
| Memory | 1GB |
| CPU | 2 cores |
| Disk (data) | Persistent volume |

## Recommendations

1. **Memory**: Monitor heap usage via `/health/live`. If >80%, consider increasing limit.
2. **CPU**: LLM calls are I/O-bound, not CPU-bound. 2 cores sufficient for most workloads.
3. **Disk**: SQLite database grows with audit logs. Monitor `.data/` size.
4. **Network**: Provider API latency dominates. Use providers geographically close to deployment.
