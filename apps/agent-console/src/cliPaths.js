// Extracted verbatim from cli-core.js so the module-load path constants and
// the JSON reader live beside the command modules that use them. Pure
// mechanical move; behaviour unchanged.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const cliDirectory = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(cliDirectory, "../../..");
export const serviceEntrypoint = resolve(
  repoRoot,
  "apps/ai-gateway-service/src/index.js",
);
export const demoEntrypoint = resolve(repoRoot, "tools/terminal-demo.mjs");
export const workspaceManifest = resolve(repoRoot, "pnpm-workspace.yaml");
export const rootPackage = readJson(resolve(repoRoot, "package.json"));
export const usageReportUrl =
  "https://github.com/happy520ai/unified-ai-system/issues/new?template=usage-verification-report.yml";

export const CLI_VERSION = rootPackage.version;
export const DEFAULT_GATEWAY_URL =
  process.env.AI_GATEWAY_SERVICE_URL ?? "http://127.0.0.1:3100";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
