# Spend Reporting

See where tokens go, per virtual key, without a database or a SaaS
dashboard. Data comes from the virtual-key manager's budget windows — the
same counters that enforce limits — so the report and the enforcement never
disagree.

## API

```bash
curl http://127.0.0.1:3100/enterprise/spend-report \
  -H "authorization: Bearer $ADMIN_OR_UAI_KEY"
```

Scoped to the caller's tenant. Response (envelope trimmed):

```json
{
  "data": {
    "window": "current-budget-window",
    "rows": [
      {
        "keyId": "abc123def456",
        "description": "ci key",
        "role": "operator",
        "tenantId": "tenant-a",
        "revoked": false,
        "lastUsedAt": "2026-08-16T00:00:00.000Z",
        "tokensUsed": 4200,
        "requestCount": 37,
        "budget": {
          "enabled": true,
          "limitTokens": 5000,
          "tokensRemaining": 800,
          "softBudgetExceeded": true,
          "windowResetAt": "2026-08-17T00:00:00.000Z"
        }
      }
    ],
    "totals": {
      "keys": 1,
      "activeKeys": 1,
      "tokensUsed": 4200,
      "requestCount": 37,
      "keysOverSoftBudget": 1
    }
  }
}
```

Permission: `user:admin` (same tier as virtual-key management).

## CLI

```bash
pnpm gateway spend --admin-key uai-…
```

Renders a per-key table (tokens, budget consumption, soft-budget warnings,
revocation) and honors `--json`. The admin key can also come from
`AGENT_CONSOLE_ADMIN_KEY` or `PME_AUTH_TOKEN`.

## Notes

- Token attribution happens on the chat hot path for both fresh responses
  and cache replays (hits still consume budget).
- `requestCount` counts budget-window requests per key.
- This is token spend, not currency: multiply by your own per-model rates if
  you need dollars. The gateway deliberately does not guess prices.

## Provider usage ledger

The virtual-key report above remains the authoritative enforcement-window view.
Provider-call operations additionally write reservation/terminal events to the
usage ledger exposed by `/usage/summary` and `/usage/logs` (`audit:read`). A
single process can use fsynced local files. Multi-instance real-provider
deployments must use the central PostgreSQL mode:

```bash
AI_GATEWAY_USAGE_LEDGER_STORE_MODE=postgres
AI_GATEWAY_USAGE_LEDGER_POSTGRES_URL=<secret>?sslmode=verify-full
AI_GATEWAY_USAGE_LEDGER_NAMESPACE=production
AI_GATEWAY_USAGE_LEDGER_CENTRAL_REQUIRED=true
```

Central rows contain only tenant, provider/model, token/cost/latency,
fallback/shadow, lifecycle and sanitized error metadata. Prompts, responses,
credentials and Authorization values are outside the schema. This is an
operational usage statement, not a legal invoice or provider reconciliation;
`unknownCostRecords` and `unresolvedBillableAttempts` must be zero and then
checked against the provider's own statement before financial use.
