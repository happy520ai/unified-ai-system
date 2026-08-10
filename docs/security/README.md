# Security Evidence

This directory contains bounded, reproducible security evidence for published
MCP images. These documents describe a reviewed artifact and its residual risks;
they are not production certification or a claim of universal safety.

## Current entry points

- [Current release v0.4.9](https://github.com/happy520ai/unified-ai-system/releases/tag/v0.4.9)
- [Latest CI and container checks](https://github.com/happy520ai/unified-ai-system/actions)
- [Security policy](../../SECURITY.md)
- [Provider-free public-clone verification](../getting-started.md#verify)

Use the current release workflow and the latest available image review when
evaluating the gateway. The Codex plugin pins the reviewed immutable `0.4.9`
image.

## Current review

- [MCP image review 0.4.9](mcp-image-review-0.4.9.md)

## Historical reviews

- [MCP image review 0.4.8](mcp-image-review-0.4.8.md)
- [MCP image review 0.4.0](mcp-image-review-0.4.0.md)
- [MCP image review 0.3.2](mcp-image-review-0.3.2.md)

The default public path keeps real providers disabled, requires explicit scoped
authorization for provider execution, and should be independently reviewed
before any production deployment.
