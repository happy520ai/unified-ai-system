# Security Evidence

This directory contains bounded, reproducible security evidence for published
MCP images. These documents describe a reviewed artifact and its residual risks;
they are not production certification or a claim of universal safety.

## Current entry points

- [Latest project release v0.8.0](https://github.com/happy520ai/unified-ai-system/releases/tag/v0.8.0)
- [Latest CI and container checks](https://github.com/happy520ai/unified-ai-system/actions)
- [Security policy](../../SECURITY.md)
- [Provider-free public-clone verification](../getting-started.md#verify)

Use the current release workflow and the applicable image review when evaluating
the gateway. The latest project release is `0.8.0`, and two reviews are current but
answer different questions:

- `0.8.0` was reviewed on 2026-09-29 by reading the layer tarballs straight out of the
  registry with `tools/inspect-image-filesystem.mjs`, which needs no Docker engine and
  executes nothing. That review is the one that found the `linux/arm64` tag carrying
  x86-64 native modules, so it is a defect report rather than a clean bill of health.
- `0.4.9` is the newest review produced by the Docker-export procedure, and it is the
  review the Codex plugin's digest pin rests on. The registration deliberately stays
  pinned to that immutable image until an export-based review of a newer image replaces
  it, which is why the pin has not moved even though a `0.8.0` review now exists.

`0.5.0`, `0.6.0` and `0.7.0` have no content review on file.

## Current reviews

- [MCP image review 0.8.0](mcp-image-review-0.8.0.md) - registry tarballs, no Docker
  engine, nothing executed; records the `linux/arm64` architecture regression
- [MCP image review 0.4.9](mcp-image-review-0.4.9.md) - Docker-export procedure, and the
  review that backs the pinned digest used by the agent skill

## Historical reviews

- [MCP image review 0.4.8](mcp-image-review-0.4.8.md)
- [MCP image review 0.4.0](mcp-image-review-0.4.0.md)
- [MCP image review 0.3.2](mcp-image-review-0.3.2.md)

The default public path keeps real providers disabled, requires explicit scoped
authorization for provider execution, and should be independently reviewed
before any production deployment.
