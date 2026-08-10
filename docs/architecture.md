# Architecture

Unified AI System is a modular monolith with reusable workspace packages.

## Runtime

- `apps/ai-gateway-service` owns HTTP routes, gateway runtime, provider
  orchestration, knowledge, agents, and operational controls.
- `apps/agent-console` owns the terminal operator interface.
- `packages/mcp-server` owns the stdio and Streamable HTTP MCP surfaces used by
  Codex and other MCP hosts. It depends on the shared SDK rather than gateway
  internals.
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
  -> terminal, OpenAI-compatible HTTP, A2A, or MCP adapter
  -> HTTP route
  -> optional deterministic prompt enhancement (explicit opt-in)
  -> normalized gateway request
  -> provider selection and policy
  -> local fake or explicitly enabled provider
  -> response envelope, diagnostics, and metrics
```

The repository does not provide a centrally hosted public endpoint. Each user
runs or deploys an instance they control.

The OpenAI-compatible Chat Completions and text-only Responses profiles, plus
the A2A v1.0 JSON-RPC profile, terminate in the same gateway service. They reuse
the existing `chat:use` authorization boundary and provider policy instead of
creating alternate execution paths. A2A Agent Card discovery is public, while
task execution remains governed. The source profile stores A2A tasks in memory
and pins execution to the local fake provider.

The default MCP command is self-contained: it allocates a local port, starts a
fake-provider gateway, serves the governed stdio tools, and tears the child
process down when the host disconnects. The source build and pinned `0.4.9`
release both expose nine tools, including provider-free prompt enhancement. An
explicit `AI_GATEWAY_MCP_URL` can point the server at an existing safe gateway.

The source build also has a Streamable HTTP entry point. It binds to loopback
by default and uses the official MCP Node transport adapter with Host and Origin
validation. A non-loopback bind requires a Bearer token plus explicit Host and
Origin allowlists before the listener starts. HTTP and stdio create servers from
the same tool factory, so their public tool definitions cannot drift.
