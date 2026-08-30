# Unified AI System MCP Server

Connect Codex and other MCP hosts to the credential-free Unified AI System
preview over stdio or MCP Streamable HTTP.

The server starts an isolated local gateway automatically, pins it to the
deterministic fake provider, exposes authenticated permission-scoped tools, and removes the gateway when
the MCP session ends. It does not enable or authorize real provider calls.

## Tools

| Tool | Behavior |
| --- | --- |
| `gateway_health` | Inspect gateway health and provider safety state. |
| `gateway_readiness` | Inspect first-run and chat readiness. |
| `agent_governance_status` | Inspect Agent Governance status when the authenticated identity has platform-status access. |
| `agent_governance_list` | List only governed Agents visible to the authenticated tenant. |
| `agent_governance_describe` | Describe one Agent only when it belongs to the authenticated tenant. |
| `gateway_prompt_enhance` | Structure a natural-language request locally without a provider call. |
| `gateway_prompt_enhance_llm` | Enhance prompts via optional LLM backend (or falls back when unavailable). |
| `gateway_chat` | Send one fake-provider-only chat request. |
| `knowledge_readiness` | Inspect local knowledge infrastructure. |
| `knowledge_retrieve` | Search the local knowledge base by keyword. |
| `workflow_health` | Inspect the governed workflow subsystem. |
| `workflow_actions` | List workflow action definitions. |
| `workflow_run` | Execute a three-step local workflow and atomically publish a tenant-partitioned artifact. Managed mode injects a dedicated `file_write` Agent; external governed gateways require `agentId`. |
| `workforce_health` | Inspect the workforce subsystem. |
| `workforce_agents` | List workforce agent descriptors. |

Agent Governance inspection tools are read-only. `workflow_run` writes one
controlled local artifact. Agent creation remains available through the REST,
shared-SDK, and human Agent Console surfaces because the MCP tool protocol cannot
yet prove idempotent, cancellation-safe generation after a transport timeout.
No MCP tool exposes Agent creation/execution/revocation, approval/rejection, or
policy creation/activation. Governance
tools never accept `tenantId` or `ownerUserId`: the Gateway binds both from its
authenticated identity, and cross-tenant descriptions fail as not found.
`workflow_run` never overwrites an existing path and is routed through Agent Governance when
the connected Gateway enables that control plane. The chat tool checks the gateway safety
state before every request and fails closed unless `realProviderEnabled` is
exactly `false` and the response proves `executionMode: "fake"`.

The source build exposes sixteen tools, including the four Agent Governance
lifecycle tools and the provider-free `gateway_prompt_enhance` preview. Published
images expose the tool set shipped by their pinned tag.

## Run From Source

From the repository root:

```bash
pnpm install --frozen-lockfile
node packages/mcp-server/src/index.js
```

The project-level [`.codex/config.toml`](../../.codex/config.toml) registers
that command automatically in trusted Codex projects. Restart Codex after
cloning or changing MCP configuration, then use `/mcp` to inspect the server.

## Streamable HTTP

Start the source-build HTTP transport:

```bash
pnpm mcp:http
```

The MCP endpoint is `http://127.0.0.1:3210/mcp`. It listens on loopback by
default, validates `Host` and `Origin`, starts the same fake-provider gateway,
and exposes the same sixteen source-build tools as stdio. Point any MCP Streamable HTTP client
at that URL.

For a local token-protected endpoint, set `MCP_HTTP_AUTH_TOKEN` and send it as
`Authorization: Bearer <token>`. Binding beyond loopback fails closed unless
all of these variables are present:

| Variable | Requirement |
| --- | --- |
| `MCP_HTTP_HOST` | Non-loopback bind address, such as `0.0.0.0`. |
| `MCP_HTTP_AUTH_TOKEN` | At least 32 bytes; never place it in source control. |
| `MCP_HTTP_ALLOWED_HOSTS` | Comma-separated request hostnames, without ports. |
| `MCP_HTTP_ALLOWED_ORIGINS` | Comma-separated browser origin hostnames, without schemes or ports. |

Example for a private deployment behind a TLS reverse proxy:

```bash
MCP_HTTP_HOST=0.0.0.0 \
MCP_HTTP_AUTH_TOKEN=replace-with-a-random-secret-of-at-least-32-bytes \
MCP_HTTP_ALLOWED_HOSTS=mcp.example.com \
MCP_HTTP_ALLOWED_ORIGINS=console.example.com \
pnpm mcp:http
```

The built-in Bearer token is a bounded self-hosting control, not an OAuth
authorization server. Terminate TLS at a trusted reverse proxy and use a
dedicated identity layer before exposing the endpoint to untrusted networks.
The published `v0.5.0` container remains stdio-only; the HTTP command above is
source-build functionality until a later release publishes it.

## Add To Codex With Docker

No clone or API key is required:

```bash
codex mcp add unified-ai-system -- docker run --rm -i ghcr.io/happy520ai/unified-ai-system/mcp-server:0.6.0
```

The dedicated image starts the MCP server by default; no command override is
required, and it invokes Node directly so package-manager output cannot pollute
the JSON-RPC stream. Its OCI identity and stdio transport are declared in the
repository root [`server.json`](../../server.json) for the official MCP
Registry.

The equivalent `config.toml` entry is:

```toml
[mcp_servers.unified_ai_system]
command = "docker"
args = [
  "run",
  "--rm",
  "-i",
  "ghcr.io/happy520ai/unified-ai-system/mcp-server:0.6.0",
]
startup_timeout_sec = 45
tool_timeout_sec = 60
default_tools_approval_mode = "writes"
```

For clients that accept the standard JSON `mcpServers` shape, use the
[generic MCP client configuration guide](../../docs/mcp-generic-client.md).

## Try It In Codex

Restart Codex after adding the server, then run `/mcp verbose` to inspect the
connected tools. A useful first task is:

> Use `gateway_prompt_enhance` to turn "build a small API for my team" into a
> coding prompt. Show the preserved original request, detected language,
> enhanced prompt, and proof that no provider was called.

Then prove the fake-chat safety boundary:

> Use the Unified AI System MCP tools to check gateway health and readiness,
> then send `MCP_READY` through gateway chat only if the gateway proves
> fake-only mode. Report the provider, model, execution mode, and response.

The [60-second Codex MCP quickstart](../../docs/codex-mcp-quickstart.md)
includes two more safe tasks, expected evidence, diagnostics, and the removal
command.

## Connect To An Existing Safe Gateway

Set `AI_GATEWAY_MCP_URL` and a dedicated gateway access token to use an already
running instance:

```bash
AI_GATEWAY_MCP_URL=http://127.0.0.1:3100 \
AI_GATEWAY_MCP_AUTH_TOKEN=<at-least-32-character-gateway-token> \
node packages/mcp-server/src/index.js
```

The managed gateway uses a private least-privilege token whose lifetime is
bounded by the isolated child process; it is never emitted in MCP results.
External gateway startup rejects missing or weak
tokens, URL credentials, non-loopback plaintext HTTP, invalid authentication,
or any gateway that may call a real provider. Provider credentials and
real-provider execution remain outside this preview surface.

For Agent Governance, give the dedicated Gateway identity only
`dashboard:read` and `workflow:run` unless a broader operator workflow is
explicitly required. `agent_governance_status` additionally requires the
Gateway's platform-tenant identity; ordinary tenants can still use tenant-scoped
list, generate, and describe. Do not grant `workflow:approve` or `user:admin` to
an MCP model merely to use these tools.

## Verify

The tests launch both transports through the official MCP v2 client. They pin
the modern `2026-07-28` stateless era on stdio and Streamable HTTP, retain
legacy `2025-11-25` plus `2025-06-18` initialize compatibility, list all
source-build tools, prove local prompt enhancement and fake-provider safety,
exercise HTTP/CORS access controls, close the clients, and confirm that each
managed gateway stopped. The container-safe raw smoke also uses
`server/discover` plus a per-request `_meta` envelope rather than inferring
modern support from the SDK version:

```bash
pnpm verify:mcp
```
