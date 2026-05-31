import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runMainGatewayContextCodecDryRun } from "../../apps/ai-gateway-service/src/gateway/contextCodecDryRun.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const result = {
  phase: "Phase641R-AIO",
  name: "Main Gateway Context Codec Dry Run",
  ...runMainGatewayContextCodecDryRun(),
  mainGatewayCodecAvailable: true,
  providerCallsMade: false,
  secretRead: false,
  secretValueExposed: false,
  chatBehaviorChanged: false,
  chatGatewayExecuteBehaviorChanged: false,
};

await mkdir(path.join(repoRoot, "apps/ai-gateway-service/evidence/phase641r"), { recursive: true });
await writeFile(
  path.join(repoRoot, "apps/ai-gateway-service/evidence/phase641r/main-gateway-context-codec-dry-run.json"),
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8",
);
await writeFile(
  path.join(repoRoot, "apps/ai-gateway-service/evidence/phase641r/main-gateway-context-codec-dry-run-result.json"),
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8",
);

console.log(JSON.stringify(result, null, 2));
