import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildCodexContextCodecBridge } from "../../packages/codex-context-gateway/src/contextCodecBridge.js";
import { appendContextCodecPromptPackSection } from "../../packages/codex-context-gateway/src/contextCodecPromptPackBuilder.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const bridge = await buildCodexContextCodecBridge({ repoRoot, output: true });
const promptPackPreview = appendContextCodecPromptPackSection(
  "Phase641R prompt-pack dry-run preview.",
  bridge.yaml.compactContext,
);

const result = {
  phase: "Phase641R-AIO",
  name: "Codex Subgateway Context Codec Bridge",
  completed: bridge.completed,
  codexSubgatewayCodecAvailable: true,
  sharedCoreUsed: bridge.sharedCoreUsed,
  promptPackContextCodecSectionAdded: promptPackPreview.includes("[Context Codec Compact State]"),
  providerCallsMade: false,
  secretRead: false,
  secretValueExposed: false,
  codexConfigModified: false,
  codexBaseUrlModified: false,
  outputs: bridge.outputs,
  tokenReport: bridge.tokenReport,
  factRecoveryReport: bridge.factRecoveryReport,
};

await mkdir(path.join(repoRoot, "apps/ai-gateway-service/evidence/phase641r"), { recursive: true });
await writeFile(
  path.join(repoRoot, "apps/ai-gateway-service/evidence/phase641r/codex-subgateway-context-codec-bridge.json"),
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8",
);
await writeFile(
  path.join(repoRoot, "apps/ai-gateway-service/evidence/phase641r/codex-subgateway-context-codec-bridge-result.json"),
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8",
);

console.log(JSON.stringify(result, null, 2));
