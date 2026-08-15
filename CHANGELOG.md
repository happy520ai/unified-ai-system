# Changelog

All notable public changes to Unified AI System are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Added chat-specific Prometheus metrics on `GET /metrics`
  (`ai_gateway_chat_requests_total`, `ai_gateway_chat_tokens_total`,
  `ai_gateway_chat_ttft_ms` histogram, `ai_gateway_chat_cache_events_total`,
  `ai_gateway_chat_virtual_key_rejections_total`) with capped label
  cardinality, plus an opt-in Langfuse export (`LANGFUSE_PUBLIC_KEY` /
  `LANGFUSE_SECRET_KEY`) that batches generation events with usage,
  provider, latency, cache-hit, and virtual-key fingerprint metadata,
  truncates captured content, and fails open on export errors. See
  `docs/observability-export.md`.
- Added virtual keys (`uai-`) with periodic token budgets and per-key rate
  limits. Operators create, list, and revoke keys through
  `/enterprise/virtual-keys` (user:admin); keys authenticate through the
  enterprise governance layer as tenant-scoped identities; and
  `POST /v1/chat/completions` enforces a pre-request budget check (429
  `VIRTUAL_KEY_BUDGET_EXHAUSTED` / `VIRTUAL_KEY_RATE_LIMITED`), records
  actual usage (including response-cache hits and streaming), and emits a
  soft-budget service-log event at the configured threshold. Keys persist as
  SHA-256 hashes with usage counters in `.data/enterprise/api-keys.json`.
  See `docs/virtual-keys.md`.
- Added native streaming to the Anthropic provider adapter. `generateStream`
  now consumes the upstream Anthropic Messages SSE stream directly (text
  deltas, usage accounting from `message_start`/`message_delta`, stop-reason
  mapping, inactivity-based timeout, and caller abort propagation), so
  streaming requests no longer fail with `PROVIDER_STREAMING_UNSUPPORTED`
  when a real Anthropic provider is selected. Also fixed the non-streaming
  timeout error, which previously shipped without `category`/`retryable`.
- Added an opt-in response cache for the OpenAI-compatible chat hot path.
  With `AI_GATEWAY_RESPONSE_CACHE_ENABLED=true`, identical tenant-scoped
  `POST /v1/chat/completions` requests replay the exact JSON or SSE wire
  response without a provider call, reusing the existing response-cache store,
  tenant scoping, TTL, and audit trail. See
  `docs/response-cache-hot-path.md` for eligibility rules and operations.
- Added a credential-gated real-provider smoke: `tools/real-provider-smoke.mjs`
  plus the manual **Real Provider Smoke** workflow. The wrapper pins the
  OpenAI lane, bootstraps a per-run enterprise token (real modes require
  authentication even on loopback), enforces a timeout, treats fake-lane
  fallback as a failure, and exits with an explicit skip when
  `secrets.OPENAI_API_KEY` is absent, so zero-credential runs stay green.
- Added the real provider enablement runbook
  (`docs/real-provider-enablement.md`) covering the three-gate whitelist
  matrix, credential provisioning paths, verification, cost control, the
  unchanged fake boundary, and rollback.
- Added a task handoff loop reference that documents the read and write handoff
  endpoints, the task card schema, the standard round, and a read-only
  connection verification card that any MCP host can run.
- Added a design-only proposal for a gateway-driven external runner, covering
  token scope, command whitelist, and the approval gate. No runtime code
  implements it, and it stays closed until the repository owner authorizes it.

### Changed

- Moved the Codex plugin and manual Agent Skill procedure to the reviewed
  immutable `v0.4.9` MCP image index.
- Documented local client convergence for the three source hosts and ignored
  `.zcode/`, so per-machine interpreter paths stay out of version control.
- Corrected the governed tool count in the Chinese MCP compatibility baseline
  from nine to twelve, completing an earlier alignment that missed this line.
- Corrected the supervised MCP service README from nine to twelve governed
  tools and refreshed its tool list to match the MCP server README.

### Fixed

- Fixed managed MCP sessions losing every authenticated tool after about ten
  minutes. The ephemeral managed token no longer carries a fixed wall-clock
  expiry; its lifetime is bounded by the fake-provider, loopback-only gateway
  child process that the MCP host already owns.

### Verification

- Reviewed both published `v0.4.9` Linux platforms without starting them,
  including OCI identities, flattened filesystems, native binaries, lifecycle
  hooks, privileged files, internal links, and credential-like artifacts.
- Held one stdio MCP session for 12.05 minutes across twelve authenticated
  polls with zero authentication failures, called chat successfully past the
  former ten-minute boundary in fake mode, closed the managed gateway, and
  recorded no new token-expiry audit entry.
- Ran the three source client profiles concurrently from their own on-disk
  configuration: each discovered the same twelve governed tools, held a distinct
  loopback port, returned fake-provider output, released only its own port on
  disconnect, and left no orphan listener.

## [0.4.9] - 2026-08-10

### Added

- Added `GET /v1/models` and `POST /v1/chat/completions` as a focused
  OpenAI-compatible inbound API with text completions, data-only SSE streaming,
  standard error envelopes, visible execution metadata, and optional local
  prompt enhancement.
- Added public protocol types and bilingual OpenAI SDK integration guides.
- Added a credential-free end-to-end example that verifies the gateway with
  the official OpenAI JavaScript SDK `7.4.0`.

### Changed

- Made the growth dashboard distinguish merged directory submissions from
  pull requests closed without merge, show listing titles, and include the
  current ToolSDK and awesome-ai-gateway submissions.
- Replaced status-only PR follow-up advice with a contributor-safe policy:
  answer technical feedback, but do not repeatedly ping waiting maintainers.
- Aligned source development and full verification on Node.js 22, matching the
  existing CI and container runtime.

### Documentation

- Simplified the bilingual README first screen around one visual proof, one
  prefilled no-install Prompt Lab path, and one published-container command.
- Refreshed the reproducible social preview around the MCP gateway, Codex,
  prompt enhancement, and the nine governed tools.
- Added copy-ready Windows PowerShell request-file commands to the bilingual
  README and community promotion paths.
- Added a dedicated MCP client report template with required client, version,
  environment, tool-count, and sanitized health/readiness evidence fields.
- Routed the bilingual Codex MCP quickstarts to the dedicated client report
  flow so client evidence is captured with the right context.
- Refreshed the public Codex for Open Source application copy and the v0.4.8
  Showcase and MCP compatibility contribution entry points.

### Verification

- Extended the credential-free public-clone verifier with model listing,
  regular and enhanced Chat Completions, OpenAI-compatible streaming, fake-
  provider evidence, and process cleanup.
- Added `pnpm eval:prompt-enhancement`, a credential-free contract evaluation
  covering representative profiles, language detection, signal compilation,
  original-input preservation, determinism, and zero provider calls.
- Reviewed the published `v0.4.8` MCP image for both Linux architectures and
  moved the Codex plugin from the historical `v0.4.0` image to the reviewed
  immutable `v0.4.8` index.
- Hardened container MCP smoke tests with the same no-network, dropped-
  capability, and no-new-privileges boundary used by the Codex plugin.
- Added official-SDK checks for source, locally built container, and anonymously
  pulled published-image paths, including structured 400 error verification.

## [0.4.8] - 2026-08-10

### Added

- Added detected request signals and compiled-section summaries to browser,
  CLI, and isolated-demo evidence packets so shared reports show what the
  local enhancer carried into the structured prompt.
- Published the evidence-first Prompt Lab workflow with detected signals,
  compiled sections, shareable state, and a structured feedback handoff.
- Added a verified Node MCP SDK test-host path to the client compatibility
  evidence.
- Made the browser Prompt Lab feedback link copy the current evidence packet
  before opening the usage-report form, with profile and language in the title.

### Changed

- Made the first-run CLI and browser paths produce inspectable, provider-free
  evidence that users can share without credentials.
- Refined the public onboarding and community promotion paths around one
  reproducible proof instead of unverifiable adoption claims.
- Updated the growth campaign command to emit evidence packets and track the
  Agent Skill Exchange submission in the external PR funnel.

### Documentation

- Added a Node MCP SDK test-host row to the bilingual compatibility matrix,
  separating protocol integration evidence from client-specific certification.
- Updated the bilingual README first-run commands to emit shareable evidence
  packets by default.
- Aligned repeated README and community quickstart snippets with the same
  evidence-producing command.

## [0.4.7] - 2026-08-10

### Added

- Compiled detected request signals for format, constraints, audience,
  environment, evidence, and success criteria into the structured prompt
  sections, so explicit user intent is carried forward instead of only being
  used to decide clarification questions.

### Documentation

- Refreshed contributor and security guidance for the current `0.4.x` release
  line and removed closed first-run issue links from public entry points.
- Routed the bilingual README Codex links to the deployed Docker quickstarts
  while keeping the repository source guide available for contributors.

## [0.4.6] - 2026-08-10

### Added

- Added caller-controlled `AbortSignal` support to Shared SDK JSON requests and
  `chatStream` calls without changing existing method signatures.
- Added deterministic cancellation coverage for JSON and streaming requests.

### Changed

- Preserved caller abort reasons through `GatewayClientError.cause` and named
  internal timeout causes `TimeoutError` so applications can distinguish them.
- Documented the cancellation contract and synchronized public release entry
  points with `0.4.6`.

## [0.4.5] - 2026-08-09

### Added

- Added `enhance --evidence` for a report-ready, provider-free prompt
  enhancement packet containing the original request, enhanced prompt, and
  verification metadata.

### Changed

- Documented the direct enhancement evidence path and synchronized public
  Docker, MCP, Codex, and documentation entry points with `0.4.5`.

## [0.4.4] - 2026-08-09

### Added

- Added human-readable CLI output for optional clarification questions and
  provider-free safety evidence after prompt enhancement.

### Changed

- Synchronized the public Docker, MCP, Codex, and documentation entry points
  with the `0.4.4` patch release.

## [0.4.3] - 2026-08-09

### Added

- Added explicit `--language auto|zh-CN|en` control to CLI prompt enhancement,
  enhanced chat, and the isolated demo workflow.
- Added a copy-ready Windows PowerShell JSON example that exposes the
  provider-free enhancement evidence fields.

### Changed

- Published the CLI, Docker image, MCP package metadata, and public examples
  under one consistent `0.4.3` release version.
- Synchronized public Codex and MCP onboarding paths with the current release.

## [0.4.2] - 2026-08-09

### Added

- Added a one-command terminal demo that enhances a natural-language request
  locally and runs the credential-free fake chat path.
- Added explicit `--enhance` and `--profile` support to the demo workflow,
  with JSON output suitable for reproducible onboarding and automation.

### Changed

- Published the CLI, Docker image, MCP package metadata, and public examples
  under one consistent `0.4.2` release version.
- Kept provider calls disabled in the public demo path and added verification
  that prompt enhancement does not silently invoke a real provider.

## [0.4.1] - 2026-08-08

### Added

- Added generic JSON `mcpServers` configuration and Windows PowerShell
  quickstarts for the credential-free gateway and MCP paths.
- Added a provider adapter contribution guide with current contracts,
  credential-free tests, catalog boundaries, and review checklist.
- Added supervised MCP service packaging, public growth snapshots, and a
  reproducible community verification workflow.

### Changed

- Kept the local fake provider as the default and made public verification
  prove prompt enhancement, MCP discovery, process cleanup, and no real
  provider calls.
- Updated public dependency overrides and package metadata for the v0.4.1
  multi-platform image and MCP Registry release.

### Security

- The public dependency scan is clean at release preparation time; real
  provider execution remains explicitly disabled by default.

## [0.4.0] - 2026-08-02

### Added

- A deterministic, provider-free natural-language prompt enhancement engine
  with Chinese and English task profiles, clarification guidance, and explicit
  completion criteria.
- `POST /prompts/enhance`, shared SDK contracts, `pnpm gateway enhance`,
  opt-in `chat --enhance`, and a ninth MCP enhancement tool.

### Changed

- Redirected internal audit, security, context-selection, and Codex handoff
  checks from the retired Workbench to the maintained terminal CLI.
- Promoted the published MCP distribution to nine tools and pinned public
  container, Registry, CLI, and project-site references to `0.4.0`.

### Removed

- Removed the dormant browser UI source tree, its unused build and route
  staging, and UI-only tests. The supported terminal, HTTP, SDK, and MCP
  runtime paths are unchanged, while `/ui` and `/console` remain verified 404s.

## [0.3.3] - 2026-08-02

### Added

- A dependency-free JavaScript chat example that checks gateway safety, pins
  the local fake provider, and verifies fake execution before printing output.
- A 60-second Codex MCP quickstart with copy-ready safety, chat, workflow, and
  workforce inspection tasks plus diagnostics and removal.
- A Codex plugin distribution with marketplace metadata, project-level MCP
  configuration, and a catalog-ready operating skill.
- A terminal-first project site with search metadata, a sitemap, an LLM-readable
  project summary, and direct setup paths for Codex, Cursor, and Cline.
- Cline installation guidance, cross-client configuration generation, and
  Glama discovery metadata.

### Changed

- Extended public-clone verification to execute the JavaScript example against
  the credential-free gateway path.
- Moved the public README and project site toward the verified gateway demo,
  explicit agent connection paths, and a clearer contribution call to action.
- Pointed package, plugin, and official MCP Registry website metadata at the
  public project site.
- Pinned public container examples and Registry metadata to `0.3.3`.

### Security

- Added a reproducible content review for the immutable `0.3.2` MCP image used
  by the hardened Codex skill setup path.
- Added the HOL plugin scanner and strengthened executable-file inventory,
  special-mode preservation, and scanner finding visibility.

## [0.3.2] - 2026-07-30

### Added

- A square project icon in the official MCP Registry metadata for richer client
  and directory presentation.
- Stable GitHub repository identity, MCP package subfolder, and project website
  metadata for downstream discovery services.

### Changed

- Moved the one-command Codex MCP path ahead of the general gateway demo in the
  public README.
- Pinned public container examples to the reproducible `0.3.2` release.

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

[Unreleased]: https://github.com/happy520ai/unified-ai-system/compare/v0.4.9...HEAD
[0.4.9]: https://github.com/happy520ai/unified-ai-system/compare/v0.4.8...v0.4.9
[0.4.8]: https://github.com/happy520ai/unified-ai-system/compare/v0.4.7...v0.4.8
[0.4.7]: https://github.com/happy520ai/unified-ai-system/compare/v0.4.6...v0.4.7
[0.4.6]: https://github.com/happy520ai/unified-ai-system/compare/v0.4.5...v0.4.6
[0.4.5]: https://github.com/happy520ai/unified-ai-system/compare/v0.4.4...v0.4.5
[0.4.4]: https://github.com/happy520ai/unified-ai-system/compare/v0.4.3...v0.4.4
[0.4.3]: https://github.com/happy520ai/unified-ai-system/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/happy520ai/unified-ai-system/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/happy520ai/unified-ai-system/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/happy520ai/unified-ai-system/compare/v0.3.3...v0.4.0
[0.3.3]: https://github.com/happy520ai/unified-ai-system/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/happy520ai/unified-ai-system/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/happy520ai/unified-ai-system/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/happy520ai/unified-ai-system/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/happy520ai/unified-ai-system/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/happy520ai/unified-ai-system/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/happy520ai/unified-ai-system/releases/tag/v0.1.0
