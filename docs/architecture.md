# Architecture

Unified AI System is a modular monolith with reusable workspace packages.

## Runtime

- `apps/ai-gateway-service` owns HTTP routes, gateway runtime, provider
  orchestration, knowledge, agents, and operational controls.
- `apps/agent-console` owns the terminal operator interface.
- `packages/mcp-server` owns the stdio MCP surface used by Codex and other MCP
  hosts. It depends on the shared SDK rather than gateway internals.
- `packages/*` provide contracts, configuration, SDKs, context, workforce,
  routing, and engine modules.

## Boundaries

- Provider credentials enter through environment or controlled local
  configuration and are never committed.
- The fake provider is enabled by default.
- Real providers are disabled until explicitly selected.
- The public MCP surface fails closed unless the connected gateway proves that
  real providers are disabled.
- Generated evidence is local runtime output and is not source code.

## Request Flow

```text
Client
  -> terminal, HTTP, SDK, or MCP adapter
  -> HTTP route
  -> optional deterministic prompt enhancement (explicit opt-in)
  -> normalized gateway request
  -> provider selection and policy
  -> local fake or explicitly enabled provider
  -> response envelope, diagnostics, and metrics
```

The repository does not provide a centrally hosted public endpoint. Each user
runs or deploys an instance they control.

The default MCP command is self-contained: it allocates a local port, starts a
fake-provider gateway, serves the governed stdio tools, and tears the child
process down when the host disconnects. The source build and pinned `0.4.0`
release both expose nine tools, including provider-free prompt enhancement. An
explicit `AI_GATEWAY_MCP_URL` can point the server at an existing safe gateway.
