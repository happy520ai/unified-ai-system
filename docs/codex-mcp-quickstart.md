# Codex MCP Quickstart

Connect Codex to an isolated, credential-free Unified AI System gateway and
verify the complete MCP path in about a minute.

## 1. Add The Server

Requirements:

- Codex CLI
- Docker running locally

Register the pinned MCP image:

```bash
codex mcp add unified-ai-system -- docker run --rm -i ghcr.io/happy520ai/unified-ai-system/mcp-server:0.4.7
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

The server should be connected and expose these nine tools:

- `gateway_health`
- `gateway_readiness`
- `gateway_prompt_enhance`
- `gateway_chat`
- `knowledge_readiness`
- `workflow_health`
- `workflow_actions`
- `workforce_health`
- `workforce_agents`

## 3. Try Four Safe Tasks

Paste each task into Codex as a normal prompt.

### Structure A Natural-Language Request

> Use `gateway_prompt_enhance` to turn "build a small API for my team" into a
> coding prompt. Show the preserved original request, detected language,
> enhanced prompt, and proof that no provider was called.

### Capture A Shareable Evidence Record

After the tool returns, ask Codex to emit one JSON object containing only the
fields below. This makes a first-run result easy to review or paste into the
[usage report template](https://github.com/happy520ai/unified-ai-system/issues/new?template=usage-verification-report.yml&title=%5BUsage%20Report%5D%20Codex%20MCP%20Quickstart):

```text
Return one JSON object from the gateway_prompt_enhance result. Map
result.original to input, then include: input, enhancedPrompt, profile, language,
and metadata.engine,
metadata.version, metadata.providerCalled, metadata.credentialRequired,
metadata.originalPreserved, metadata.deterministic. Do not add credentials,
environment variables, or private request data.
```

The expected safety evidence includes `providerCalled: false`,
`credentialRequired: false`, `originalPreserved: true`, and
`deterministic: true`. A report is optional, but sharing one real output helps
maintainers improve the onboarding path without turning a successful command
into an unsupported adoption or Star claim.

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
- Prompt enhancement ran locally without calling a provider.
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
