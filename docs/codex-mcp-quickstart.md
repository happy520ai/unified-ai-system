# Codex MCP Quickstart

Connect Codex to an isolated, credential-free Unified AI System gateway and
verify the complete MCP path in about a minute.

## 1. Add The Server

Requirements:

- Codex CLI
- Docker running locally

Register the pinned MCP image:

```bash
codex mcp add unified-ai-system -- docker run --rm -i ghcr.io/happy520ai/unified-ai-system/mcp-server:0.3.2
```

The image starts its own temporary gateway over stdio, pins chat to the
deterministic local fake provider, and removes the container when the MCP
session ends. It does not read a provider API key or authorize real-provider
execution.

## 2. Confirm The Connection

Inspect the stored configuration:

```bash
codex mcp get unified-ai-system --json
```

Restart Codex after adding the server. In the Codex terminal UI, run:

```text
/mcp verbose
```

The server should be connected and expose these eight tools:

- `gateway_health`
- `gateway_readiness`
- `gateway_chat`
- `knowledge_readiness`
- `workflow_health`
- `workflow_actions`
- `workforce_health`
- `workforce_agents`

## 3. Try Three Safe Tasks

Paste each task into Codex as a normal prompt.

### Check The Safety Boundary

> Use the Unified AI System MCP tools to inspect gateway health and readiness.
> Report the provider mode, whether real providers are enabled, and whether
> chat is ready. Do not call chat unless the gateway proves fake-only mode.

### Prove Fake-Provider Chat

> Use the Unified AI System MCP tools. Check health and readiness first, then
> send `MCP_READY` through gateway chat. Report the selected provider, selected
> model, execution mode, and response. Clearly label it as fake-provider
> output.

### Inspect Governed Surfaces

> Use the Unified AI System MCP tools to inspect knowledge readiness, workflow
> health and action definitions, and workforce health and agent descriptors.
> Summarize what is ready or not ready. Do not start a workflow, dispatch an
> agent, or change data.

## What This Proves

A successful run proves that:

- Codex loaded the stdio MCP server.
- The managed local gateway started and passed its health boundary.
- Chat remained on the deterministic fake provider.
- Knowledge, workflow, and workforce inspection surfaces were readable.

It does not prove production readiness, authorize a real provider, execute an
agent plan, or establish an AGI claim.

## Troubleshooting And Removal

Check Docker and the stored MCP definition:

```bash
docker info
codex mcp get unified-ai-system --json
```

Use `/mcp verbose` for server diagnostics after restarting Codex. To remove the
entry:

```bash
codex mcp remove unified-ai-system
```

See the [MCP server guide](../packages/mcp-server/README.md) for transport and
safety details, the [terminal CLI guide](cli.md) for direct gateway operation,
and the official [Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp)
for Codex configuration behavior.
