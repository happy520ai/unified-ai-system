#!/usr/bin/env node

import { createServer } from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clientRuntimeCatalog as builtinClientRuntimeCatalog,
  getClientDefinition as getClientDefinitionFromCatalog,
  loadClientRuntimeCatalog,
} from "./client-runtime-registry.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serviceRoot = resolve(repoRoot, "apps/ai-gateway-service");
const serviceEntrypoint = resolve(serviceRoot, "src/index.js");
const mcpSmokeEntrypoint = resolve(repoRoot, "tools", "mcp-smoke.mjs");
const openAiNodeEntrypoint = resolve(
  repoRoot,
  "docs/examples/openai-sdk-chat.mjs",
);
const sharedSdkPromptEntrypoint = resolve(
  repoRoot,
  "docs/examples/shared-sdk-prompt-enhancement.mjs",
);
const openAiPythonEntrypoint = resolve(
  repoRoot,
  "docs/examples/openai-sdk-chat.py",
);
const optionalPythonRuntimeEntrypoint = resolve(
  repoRoot,
  "docs/examples/client-runtime-smoke.py",
);
const javaHttpEntrypoint = resolve(repoRoot, "docs/examples/java-http-smoke.java");
const dotnetHttpProject = resolve(
  repoRoot,
  "docs/examples/dotnet-http-smoke/dotnet-http-smoke.csproj",
);
const dotnetOpenAiProject = resolve(
  repoRoot,
  "docs/examples/dotnet-openai-sdk/dotnet-openai-sdk.csproj",
);
const openAiGoEntrypoint = resolve(
  repoRoot,
  "docs/examples/openai-go-chat.go",
);
const openAiWireEntrypoint = resolve(
  repoRoot,
  "docs/examples/openai-wire-smoke.mjs",
);
const a2aJsEntrypoint = resolve(repoRoot, "docs/examples/a2a-sdk-client.mjs");
const optionalNodeRuntimeEntrypoint = resolve(
  repoRoot,
  "docs/examples/client-runtime-smoke.mjs",
);
const powershellHttpEntrypoint = resolve(
  repoRoot,
  "docs/examples/powershell-http-smoke.ps1",
);
const evidenceDirectory = resolve(
  repoRoot,
  "apps/ai-gateway-service/evidence/client-runtime-verifications",
);
let clientRuntimeCatalog = [...builtinClientRuntimeCatalog];
let allKnownClientIds = clientRuntimeCatalog.map((client) => client.id);
let automatedClientIds = new Set();
let manualClientIds = new Set();
let mainstreamClientIds = new Set();
const verifiedManualStates = new Set(["verified", "pass", "passed"]);
const rejectedManualStates = new Set(["failed", "fail", "rejected", "blocked"]);
const pendingManualStates = new Set(["manual", "pending", "todo", "review"]);
const fakeProviderIds = new Set(["local-fake-provider", "backup-fake-provider"]);
const sensitiveEnvironmentNamePattern = /(?:^|_)(?:api_?key|token|secret|password|credentials?|authorization)(?:$|_)/i;

function createCredentialFreeEnvironment(baseEnvironment = {}, overrides = {}) {
  const environment = { ...baseEnvironment, ...overrides };
  for (const key of Object.keys(environment)) {
    const safeCredentialStoreMode = key === "PME_RUNTIME_CREDENTIAL_STORE_MODE"
      && environment[key] === "memory";
    if (sensitiveEnvironmentNamePattern.test(key) && !safeCredentialStoreMode) {
      delete environment[key];
    }
  }
  return environment;
}

async function updateClientCatalog(customCatalogPath, customCatalogDirectoryPath = null, customCatalogUrlValue = null) {
  clientRuntimeCatalog = await loadClientRuntimeCatalog(
    customCatalogPath,
    customCatalogDirectoryPath,
    customCatalogUrlValue,
  );
  allKnownClientIds = clientRuntimeCatalog.map((client) => client.id);
  automatedClientIds = new Set(
    clientRuntimeCatalog
      .filter((client) => client.mode === "automated")
      .map((client) => client.id),
  );
  manualClientIds = new Set(
    clientRuntimeCatalog.filter((client) => client.mode === "manual").map((client) => client.id),
  );
  mainstreamClientIds = new Set(
    clientRuntimeCatalog.filter((client) => client.tags?.includes("mainstream")).map((client) => client.id),
  );
}

function getClientDefinition(clientId) {
  return getClientDefinitionFromCatalog(clientId, clientRuntimeCatalog);
}

const profileSelectors = {
  openai: (clientId) => getClientDefinition(clientId)?.tags?.includes("openai") ?? false,
  mcp: (clientId) => getClientDefinition(clientId)?.tags?.includes("mcp") ?? false,
  a2a: (clientId) => getClientDefinition(clientId)?.tags?.includes("a2a") ?? false,
  http: (clientId) => getClientDefinition(clientId)?.tags?.includes("http") ?? false,
  shared: (clientId) => getClientDefinition(clientId)?.tags?.includes("shared") ?? false,
  manual: (clientId) => manualClientIds.has(clientId),
  mainstream: (clientId) => mainstreamClientIds.has(clientId),
  automated: (clientId) => automatedClientIds.has(clientId),
  all: () => true,
};

function hasTag(clientId, tagValue) {
  if (!tagValue) return false;
  const definition = getClientDefinition(clientId);
  return (definition?.tags ?? []).some((tag) => matchesClientPattern(tag, tagValue));
}

function protocolMatches(clientId, protocolName) {
  const definition = getClientDefinition(clientId);
  if (!definition?.protocol || !protocolName) return false;
  return matchesClientPattern(definition.protocol, protocolName);
}

function transportMatches(clientId, transportValue) {
  const definition = getClientDefinition(clientId);
  if (!definition?.transport || !transportValue) return false;
  return matchesClientPattern(definition.transport, transportValue, { mode: "contains" });
}

function nameMatches(clientId, namePattern) {
  if (!namePattern) return false;
  const definition = getClientDefinition(clientId);
  if (!definition?.name) return false;
  return matchesClientPattern(definition.name, namePattern, { mode: "contains" });
}

function escapeGlob(value) {
  return escapeRegex(String(value).toLowerCase());
}

function matchesClientPattern(candidate, rawPattern, options = {}) {
  const mode = options.mode ?? "exact";
  const pattern = String(rawPattern).toLowerCase();
  const value = String(candidate ?? "").toLowerCase();
  if (!pattern) return false;
  if (!pattern.includes("*")) {
    if (mode === "contains") {
      return value.includes(pattern);
    }
    return value === pattern;
  }
  const safePattern = pattern
    .split("*")
    .map(escapeGlob)
    .join(".*");
  return new RegExp(`^${safePattern}$`, "i").test(value);
}

function printUsage() {
  const clientList = [...allKnownClientIds].sort().join(", ");
  const usage = `Usage:
node tools/verify-client-runtimes.mjs [options]
pnpm exec node tools/verify-client-runtimes.mjs [options]

Options:
  --client <id>[,<id>...]     Only verify selected clients; comma-separated.
  --client=<id>[,<id>...]     Same as above.
  --client openai             Select all OpenAI-profile clients.
  --client mcp                Select all MCP-profile clients.
  --client a2a                Select all A2A-profile clients.
  --client mainstream         Select all mainstream-priority clients.
  --client global             Select all known clients.
  --client http               Select all HTTP/native profile clients.
  --client shared             Select all Shared SDK and local SDK clients.
  --client protocol:openai-compatible
  --client protocol:openai*      Wildcard protocol match.
  Select all clients by protocol value.
  --client protocol:mcp       Select all clients by protocol value.
  --client transport:v1       Select clients by transport substring/wildcard.
  --client transport:v1*     Select clients by transport pattern.
  --client tag:openai         Select all clients carrying a specific tag.
  --client tag:language:python Select language clients by tag.
  --client tag:language:*     Select all language-tagged clients.
  --client name:openai        Select clients by readable name match.
  --catalog                   Print all registry rows and exit.
  --client automated          Select all currently automated clients.
  --client manual             Select all manual-report clients.
  --client openai-*           Select all OpenAI-profile clients.
  --client mcp-*              Select all MCP profile clients.
  --client-catalog <file>     Merge an external JSON catalog to extend the runtime list.
                             Also supports CLIENT_RUNTIME_CATALOG_PATH env var.
  --client-catalog-dir <dir>  Merge all *.json files from a directory into the catalog.
                             Defaults to docs/client-runtime-catalog.d when present.
                             Also supports CLIENT_RUNTIME_CATALOG_DIR env var.
  --client-catalog-url <url>   Merge remote JSON catalog(s) to extend the runtime list.
                             Supports --client-catalog-url repeat and env vars:
                             CLIENT_RUNTIME_CATALOG_URL / CLIENT_RUNTIME_CATALOG_URLS.
  --evidence-dir <path>       Override evidence output directory.
  --evidence-prefix <text>    Prefix output file names for this verification run.
  --runbook                   Generate a client certification runbook (no gateway startup).
  --runbook-output <path>     Write runbook output to file.
  --runbook-format <md|json>  Runbook format (default: md).
  --clients <id>[,<id>...]    Alias for --client.
  --clients=<id>[,<id>...]    Alias for --client.
  --skip-openai-python         Skip automated OpenAI Python run and mark as manual.
  --manual-evidence <file>     JSON evidence map for manual clients.
  --evidence-template <file>   Generate an evidence JSON template for selected clients and exit.
  --require-manual-evidence    Fail if any selected manual client lacks verified evidence.
  --help, -h                  Show this help text.

Use --client all or --client global to force full scope explicitly.

Known client IDs:
${clientList}
`;
  process.stdout.write(`${usage}\n`);
}

function printClientCatalog() {
  const lines = clientRuntimeCatalog
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((client) => {
      const tagList = client.tags?.length ? ` tags=${client.tags.join(",")}` : "";
      return [
        `- ${client.id}`,
        `  protocol=${client.protocol}`,
        `  transport=${client.transport}`,
        `  mode=${client.mode}${tagList}`,
        `  command=${client.command}`,
      ].join("\n");
    });

  process.stdout.write(`Client runtime catalog (${clientRuntimeCatalog.length} entries):\n`);
  process.stdout.write(`${lines.join("\n")}\n`);
  process.stdout.write(
    "\nTip: use --client tag:<tag>, --client protocol:<protocol>, or --client name:<text>.\n",
  );
}

function getArgValue(argv, key) {
  const index = argv.findIndex((arg) => arg === key);
  if (index >= 0) {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) return null;
    return value;
  }
  const equalsToken = argv.find((arg) => arg.startsWith(`${key}=`));
  if (!equalsToken) return null;
  return equalsToken.split("=", 2)[1];
}

function getArgValues(argv, key) {
  const keyWithEquals = `${key}=`;
  const values = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === key) {
      const value = argv[index + 1];
      if (value && !value.startsWith("--")) {
        values.push(value);
      }
      continue;
    }
    if (arg.startsWith(keyWithEquals)) {
      values.push(arg.substring(keyWithEquals.length));
    }
  }
  return values;
}

function normalizeManualEvidenceStatus(value) {
  if (typeof value !== "string") return "manual";
  const normalized = value.toLowerCase().trim();
  if (verifiedManualStates.has(normalized)) return "verified";
  if (pendingManualStates.has(normalized)) return "manual";
  if (rejectedManualStates.has(normalized)) return "manual-failed";
  return normalized;
}

function parseManualEvidence(rawEvidenceEntries) {
  const out = new Map();
  for (const key of Object.keys(rawEvidenceEntries)) {
    const entry = rawEvidenceEntries[key];
    if (!entry) continue;
    const clientId = entry.clientId ?? key;
    out.set(clientId, {
      status: normalizeManualEvidenceStatus(entry.status),
      command: entry.command ?? "n/a",
      notes: entry.notes ?? "",
      checks: entry.checks ?? null,
      evidencePath: entry.evidencePath ?? entry.evidence ?? entry.outputPath ?? null,
      raw: entry.raw ?? entry.output ?? null,
    });
  }
  return out;
}

function resolveEvidencePath(rawPath) {
  if (typeof rawPath !== "string" || !rawPath.trim()) return null;
  return resolve(process.cwd(), rawPath.trim());
}

function isEvidencePathReadable(rawPath) {
  const absolutePath = resolveEvidencePath(rawPath);
  return !!absolutePath && existsSync(absolutePath);
}

async function loadManualEvidenceFromFile(rawPath) {
  if (!rawPath) return new Map();
  const filePath = resolve(process.cwd(), rawPath);
  let parsed;
  let rawContent;
  try {
    rawContent = await readFile(filePath, "utf8");
    parsed = JSON.parse(rawContent);
  } catch (error) {
    if (error?.name === "SyntaxError") {
      throw new Error(
        `Manual evidence file "${filePath}" is not valid JSON: ${error?.message ?? error}`,
      );
    }
    if (error?.code === "ENOENT") {
      throw new Error(`Manual evidence file not found: ${filePath}`);
    }
    throw new Error(`Failed to read manual evidence file "${filePath}": ${error?.message ?? error}`);
  }
  if (Array.isArray(parsed)) {
    const byId = {};
    for (const item of parsed) {
      if (!item?.clientId) continue;
      byId[item.clientId] = item;
    }
    return parseManualEvidence(byId);
  }
  if (parsed && typeof parsed === "object" && typeof parsed.clientId === "string") {
    return parseManualEvidence({ [parsed.clientId]: parsed });
  }
  if (parsed && typeof parsed === "object" && Array.isArray(parsed.evidence)) {
    const byId = {};
    for (const item of parsed.evidence) {
      if (!item?.clientId) continue;
      byId[item.clientId] = item;
    }
    return parseManualEvidence(byId);
  }
  if (parsed && typeof parsed === "object") {
    return parseManualEvidence(parsed);
  }
  return new Map();
}

function clampOutput(text) {
  if (typeof text !== "string") return "";
  return text
    .replace(/(bearer\s+)[a-z0-9._~+/=-]{8,}/gi, "$1[REDACTED]")
    .replace(/(sk-(?:proj-|or-v1-)?)[a-z0-9_-]{8,}/gi, "$1[REDACTED]")
    .replace(/(incorrect api key provided:\s*)[^.\r\n]+/gi, "$1[REDACTED]")
    .trim()
    .slice(-4_000);
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function parseJsonOutput(text) {
  const candidate = clampOutput(text);
  if (!candidate) return null;
  try {
    return JSON.parse(candidate);
  } catch (error) {
    let best = null;
    for (let start = 0; start < candidate.length; start += 1) {
      if (candidate[start] !== "{" && candidate[start] !== "[") continue;
      const stack = [];
      let inString = false;
      let escaped = false;
      for (let index = start; index < candidate.length; index += 1) {
        const character = candidate[index];
        if (inString) {
          if (escaped) {
            escaped = false;
          } else if (character === "\\") {
            escaped = true;
          } else if (character === '"') {
            inString = false;
          }
          continue;
        }
        if (character === '"') {
          inString = true;
          continue;
        }
        if (character === "{" || character === "[") {
          stack.push(character);
          continue;
        }
        if (character !== "}" && character !== "]") continue;
        const expected = character === "}" ? "{" : "[";
        if (stack.pop() !== expected) break;
        if (stack.length !== 0) continue;
        try {
          const parsed = JSON.parse(candidate.slice(start, index + 1));
          if (!best || index > best.end || (index === best.end && start < best.start)) {
            best = { end: index, start, parsed };
          }
        } catch {
          // Keep scanning in case a later balanced value is the actual result.
        }
        break;
      }
    }
    return best?.parsed ?? null;
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findFreePort() {
  const server = createServer();
  server.unref();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolve) => server.close(resolve));
  if (!port) throw new Error("Unable to allocate a local port.");
  return port;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 400) };
  }
  return { status: response.status, body };
}

async function waitForReady(baseUrl, service) {
  const timeoutAt = Date.now() + 30_000;
  while (Date.now() < timeoutAt) {
    if (service.exitCode !== null) {
      throw new Error(
        `Gateway exited before readiness with code ${service.exitCode}.`,
      );
    }
    try {
      const health = await fetchJson(`${baseUrl}/health/check`);
      if (health.status === 200) return health;
    } catch {
      // startup retry window
    }
    await delay(250);
  }
  throw new Error("Gateway did not become ready within 30 seconds.");
}

function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
}

function runCommand({ name, command, args, cwd, env, timeoutMs = 120000 }) {
  const options = {
    cwd,
    env: createCredentialFreeEnvironment(process.env, env),
    encoding: "utf8",
    windowsHide: true,
    timeout: timeoutMs,
    shell: false,
    maxBuffer: 4_000_000,
  };
  let childResult;
  try {
    childResult = spawnSync(command, args, options);
  } catch (error) {
    return {
      name,
      command,
      args,
      exitCode: null,
      signal: null,
      stdout: "",
      stderr: "",
      timedOut: false,
      error: String(error?.message ?? error),
    };
  }
  return {
    name,
    command,
    args,
    exitCode: childResult.status,
    signal: childResult.signal,
    stdout: clampOutput(childResult.stdout),
    stderr: clampOutput(childResult.stderr),
    timedOut: childResult.error?.code === "ETIMEDOUT",
    error: childResult.error?.message ?? null,
  };
}

function commandString(commandResult) {
  if (!commandResult) return "n/a";
  const args = commandResult?.args?.length
    ? ` ${commandResult.args.map((item) => JSON.stringify(item)).join(" ")}`
    : "";
  return `${commandResult?.command}${args}`;
}

function mapClientRecord({
  name,
  protocol,
  transport,
  command,
  outcome,
  notes,
  checks,
  status,
  evidencePath,
  id,
  runtimeEvidence,
}) {
  return {
    id,
    name,
    protocol,
    transport,
    command,
    status,
    notes,
    checks,
    outcome,
    evidencePath,
    ...(runtimeEvidence ? { runtimeEvidence } : {}),
  };
}

function pickRuntimeEvidence(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  const fields = [
    "client",
    "sdk",
    "sdkVersion",
    "hostClientInfo",
    "mcpServerInfo",
    "mcpProtocolVersion",
    "mcpHostMethods",
    "mcpToolNames",
    "mcpToolCallNames",
    "realProviderCallsMade",
  ];
  const evidence = Object.fromEntries(
    fields
      .filter((field) => Object.hasOwn(parsed, field))
      .map((field) => [field, parsed[field]]),
  );
  return Object.keys(evidence).length > 0 ? evidence : null;
}

function renderMarkdownReport(result) {
  const rows = result.automated
    .map((client) => {
      const checks = client.checks
        ? Object.entries(client.checks)
          .filter(([, value]) => value !== true && value !== null)
          .map(([key]) => key)
          .join(", ")
        : "n/a";
      return `- ${client.name} (${client.protocol}/${client.transport}) -> ${client.status}; command: \`${commandString(client.outcome)}\`; checks: ${checks || "passed"}`;
    })
    .join("\n");

  const manualRows = result.manual
    .map(
      (client) =>
        `- ${client.name} (${client.protocol}/${client.transport}) -> ${client.status}; evidence: ${client.evidencePath || "not provided"}; reason: ${client.notes}`,
    )
    .join("\n");

  return `# Client Runtime Certification Report

Generated at: ${result.generatedAt}

## Automated client runs

${rows || "- None"}

## Manual certification required

${manualRows || "- None"}

## Execution summary

- verified: ${result.summary.verified}
- failed: ${result.summary.failed}
- skipped: ${result.summary.skipped}
- manual: ${result.summary.manual}
- manual verified: ${result.summary.manualVerified}
- manual pending: ${result.summary.manualPending}
- manual failed: ${result.summary.manualFailed}
- failed commands:
${result.summary.failedClients.map((entry) => `  - ${entry}`).join("\n") || "  - none"}
${result.summary.manualFailedEntries?.length ? `- manual evidence failures:\n${result.summary.manualFailedEntries.map((entry) => `  - ${entry}`).join("\n")}` : "- manual evidence failures:\n  - none"}
${result.summary.manualPendingEntries?.length ? `- manual pending:\n${result.summary.manualPendingEntries.map((entry) => `  - ${entry}`).join("\n")}` : "- manual pending:\n  - none"}

Evidence JSON: ${result.evidenceJson}
`;
}

function normalizeRunbookFormat(rawFormat) {
  const normalized = (rawFormat || "md").toLowerCase();
  if (normalized !== "md" && normalized !== "json") {
    throw new Error(`Unsupported runbook format "${rawFormat}". Use --runbook-format md|json.`);
  }
  return normalized;
}

function toCompactTimestamp(date = new Date()) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function normalizeEvidencePrefix(rawValue) {
  const candidate = String(rawValue || "").trim().toLowerCase();
  if (!candidate) return "";
  const slug = candidate
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "";
}

function safeClientId(value) {
  return String(value || "client")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-");
}

function resolveRunbookOutputPath(rawPath, format, timestamp = null) {
  const stamp = timestamp || toCompactTimestamp();
  if (rawPath && rawPath.trim()) {
    return resolve(process.cwd(), rawPath.trim());
  }
  return resolve(evidenceDirectory, `${stamp}-client-runtime-runbook.${format}`);
}

function resolveEvidenceOutputDir(rawPath) {
  if (!rawPath || !String(rawPath).trim()) {
    return evidenceDirectory;
  }
  return resolve(process.cwd(), String(rawPath).trim());
}

function defaultEvidencePathForClient(clientId, timestamp) {
  const stamp = timestamp || toCompactTimestamp();
  return resolve(
    evidenceDirectory,
    `${stamp}-${safeClientId(clientId)}-evidence.json`,
  );
}

function expectedClientChecks(definition) {
  if (definition.protocol === "MCP") {
    return [
      "Initialize + tool listing succeeds",
      "Transport handshake to stdio /streamable endpoint is stable",
      "Gateway returns an expected tool call result for smoke probe",
      "Gateway reports local execution_mode in fake-mode proof payload",
    ];
  }
  if (definition.protocol === "A2A") {
    return [
      "Fetch Agent Card from /.well-known/agent-card.json",
      "SendMessage call succeeds",
      "GetTask/ListTasks returns task lifecycle fields",
      "Execution metadata is consistent with local fake mode",
    ];
  }
  return [
    "Model list /models endpoint responds with gateway model inventory",
    "Completion/chat request returns a successful response",
    "Streaming path is stable if client requests SSE",
    "No outbound private provider call is required in smoke mode",
  ];
}

function normalizeChecksForRunbook(rawChecks, definition) {
  if (Array.isArray(rawChecks)) {
    return rawChecks.filter(Boolean);
  }
  if (rawChecks && typeof rawChecks === "object") {
    return Object.entries(rawChecks)
      .filter(([, value]) => value === true)
      .map(([key]) => key);
  }
  return expectedClientChecks(definition);
}

function buildRunbookEntries(requestedClientIds, evidence = new Map(), timestamp = toCompactTimestamp()) {
  const scope = requestedClientIds
    ? [...requestedClientIds].sort()
    : [...allKnownClientIds].sort();
  const bySelection = new Set(scope);
  return clientRuntimeCatalog
    .filter((definition) => bySelection.has(definition.id))
    .map((definition) => {
      const providedEvidence = evidence.get(definition.id);
      const checks = normalizeChecksForRunbook(providedEvidence?.checks, definition);
      const notes = providedEvidence?.notes
        || definition.evidenceNotes
        || "Manual evidence report required.";
      const suggestedEvidencePath = definition.mode === "manual"
        ? defaultEvidencePathForClient(definition.id, timestamp)
        : null;
      return {
        id: definition.id,
        name: definition.name,
        protocol: definition.protocol,
        transport: definition.transport,
        mode: definition.mode,
        priority: definition.tags?.includes("mainstream") ? "mainstream" : "standard",
        command: providedEvidence?.command || definition.command || "n/a",
        evidenceStatus: providedEvidence?.status
          || (definition.mode === "automated" ? "automated-ready" : "manual"),
        evidencePath: providedEvidence?.evidencePath || (definition.mode === "manual"
          ? suggestedEvidencePath
          : null),
        checks,
        notes,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function renderRunbookMarkdown(runbook) {
  const lines = [
    "# Client Runtime Onboarding Runbook",
    "",
    `Generated at: ${runbook.generatedAt}`,
    `Client scope: ${runbook.scope.join(", ")}`,
    "",
    `Automated: ${runbook.automatedCount}`,
    `Manual / proof-required: ${runbook.manualCount}`,
    `Mainstream priority clients: ${runbook.mainstreamCount}`,
    "",
    "## Onboarding flow",
    "",
    "1. Start gateway using fake provider mode (no private keys).",
    "2. Replace base URL placeholders with your local gateway endpoint.",
    "3. Run each client command and keep request/response evidence.",
    "4. Attach evidence path in local `--manual-evidence` JSON for each completed client.",
    "5. Re-run strict runbook/verification and promote status to verified when proven.",
    "",
  ];

  runbook.clients.forEach((client, index) => {
    lines.push(`### ${index + 1}. ${client.name}`);
    lines.push("");
    lines.push(`- Client ID: \`${client.id}\``);
    lines.push(`- Protocol: ${client.protocol}`);
    lines.push(`- Transport: ${client.transport}`);
    lines.push(`- Verification mode: ${client.mode}`);
    lines.push(`- Priority: ${client.priority}`);
    lines.push(`- Recommended command: \`${client.command}\``);
    lines.push(`- Current evidence status: ${client.evidenceStatus}`);
    if (client.evidencePath) {
      lines.push(`- Evidence file: \`${client.evidencePath}\``);
    }
    lines.push(`- Notes: ${client.notes}`);
    lines.push("- Checks:");
    lines.push(...client.checks.map((item) => `  - ${item}`));
    lines.push("- How to record:");
    lines.push("  - Set `AI_GATEWAY_PROVIDER_MODE=fake` and `AI_GATEWAY_REAL_PROVIDER_ENABLED=false`.");
    lines.push("  - Capture at least one successful model and one completion/task result.");
    lines.push("  - Fill status as `verified` with evidence path in your manual evidence JSON.");
    lines.push("");
  });

  lines.push("## Suggested evidence schema");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify({
    clientId: "client-id",
    status: "verified",
    command: "command used",
    checks: { passed: true },
    notes: "Smoke test notes",
    evidencePath: "apps/ai-gateway-service/evidence/client-runtime-verifications/....json",
  }, null, 2));
  lines.push("```");

  return `${lines.join("\n")}\n`;
}

function buildRunbookPayload(requestedClientIds, evidence = new Map(), timestamp = toCompactTimestamp()) {
  const clients = buildRunbookEntries(requestedClientIds, evidence, timestamp);
  const scope = requestedClientIds ? [...requestedClientIds].sort() : ["all"];
  return {
    generatedAt: new Date().toISOString(),
    generatedAtCompact: timestamp,
    scope,
    generatedBy: "tools/verify-client-runtimes.mjs",
    generatedMode: "runbook",
    automatedCount: clients.filter((client) => client.mode === "automated").length,
    manualCount: clients.filter((client) => client.mode === "manual").length,
    mainstreamCount: clients.filter((client) => client.priority === "mainstream").length,
    clientCount: clients.length,
    clients,
  };
}

function isRuntimeDependencyMissing(raw, parsed) {
  if (parsed?.skipped === true) return true;
  const errorText = [raw?.error, raw?.stderr, parsed?.error, parsed?.reason]
    .filter(Boolean)
    .join(" ");
  return /cannot find module|module not found|modulenotfounderror|enoent|not installed|not found in path/i
    .test(errorText);
}

function addRuntimeProfileResult({ automated, manual, clientId, raw, parsed }) {
  const definition = getClientDefinition(clientId);
  if (!definition) return;
  if (isRuntimeDependencyMissing(raw, parsed)) {
    addManualClientFromCatalog(manual, clientId, {
      status: "manual",
      command: commandString(raw),
      notes: parsed?.reason
        || raw?.error
        || `${definition.name} requires an optional runtime dependency in this environment.`,
    }, { force: true });
    return;
  }
  const passed = raw.exitCode === 0 && parsed?.ok === true;
  automated.push(
    mapClientRecord({
      id: clientId,
      name: definition.name,
      protocol: definition.protocol,
      transport: definition.transport,
      command: commandString(raw),
      outcome: raw,
      status: passed ? "verified" : "failed",
      checks: parsed?.checks ?? null,
      notes: passed ? definition.evidenceNotes : parsed?.error || "Runtime profile failed.",
      runtimeEvidence: pickRuntimeEvidence(parsed),
    }),
  );
}

function resolvePythonRuntime() {
  const configured = process.env.AI_GATEWAY_PYTHON_EXECUTABLE
    || process.env.PYTHON_EXECUTABLE;
  if (configured) {
    return { command: configured, prefixArgs: [] };
  }

  const candidates = process.platform === "win32"
    ? [
      { command: "py", prefixArgs: ["-3"] },
      { command: "python", prefixArgs: [] },
      { command: "python3", prefixArgs: [] },
    ]
    : [
      { command: "python3", prefixArgs: [] },
      { command: "python", prefixArgs: [] },
    ];

  for (const candidate of candidates) {
    const probe = spawnSync(candidate.command, [...candidate.prefixArgs, "--version"], {
      stdio: "ignore",
      windowsHide: true,
      shell: false,
    });
    if (probe.status === 0) return candidate;
  }

  return candidates[0];
}

function resolvePowerShellRuntime() {
  const configured = process.env.AI_GATEWAY_POWERSHELL_EXECUTABLE
    || process.env.POWERSHELL_EXECUTABLE;
  if (configured) return configured;

  const candidates = process.platform === "win32"
    ? ["powershell", "pwsh"]
    : ["pwsh", "powershell"];
  for (const command of candidates) {
    const probe = spawnSync(
      command,
      ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"],
      {
        stdio: "ignore",
        windowsHide: true,
        shell: false,
      },
    );
    if (probe.status === 0) return command;
  }

  return candidates[0];
}

function serializeRunbook(runbook, format) {
  if (format === "json") {
    return `${JSON.stringify(runbook, null, 2)}\n`;
  }
  return renderRunbookMarkdown(runbook);
}

function buildEvidenceTemplate(requestedClientIds, scopeTag = "selected") {
  const scope = requestedClientIds
    ? [...requestedClientIds].sort()
    : [...allKnownClientIds].sort();
  const bySelection = new Set(scope);
  const template = {};
  const stamp = toCompactTimestamp();
  for (const clientId of bySelection) {
    const definition = getClientDefinition(clientId);
    if (!definition) continue;
    if (definition.mode !== "manual") {
      continue;
    }
    const suggestion = definition.mode === "manual"
      ? defaultEvidencePathForClient(clientId, stamp)
      : null;
    template[clientId] = {
      clientId,
      status: "manual",
      command: definition.command || "manual smoke check command",
      notes: `Run ${definition.name || clientId} against a local fake-provider gateway and record evidence.`,
      checks: {
        status200: null,
        fakeExecution: null,
        protocolCompliance: null,
      },
      evidencePath: suggestion,
      scope: scopeTag,
      protocol: definition.protocol,
      transport: definition.transport,
    };
  }
  return template;
}

function parseClientFilter(argv) {
  const filter = new Set();
  let includeAll = false;
  const expandToken = (value) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return;
    if (normalized === "all" || normalized === "global") {
      includeAll = true;
      filter.clear();
      return;
    }
    if (normalized.startsWith("protocol:")) {
      const protocol = normalized.slice("protocol:".length);
      const matches = allKnownClientIds.filter((item) => protocolMatches(item, protocol));
      if (matches.length === 0) {
        throw new Error(`No known clients match protocol "${protocol}".`);
      }
      matches.forEach((item) => filter.add(item));
      return;
    }
    if (normalized.startsWith("transport:")) {
      const transport = normalized.slice("transport:".length);
      const matches = allKnownClientIds.filter((item) => transportMatches(item, transport));
      if (matches.length === 0) {
        throw new Error(`No known clients match transport "${transport}".`);
      }
      matches.forEach((item) => filter.add(item));
      return;
    }
    if (normalized.startsWith("tag:")) {
      const tagValue = normalized.slice("tag:".length);
      const matches = allKnownClientIds.filter((item) => hasTag(item, tagValue));
      if (matches.length === 0) {
        throw new Error(`No known clients match tag "${tagValue}".`);
      }
      matches.forEach((item) => filter.add(item));
      return;
    }
    if (normalized.startsWith("name:")) {
      const namePattern = normalized.slice("name:".length);
      const matches = allKnownClientIds.filter((item) => nameMatches(item, namePattern));
      if (matches.length === 0) {
        throw new Error(`No known clients match name pattern "${namePattern}".`);
      }
      matches.forEach((item) => filter.add(item));
      return;
    }
    if (normalized.startsWith("client:")) {
      const clientId = normalized.slice("client:".length);
      if (clientId) filter.add(clientId);
      return;
    }
    if (normalized in profileSelectors) {
      allKnownClientIds.filter((item) => profileSelectors[normalized](item))
        .forEach((item) => filter.add(item));
      return;
    }
    if (normalized.includes("*")) {
      const pattern = `^${normalized.split("*").map(escapeRegex).join(".*")}$`;
      const matches = allKnownClientIds.filter((item) => new RegExp(pattern, "i").test(item));
      if (matches.length === 0) {
        throw new Error(`No known clients match pattern "${normalized}".`);
      }
      matches.forEach((item) => filter.add(item));
      return;
    }
    filter.add(normalized);
  };
  const parseClientTokenString = (value) => {
    value
      .split(",")
      .map((item) => item.trim())
      .forEach((item) => {
        expandToken(item);
      });
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--client" || arg === "--clients") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a comma-separated client list.`);
      }
      parseClientTokenString(value);
      index += 1;
      continue;
    }
    if (
      arg === "--client-catalog"
      || arg === "--manual-evidence"
      || arg === "--client-catalog-dir"
      || arg === "--client-catalog-url"
      || arg === "--catalog"
      || arg === "--evidence-dir"
      || arg === "--evidence-prefix"
      || arg === "--runbook"
      || arg === "--runbook-format"
      || arg === "--runbook-output"
      || arg === "--evidence-template"
    ) {
      index += 1;
      continue;
    }
    if (arg.startsWith("--client=") || arg.startsWith("--clients=")) {
      const value = arg.includes("=") ? arg.split("=", 2)[1] : "";
      parseClientTokenString(value);
      continue;
    }
    if (
      arg.startsWith("--client-catalog=")
      || arg.startsWith("--client-catalog-dir=")
      || arg.startsWith("--client-catalog-url=")
      || arg.startsWith("--manual-evidence=")
      || arg.startsWith("--evidence-template=")
      || arg.startsWith("--evidence-dir=")
      || arg.startsWith("--evidence-prefix=")
      || arg.startsWith("--runbook-format=")
      || arg.startsWith("--runbook-output=")
    ) {
      continue;
    }
  }
  if (includeAll || filter.size === 0) return null;
  return filter;
}

const rawArgs = process.argv.slice(2);
if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
  printUsage();
  process.exit(0);
}
const evidenceOutputDirArgument = getArgValue(rawArgs, "--evidence-dir");
const evidenceOutputDir = resolveEvidenceOutputDir(evidenceOutputDirArgument);
const clientCatalogArgument = getArgValue(rawArgs, "--client-catalog");
const clientCatalogDirArgument = getArgValue(rawArgs, "--client-catalog-dir");
const clientCatalogUrls = getArgValues(rawArgs, "--client-catalog-url");
const clientCatalogUrlArgument = clientCatalogUrls.length
  ? clientCatalogUrls.join(",")
  : null;
try {
  await updateClientCatalog(clientCatalogArgument, clientCatalogDirArgument, clientCatalogUrlArgument);
} catch (error) {
  process.stderr.write(`Failed to load client runtime catalog: ${error?.message ?? error}\n`);
  process.exit(1);
}

if (rawArgs.includes("--catalog")) {
  printClientCatalog();
  process.exit(0);
}
const skipOpenAiPython = rawArgs.includes("--skip-openai-python");
const runbookMode = rawArgs.includes("--runbook");
const runbookOutputArgument = getArgValue(rawArgs, "--runbook-output");
const runbookFormatArgument = getArgValue(rawArgs, "--runbook-format");
const evidenceTemplateArgument = getArgValue(rawArgs, "--evidence-template");
let requestedClientIds = null;
const manualEvidenceArgument = getArgValue(rawArgs, "--manual-evidence");
const requireManualEvidence = rawArgs.includes("--require-manual-evidence");
let manualEvidence = new Map();
let runbookFormat = "md";
let runbookTimestamp = null;
try {
  requestedClientIds = parseClientFilter(rawArgs);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n`);
  printUsage();
  process.exit(1);
}
if (manualEvidenceArgument) {
  try {
    manualEvidence = await loadManualEvidenceFromFile(manualEvidenceArgument);
  } catch (error) {
    process.stderr.write(`${error?.message ?? error}\n`);
    process.exit(1);
  }
}
if (evidenceTemplateArgument) {
  try {
    const scope = requestedClientIds
      ? [...requestedClientIds].sort()
      : [...allKnownClientIds].sort();
    const template = buildEvidenceTemplate(
      requestedClientIds,
      scope.length === allKnownClientIds.length ? "global" : "selected",
    );
    const outputPath = resolve(process.cwd(), evidenceTemplateArgument);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(template, null, 2)}\n`);
    process.stdout.write(
      `Evidence template generated: ${outputPath}\nEntries: ${Object.keys(template).length}\n`,
    );
    process.exit(0);
  } catch (error) {
    process.stderr.write(`Failed to generate evidence template: ${error?.message ?? error}\n`);
    process.exit(1);
  }
}
if (runbookMode) {
  try {
    runbookFormat = normalizeRunbookFormat(runbookFormatArgument);
    runbookTimestamp = toCompactTimestamp();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

if (
  requestedClientIds
  && [...requestedClientIds].some((clientId) => !allKnownClientIds.includes(clientId))
) {
  const unknown = [...requestedClientIds]
    .filter((clientId) => !allKnownClientIds.includes(clientId))
    .join(", ");
  process.stderr.write(
    `Unknown client id(s): ${unknown}. Supported ids: ${allKnownClientIds.join(", ")}.\n\n`,
  );
  printUsage();
  process.exit(1);
}

if (runbookMode) {
  const runbook = buildRunbookPayload(requestedClientIds, manualEvidence, runbookTimestamp);
  const output = serializeRunbook(runbook, runbookFormat);
  const outputPath = resolveRunbookOutputPath(runbookOutputArgument, runbookFormat, runbookTimestamp);
  try {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, output);
    process.stdout.write(`Client onboarding runbook generated: ${outputPath}\n`);
    process.stdout.write(
      `Total entries: ${runbook.clientCount}; automated=${runbook.automatedCount}; manual=${runbook.manualCount}; mainstream=${runbook.mainstreamCount}\n`,
    );
  } catch (error) {
    process.stderr.write(`Failed to write runbook output: ${error?.message ?? error}\n`);
    process.exit(1);
  }
  process.exit(0);
}

function isClientSelected(clientId) {
  if (!requestedClientIds) return true;
  return requestedClientIds.has(clientId);
}

function addManualClient({
  manual,
  id,
  name,
  protocol,
  transport,
  notes,
  status = "manual",
  checks = null,
  command = "n/a",
  evidencePath = null,
}) {
  if (!isClientSelected(id)) return;
  manual.push(
    mapClientRecord({
      id,
      name,
      protocol,
      transport,
      command,
      status,
      notes,
      outcome: null,
      checks,
      evidencePath,
    }),
  );
}

function addManualClientFromCatalog(manual, clientId, overrides = {}, options = {}) {
  const definition = getClientDefinition(clientId);
  if (
    !definition
    || (options.force !== true && definition.mode !== "manual")
  ) {
    return;
  }
  let status = overrides.status || "manual";
  let evidencePath = overrides.evidencePath || null;
  if (evidencePath && typeof evidencePath === "string") {
    evidencePath = resolveEvidencePath(evidencePath);
  }
  let notes = overrides.notes ?? definition.evidenceNotes ?? "Manual evidence report required.";
  if (status === "verified" && !evidencePath) {
    status = "manual-failed";
    notes = `${notes} evidencePath is required for verified status.`;
  } else if (status === "verified" && !isEvidencePathReadable(evidencePath)) {
    status = "manual-failed";
    notes = `${notes} evidence file not found: ${evidencePath}.`;
  }
  addManualClient({
    manual,
    id: definition.id,
    name: definition.name,
    protocol: definition.protocol,
    transport: definition.transport,
    notes,
    checks: overrides.checks ?? options.checks ?? null,
    command: overrides.command || "n/a",
    evidencePath,
    status,
  });
}

function addAllManualClientsFromCatalog(manual) {
  for (const definition of clientRuntimeCatalog.filter((client) => client.mode === "manual")) {
    if (!isClientSelected(definition.id)) continue;
    if (definition.id === "openai-python" || definition.id === "openai-go") continue;
    const evidence = manualEvidence.get(definition.id);
    if (evidence) {
      addManualClientFromCatalog(manual, definition.id, {
        status: evidence.status,
        notes: evidence.notes || definition.evidenceNotes || "Manual evidence report required.",
        command: evidence.command,
        checks: evidence.checks,
        evidencePath: evidence.evidencePath,
      }, {
        force: true,
      });
      continue;
    }
    addManualClient({
      manual,
      id: definition.id,
      name: definition.name,
      protocol: definition.protocol,
      transport: definition.transport,
      notes: definition.evidenceNotes || "Manual evidence report required.",
    });
  }

}

void (async () => {
const port = await findFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const gatewayEnv = {
  AI_GATEWAY_SERVICE_HOST: "127.0.0.1",
  AI_GATEWAY_SERVICE_PORT: String(port),
  AI_GATEWAY_PROVIDER_MODE: "fake",
  AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
  AI_GATEWAY_ROUTE_MODE: "registry-default",
  AI_GATEWAY_DEFAULT_PROVIDER: "local-fake-provider",
  AI_GATEWAY_DEFAULT_MODEL: "local-fake-model",
  AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
  PME_ENTERPRISE_AUTH_ENABLED: "false",
  PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory",
  ...(isClientSelected("cline-mcp") || isClientSelected("mcp-continue")
    ? { AI_GATEWAY_FAKE_PROVIDER_TOOL_MODE: "mcp-health-certification" }
    : {}),
};

const gateway = spawn(process.execPath, [serviceEntrypoint], {
  cwd: serviceRoot,
  windowsHide: true,
  env: createCredentialFreeEnvironment(process.env, gatewayEnv),
  stdio: ["ignore", "pipe", "pipe"],
});
let gatewayOut = "";
let gatewayErr = "";
let gatewayLogRemainder = "";
const realProviderAttempts = new Set();

function inspectGatewayLogChunk(chunk) {
  const lines = `${gatewayLogRemainder}${chunk}`.split(/\r?\n/);
  gatewayLogRemainder = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.includes('"event":"provider_call_start"')) continue;
    try {
      const event = JSON.parse(line);
      if (event.provider && !fakeProviderIds.has(event.provider)) {
        realProviderAttempts.add(event.provider);
      }
    } catch {
      realProviderAttempts.add("unparsed-provider-call");
    }
  }
}

gateway.stdout.setEncoding("utf8");
gateway.stderr.setEncoding("utf8");
gateway.stdout.on("data", (chunk) => {
  inspectGatewayLogChunk(chunk);
  gatewayOut = `${gatewayOut}${chunk}`.slice(-8_000);
});
gateway.stderr.on("data", (chunk) => {
  gatewayErr = `${gatewayErr}${chunk}`.slice(-8_000);
});

let result;
try {
  await waitForReady(baseUrl, gateway);

  const automated = [];
  const manual = [];

  if (isClientSelected("openai-go")) {
    const goVersionRaw = runCommand({
      name: "Go runtime probe",
      command: "go",
      args: ["version"],
    });
    if (goVersionRaw.exitCode === null) {
      addManualClient({
        manual,
        id: "openai-go",
        name: "OpenAI Go SDK/Client (native HTTP)",
        protocol: "OpenAI-compatible",
        transport: "HTTP /v1 + aliases + /openai/deployments + /v1/engines",
        notes: `Go runtime not found in PATH: ${goVersionRaw.error ?? "skip to avoid build break"}`,
        status: requireManualEvidence ? "manual-failed" : "manual",
      });
    } else {
      const openAiGoRaw = runCommand({
        name: "OpenAI Go native HTTP client",
        command: "go",
        args: ["run", openAiGoEntrypoint, "--base-url", baseUrl],
        timeoutMs: 240_000,
      });
      const openAiGoParsed = parseJsonOutput(openAiGoRaw.stdout);
      if (openAiGoParsed?.skipped === true) {
        addManualClient({
          manual,
          id: "openai-go",
          name: "OpenAI Go SDK/Client (native HTTP)",
          protocol: "OpenAI-compatible",
          transport: "HTTP /v1 + aliases + /openai/deployments + /v1/engines",
          notes: openAiGoParsed?.reason || "Go sample reported manual skip.",
          status: requireManualEvidence ? "manual-failed" : "manual",
        });
      } else {
        const openAiGoOk =
          openAiGoRaw.exitCode === 0 &&
          openAiGoParsed?.ok === true &&
          openAiGoParsed?.client === "openai-go" &&
          openAiGoParsed?.realProviderCallsMade === false;
        automated.push(
          mapClientRecord({
            id: "openai-go",
            name: "OpenAI Go client (native HTTP)",
            protocol: "OpenAI-compatible",
            transport: "HTTP /v1 + aliases + /openai/deployments + /v1/engines + SSE",
            command: commandString(openAiGoRaw),
            outcome: openAiGoRaw,
            status: openAiGoOk ? "verified" : "failed",
            checks: openAiGoParsed?.checks ?? null,
          }),
        );
      }
    }
  }

  addAllManualClientsFromCatalog(manual);

  const optionalNodeProfiles = [
    ["mcp-node-sdk", "mcp-node-sdk"],
    ["mcp-inspector", "mcp-inspector"],
    ["codex-mcp", "codex-mcp"],
    ["mcp-vscode", "mcp-vscode"],
    ["mcp-claude-code", "mcp-claude-code"],
    ["mcp-gemini-cli", "mcp-gemini-cli"],
    ["mcp-opencode-cli", "mcp-opencode-cli"],
    ["cursor-mcp", "cursor-mcp"],
    ["cline-mcp", "cline-mcp"],
    ["mcp-continue", "mcp-continue"],
    ["openai-langchain", "openai-langchain"],
    ["openai-vercel-ai-sdk", "openai-vercel-ai-sdk"],
    ["openai-llamaindex-js", "openai-llamaindex-js"],
    ["http-axios", "http-axios"],
    ["http-node-fetch", "http-node-fetch"],
    ["http-node-graphql-or-rest", "http-node-graphql-or-rest"],
    ["http-curl", "http-curl"],
    ["http-postman", "http-postman"],
    ["openai-promptfoo", "openai-promptfoo"],
    ["openai-agents-js", "openai-agents-js"],
    ["openai-azure-sdk-js-compat", "openai-azure-sdk-js-compat"],
  ];
  for (const [clientId, profile] of optionalNodeProfiles) {
    if (!isClientSelected(clientId)) continue;
    const raw = runCommand({
      name: `${clientId} runtime profile`,
      command: process.execPath,
      args: [optionalNodeRuntimeEntrypoint, `--client=${profile}`],
      env: {
        AI_GATEWAY_SERVICE_URL: baseUrl,
        AI_GATEWAY_BASE_URL: baseUrl,
        UNIFIED_AI_SYSTEM_REPO_ROOT: repoRoot,
      },
      timeoutMs: clientId.startsWith("mcp-") ? 240_000 : 120_000,
    });
    addRuntimeProfileResult({
      automated,
      manual,
      clientId,
      raw,
      parsed: parseJsonOutput(raw.stdout),
    });
  }

  const optionalPythonProfiles = [
    ["openai-langchain-py", "openai-langchain-py"],
    ["openai-llamaindex-python", "openai-llamaindex-python"],
    ["a2a-python", "a2a-python"],
    ["openai-litellm", "openai-litellm"],
    ["openai-pydantic-ai", "openai-pydantic-ai"],
    ["openai-autogen", "openai-autogen"],
    ["openai-agents-python", "openai-agents-python"],
    ["openai-semantic-kernel", "openai-semantic-kernel"],
    ["openai-dspy", "openai-dspy"],
    ["openai-haystack", "openai-haystack"],
    ["openai-langgraph", "openai-langgraph"],
    ["openai-crewai", "openai-crewai"],
    ["openai-instructor", "openai-instructor"],
    ["openai-guidance", "openai-guidance"],
    ["openai-python-root-alias", "openai-python-root-alias"],
    ["openai-azure-sdk-python-compat", "openai-azure-sdk-python-compat"],
    ["mcp-python-sdk", "mcp-python-sdk"],
    ["http-python-requests", "http-python-requests"],
    ["http-python-httpx", "http-python-httpx"],
    ["http-python-aiohttp", "http-python-aiohttp"],
    ["http-httpie", "http-httpie"],
  ];
  for (const [clientId, profile] of optionalPythonProfiles) {
    if (!isClientSelected(clientId)) continue;
    const pythonRuntime = resolvePythonRuntime();
    const raw = runCommand({
      name: `${clientId} runtime profile`,
      command: pythonRuntime.command,
      args: [
        ...pythonRuntime.prefixArgs,
        optionalPythonRuntimeEntrypoint,
        `--client=${profile}`,
        "--base-url",
        baseUrl,
      ],
      env: {
        AI_GATEWAY_SERVICE_URL: baseUrl,
        AI_GATEWAY_NODE_EXECUTABLE: process.execPath,
        UNIFIED_AI_SYSTEM_REPO_ROOT: repoRoot,
        OTEL_SDK_DISABLED: "true",
        CREWAI_DISABLE_TELEMETRY: "true",
        DO_NOT_TRACK: "1",
        ANONYMIZED_TELEMETRY: "False",
        CREWAI_TESTING: "true",
      },
    });
    addRuntimeProfileResult({
      automated,
      manual,
      clientId,
      raw,
      parsed: parseJsonOutput(raw.stdout),
    });
  }

  const nativeRuntimeProfiles = [
    {
      clientId: "http-java-okhttp",
      command: "java",
      args: [javaHttpEntrypoint, "--base-url", baseUrl],
    },
    {
      clientId: "http-dotnet-httpclient",
      command: "dotnet",
      args: ["run", "--project", dotnetHttpProject, "--", "--base-url", baseUrl],
    },
    {
      clientId: "http-powershell-invoke-restmethod",
      command: resolvePowerShellRuntime(),
      args: [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        powershellHttpEntrypoint,
        "-BaseUrl",
        baseUrl,
      ],
    },
    {
      clientId: "openai-dotnet",
      command: "dotnet",
      args: ["run", "--project", dotnetOpenAiProject, "--", "--base-url", baseUrl],
    },
  ];
  for (const profile of nativeRuntimeProfiles) {
    if (!isClientSelected(profile.clientId)) continue;
    if (profile.clientId === "http-java-okhttp") {
      const javaProbe = runCommand({
        name: "Java runtime probe",
        command: "java",
        args: ["-version"],
      });
      const versionText = `${javaProbe.stdout} ${javaProbe.stderr}`;
      const versionMatch = versionText.match(/version\s+"(?:1\.)?(\d+)/i);
      const javaMajor = versionMatch ? Number.parseInt(versionMatch[1], 10) : 0;
      if (javaProbe.exitCode === null || javaMajor < 11) {
        addManualClientFromCatalog(manual, profile.clientId, {
          status: "manual",
          command: commandString(javaProbe),
          notes: javaProbe.exitCode === null
            ? `Java runtime is unavailable: ${javaProbe.error ?? "not found"}.`
            : `Java ${javaMajor || "unknown"} detected; Java 11+ is required for the source-file smoke profile.`,
        }, { force: true });
        continue;
      }
    }
    const raw = runCommand({
      name: `${profile.clientId} runtime profile`,
      command: profile.command,
      args: profile.args,
      cwd: repoRoot,
      env: {
        AI_GATEWAY_SERVICE_URL: baseUrl,
      },
      timeoutMs: 240_000,
    });
    addRuntimeProfileResult({
      automated,
      manual,
      clientId: profile.clientId,
      raw,
      parsed: parseJsonOutput(raw.stdout),
    });
  }

  if (isClientSelected("mcp-official")) {
    const mcpSmokeRaw = runCommand({
      name: "MCP official client",
      command: process.execPath,
      args: [mcpSmokeEntrypoint, "--json"],
      env: {
        AI_GATEWAY_PROVIDER_MODE: "fake",
        AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
        PME_ENTERPRISE_AUTH_ENABLED: "false",
        PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory",
      },
    });
    const mcpSmoke = parseJsonOutput(mcpSmokeRaw.stdout);
    const mcpOk =
      mcpSmokeRaw.exitCode === 0 &&
      mcpSmoke?.ok === true &&
      mcpSmoke?.toolCount === 9 &&
      mcpSmoke?.executionMode === "fake" &&
      mcpSmoke?.promptEnhancementProviderCalled === false &&
      mcpSmoke?.realProviderCallsMade === false &&
      mcpSmoke?.managedGatewayCleanedUp === true;
    automated.push(
      mapClientRecord({
        id: "mcp-official",
        name: "Official MCP SDK (Node)",
        protocol: "MCP",
        transport: "stdio + streamable-http",
        command: commandString(mcpSmokeRaw),
        outcome: mcpSmokeRaw,
        status: mcpOk ? "verified" : "failed",
        checks: mcpSmokeRaw.exitCode === null ? null : {
          toolCount: mcpSmoke?.toolCount === 9,
          executionModeFake: mcpSmoke?.executionMode === "fake",
          noPromptEnhancementProviderCall:
            mcpSmoke?.promptEnhancementProviderCalled === false,
          noRealProviderCalls: mcpSmoke?.realProviderCallsMade === false,
          managedGatewayCleanedUp: mcpSmoke?.managedGatewayCleanedUp === true,
        },
      }),
    );
  }

  if (isClientSelected("openai-node")) {
    const openAiNodeRaw = runCommand({
      name: "OpenAI Node SDK",
      command: process.execPath,
      args: [openAiNodeEntrypoint],
      env: {
        AI_GATEWAY_SERVICE_URL: baseUrl,
        AI_GATEWAY_BASE_URL: baseUrl,
      },
    });
    const openAiNodeParsed = parseJsonOutput(openAiNodeRaw.stdout);
    const openAiNodeOk =
      openAiNodeRaw.exitCode === 0 &&
      openAiNodeParsed?.ok === true &&
      openAiNodeParsed?.client === "openai" &&
      openAiNodeParsed?.realProviderCallsMade === false;
    automated.push(
      mapClientRecord({
        id: "openai-node",
        name: "OpenAI Node SDK",
        protocol: "OpenAI-compatible",
        transport: "HTTP /v1",
        command: commandString(openAiNodeRaw),
        outcome: openAiNodeRaw,
        status: openAiNodeOk ? "verified" : "failed",
        checks: openAiNodeParsed?.checks ?? null,
      }),
    );
  }

  if (isClientSelected("openai-wire")) {
    const openAiWireRaw = runCommand({
      name: "OpenAI wire-compatible aliases smoke test",
      command: process.execPath,
      args: [openAiWireEntrypoint],
      env: {
        AI_GATEWAY_SERVICE_URL: baseUrl,
        AI_GATEWAY_BASE_URL: baseUrl,
      },
    });
    const openAiWireParsed = parseJsonOutput(openAiWireRaw.stdout);
    const openAiWireOk =
      openAiWireRaw.exitCode === 0 &&
      openAiWireParsed?.ok === true &&
      openAiWireParsed?.client === "openai-wire" &&
      openAiWireParsed?.realProviderCallsMade === false;
    automated.push(
      mapClientRecord({
        id: "openai-wire",
        name: "OpenAI wire-compatible aliases smoke",
        protocol: "OpenAI-compatible",
        transport: "HTTP /v1, /chat, /responses, /openai/deployments, /v1/engines",
        command: commandString(openAiWireRaw),
        outcome: openAiWireRaw,
        status: openAiWireOk ? "verified" : "failed",
        checks: openAiWireParsed?.checks ?? null,
      }),
    );
  }

  if (isClientSelected("a2a-official")) {
    const a2aRaw = runCommand({
      name: "A2A JS SDK",
      command: process.execPath,
      args: [a2aJsEntrypoint],
      env: {
        AI_GATEWAY_SERVICE_URL: baseUrl,
        AI_GATEWAY_BASE_URL: baseUrl,
      },
    });
    const a2aParsed = parseJsonOutput(a2aRaw.stdout);
    const a2aOk =
      a2aRaw.exitCode === 0 &&
      a2aParsed?.ok === true &&
      a2aParsed?.client === "@a2a-js/sdk" &&
      a2aParsed?.realProviderCallsMade === false;
    automated.push(
      mapClientRecord({
        id: "a2a-official",
        name: "Official A2A SDK (JSON-RPC)",
        protocol: "A2A",
        transport: "HTTP JSON-RPC",
        command: commandString(a2aRaw),
        outcome: a2aRaw,
        status: a2aOk ? "verified" : "failed",
        checks: a2aParsed?.checks ?? null,
      }),
    );
  }

  if (isClientSelected("shared-sdk")) {
    const sharedSdkRaw = runCommand({
      name: "Shared SDK prompt-enhancement client",
      command: process.execPath,
      args: [sharedSdkPromptEntrypoint, "Help me plan an API", "--base-url", baseUrl],
      env: {
        AI_GATEWAY_BASE_URL: baseUrl,
        AI_GATEWAY_SERVICE_URL: baseUrl,
      },
    });
    const sharedSdkParsed = parseJsonOutput(sharedSdkRaw.stdout);
    const sharedSdkOk =
      sharedSdkRaw.exitCode === 0 &&
      sharedSdkParsed?.client === "@unified-ai-system/shared-sdk" &&
      sharedSdkParsed?.metadata?.providerCalled === false &&
      sharedSdkParsed?.metadata?.credentialRequired === false &&
      sharedSdkParsed?.metadata?.deterministic === true &&
      sharedSdkParsed?.metadata?.engine === "local-deterministic";
    automated.push(
      mapClientRecord({
        id: "shared-sdk",
        name: "Shared SDK prompt-enhancement client",
        protocol: "Unified SDK",
        transport: "SDK over HTTP",
        command: commandString(sharedSdkRaw),
        outcome: sharedSdkRaw,
        status: sharedSdkOk ? "verified" : "failed",
        checks: {
          providerFree:
            sharedSdkParsed?.metadata?.providerCalled === false
            && sharedSdkParsed?.metadata?.credentialRequired === false,
          deterministicEngine: sharedSdkParsed?.metadata?.engine === "local-deterministic",
          enhancedPromptReturned: typeof sharedSdkParsed?.enhancedPrompt === "string",
        },
      }),
    );
  }

  if (isClientSelected("openai-python")) {
    if (skipOpenAiPython) {
      addManualClientFromCatalog(manual, "openai-python", {
        notes: "Skipped by --skip-openai-python.",
        status: requireManualEvidence ? "manual-failed" : "manual",
      }, {
        force: true,
      });
    } else if (manualEvidence.has("openai-python")) {
      const evidence = manualEvidence.get("openai-python");
      addManualClientFromCatalog(
        manual,
        "openai-python",
        {
          notes: evidence.notes || "Manual evidence provided.",
          command: evidence.command,
          checks: evidence.checks,
          evidencePath: evidence.evidencePath,
          status: evidence.status,
        },
        {
          force: true,
        },
      );
    } else {
      const pythonRuntime = resolvePythonRuntime();
      const pythonCommand = pythonRuntime.command;
      const pythonArgs = [
        ...pythonRuntime.prefixArgs,
        openAiPythonEntrypoint,
      ];
      const openAiPythonRaw = runCommand({
        name: "OpenAI Python SDK",
        command: pythonCommand,
        args: [...pythonArgs, "--base-url", baseUrl],
        env: {
          AI_GATEWAY_SERVICE_URL: baseUrl,
        },
      });
      const openAiPythonParsed = parseJsonOutput(openAiPythonRaw.stdout);
      if (openAiPythonParsed?.skipped === true) {
        addManualClientFromCatalog(manual, "openai-python", {
          notes:
            openAiPythonParsed?.reason
            || "Dependency missing or environment blocked; install openai package and rerun.",
        }, {
          force: true,
        });
      } else {
        const openAiPythonOk =
          openAiPythonRaw.exitCode === 0 &&
          openAiPythonParsed?.ok === true &&
          openAiPythonParsed?.realProviderCallsMade === false;
        automated.push(
          mapClientRecord({
            id: "openai-python",
            name: "OpenAI Python SDK",
            protocol: "OpenAI-compatible",
            transport: "HTTP /v1",
            command: commandString(openAiPythonRaw),
            outcome: openAiPythonRaw,
            status: openAiPythonOk ? "verified" : "failed",
            checks: openAiPythonParsed?.checks ?? null,
          }),
        );
      }
    }
  }

  if (isClientSelected("http-native")) {
    const genericHealth = await fetchJson(`${baseUrl}/health/check`);
    const genericModels = await fetchJson(`${baseUrl}/v1/models`);
    const genericChat = await fetchJson(`${baseUrl}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "Runtime verification through plain HTTP",
        providerId: "local-fake-provider",
        model: "local-fake-model",
      }),
    });
    const genericCheck =
      genericHealth.status === 200 &&
      genericModels.status === 200 &&
      genericModels.body?.data?.some(
        (model) =>
          model?.id === "local-fake-model" &&
          model?.unified_ai?.execution_mode === "fake",
      ) &&
      genericChat.status === 200 &&
      genericChat.body?.data?.executionMode === "fake";
    automated.push(
      mapClientRecord({
        id: "http-native",
        name: "Plain HTTP client",
        protocol: "Public HTTP",
        transport: "REST + SSE-capable endpoints",
        command: "native HTTP smoke profile (health + /v1/models + /chat)",
        outcome: { health: genericHealth, models: genericModels, chat: genericChat },
        status: genericCheck ? "verified" : "failed",
        checks: {
          healthReady: genericHealth.status === 200,
          modelListIncludesFakeModel: genericModels.body?.data?.some(
            (model) =>
              model?.id === "local-fake-model" &&
              model?.unified_ai?.execution_mode === "fake",
          ) === true,
          chatUsesFakeProvider:
            genericChat.status === 200 &&
            genericChat.body?.data?.executionMode === "fake",
        },
      }),
    );
  }

  const failedClients = automated
    .filter((entry) => entry.status === "failed")
    .map((entry) => entry.name);
  const manualVerified = manual.filter((entry) => entry.status === "verified").length;
  const manualPending = manual.filter(
    (entry) => entry.status === "manual" || entry.status === "manual-failed",
  ).length;
  const manualFailed = manual.filter((entry) => entry.status === "manual-failed").length;
  const extraFailureCount = requireManualEvidence && manualPending > 0 ? manualPending : 0;
  if (gatewayLogRemainder) inspectGatewayLogChunk("\n");
  const attemptedProviders = [...realProviderAttempts].sort();
  const providerSafetyFailureCount = attemptedProviders.length > 0 ? 1 : 0;
  const summary = {
    verified: automated.filter((entry) => entry.status === "verified").length,
    failed: failedClients.length + extraFailureCount + providerSafetyFailureCount,
    skipped: automated.filter((entry) => entry.status === "skipped").length,
    manual: manual.length,
    manualVerified,
    manualPending,
    manualFailed,
    failedClients: providerSafetyFailureCount > 0
      ? [...failedClients, "credential-free provider safety"]
      : failedClients,
    realProviderAttempts: attemptedProviders,
    manualFailedEntries: manual
      .filter((entry) => entry.status === "manual-failed")
      .map((entry) => `${entry.id || entry.name}: ${entry.notes}`),
    manualPendingEntries: manual
      .filter((entry) => entry.status === "manual")
      .map((entry) => `${entry.id || entry.name}: ${entry.notes}`),
  };

  await mkdir(evidenceOutputDir, { recursive: true });
  const timestamp = new Date().toISOString();
  const safeStamp = timestamp.replace(/[-:]/g, "").replace(".", "");
  const evidencePrefix = normalizeEvidencePrefix(
    getArgValue(rawArgs, "--evidence-prefix"),
  );
  const safePrefix = evidencePrefix ? `${evidencePrefix}-` : "";
  const jsonPath = resolve(evidenceOutputDir, `${safeStamp}-${safePrefix}client-runtimes.json`);
  const mdPath = resolve(evidenceOutputDir, `${safeStamp}-${safePrefix}client-runtimes.md`);

  result = {
    generatedAt: new Date().toISOString(),
    generatedBy: "tools/verify-client-runtimes.mjs",
    server: {
      baseUrl,
      host: "127.0.0.1",
      port,
      realProviderCalls: attemptedProviders.length > 0,
      attemptedProviders,
    },
    automated,
    manual,
    summary,
    evidenceJson: jsonPath,
    requestFilter: requestedClientIds
      ? [...requestedClientIds].sort()
      : ["all"],
    gatewayStdoutTail: gatewayOut,
    gatewayStderrTail: gatewayErr,
  };

  await writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  await writeFile(mdPath, renderMarkdownReport(result));

  process.stdout.write(`Saved automated client certification evidence to:\n${jsonPath}\n${mdPath}\n`);
  process.stdout.write(
    `Client certification summary: verified=${summary.verified} failed=${summary.failed} skipped=${summary.skipped} manual=${summary.manual} manual-verified=${summary.manualVerified} manual-pending=${summary.manualPending}\n`,
  );

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
} catch (error) {
  result = {
    generatedAt: new Date().toISOString(),
    generatedBy: "tools/verify-client-runtimes.mjs",
    error: error.message,
    server: {
      baseUrl,
      port,
      host: "127.0.0.1",
      realProviderCalls: realProviderAttempts.size > 0,
      attemptedProviders: [...realProviderAttempts].sort(),
    },
    automated: [],
    manual: [],
    summary: {
      verified: 0,
      failed: 1,
      skipped: 0,
      manual: 0,
      manualVerified: 0,
      manualPending: 0,
      manualFailed: 0,
    failedClients: ["gateway startup"],
    manualFailedEntries: [],
    manualPendingEntries: [],
  },
    evidenceJson: null,
    requestFilter: requestedClientIds ? [...requestedClientIds].sort() : ["all"],
  };
  process.stderr.write(`Client runtime verification failed to run: ${error.message}\n`);
  process.exitCode = 1;
}

stopProcess(gateway);
await new Promise((resolve) => setTimeout(resolve, 250));
if (gateway.exitCode === null) {
  gateway.kill("SIGKILL");
}
})();



