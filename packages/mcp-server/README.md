# Unified AI System MCP Server

Connect Codex and other MCP hosts to the credential-free Unified AI System
preview over stdio.

The server starts an isolated local gateway automatically, pins it to the
deterministic fake provider, exposes governed tools, and removes the gateway when
the MCP session ends. It does not enable or authorize real provider calls.

## Tools

| Tool | Behavior |
| --- | --- |
| `gateway_health` | Inspect gateway health and provider safety state. |
| `gateway_readiness` | Inspect first-run and chat readiness. |
| `gateway_prompt_enhance` | Structure a natural-language request locally without a provider call. |
| `gateway_chat` | Send one fake-provider-only chat request. |
| `knowledge_readiness` | Inspect local knowledge infrastructure. |
| `workflow_health` | Inspect the governed workflow subsystem. |
| `workflow_actions` | List workflow action definitions. |
| `workforce_health` | Inspect the workforce subsystem. |
| `workforce_agents` | List workforce agent descriptors. |

All inspection tools are read-only. The chat tool checks the gateway safety
state before every request and fails closed unless `realProviderEnabled` is
exactly `false` and the response proves `executionMode: "fake"`.

The source build and pinned `0.4.1` image both expose all nine tools, including
the provider-free `gateway_prompt_enhance` preview.

## Run From Source

From the repository root:

```bash
pnpm install --frozen-lockfile
node packages/mcp-server/src/index.js
```

The project-level [`.codex/config.toml`](../../.codex/config.toml) registers
that command automatically in trusted Codex projects. Restart Codex after
cloning or changing MCP configuration, then use `/mcp` to inspect the server.

## Add To Codex With Docker

No clone or API key is required:

```bash
codex mcp add unified-ai-system -- docker run --rm -i ghcr.io/happy520ai/unified-ai-system/mcp-server:0.4.1
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
  "ghcr.io/happy520ai/unified-ai-system/mcp-server:0.4.1",
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

Set `AI_GATEWAY_MCP_URL` to use an already running instance:

```bash
AI_GATEWAY_MCP_URL=http://127.0.0.1:3100 node packages/mcp-server/src/index.js
```

Startup is rejected if that gateway may call a real provider. Authentication
and real-provider execution are intentionally outside this preview surface.

## Verify

The test launches the server through the official MCP v2 client, completes the
stdio handshake, lists all source-build tools, calls every tool, proves local
prompt enhancement and fake-provider chat, closes the client, and confirms
that the managed gateway stopped:

```bash
pnpm verify:mcp
```
