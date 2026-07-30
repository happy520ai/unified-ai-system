# Changelog

All notable public changes to Unified AI System are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.1] - 2026-07-30

### Added

- A dedicated multi-architecture MCP OCI image whose default command starts
  the stdio server without a command override.
- Official MCP Registry metadata in `server.json`, including the verified
  GitHub namespace, OCI package, and stdio transport.
- Pinned, checksum-verified MCP Registry publishing through GitHub Actions
  OIDC on version tags.
- Protocol smoke coverage that talks to the default command of both local and
  anonymously pulled MCP container images.

### Changed

- Simplified the no-clone Codex command to use the dedicated MCP image.
- Extended public repository guards to keep project, Registry, image, and
  protocol versions aligned.

### Fixed

- Made the MCP image and project-level Codex configuration invoke the Node
  entrypoint directly so package-manager banners cannot corrupt stdio JSON-RPC.

## [0.3.0] - 2026-07-30

### Added

- A one-command, disposable terminal demo inside the public container image.
- OCI source, description, and license metadata for the published image.
- Repository and container guards that keep historical phase artifact roots
  out of the public product tree.
- Public-clone verification for the terminal-only default route surface.
- A Codex-ready stdio MCP server with eight governed inspection and
  fake-provider chat tools.
- Project-level Codex MCP configuration plus source and Docker startup paths.
- Official MCP v2 client coverage and a dependency-free container MCP smoke
  test with managed-process cleanup verification.

### Changed

- Made the no-clone container demo the primary README quickstart.
- Made the terminal and HTTP API the only default public product surfaces.
- Extended the container workflow to verify the bundled CLI before publishing,
  then anonymously pull the published SHA image and run both terminal and MCP
  demos again.
- Moved generated capability references under ignored `.data/` runtime state.

### Removed

- Retired the default `/ui` and `/console` browser routes after visual
  verification found the legacy Workbench unsuitable for the public preview.
- Removed 168 generated phase ledgers, dry-run results, routing evidence files,
  and provider-expansion artifacts from the public product tree.
- Removed historical read-only UI panels that only rendered those generated
  artifacts, along with the obsolete Workbench screenshot.

## [0.2.0] - 2026-07-30

### Added

- A formal `pnpm gateway` terminal CLI with `demo`, `serve`, `status`, `chat`,
  `doctor`, `help`, and `version` commands.
- Machine-readable `--json` output for automation and operator diagnostics.
- Focused CLI tests for argument validation, gateway readiness, fake-provider
  chat, offline diagnostics, and real-provider authorization.
- A task-oriented terminal CLI reference.

### Changed

- Made the terminal CLI the primary source workflow while keeping the browser
  Workbench as an optional operator surface.
- Extended Linux CI to run the CLI doctor and isolated terminal demo.

### Security

- `gateway chat` now fails closed when a real provider may be active. The
  request is not sent unless the operator adds `--allow-real-provider`
  explicitly for that command.

## [0.1.1] - 2026-07-30

### Added

- GitHub community templates, project roadmap, support guide, and launch kit.
- A real Workbench screenshot and repository social preview.
- A concise project vision and a complete Simplified Chinese README.
- A credential-free `pnpm demo` terminal path with isolated startup, verified
  fake-provider chat, and automatic process cleanup.
- A real terminal-demo image for the repository's primary product preview.

### Changed

- Refreshed the public Workbench identity around the Unified AI System brand.
- Replaced stale repository guidance with the maintained public checks.
- Improved repository metadata, topics, and community entry points.
- Reordered the main README around the real product, a 60-second container
  trial, verified capabilities, and honest boundaries.
- Made the terminal and API the primary README experience while keeping the
  browser Workbench available as an optional operator surface.

## [0.1.0] - 2026-07-30

### Added

- Local-first AI gateway with chat, streaming, routing, health, and diagnostics.
- Browser Workbench at `/ui`.
- Deterministic local fake provider for credential-free startup and verification.
- Explicit opt-in paths for user-configured real providers.
- Agent, workforce, knowledge, context, approval, and observability modules.
- Shared contracts, SDKs, configuration, and reusable workspace packages.
- Multi-architecture public container for `linux/amd64` and `linux/arm64`.
- Linux CI, repository hygiene checks, and clean-clone runtime verification.

### Notes

- This is an open-source public preview.
- It is not presented as production-certified, L5 autonomous, or established
  AGI. Those claims require independent evidence beyond local verification.

[Unreleased]: https://github.com/happy520ai/unified-ai-system/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/happy520ai/unified-ai-system/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/happy520ai/unified-ai-system/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/happy520ai/unified-ai-system/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/happy520ai/unified-ai-system/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/happy520ai/unified-ai-system/releases/tag/v0.1.0
