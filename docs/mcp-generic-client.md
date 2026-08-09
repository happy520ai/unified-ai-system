# Generic MCP Client Configuration

Use this guide when your MCP host accepts a JSON configuration with an
`mcpServers` object. It works with the published MCP image and does not
require a repository clone or provider API key.

## Configuration

Add this server entry to the MCP host configuration:

```json
{
  "mcpServers": {
    "unified-ai-system": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "ghcr.io/happy520ai/unified-ai-system/mcp-server:0.4.5"
      ]
    }
  }
}
```

The host must be able to find `docker` on its `PATH`, and Docker Desktop or
the Docker daemon must be running. Keep the `-i` flag: MCP uses stdin/stdout
for its JSON-RPC transport. Do not wrap the command in a shell or add a
terminal-only flag.

## First Connection

1. Save the configuration in the location required by your MCP host.
2. Restart the host so it reloads its MCP configuration.
3. Open the host's MCP or tool inspector and confirm the nine tools are listed:
   `gateway_health`, `gateway_readiness`, `gateway_prompt_enhance`,
   `gateway_chat`, `knowledge_readiness`, `workflow_health`,
   `workflow_actions`, `workforce_health`, and `workforce_agents`.
4. Run `gateway_health` before `gateway_chat`.

The server starts a temporary local gateway for the MCP session. The default
path is pinned to the deterministic `local-fake-provider`; prompt enhancement
is local and does not call a provider. The chat tool fails closed if the
gateway cannot prove that real provider execution is disabled.

## Client-Specific Notes

This JSON shape is intended for MCP hosts that document an `mcpServers`
configuration. The exact file location and reload action are client-specific.
For Codex, use the CLI command or TOML entry in the
[MCP server guide](../packages/mcp-server/README.md) instead. Do not assume
that adding a JSON file makes an already-running client reload its servers.

## Remove The Server

Delete the `unified-ai-system` entry from the host configuration and restart
the host. Because the container is started with `--rm`, the managed container
is removed when the MCP process exits. To inspect or remove a leftover
container manually, run:

```bash
docker ps -a --filter "ancestor=ghcr.io/happy520ai/unified-ai-system/mcp-server:0.4.5"
docker rm -f <container-id>
```

This guide covers the credential-free preview. Configuring real providers,
authentication, or a hosted multi-user endpoint requires an explicit
deployment design; it is not enabled by this entry.
