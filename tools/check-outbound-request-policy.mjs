import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(rootDir, "apps", "ai-gateway-service", "src");
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
  "providers/httpLlmProviderAdapter.js",
  "tools/webSearchTool.js",
];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return entry.isFile() && /\.(?:js|mjs|ts|mts)$/.test(entry.name) ? [absolute] : [];
  });
}

const failures = [];
for (const absolute of walk(sourceDir)) {
  const relative = path.relative(sourceDir, absolute).replace(/\\/g, "/");
  if (/\.(?:test|security\.test)\./.test(relative)) continue;
  const source = fs.readFileSync(absolute, "utf8");
  if (/\bfetch\s*\(/.test(source) && !allowedDirectFetchFiles.has(relative)) {
    failures.push(`${relative}: direct fetch() bypasses safeOutboundFetch`);
  }
}

for (const relative of requiredSafeFetchFiles) {
  const source = fs.readFileSync(path.join(sourceDir, relative), "utf8");
  if (!source.includes("safeOutboundFetch")) {
    failures.push(`${relative}: required safeOutboundFetch integration is missing`);
  }
}

if (failures.length > 0) {
  console.error("Outbound request policy check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Outbound request policy passed: ${requiredSafeFetchFiles.length} governed runtime integrations.`);
