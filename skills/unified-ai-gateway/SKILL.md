---
name: unified-ai-gateway
description: Use when operating or evaluating Unified AI System through its bundled Codex MCP tools, including gateway health and readiness, credential-free demo chat, knowledge readiness, workflow inspection, or workforce inspection. Enforces fake-provider and evidence boundaries.
license: Apache-2.0
---

# Unified AI Gateway

Use the bundled `unified-ai-system` MCP server. It starts an isolated gateway in
Docker and removes it when the MCP session ends.

## Workflow

1. Call `gateway_health`, then `gateway_readiness`, before attempting chat.
2. Select the narrowest tool that answers the request.
3. Report returned provider, execution mode, readiness, and blockers exactly.
4. Separate transport success from product or production-readiness claims.

## Tool Map

- `gateway_health`: managed gateway status and provider mode
- `gateway_readiness`: chat-path readiness and blockers
- `gateway_chat`: deterministic credential-free chat proof
- `knowledge_readiness`: knowledge subsystem readiness
- `workflow_health`: workflow subsystem status
- `workflow_actions`: available workflow actions
- `workforce_health`: workforce subsystem status
- `workforce_agents`: available workforce agents

## Safety Boundaries

- Keep the credential-free local fake provider as the default.
- Never request, read, or transmit provider credentials through this skill.
- Do not enable or call a real provider without explicit scoped authorization.
- Do not claim production readiness, L5 autonomy, or AGI from a healthy handshake.
- If tools are unavailable after installation, ask for a Codex reload or new
  task; existing tasks may not hot-load newly installed MCP configuration.
