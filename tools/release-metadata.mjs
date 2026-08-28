import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  readFileSync(resolve(repoRoot, "package.json"), "utf8"),
);

if (!/^\d+\.\d+\.\d+$/.test(packageJson.version ?? "")) {
  throw new Error("package.json must declare an exact semantic release version.");
}

export const releaseVersion = packageJson.version;
export const gatewayImage =
  `ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:${releaseVersion}`;
export const mcpImage =
  `ghcr.io/happy520ai/unified-ai-system/mcp-server:${releaseVersion}`;
export const indexNowUserAgent = `unified-ai-system-indexnow/${releaseVersion}`;
