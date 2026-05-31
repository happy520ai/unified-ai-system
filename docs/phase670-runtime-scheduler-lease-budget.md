# Phase670 Runtime Scheduler / Lease / TTL / Budget

Phase670 adds a local runtime schedule and bounded lease to each sandbox execution.

Defaults:
- ttlSeconds=300
- maxRequests=3
- maxTokenBudget=4000
- maxRuntimeMs=30000
- spawnDepth=1
- killSwitchRef=TAIJI_BEIDOU_AUTO_RUNTIME_ENABLED

If a limit is exceeded, execution is blocked with one of:
- ttl_exceeded
- request_budget_exceeded
- token_budget_exceeded
- runtime_timeout
