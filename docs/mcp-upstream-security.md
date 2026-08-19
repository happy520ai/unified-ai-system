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
  "allowedTenants": ["tenant-a"],
  "allowedRoles": ["operator", "admin"]
}
```

- Missing or empty `allowedTools` exposes no tools.
- Missing `allowedTenants` restricts the upstream to
  `PME_ENTERPRISE_PLATFORM_TENANT_ID`, falling back to `PME_AUTH_TENANT_ID` and
  then `default`.
- Missing `allowedRoles` relies on the route's existing `workflow:run` RBAC.
- `"*"` is an explicit wildcard for any of the three allowlists.
- Readiness output reports policy state without exposing URLs, commands, or
  tenant identifiers.

HTTP MCP and OpenAPI traffic uses the shared DNS-pinned outbound policy and a
bounded response reader. Stdio MCP processes inherit only launch-essential
environment variables; credentials must be explicitly scoped in the upstream's
`env` object. Stdio stdout is bounded and stderr is drained without retention.

## Performance

ACL evaluation is an in-process array membership check. Response limits count
bytes while data already traverses the shared connection pool, adding no proxy
hop or resident service.

## Language Selection

- Workload: protocol parsing, ACL enforcement, bounded streaming, and child
  process environment construction.
- Selected language: TypeScript for transport/config/identity contracts and
  JavaScript only where the existing shared connection-pool implementation is
  being tightened in place.
- Alternatives: a new proxy service would add latency and memory without
  improving the existing DNS-pinned boundary; shell wrappers would weaken
  argument and environment handling.
- Compatibility: configuration gains optional ACL fields; the intentional
  breaking security change is tool deny-by-default when `allowedTools` is absent.
