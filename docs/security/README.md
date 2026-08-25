# Security Evidence

This directory contains bounded, reproducible security evidence for published
MCP images. These documents describe a reviewed artifact and its residual risks;
they are not production certification or a claim of universal safety.

## Current entry points

- [Latest project release v0.5.0](https://github.com/happy520ai/unified-ai-system/releases/tag/v0.5.0)
- [Latest CI and container checks](https://github.com/happy520ai/unified-ai-system/actions)
- [Security policy](../../SECURITY.md)
- [Provider-free public-clone verification](../getting-started.md#verify)

Use the current release workflow and the latest applicable image review when
evaluating the gateway. The latest project release is `0.5.0`; the Codex plugin
deliberately remains pinned by digest to the separately reviewed immutable
`0.4.9` image until a newer plugin image review replaces it.

## Current review

- [MCP image review 0.4.9](mcp-image-review-0.4.9.md)

## Historical reviews

- [MCP image review 0.4.8](mcp-image-review-0.4.8.md)
- [MCP image review 0.4.0](mcp-image-review-0.4.0.md)
- [MCP image review 0.3.2](mcp-image-review-0.3.2.md)

The default public path keeps real providers disabled, requires explicit scoped
authorization for provider execution, and should be independently reviewed
before any production deployment.
