# Architecture

Unified AI System is a modular monolith with reusable workspace packages.

## Runtime

- `apps/ai-gateway-service` owns HTTP routes, the Workbench, provider
  orchestration, knowledge, agents, and operational controls.
- `apps/agent-console` owns the separate operator console.
- `packages/*` provide contracts, configuration, SDKs, context, workforce,
  routing, and engine modules.

## Boundaries

- Provider credentials enter through environment or controlled local
  configuration and are never committed.
- The fake provider is enabled by default.
- Real providers are disabled until explicitly selected.
- Generated evidence is local runtime output and is not source code.

## Request Flow

```text
Client
  -> HTTP route
  -> normalized gateway request
  -> provider selection and policy
  -> local fake or explicitly enabled provider
  -> response envelope, diagnostics, and metrics
```

The repository does not provide a centrally hosted public endpoint. Each user
runs or deploys an instance they control.
