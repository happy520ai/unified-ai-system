import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(rootDir, "apps", "ai-gateway-service", "src");
const packagesDir = path.join(rootDir, "packages");
const allowedDirectFetchFiles = new Set([
  "capabilities/neuronCodeGenerator.js",
  "entrypoints/entrypointUtils.js",
  "entrypoints/smokeNvidiaRoute.js",
  "entrypoints/smokeOpenAiRoute.js",
]);
const requiredSafeFetchFiles = [
  "alerting/alertEngine.js",
  "automation/commandPaletteProviderHandlers.js",
  "capabilities/godReviewCellExecutor-gateway.js",
  "capabilities/tianshuPlannerStorage.js",
  "claude-code-patterns/mcpTransports.js",
  "claude-code-patterns/sandboxTools.js",
  "enterprise/oauth2Provider.js",
  "http/httpServerCapabilityRoutes.js",
  "http/httpServerRoutes03.js",
  "knowledge/vectorProductionProbe.js",
  "model-import/modelImportService.js",
  "model-import/providerProbeRegistry.js",
  "model-library/nvidiaCatalogDiscovery.js",
  "providers/httpLlmProviderAdapter.js",
  "providers/multimodalHttpHelpers.js",
  "providers/multimodalProviderAdapter.js",
  "providers/nvidia/nvidiaUnifiedClient.js",
  "tools/webSearchTool.js",
];

// packages/* run in-process with the gateway; direct fetch is only tolerated
// with an explicit reason. Forge's own-gateway clients talk to a fixed
// 127.0.0.1 gatewayUrl; the dashboard helper is browser-side script; the
// skills searcher targets api.github.com; mcp-server validates its target;
// shared-sdk/shared-utils are client libraries and offline scripts; im
// connectors post to operator-configured webhooks.
const allowedPackageDirectFetchFiles = new Set([
  "forge-core/src/forge-dashboard/render-helpers.js", // browser-side dashboard script
  "forge-core/src/gateway-bridge/index.js", // fixed own-gateway URL
  "forge-core/src/gateway-bridge/utils.js", // fixed own-gateway URL
  "forge-core/src/gateway-lifecycle/index.js", // fixed own-gateway URL
  "forge-core/src/llm-client.js", // fixed own-gateway URL
  "forge-core/src/llm-client-helpers.js", // guarded by isObviouslyUnsafeNetworkTarget
  "forge-core/src/multimodal-client/helpers.js", // guarded by isObviouslyUnsafeNetworkTarget
  "forge-core/src/skills/githubSkillSearcher.js", // api.github.com only
  "forge-core/src/verification/smokeTest.js", // fixed 127.0.0.1 target
  "im-connector-feishu/src/index.js", // operator-configured webhook target
  "im-connector-wecom/src/index.js", // operator-configured webhook target
  "mcp-server/src/runtime.js", // loopback-or-HTTPS validated target
  "shared-sdk/src/index.js", // client library pointed at the user's gateway
  "shared-utils/src/index.js", // offline entrypoint scripts only
]);
const requiredPackageMarkers = new Map([
  ["forge-core/src/llm-client-helpers.js", "isObviouslyUnsafeNetworkTarget"],
  ["forge-core/src/multimodal-client/helpers.js", "isObviouslyUnsafeNetworkTarget"],
  ["im-connector-feishu/src/index.js", "externalEffectGuard.reserveAndCommit"],
  ["im-connector-wecom/src/index.js", "externalEffectGuard.reserveAndCommit"],
]);
const requiredExternalEffectMarkers = new Map([
  ["alerting/alertEngine.js", "externalEffectGuard.reserveAndCommit"],
  ["http/httpServerCapabilityRoutes.js", "reserveWebhookExternalEffect"],
  ["http/httpServerRoutes03.js", "reserveWebhookExternalEffect"],
]);
const requiredMcpEffectMarkers = new Map([
  ["agentic/agenticCodingLoop-helpers.js", "context.commitExternalEffect"],
  ["application/createGatewayApplication.js", "externalEffectGate"],
  ["http/httpServerRoutes03.js", "readExternalEffectKeyContext"],
  ["mcpGateway/mcpExternalEffectPolicy.ts", "gate.reserve"],
  ["mcpGateway/mcpGatewayService.ts", "reserveMcpExternalEffect"],
  ["tools/mcpToolAdapter.js", "context.commitExternalEffect"],
]);
const requiredCustomToolMarkers = [
  ["claude-code-patterns/toolRegistryEngine.js", "TOOL_BUILTIN_OVERRIDE_BLOCKED"],
  ["claude-code-patterns/toolRegistryEngine.js", "CUSTOM_TOOL_EFFECT_CONTRACT_REQUIRED"],
];
const governedMcpDirectUseRules = [
  {
    pattern: /mcpBridge\.callTool\s*\(/,
    allowed: new Set([
      "agentic/agenticCodingLoop-helpers.js",
      "tools/mcpToolAdapter.js",
    ]),
    label: "mcpBridge.callTool",
  },
  {
    pattern: /upstream\.client\.callTool\s*\(/,
    allowed: new Set(["mcpGateway/mcpGatewayService.ts"]),
    label: "upstream.client.callTool",
  },
  {
    pattern: /createMcpUpstreamFromConfig\s*\(/,
    allowed: new Set([
      "mcpGateway/mcpGatewayService.ts",
      "mcpGateway/mcpUpstreamClient.ts",
    ]),
    label: "createMcpUpstreamFromConfig",
  },
  {
    pattern: /createOpenApiRestBridge\s*\(/,
    allowed: new Set([
      "mcpGateway/mcpGatewayService.ts",
      "mcpGateway/openApiRestBridge.ts",
    ]),
    label: "createOpenApiRestBridge",
  },
];

// Aliased native fetch (e.g. fetchImpl = globalThis.fetch) previously escaped
// the literal fetch( scan, so detect the bare reference too.
function usesDirectFetch(source) {
  return /\bfetch\s*\(/.test(source) || /globalThis\.fetch\b/.test(source);
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return entry.isFile() && /\.(?:js|mjs|ts|mts)$/.test(entry.name) ? [absolute] : [];
  });
}

const failures = [];
for (const absolute of walk(sourceDir)) {
  const relative = path.relative(sourceDir, absolute).split(path.sep).join("/");
  if (/\.(?:test|security\.test)\./.test(relative)) continue;
  const source = fs.readFileSync(absolute, "utf8");
  if (usesDirectFetch(source) && !allowedDirectFetchFiles.has(relative)) {
    failures.push(`${relative}: direct fetch() or globalThis.fetch bypasses safeOutboundFetch`);
  }
  for (const rule of governedMcpDirectUseRules) {
    if (rule.pattern.test(source) && !rule.allowed.has(relative)) {
      failures.push(`${relative}: ${rule.label} bypasses the governed MCP external-effect boundary`);
    }
  }
}

for (const packageDir of fs.readdirSync(packagesDir, { withFileTypes: true })) {
  if (!packageDir.isDirectory()) continue;
  const packageSrc = path.join(packagesDir, packageDir.name, "src");
  if (!fs.existsSync(packageSrc)) continue;
  for (const absolute of walk(packageSrc)) {
    const relative = path.relative(packagesDir, absolute).split(path.sep).join("/");
    if (/\.(?:test|security\.test)\./.test(relative)) continue;
    const source = fs.readFileSync(absolute, "utf8");
    if (usesDirectFetch(source) && !allowedPackageDirectFetchFiles.has(relative)) {
      failures.push(`${relative}: direct fetch() in packages/ bypasses the outbound policy`);
    }
  }
}

for (const relative of requiredSafeFetchFiles) {
  const source = fs.readFileSync(path.join(sourceDir, relative), "utf8");
  if (!source.includes("safeOutboundFetch")) {
    failures.push(`${relative}: required safeOutboundFetch integration is missing`);
  }
}

for (const [relative, marker] of requiredPackageMarkers) {
  const source = fs.readFileSync(path.join(packagesDir, relative), "utf8");
  if (!source.includes(marker)) {
    failures.push(`${relative}: required guard ${marker} is missing`);
  }
}

for (const [relative, marker] of requiredExternalEffectMarkers) {
  const source = fs.readFileSync(path.join(sourceDir, relative), "utf8");
  if (!source.includes(marker)) {
    failures.push(`${relative}: required irreversible-effect guard ${marker} is missing`);
  }
}

for (const [relative, marker] of requiredMcpEffectMarkers) {
  const source = fs.readFileSync(path.join(sourceDir, relative), "utf8");
  if (!source.includes(marker)) {
    failures.push(`${relative}: required MCP external-effect guard ${marker} is missing`);
  }
}

for (const [relative, marker] of requiredCustomToolMarkers) {
  const source = fs.readFileSync(path.join(sourceDir, relative), "utf8");
  if (!source.includes(marker)) {
    failures.push(`${relative}: required custom-tool authority guard ${marker} is missing`);
  }
}

const ciWorkflow = fs.readFileSync(path.join(rootDir, ".github", "workflows", "ci.yml"), "utf8");
if (!ciWorkflow.includes("externalEffectGate.postgres.integration.test.ts")) {
  failures.push("ci.yml: real PostgreSQL external-effect integration coverage is missing");
}
if (!ciWorkflow.includes("pnpm drill:postgres-recovery")) {
  failures.push("ci.yml: destructive PostgreSQL logical recovery coverage is missing");
}
if (!ciWorkflow.includes("verify-postgres-recovery-drill.mjs")) {
  failures.push("ci.yml: structured PostgreSQL recovery evidence verification is missing");
}

if (failures.length > 0) {
  console.error("Outbound request policy check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Outbound request policy passed: ${requiredSafeFetchFiles.length} governed runtime integrations.`);
