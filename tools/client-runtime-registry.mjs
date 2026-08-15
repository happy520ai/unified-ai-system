import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

export const clientRuntimeCatalog = [
  {
    id: "mcp-official",
    name: "Official MCP Node SDK (@modelcontextprotocol/client)",
    protocol: "MCP",
    transport: "stdio + streamable-http",
    mode: "automated",
    tags: ["mcp", "core", "official", "official-client", "mainstream"],
    command: "node tools/mcp-smoke.mjs --json",
    evidenceNotes:
      "Protocol smoke via official MCP client over stdio + streamable HTTP.",
  },
  {
    id: "mcp-node-sdk",
    name: "Official MCP Node SDK runtime profile",
    protocol: "MCP",
    transport: "stdio",
    mode: "automated",
    tags: ["mcp", "official", "official-client", "language:javascript", "mainstream"],
    command: "node docs/examples/client-runtime-smoke.mjs --client=mcp-node-sdk",
    evidenceNotes:
      "Real @modelcontextprotocol/sdk Client + StdioClientTransport tool discovery and gateway_health call.",
  },
  {
    id: "openai-node",
    name: "OpenAI JS SDK",
    protocol: "OpenAI-compatible",
    transport: "HTTP /v1",
    mode: "automated",
    tags: ["openai", "openai-compatible", "official", "language:js", "mainstream"],
    command: "node docs/examples/openai-sdk-chat.mjs",
    evidenceNotes:
      "Text Chat, legacy completions, responses, and streaming profile checks.",
  },
  {
    id: "openai-wire",
    name: "OpenAI wire-alias route matrix",
    protocol: "OpenAI-compatible",
    transport: "HTTP aliases (/v1, root, /openai/deployments, /v1/engines)",
    mode: "automated",
    tags: ["openai", "openai-compatible", "wire", "route-matrix", "mainstream"],
    command: "node docs/examples/openai-wire-smoke.mjs",
    evidenceNotes: "Route normalization and stream/event compatibility smoke checks.",
  },
  {
    id: "openai-python",
    name: "OpenAI Python SDK",
    protocol: "OpenAI-compatible",
    transport: "HTTP /v1",
    mode: "automated",
    tags: ["openai", "openai-compatible", "language:python", "official", "mainstream"],
    command: "py -3 docs/examples/openai-sdk-chat.py",
    evidenceNotes:
      "Text Chat, Responses, legacy completions, and streaming profile checks.",
  },
  {
    id: "a2a-official",
    name: "A2A JS SDK",
    protocol: "A2A",
    transport: "HTTP JSON-RPC",
    mode: "automated",
    tags: ["a2a", "official", "official-client", "mainstream"],
    command: "node docs/examples/a2a-sdk-client.mjs",
    evidenceNotes: "Agent Card discover, SendMessage/GetTask/ListTasks smoke checks.",
  },
  {
    id: "shared-sdk",
    name: "Unified shared SDK prompt enhancement",
    protocol: "Unified SDK",
    transport: "SDK over HTTP",
    mode: "automated",
    tags: ["shared", "gateway-sdk", "local", "mainstream"],
    command: "node docs/examples/shared-sdk-prompt-enhancement.mjs",
    evidenceNotes: "Deterministic local prompt enhancement with local provider metadata.",
  },
  {
    id: "http-native",
    name: "Native HTTP/Fetch smoke profile",
    protocol: "Public HTTP",
    transport: "REST + SSE-capable endpoints",
    mode: "automated",
    tags: ["http", "native", "generic", "mainstream"],
    command: "native HTTP smoke profile (health + /v1/models + /chat)",
    evidenceNotes:
      "Health, model discovery, and /chat provider-mode sanity checks using plain HTTP.",
  },
  {
    id: "openai-go",
    name: "OpenAI Go SDK / native HTTP",
    protocol: "OpenAI-compatible",
    transport: "HTTP /v1 + aliases + /openai/deployments + /v1/engines",
    mode: "automated",
    tags: ["openai", "openai-compatible", "language:go", "standard-library", "mainstream"],
    command: "go run docs/examples/openai-go-chat.go --base-url <url>",
    evidenceNotes: "OpenAI route compatibility and stream checks in Go stdlib profile.",
  },
  {
    id: "openai-java",
    name: "OpenAI Java SDK (manual)",
    protocol: "OpenAI-compatible",
    transport: "HTTP /v1 + /openai/deployments",
    mode: "manual",
    tags: ["openai", "openai-compatible", "language:java", "mainstream"],
    command: "openai-java local sample against /v1",
    evidenceNotes:
      "Run a local Java chat/completions sample and attach command and request/response proof.",
  },
  {
    id: "openai-azure-style",
    name: "Azure-style OpenAI path profile",
    protocol: "OpenAI-compatible",
    transport: "HTTP /openai/deployments",
    mode: "manual",
    tags: ["openai", "openai-compatible", "azure", "route-compatibility", "mainstream"],
    command: "client using deployment route aliases",
    evidenceNotes:
      "Validate deployment routing and local metadata behavior for that client runtime.",
  },
  {
    id: "openai-langchain",
    name: "LangChain wrapper profile",
    protocol: "OpenAI-compatible",
    transport: "HTTP /v1 + /chat/completions aliases",
    mode: "automated",
    tags: ["openai", "openai-compatible", "language:js", "framework:langchain", "mainstream"],
    command: "node docs/examples/client-runtime-smoke.mjs --client=openai-langchain",
    evidenceNotes:
      "Record wrapper runtime behavior with wrapper-generated model list/chat calls and metadata.",
  },
  {
    id: "codex-mcp",
    name: "Codex MCP",
    protocol: "MCP",
    transport: "stdio",
    mode: "automated",
    tags: ["mcp", "codex", "agent-host", "mainstream"],
    command: "node docs/examples/client-runtime-smoke.mjs --client=codex-mcp",
    evidenceNotes:
      "Run the official Codex App Server, discover MCP tools, call prompt enhancement, and prove managed-gateway cleanup without a model turn.",
  },
  {
    id: "mcp-claude-code",
    name: "Claude Code MCP host",
    protocol: "MCP",
    transport: "stdio",
    mode: "automated",
    tags: ["mcp", "anthropic", "agent-host", "cli-host", "official", "mainstream"],
    command: "node docs/examples/client-runtime-smoke.mjs --client=mcp-claude-code",
    evidenceNotes:
      "Run the official Claude Code CLI in an isolated home, add the gateway through its MCP command, and record handshake plus 12-tool discovery without a model request.",
  },
  {
    id: "mcp-gemini-cli",
    name: "Gemini CLI MCP host",
    protocol: "MCP",
    transport: "stdio",
    mode: "automated",
    tags: ["mcp", "google", "agent-host", "cli-host", "official", "mainstream"],
    command: "node docs/examples/client-runtime-smoke.mjs --client=mcp-gemini-cli",
    evidenceNotes:
      "Run the official Gemini CLI in an isolated trusted workspace, add the gateway through its MCP command, and record handshake plus 12-tool discovery without a model request.",
  },
  {
    id: "mcp-opencode-cli",
    name: "OpenCode CLI MCP host",
    protocol: "MCP",
    transport: "stdio",
    mode: "automated",
    tags: ["mcp", "opencode", "agent-host", "cli-host", "official", "mainstream"],
    command: "node docs/examples/client-runtime-smoke.mjs --client=mcp-opencode-cli",
    evidenceNotes:
      "Run the official OpenCode CLI with an isolated inline MCP configuration, and record handshake plus 12-tool discovery without plugins or a model request.",
  },
  {
    id: "cursor-mcp",
    name: "Cursor Agent CLI MCP host",
    protocol: "MCP",
    transport: "stdio",
    mode: "automated",
    tags: ["mcp", "cursor", "agent-host", "cli-host", "official", "mainstream"],
    command: "node docs/examples/client-runtime-smoke.mjs --client=cursor-mcp",
    evidenceNotes:
      "Run the official Cursor Agent CLI in an isolated workspace, load the gateway from .cursor/mcp.json, and record handshake plus 12-tool discovery through mcp list-tools without account credentials or a model request.",
  },
  {
    id: "cline-mcp",
    name: "Cline CLI MCP host",
    protocol: "MCP",
    transport: "stdio",
    mode: "automated",
    tags: ["mcp", "cline", "agent-host", "cli-host", "official", "mainstream"],
    command: "node docs/examples/client-runtime-smoke.mjs --client=cline-mcp",
    evidenceNotes:
      "Run the official Cline CLI in an isolated data directory with only the local fake OpenAI-compatible model, discover all 12 tools, and invoke only read-only gateway_health; no real provider is enabled or called.",
  },
  {
    id: "openai-python-root-alias",
    name: "OpenAI Python SDK (root aliases)",
    protocol: "OpenAI-compatible",
    transport: "HTTP /chat/completions /responses aliases",
    mode: "automated",
    tags: ["openai", "openai-compatible", "language:python", "alias-route", "mainstream"],
    command: "python docs/examples/client-runtime-smoke.py --client=openai-python-root-alias --base-url <url>",
    evidenceNotes:
      "Some wrappers resolve /chat and /responses without /v1 path prefix; capture evidence if present.",
  },
  {
    id: "openai-litellm",
    name: "LiteLLM OpenAI-compatible profile",
    protocol: "OpenAI-compatible",
    transport: "HTTP /v1 + /responses aliases",
    mode: "automated",
    tags: ["openai", "openai-compatible", "language:python", "framework:litellm", "gateway-wrapper", "mainstream"],
    command: "python docs/examples/client-runtime-smoke.py --client=openai-litellm --base-url <url>",
    evidenceNotes:
      "Run LiteLLM request path smoke against local /v1 endpoints and include request/response proof.",
  },
  {
    id: "openai-autogen",
    name: "Microsoft AutoGen (OpenAI profile)",
    protocol: "OpenAI-compatible",
    transport: "HTTP /v1 + /chat/completions",
    mode: "automated",
    tags: ["openai", "openai-compatible", "language:python", "framework:autogen", "gateway-wrapper", "mainstream"],
    command: "python docs/examples/client-runtime-smoke.py --client=openai-autogen --base-url <url>",
    evidenceNotes:
      "Run a minimal AutoGen chat plan and keep command + sanitized run output proving compatibility.",
  },
  {
    id: "openai-agents-python",
    name: "OpenAI Agents SDK (Python)",
    protocol: "OpenAI-compatible",
    transport: "HTTP /v1 + /chat/completions",
    mode: "automated",
    tags: ["openai", "openai-compatible", "language:python", "framework:openai-agents", "gateway-wrapper", "mainstream"],
    command: "python docs/examples/client-runtime-smoke.py --client=openai-agents-python --base-url <url>",
    evidenceNotes:
      "Run one tracing-disabled agent turn through the local fake provider and verify the final output.",
  },
  {
    id: "openai-agents-js",
    name: "OpenAI Agents SDK (JavaScript)",
    protocol: "OpenAI-compatible",
    transport: "HTTP /v1 + /chat/completions",
    mode: "automated",
    tags: ["openai", "openai-compatible", "language:javascript", "framework:openai-agents", "gateway-wrapper", "mainstream"],
    command: "node docs/examples/client-runtime-smoke.mjs --client=openai-agents-js",
    evidenceNotes:
      "Run one tracing-disabled JavaScript agent turn through the local fake provider and verify the final output.",
  },
  {
    id: "openai-llamaindex-js",
    name: "LlamaIndex JS OpenAI wrapper",
    protocol: "OpenAI-compatible",
    transport: "HTTP /v1 + /models",
    mode: "automated",
    tags: ["openai", "openai-compatible", "language:js", "framework:llamaindex", "gateway-wrapper", "mainstream"],
    command: "node docs/examples/client-runtime-smoke.mjs --client=openai-llamaindex-js",
    evidenceNotes:
      "Record model listing and chat completion trace from a minimal LlamaIndex workflow.",
  },
  {
    id: "openai-llamaindex-python",
    name: "LlamaIndex Python OpenAI wrapper",
    protocol: "OpenAI-compatible",
    transport: "HTTP /v1 + /models",
    mode: "automated",
    tags: ["openai", "openai-compatible", "language:python", "framework:llamaindex", "gateway-wrapper", "mainstream"],
    command: "python docs/examples/client-runtime-smoke.py --client=openai-llamaindex-python --base-url <url>",
    evidenceNotes:
      "Record model listing and chat completion output from LlamaIndex local sample.",
  },
  {
    id: "openai-langgraph",
    name: "LangGraph OpenAI compatibility profile",
    protocol: "OpenAI-compatible",
    transport: "HTTP /v1 + /chat/completions + /responses",
    mode: "automated",
    tags: ["openai", "openai-compatible", "language:python", "framework:langgraph", "gateway-wrapper", "mainstream"],
    command: "python docs/examples/client-runtime-smoke.py --client=openai-langgraph --base-url <url>",
    evidenceNotes:
      "Run a minimal graph node run and verify model/chat route behavior and fake execution metadata.",
  },
  {
    id: "openai-ollama-openai",
    name: "Ollama OpenAI-compatible proxy profile",
    protocol: "OpenAI-compatible",
    transport: "HTTP /v1 + /v1/models + /v1/completions",
    mode: "manual",
    tags: ["openai", "openai-compatible", "language:go", "language:python", "runtime:proxy", "route-compatibility", "mainstream"],
    command: "Ollama client configured for OpenAI-compatible base path",
    evidenceNotes:
      "Validate that OpenAI-compatible proxy clients and route aliases used by Ollama wrappers are compatible.",
  },
  {
    id: "openai-vllm-openai",
    name: "vLLM OpenAI-compatible profile",
    protocol: "OpenAI-compatible",
    transport: "HTTP /v1 + /openai/deployments + /v1/engines",
    mode: "manual",
    tags: ["openai", "openai-compatible", "language:python", "runtime:proxy", "route-compatibility", "mainstream"],
    command: "vLLM-compatible OpenAI client sample against local /v1",
    evidenceNotes:
      "Run a representative vLLM OpenAI-compatible request path and retain sanitized outputs.",
  },
  {
    id: "openai-rust",
    name: "OpenAI Rust SDK",
    protocol: "OpenAI-compatible",
    transport: "HTTP /v1 + /v1/engines legacy",
    mode: "manual",
    tags: ["openai", "openai-compatible", "language:rust", "legacy-routes", "mainstream"],
    command: "Rust SDK sample against local /v1",
    evidenceNotes:
      "Run local Rust async-openai-like sample and attach model/chat output and route behavior.",
  },
  {
    id: "openai-dotnet",
    name: "OpenAI .NET SDK",
    protocol: "OpenAI-compatible",
    transport: "HTTP /v1 + wrappers",
    mode: "automated",
    tags: ["openai", "openai-compatible", "language:dotnet", "mainstream"],
    command: "dotnet run --project docs/examples/dotnet-openai-sdk/dotnet-openai-sdk.csproj -- --base-url <url>",
    evidenceNotes:
      "Run a local .NET chat sample and retain command/output proving route compatibility.",
  },
  {
    id: "openai-php",
    name: "OpenAI PHP SDK",
    protocol: "OpenAI-compatible",
    transport: "HTTP /v1 + /models + /chat/completions",
    mode: "manual",
    tags: ["openai", "openai-compatible", "language:php", "mainstream"],
    command: "openai-php/client sample against local gateway",
    evidenceNotes:
      "Run local list-models + chat sample and attach sanitized request/response evidence.",
  },
  {
    id: "openai-ruby",
    name: "OpenAI Ruby SDK",
    protocol: "OpenAI-compatible",
    transport: "HTTP /v1 + wrappers",
    mode: "manual",
    tags: ["openai", "openai-compatible", "language:ruby", "mainstream"],
    command: "ruby-openai sample against local gateway",
    evidenceNotes:
      "Run local ruby-openai sample and capture minimal output proving mode compatibility.",
  },
  {
    id: "openai-kotlin",
    name: "OpenAI Kotlin SDK",
    protocol: "OpenAI-compatible",
    transport: "HTTP /v1 + SSE",
    mode: "manual",
    tags: ["openai", "openai-compatible", "language:kotlin", "mainstream"],
    command: "aallam/openai-kotlin-client sample against local gateway",
    evidenceNotes:
      "Run local Kotlin sample and attach list model/chat stream outputs and metadata.",
  },
  {
    id: "openai-swift",
    name: "OpenAI Swift SDK",
    protocol: "OpenAI-compatible",
    transport: "HTTP /v1 + wrappers",
    mode: "manual",
    tags: ["openai", "openai-compatible", "language:swift", "mainstream"],
    command: "Swift OpenAI client sample against local gateway",
    evidenceNotes:
      "Run local Swift sample and include command + minimal output proving response metadata.",
  },
  {
    id: "openai-elixir",
    name: "OpenAI Elixir SDK",
    protocol: "OpenAI-compatible",
    transport: "HTTP /v1 + wrappers",
    mode: "manual",
    tags: ["openai", "openai-compatible", "language:elixir", "mainstream"],
    command: "elixir openai client sample against local gateway",
    evidenceNotes:
      "Run local Elixir sample and provide minimal evidence of model/chat behavior.",
  },
  {
    id: "mcp-generic-stdio",
    name: "Generic MCP stdio host",
    protocol: "MCP",
    transport: "stdio",
    mode: "manual",
    tags: ["mcp", "agent-host", "generic", "mainstream"],
    command: "generic MCP stdio host with unified-ai-system server",
    evidenceNotes:
      "Use your preferred MCP stdio host config and attach tool list/readiness evidence.",
  },
  {
    id: "mcp-generic-streamable",
    name: "Generic MCP Streamable HTTP host",
    protocol: "MCP",
    transport: "streamable-http",
    mode: "manual",
    tags: ["mcp", "agent-host", "generic", "streamable-http", "mainstream"],
    command: "generic MCP Streamable HTTP host against /mcp endpoint",
    evidenceNotes:
      "Use your preferred streamable HTTP MCP host and attach 12-tool + readiness proof.",
  },
  {
    id: "mcp-claude-desktop",
    name: "Claude Desktop MCP host",
    protocol: "MCP",
    transport: "stdio",
    mode: "manual",
    tags: ["mcp", "agent-host", "anthropic", "desktop", "gui-host", "mainstream"],
    command: "Claude desktop MCP host with unified-ai-system server",
    evidenceNotes:
      "Run Claude Desktop MCP command discovery and tool list/readiness checks with your local configuration.",
  },
  {
    id: "mcp-rider-code",
    name: "Roo Code MCP host",
    protocol: "MCP",
    transport: "stdio",
    mode: "manual",
    tags: ["mcp", "agent-host", "coding-assistant", "stdio", "mainstream"],
    command: "Roo Code MCP host with unified-ai-system server",
    evidenceNotes: "Run Roo Code MCP host startup and tool read/write discovery.",
  },
  {
    id: "mcp-windsurf",
    name: "Windsurf (Codeium) MCP host",
    protocol: "MCP",
    transport: "stdio",
    mode: "manual",
    tags: ["mcp", "agent-host", "code-editor", "codeium", "stdio", "mainstream"],
    command: "Windsurf MCP host with unified-ai-system server",
    evidenceNotes:
      "Run the Windsurf MCP integration flow and capture tool availability/readiness proof.",
  },
  {
    id: "mcp-continue",
    name: "Continue CLI MCP host",
    protocol: "MCP",
    transport: "stdio",
    mode: "automated",
    tags: ["mcp", "continue", "agent-host", "cli-host", "coding-assistant", "official", "stdio", "mainstream"],
    command: "node docs/examples/client-runtime-smoke.mjs --client=mcp-continue",
    evidenceNotes:
      "Run the official Continue CLI with an isolated local configuration and fake OpenAI-compatible model, discover all 12 tools, and invoke only read-only gateway_health; no real provider is enabled or called.",
  },
  {
    id: "mcp-chatgpt-desktop",
    name: "ChatGPT Desktop MCP host",
    protocol: "MCP",
    transport: "stdio",
    mode: "manual",
    tags: ["mcp", "agent-host", "gui-host", "desktop", "mainstream"],
    command: "ChatGPT desktop MCP host (if exposed) with unified-ai-system server",
    evidenceNotes:
      "Run client startup and confirm MCP host-level readiness + tool list is discoverable.",
  },
  {
    id: "a2a-python",
    name: "A2A Python SDK",
    protocol: "A2A",
    transport: "HTTP JSON-RPC",
    mode: "automated",
    tags: ["a2a", "a2a-sdk", "language:python", "framework:a2a", "mainstream"],
    command: "python docs/examples/client-runtime-smoke.py --client=a2a-python --base-url <url>",
    evidenceNotes:
      "Run agent-card discovery and basic JSON-RPC ops (SendMessage/GetTask/ListTasks) with sanitized output.",
  },
  {
    id: "a2a-java",
    name: "A2A Java SDK (or wrapper)",
    protocol: "A2A",
    transport: "HTTP JSON-RPC",
    mode: "manual",
    tags: ["a2a", "a2a-sdk", "language:java", "framework:a2a", "mainstream"],
    command: "Java A2A sample against /.well-known/agent-card.json and /a2a/jsonrpc",
    evidenceNotes:
      "Run discovery and task lifecycle probe in Java environment and capture evidence output.",
  },
  {
    id: "openai-vercel-ai-sdk",
    name: "Vercel AI SDK openai provider",
    protocol: "OpenAI-compatible",
    transport: "HTTP /v1 + streaming APIs",
    mode: "automated",
    tags: ["openai", "openai-compatible", "language:javascript", "framework:vercel-ai", "gateway-wrapper", "mainstream"],
    command: "node docs/examples/client-runtime-smoke.mjs --client=openai-vercel-ai-sdk",
    evidenceNotes:
      "Run Vercel AI SDK stream/chat sample and capture model list, tool output, and execution mode.",
  },
  {
    id: "openai-pydantic-ai",
    name: "PydanticAI OpenAI-compatible profile",
    protocol: "OpenAI-compatible",
    transport: "HTTP /v1 + /chat/completions",
    mode: "automated",
    tags: ["openai", "openai-compatible", "language:python", "framework:pydanticai", "gateway-wrapper", "mainstream"],
    command: "python docs/examples/client-runtime-smoke.py --client=openai-pydantic-ai --base-url <url>",
    evidenceNotes:
      "Run a minimal PydanticAI chat sample and validate request/response compatibility.",
  },
  {
    id: "openai-crewai",
    name: "CrewAI OpenAI-compatible profile",
    protocol: "OpenAI-compatible",
    transport: "HTTP /v1 + /chat/completions",
    mode: "automated",
    tags: ["openai", "openai-compatible", "language:python", "framework:crew-ai", "agent-orchestration", "gateway-wrapper", "mainstream"],
    command: "python docs/examples/client-runtime-smoke.py --client=openai-crewai --base-url <url>",
    evidenceNotes:
      "Run a minimal CrewAI crew against the local fake provider with telemetry disabled and verify task output.",
  },
  {
    id: "openai-semantic-kernel",
    name: "Microsoft Semantic Kernel OpenAI profile",
    protocol: "OpenAI-compatible",
    transport: "HTTP /v1 + /chat/completions",
    mode: "automated",
    tags: ["openai", "openai-compatible", "language:python", "framework:semantic-kernel", "gateway-wrapper", "mainstream"],
    command: "python docs/examples/client-runtime-smoke.py --client=openai-semantic-kernel --base-url <url>",
    evidenceNotes:
      "Run a minimal Semantic Kernel Python sample and capture chat completion compatibility.",
  },
  {
    id: "openai-openrouter",
    name: "OpenRouter-style OpenAI-compatible profile",
    protocol: "OpenAI-compatible",
    transport: "HTTP /v1 + /models + /responses",
    mode: "manual",
    tags: ["openai", "openai-compatible", "language:javascript", "language:python", "gateway-wrapper", "route-compatibility", "mainstream"],
    command: "OpenRouter-compatible /v1 client sample against local gateway",
    evidenceNotes:
      "Validate that OpenAI-compatible local routing via /v1 works for OpenRouter-style clients.",
  },
  {
    id: "a2a-go",
    name: "A2A Go SDK",
    protocol: "A2A",
    transport: "HTTP JSON-RPC",
    mode: "manual",
    tags: ["a2a", "a2a-sdk", "language:go", "protocol:a2a", "mainstream"],
    command: "Go A2A sample against /.well-known/agent-card.json and /a2a/jsonrpc",
    evidenceNotes:
      "Run Agent Card discovery and JSON-RPC task lifecycle checks in Go.",
  },
  {
    id: "a2a-dotnet",
    name: "A2A .NET SDK",
    protocol: "A2A",
    transport: "HTTP JSON-RPC",
    mode: "manual",
    tags: ["a2a", "a2a-sdk", "language:dotnet", "protocol:a2a", "mainstream"],
    command: ".NET A2A sample against /.well-known/agent-card.json and /a2a/jsonrpc",
    evidenceNotes:
      "Run discovery and Send/Get/List task flow in .NET and attach sanitized proof.",
  },
];

function normalizeCatalogPath(rawPath) {
  if (!rawPath || typeof rawPath !== "string") return null;
  return resolve(process.cwd(), rawPath.trim());
}

function normalizeCatalogUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const url = rawUrl.trim();
  if (!url) return null;
  try {
    new URL(url);
    return url;
  } catch {
    return null;
  }
}

function parseCatalogPathList(rawPathValue) {
  if (!rawPathValue) return [];
  return String(rawPathValue)
    .split(/[;,]/)
    .map((candidate) => (typeof candidate === "string" ? candidate.trim() : ""))
    .filter(Boolean);
}

function parseCatalogUrlList(rawUrlValue) {
  if (!rawUrlValue) return [];
  return String(rawUrlValue)
    .split(/[;,]/)
    .map((candidate) => normalizeCatalogUrl(candidate))
    .filter(Boolean);
}

function readClientRuntimeCatalogFile(filePath) {
  const absolutePath = normalizeCatalogPath(filePath);
  if (!absolutePath) return [];
  if (!existsSync(absolutePath)) {
    throw new Error(`Custom client runtime catalog does not exist: ${absolutePath}`);
  }
  if (!statSync(absolutePath).isFile()) {
    throw new Error(`Custom client runtime catalog path must be a file: ${absolutePath}`);
  }

  const content = readFileSync(absolutePath, "utf8");
  const normalizedContent = content.charCodeAt(0) === 0xFEFF
    ? content.slice(1)
    : content;
  let parsed;
  try {
    parsed = JSON.parse(normalizedContent);
  } catch (error) {
    throw new Error(
      `Custom client runtime catalog JSON parse failed: ${absolutePath}: ${error?.message ?? error}`,
    );
  }

  const clients = parseClientEntriesFromPayload(parsed);
  return clients.map((entry) => ({ ...entry, source: "custom", sourcePath: absolutePath }));
}

function readClientRuntimeCatalogDirectory(directoryPath) {
  const absolutePath = normalizeCatalogPath(directoryPath);
  if (!absolutePath) return [];
  if (!existsSync(absolutePath)) {
    throw new Error(`Custom client runtime catalog directory does not exist: ${absolutePath}`);
  }
  if (!statSync(absolutePath).isDirectory()) {
    throw new Error(`Custom client runtime catalog path must be a directory: ${absolutePath}`);
  }

  const collectCatalogFiles = (currentPath) => {
    const entries = readdirSync(currentPath, { withFileTypes: true });
    return entries.flatMap((entry) => {
      const candidate = resolve(currentPath, entry.name);
      if (entry.isDirectory()) {
        return collectCatalogFiles(candidate);
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
        return [candidate];
      }
      return [];
    });
  };

  const files = collectCatalogFiles(absolutePath).sort();
  if (!files.length) {
    throw new Error(`Custom client runtime catalog directory is empty: ${absolutePath}`);
  }
  return files.flatMap((file) => readClientRuntimeCatalogFile(file));
}

async function readClientRuntimeCatalogRemote(rawUrl) {
  const absoluteUrl = normalizeCatalogUrl(rawUrl);
  if (!absoluteUrl) {
    throw new Error(`Custom client runtime catalog URL is not valid: ${rawUrl}`);
  }

  let response;
  try {
    response = await fetch(absoluteUrl);
  } catch (error) {
    throw new Error(`Failed to fetch custom catalog URL ${absoluteUrl}: ${error?.message ?? error}`);
  }
  if (!response.ok) {
    throw new Error(
      `Custom client runtime catalog URL returned ${response.status} ${response.statusText}: ${absoluteUrl}`,
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error(`Custom client runtime catalog URL is not valid JSON: ${absoluteUrl}: ${error?.message ?? error}`);
  }

  const clients = parseClientEntriesFromPayload(payload);
  return clients.map((entry) => ({ ...entry, source: "remote", sourcePath: absoluteUrl }));
}

function normalizeClientEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!id) return null;
  const tags = Array.isArray(raw.tags)
    ? [...raw.tags]
        .filter((value) => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];
  return {
    ...raw,
    id,
    name: typeof raw.name === "string" ? raw.name.trim() : id,
    protocol: typeof raw.protocol === "string" ? raw.protocol.trim() : "Unknown",
    transport: typeof raw.transport === "string" ? raw.transport.trim() : "Unknown",
    mode: raw.mode === "automated" ? "automated" : "manual",
    tags,
    command: typeof raw.command === "string" ? raw.command.trim() : `Manual check for ${id}`,
    evidenceNotes: typeof raw.evidenceNotes === "string"
      ? raw.evidenceNotes.trim()
      : typeof raw.notes === "string"
        ? raw.notes.trim()
        : "Manual evidence report required.",
    source: raw.source ?? "builtin",
  };
}

function parseClientEntriesFromPayload(payload) {
  if (Array.isArray(payload)) {
    return payload.map(normalizeClientEntry).filter(Boolean);
  }
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.clients)) {
      return payload.clients.map(normalizeClientEntry).filter(Boolean);
    }
    if (Array.isArray(payload.clientRuntimeCatalog)) {
      return payload.clientRuntimeCatalog.map(normalizeClientEntry).filter(Boolean);
    }
    return Object.entries(payload)
      .map(([key, value]) => {
        if (!value || typeof value !== "object") return null;
        return normalizeClientEntry({ ...value, id: value.id ?? key });
      })
      .filter(Boolean);
  }
  return [];
}

function collectDefaultCatalogDirectories() {
  const defaultDirectory = resolve(process.cwd(), "docs", "client-runtime-catalog.d");
  if (existsSync(defaultDirectory) && statSync(defaultDirectory).isDirectory()) {
    return [defaultDirectory];
  }
  return [];
}

export async function loadClientRuntimeCatalog(
  customCatalogPath = null,
  customCatalogDirectoryPath = null,
  customCatalogUrlValue = null,
) {
  const merged = new Map();
  const customPathList = [
    ...parseCatalogPathList(customCatalogPath),
    ...parseCatalogPathList(process.env.CLIENT_RUNTIME_CATALOG_PATH),
  ];
  const customDirectoryList = [
    ...parseCatalogPathList(customCatalogDirectoryPath),
    ...collectDefaultCatalogDirectories(),
    ...parseCatalogPathList(process.env.CLIENT_RUNTIME_CATALOG_DIR),
  ];
  const customUrlList = [
    ...parseCatalogUrlList(customCatalogUrlValue),
    ...parseCatalogUrlList(process.env.CLIENT_RUNTIME_CATALOG_URL),
    ...parseCatalogUrlList(process.env.CLIENT_RUNTIME_CATALOG_URLS),
  ];

  for (const client of clientRuntimeCatalog.map(normalizeClientEntry).filter(Boolean)) {
    merged.set(client.id, client);
  }
  for (const catalogPath of customPathList) {
    for (const client of readClientRuntimeCatalogFile(catalogPath)) {
      merged.set(client.id, { ...merged.get(client.id), ...client });
    }
  }
  for (const catalogDirectory of customDirectoryList) {
    for (const client of readClientRuntimeCatalogDirectory(catalogDirectory)) {
      merged.set(client.id, { ...merged.get(client.id), ...client });
    }
  }
  for (const catalogUrl of customUrlList) {
    for (const client of await readClientRuntimeCatalogRemote(catalogUrl)) {
      merged.set(client.id, { ...merged.get(client.id), ...client });
    }
  }

  return [...merged.values()];
}

export function getClientDefinition(id, catalog = clientRuntimeCatalog) {
  const clientId = typeof id === "string" ? id.trim() : id;
  if (!clientId) return null;
  return catalog.find((client) => client.id === clientId) || null;
}
