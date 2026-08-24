# Protocol And Client Compatibility

The project scales client coverage through open protocols. A protocol test
proves the wire contract; a named product is certified only after a real run
records the product version, operating system, configuration, and result.

The strategy is intentionally protocol-first: no client family is listed as supported forever. If a client speaks MCP (stdio or Streamable HTTP), OpenAI-compatible REST, A2A JSON-RPC, or plain JSON/HTTP, it is eligible as long as it follows
the documented request/route boundaries and provides reproducible evidence.

## Verified Source Protocols

| Surface | Verified implementation | Covered behavior | Boundary |
| --- | --- | --- | --- |
| MCP stdio | Official `@modelcontextprotocol/client` `2.0.0` | Modern `2026-07-28` `server/discover`, per-request envelope, twelve tools, prompt enhancement, fake chat, cleanup | Modern era is source-verified; named host UI behavior still needs a report. |
| MCP Streamable HTTP | Official `@modelcontextprotocol/client` `2.0.0` | Modern `2026-07-28`, legacy `2025-11-25` and `2025-06-18`, header routing/CORS, twelve tools, Bearer/Origin rejection, cleanup | Source build only; published `v0.4.9` image is stdio-only. |
| OpenAI Chat Completions | Official `openai` JS SDK `7.4.0` plus real Cline/Continue hosts | Models, text completion, streaming, structured errors, enhancement, function tools, tool results, bounded inline image input | Image input is restricted to validated base64 PNG/JPEG/WebP/GIF data URLs; remote URLs and audio content remain fail-closed. |
| OpenAI wire-alias profile | OpenAI-compatible HTTP route matrix (`openai-wire-smoke.mjs`) | `/v1`, root aliases, `/openai/deployments`, `/v1/engines`, SSE | Confirms route variants used by many wrappers. |
| OpenAI Legacy Completions | Official `openai` JS SDK `7.4.0` | `/v1/completions` text `prompt` and streaming | Text profile; no logprobs, no tool calling, no images/audio. |
| OpenAI Legacy Engines list | OpenAI-compatible compatibility layer | `GET /v1/engines` | Legacy list endpoint alias for tooling that still checks engine inventories. |
| OpenAI Responses | Official `openai` JS SDK `7.4.0` | Text and bounded inline image input, `output_text`, streaming events, fake execution evidence | No stored responses, background tasks, tools, files, remote image URLs, or audio input. |
| OpenAI Multimodal Profile | OpenAI-compatible REST clients for embeddings, speech, and image generation | `POST /v1/embeddings`, `/v1/audio/speech`, `/v1/audio/transcriptions`, `/v1/images/generations` | Focused implementation with normalized request checks and provider adapter routing. |
| OpenAI-compatible aliases | Legacy and root path aliases (e.g., `/chat/completions`, `/responses`) | Alias path normalization and permission mapping | Alias support enables SDKs that send root paths without `/v1`. |
| OpenAI Legacy Engines | `/v1/engines/{engine}/chat/completions`, `/v1/engines/{engine}/completions` | Legacy route remapping with model inference from the engine segment | Text-only completion profile with model fallback and no tool/multimodal support. |
| OpenAI Model/Engine Details | `GET /v1/models/{id}`, `GET /v1/engines/{id}` | Model and engine inventory detail entries returned in same schema as list responses | Supports ID lookups from compatibility lists; not all OpenAI object-level fields are implemented. |
| A2A v1.0 JSON-RPC | Official `@a2a-js/sdk` `1.0.1` | Verifiable Agent Card/JWKS, `SendMessage`, `GetTask`, `ListTasks`, `CancelTask`, task artifacts, bounded memory/SQLite/PostgreSQL state, and PostgreSQL execution fencing | Source build, fake-provider-only, no streaming; downstream side effects are not yet atomically fence-aware. |
| Native HTTP and shared SDK | Node `fetch`, curl examples, repository SDK tests | Health, chat, streaming, prompt enhancement, operational reads | Unified AI System contract, not a third-party protocol. |

## Verified Named MCP Hosts

These are product-level runtime results, not inferences from protocol support.
All rows below came from isolated Windows x64 runs against the local fake
gateway. The host had to issue `initialize`, `notifications/initialized`, and
`tools/list`, discover all twelve gateway tools, make no real-provider call, and
leave no host or MCP server process behind. Profiles that exercise a tool call
are restricted to exactly one read-only `gateway_health` call.

| Host | Tested version | Negotiated MCP version | Result |
| --- | --- | --- | --- |
| Claude Code | `2.1.227` | `2025-11-25` | Twelve tools discovered; no tool or model call; cleanup verified. |
| Gemini CLI | `0.54.4` | `2025-06-18` | Real Gemini MCP client discovery after minimal ACP initialization; no session prompt or model call; cleanup verified. |
| OpenCode CLI | `1.18.16` | `2025-11-25` | Twelve tools discovered under `--pure` isolated configuration; no tool or model call; cleanup verified. |
| Cursor Agent CLI | `2026.08.04-aaa8809` | `2025-11-25` | Twelve tools discovered through official `mcp list-tools`; no account or model call; cleanup verified. |
| Cline CLI | `3.0.52` | `2024-11-05` | Twelve tools discovered; only read-only `gateway_health` called through the local fake model; cleanup verified. |
| Continue CLI | `1.5.47` | `2025-11-25` | Twelve tools discovered; only read-only `gateway_health` called through the local fake model; cleanup verified. |

Codex App Server and VS Code Extension Host have separate automated profiles in
the same verifier. Claude Desktop, JetBrains, Windsurf, and other cataloged
hosts remain manual until a named version and sanitized runtime report are
attached.

## Client Eligibility

### "Global" means protocol-compatible

We do not promise one-off support for every client package ever shipped.
We do promise protocol-first compatibility:

- OpenAI-compatible: `/v1` and supported alias paths for text Chat/Completions/Responses, plus focused multimodal routes (`embeddings`, `images/generations`, `audio/speech`, `audio/transcriptions`).
- MCP: modern stateless `2026-07-28` plus legacy initialize-era stdio/Streamable HTTP behavior.
- A2A: JSON-RPC contract, `Agent Card` discovery, and task lifecycle methods.

If a client fits this profile, we onboard it through the registry and collect
evidence when we confirm an actual run on your target version and environment.

- An MCP host is eligible when it supports stdio or Streamable HTTP and accepts
  the server command or endpoint required by that transport.
- An OpenAI-compatible client is eligible when it supports a custom `baseURL`
  and stays within the documented Chat/Completions, Legacy Completions,
  Responses, or focused multimodal profile.

This includes mainstream SDKs from other ecosystems (Python, Node, Java, .NET,
PHP, Ruby, Go, Kotlin, Swift, Rust, etc.) when they use the documented
transport profile and provide a reproducible local run result.

Manual onboarding is supported through evidence-backed issue reports, and those results can be imported by
`--manual-evidence` in `pnpm exec node tools/verify-client-runtimes.mjs`.
- An A2A client is eligible when it supports A2A v1.0 Agent Card discovery and
  JSON-RPC.
- A generic HTTP client is eligible when it can send JSON, consume SSE where
  needed, and provide the gateway's scoped Bearer token when authentication is
  enabled.

Eligibility is not certification. Use the
[protocol client report](https://github.com/happy520ai/unified-ai-system/issues/new?template=protocol-client-report.yml)
to turn a candidate client into a reproducible matrix entry. Never include
tokens, provider keys, private prompts, or private endpoint names.

The repository does not claim every global client, full OpenAI API parity,
production readiness, L5 autonomy, or AGI.

## Runtime Certification

Protocol compatibility proves the wire contract.
Client certification requires a concrete run report for each client and environment.

- Source protocol checks are available through:
  - `pnpm verify:mcp` (MCP stdio + Streamable HTTP and cleanup)
  - `pnpm verify:public-clone` (OpenAI-compatible + A2A official SDK examples)
- Mainstream client certification uses:
  - `pnpm exec node tools/verify-client-runtimes.mjs --client automated` (Automated checks + stored evidence)
  - Issue-based manual report path for environments where a client is not automatable here

See the global registry and evidence workflow:
[`docs/client-runtime-certification.md`](client-runtime-certification.md).
