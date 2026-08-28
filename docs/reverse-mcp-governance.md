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
    "allowedTools": ["get_*"],
    "readOnlyTools": ["get_*"]
  },
  {
    "id": "local-tools",
    "transport": "stdio",
    "command": "node",
    "args": ["tools/mcp-server.js"],
    "allowedTools": ["search", "fetch_*"],
    "readOnlyTools": ["search", "fetch_*"]
  },
  {
    "id": "pets-api",
    "transport": "openapi",
    "baseUrl": "https://api.example.com",
    "specUrl": "https://api.example.com/openapi.json",
    "allowedTools": ["getPet", "createPet"],
    "readOnlyTools": ["getPet"]
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
- `allowedTools`: glob allowlist (`*` suffix). Missing or empty means no tools
  are exposed.
- `readOnlyTools`: separate operator-attested glob allowlist. An allowed tool
  absent from this list is treated as a mutation and requires a durable
  external-effect key before `tools/call` or a generated REST request. MCP
  descriptor hints do not grant read-only authority.

## Consume (authenticated tenants)

| Route | Permission | Behavior |
| --- | --- | --- |
| `GET /mcp/health` | `dashboard:read` | Registry readiness (sanitized). |
| `GET /mcp/tools` | `workflow:run` | Aggregated tool list with `serverId__toolName` namespacing (60s listing cache). |
| `POST /mcp/call` | `workflow:run` | `{server, tool, arguments}` — ACL-checked, audited, size-capped upstream call. Mutations require exactly one `External-Effect-Key` or `Idempotency-Key` header. |

Tool calls require an authenticated tenant context; the tenant is recorded
with every audit entry.

Agent-facing MCP adapters use a stricter boundary: every imported MCP tool is
registered as a fenced mutation because that older bridge has no trusted
operator read-only allowlist. The registry must provide a stable tool-call key
and active execution fence before `mcpBridge.callTool`.

## Guardrails

- HTTP egress (upstream MCP and REST bridge) goes through the outbound URL
  policy (HTTPS, public unicast only) and the shared connection pool.
- Every `tools/call` outcome is written to the enterprise audit trail
  (allowed and failed calls; arguments are summarized by size, never dumped).
- Every tool is mutation-by-default. Only `readOnlyTools` can bypass the
  external-effect reservation. Mutation keys, target configuration, tenant,
  and arguments are hashed before the dedicated SQLite/PostgreSQL tombstone is
  written. Duplicate, changed-payload, missing-key, capacity, and store errors
  fail before the upstream call.
- Configuring any upstream automatically enables the external-effect gate.
  Multi-instance deployments therefore require its PostgreSQL mode and stable
  HMAC secret. See [the external-effect contract](./external-effect-fencing.md).
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
- Remote exactly-once. The reservation and upstream server do not share a
  transaction; an accepted call with a lost response remains an unknown
  external outcome and the same key is not retried.
