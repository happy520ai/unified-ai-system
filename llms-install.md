# Agent Installation: Unified AI System MCP

Use this guide to install the published Unified AI System MCP server in Cline.
The default installation is anonymous, starts an isolated local gateway, and
does not require a provider API key.

## Requirements

- Docker is installed and running.
- Cline CLI supports `cline mcp install --yes`.

## Install

Run exactly this command:

```bash
cline mcp install unified-ai-system --yes --json -- docker run --rm -i ghcr.io/happy520ai/unified-ai-system/mcp-server:0.3.3
```

A successful installation returns JSON with:

```json
{
  "name": "unified-ai-system",
  "status": "installed",
  "transport": {
    "type": "stdio",
    "command": "docker",
    "args": [
      "run",
      "--rm",
      "-i",
      "ghcr.io/happy520ai/unified-ai-system/mcp-server:0.3.3"
    ]
  },
  "warnings": []
}
```

Do not add provider credentials or real-provider enablement flags. The image
is intentionally safe by default and must remain in fake-only mode for this
verification path.

## Verify

Start a fresh Cline session and ask:

> Use the Unified AI System MCP server to check gateway health and readiness.
> List the available tools. Call gateway chat with `CLINE_MCP_READY` only if
> health proves real-provider calls are disabled. Report the provider, model,
> execution mode, and response.

Accept the installation only when all of these conditions hold:

- The server exposes eight tools.
- `gateway_health` reports a ready managed gateway.
- `realProviderCallsAllowed` and `realProviderEnabled` are both `false`.
- `gateway_chat` reports `local-fake-provider` and execution mode `fake`.

## Troubleshooting

If the first connection takes too long while Docker downloads the image, pull
it once and reconnect:

```bash
docker pull ghcr.io/happy520ai/unified-ai-system/mcp-server:0.3.3
```

To remove the server, run `cline mcp`, choose **Delete server**, and select
`unified-ai-system`.
