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
operational usage statement, not a legal invoice.

## Provider statement reconciliation

Tenant administrators can compare normalized USD provider statement lines with
central terminal usage attempts. Matching is exact on `usageAttemptId`; the
gateway does not guess matches from timestamps, prompts, or approximate model
names.

```bash
curl -X POST http://127.0.0.1:3100/enterprise/provider-statement-reconciliation \
  -H "authorization: Bearer $ADMIN_OR_UAI_KEY" \
  -H "content-type: application/json" \
  --data '{
    "statementId": "provider-a-2026-08",
    "provider": "provider-a",
    "currency": "USD",
    "periodStart": "2026-08-01T00:00:00.000Z",
    "periodEnd": "2026-09-01T00:00:00.000Z",
    "absoluteToleranceUsd": "0.01",
    "relativeToleranceBps": 100,
    "lines": [{
      "statementLineId": "line-0001",
      "usageAttemptId": "<gateway-attempt-id>",
      "model": "provider-model",
      "occurredAt": "2026-08-01T12:00:00.000Z",
      "totalTokens": 1234,
      "billedCostUsd": "0.012345"
    }]
  }'
```

The response classifies exact matches, excessive cost variance, model/token
mismatch, statement-only lines, gateway-only attempts, unresolved attempts,
unknown estimates, and duplicate gateway terminals. It also returns a stable
SHA-256 digest over the normalized tenant-scoped statement so the comparison
can be referenced by the enterprise audit chain.

Security and accounting boundaries:

- `user:admin` is required and the tenant comes only from authenticated server
  identity; request bodies cannot select another tenant.
- The route requires the central PostgreSQL usage ledger, accepts at most 5,000
  allow-listed structured lines over no more than 93 days, and fails closed if
  the 10,000-record ledger query bound is reached.
- Only canonical UTC timestamps and USD values with at most six decimal places
  are accepted. Currency conversion is never inferred.
- Raw invoices, credentials, authorization headers, payment data, prompts, and
  response bodies are not accepted or persisted.
- Input is operator-supplied and is not authenticated against a provider API or
  signed source. The result is not a legal invoice, tax calculation, payment
  status, or authoritative accounting record.
