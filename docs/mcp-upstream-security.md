# MCP Upstream Security

MCP upstreams remain part of the gateway core and are declared only through
trusted operator configuration. Request payloads cannot register commands or
destinations.

## Default-deny governance

Each `MCP_UPSTREAM_SERVERS_JSON` entry should declare:

```json
{
  "id": "weather",
  "transport": "http",
  "url": "https://mcp.example.com/mcp",
  "allowedTools": ["get_forecast"],
  "readOnlyTools": ["get_forecast"],
  "allowedTenants": ["tenant-a"],
  "allowedRoles": ["operator", "admin"]
}
```

- Missing or empty `allowedTools` exposes no tools.
- Missing or empty `readOnlyTools` treats every allowed `tools/call` as a
  mutation. Only the operator configuration can attest a tool read-only;
  upstream annotations are not security authority.
- Missing `allowedTenants` restricts the upstream to
  `PME_ENTERPRISE_PLATFORM_TENANT_ID`, falling back to `PME_AUTH_TENANT_ID` and
  then `default`.
- Missing `allowedRoles` relies on the route's existing `workflow:run` RBAC.
- `"*"` is an explicit wildcard for any of the three allowlists.
- Readiness output reports policy state without exposing URLs, commands, or
  tenant identifiers.

Mutation calls require exactly one `External-Effect-Key` or `Idempotency-Key`.
The gateway hashes the key immediately, commits a dedicated durable tombstone,
and only then calls the HTTP/stdio MCP upstream or generated OpenAPI REST
operation. Missing, duplicate, conflicting, full, and unavailable reservation
states fail closed. The contract is TTL-bounded at-most-once attempt, not
remote exactly-once.

HTTP MCP and OpenAPI traffic uses the shared DNS-pinned outbound policy and a
bounded response reader. Stdio MCP processes inherit only launch-essential
environment variables; credentials must be explicitly scoped in the upstream's
`env` object. Stdio stdout is bounded and stderr is drained without retention.

## Performance

ACL and read-only classification are in-process array membership checks.
Read-only calls add no persistence. Mutations add one durable reservation
round-trip before the existing transport; response limits still count bytes in
the shared connection pool.

## Language Selection

- Workload: protocol parsing, ACL enforcement, irreversible-effect fencing,
  bounded streaming, and child process environment construction.
- Selected language: TypeScript for transport/config/identity contracts and
  JavaScript only where the existing shared connection-pool implementation is
  being tightened in place.
- Alternatives: a new proxy service would add latency and memory without
  improving the existing DNS-pinned boundary; shell wrappers would weaken
  argument and environment handling.
- Compatibility: configuration gains `readOnlyTools`; the intentional security
  boundaries are tool deny-by-default when `allowedTools` is absent and
  mutation-by-default when `readOnlyTools` is absent.
