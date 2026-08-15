# Reverse MCP Governance (Upstream Aggregation)

The gateway can act as a governed aggregation point for external MCP servers
and REST APIs — the reverse of the (still fake-only) outbound MCP server it
exposes. Operators declare upstreams; consumers discover and call tools
through tenant-scoped, audited, allowlisted routes.

## Configure upstreams (operator-trusted environment only)

`MCP_UPSTREAM_SERVERS_JSON` — a JSON array (max 16 entries). This is trusted
operator configuration, at the same trust level as MCP host configuration;
it is never accepted from request input.

```json
[
  {
    "id": "weather",
    "transport": "http",
    "url": "https://mcp.example.com/mcp",
    "allowedTools": ["get_*"]
  },
  {
    "id": "local-tools",
    "transport": "stdio",
    "command": "node",
    "args": ["tools/mcp-server.js"],
    "allowedTools": ["search", "fetch_*"]
  },
  {
    "id": "pets-api",
    "transport": "openapi",
    "baseUrl": "https://api.example.com",
    "specUrl": "https://api.example.com/openapi.json",
    "allowedTools": ["getPet"]
  }
]
```

- `http`: Streamable HTTP MCP upstream (initialize handshake with session
  tracking, JSON or SSE responses). URL must be HTTPS.
- `stdio`: spawned child process speaking newline-delimited JSON-RPC over
  stdio. The command comes from operator config only.
- `openapi` (REST→MCP): the gateway fetches the OpenAPI 3 spec (HTTPS, size
  capped), generates one MCP tool per operation (`operationId` naming; path/
  query/body parameters mapped into the tool input schema), and executes
  calls as ordinary REST requests against `baseUrl`.
- `allowedTools`: optional glob allowlist (`*` suffix). Without it, all
  upstream tools are exposed.

## Consume (authenticated tenants)

| Route | Permission | Behavior |
| --- | --- | --- |
| `GET /mcp/health` | `dashboard:read` | Registry readiness (sanitized). |
| `GET /mcp/tools` | `workflow:run` | Aggregated tool list with `serverId__toolName` namespacing (60s listing cache). |
| `POST /mcp/call` | `workflow:run` | `{server, tool, arguments}` — ACL-checked, audited, size-capped upstream call. |

Tool calls require an authenticated tenant context; the tenant is recorded
with every audit entry.

## Guardrails

- HTTP egress (upstream MCP and REST bridge) goes through the outbound URL
  policy (HTTPS, public unicast only) and the shared connection pool.
- Every `tools/call` outcome is written to the enterprise audit trail
  (allowed and failed calls; arguments are summarized by size, never dumped).
- Argument payloads cap at 100 KB, results at 1 MB, specs at 2 MB; upstream
  calls time out after 20s (configurable per upstream).
- Registry validation is fail-closed: malformed config reports
  `misconfigured` in `/mcp/health` and serves no tools.

## Out of scope (v1)

- A protocol-native `/mcp` JSON-RPC server endpoint (the REST surface above
  is the v1 contract).
- Upstream MCP OAuth2 / token exchange, and per-tool argument schema
  enforcement (descriptors are surfaced; validation is upstream-side).
- Admin routes to mutate the registry at runtime (restart to change).
