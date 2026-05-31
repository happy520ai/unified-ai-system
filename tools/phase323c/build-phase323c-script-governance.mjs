import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const inventoryPath = resolve(repoRoot, "docs/phase323c-script-entrypoint-inventory.json");
const rootPackagePath = resolve(repoRoot, "package.json");
const servicePackagePath = resolve(repoRoot, "apps/ai-gateway-service/package.json");

const governancePolicyPath = resolve(repoRoot, "docs/phase323c-script-governance-policy.md");
const recommendedIndexPath = resolve(repoRoot, "docs/phase323c-recommended-command-index.md");
const archiveCandidateJsonPath = resolve(repoRoot, "docs/phase323c-archive-candidate-scripts.json");

const recommendedCommands = {
  "基础健康": [
    "cmd /c pnpm run health:phase12a",
    "cmd /c pnpm run doctor:phase13a",
    "cmd /c pnpm -r --if-present check",
  ],
  "Workbench 主链": [
    "cmd /c pnpm run verify:phase321a-workbench-product-recovery",
    "cmd /c pnpm run verify:phase322a-workbench-chat-gateway-real-nvidia",
  ],
  "模型库": [
    "cmd /c pnpm run verify:phase313a-model-usability-matrix",
    "cmd /c pnpm run verify:phase312a-unified-model-library",
  ],
  "安全": [
    "cmd /c pnpm run verify:phase107a-secret-safety",
  ],
  inventory: [
    "cmd /c node tools\\phase323c\\build-phase323c-inventory.mjs",
    "cmd /c node tools\\phase323c\\build-phase323c-script-governance.mjs",
  ],
};

const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));
const servicePackage = JSON.parse(await readFile(servicePackagePath, "utf8"));

const rootScripts = Object.keys(rootPackage.scripts ?? {}).sort();
const serviceScripts = Object.keys(servicePackage.scripts ?? {}).sort();

const governance = buildGovernance(inventory, rootScripts, serviceScripts);

await mkdir(resolve(repoRoot, "docs"), { recursive: true });
await writeFile(governancePolicyPath, renderGovernancePolicy(governance), "utf8");
await writeFile(recommendedIndexPath, renderRecommendedIndex(), "utf8");
await writeFile(archiveCandidateJsonPath, `${JSON.stringify(governance.archiveCandidates, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      status: "pass",
      governancePolicyPath,
      recommendedIndexPath,
      archiveCandidateJsonPath,
      archiveCandidateCount: governance.archiveCandidates.totalCount,
    },
    null,
    2,
  ),
);

function buildGovernance(inventoryData, rootScriptNames, serviceScriptNames) {
  const coreDaily = unique([
    "health:phase12a",
    "doctor:phase13a",
    "check",
  ]);
  const productRegression = unique([
    "verify:phase321a-workbench-product-recovery",
    "verify:phase319a-functional-landing",
  ]);
  const providerModelRegression = unique([
    "verify:phase322a-workbench-chat-gateway-real-nvidia",
    "verify:phase313a-model-usability-matrix",
    "verify:phase312a-unified-model-library",
    "verify:phase314a-chat-gateway-task-closure",
  ]);
  const securityBoundary = unique([
    "verify:phase107a-secret-safety",
  ]);

  const historicalCompatible = unique([
    ...inventoryData.scriptInventory.root["historical-compatible"].items,
    ...inventoryData.scriptInventory.service["historical-compatible"].items,
  ]);
  const archiveCandidates = unique([
    ...inventoryData.scriptInventory.root["archive-candidate"].items,
    ...inventoryData.scriptInventory.service["archive-candidate"].items,
  ]);
  const forbiddenDangerous = unique([
    ...inventoryData.scriptInventory.root["forbidden-touch"].items,
    ...inventoryData.scriptInventory.service["forbidden-touch"].items,
  ]);

  return {
    tiers: {
      "tier-0-core-daily": {
        description: "日常最小健康与语法检查入口。",
        commands: coreDaily.filter((item) => rootScriptNames.includes(item) || item === "check"),
      },
      "tier-1-product-regression": {
        description: "当前 Workbench 产品面与可见 UI 回归。",
        commands: productRegression.filter((item) => rootScriptNames.includes(item)),
      },
      "tier-2-provider-model-regression": {
        description: "模型可用性与真实 Provider 主链相关回归。",
        commands: providerModelRegression.filter((item) => rootScriptNames.includes(item)),
      },
      "tier-3-security-boundary": {
        description: "secret / redaction / 安全边界检查。",
        commands: securityBoundary.filter((item) => rootScriptNames.includes(item)),
      },
      "tier-4-historical-compatible": {
        description: "历史兼容脚本，允许保留但不建议作为默认入口。",
        commands: historicalCompatible,
      },
      "tier-5-archive-candidate": {
        description: "候选归档脚本，只做清单追踪，不删除。",
        commands: archiveCandidates,
      },
      "tier-6-forbidden-dangerous": {
        description: "与当前阶段边界冲突、不得作为默认入口的高风险脚本。",
        commands: forbiddenDangerous,
      },
    },
    archiveCandidates: {
      phase: "Phase323C-2",
      generatedAt: new Date().toISOString(),
      totalCount: archiveCandidates.length,
      rootScripts: inventoryData.scriptInventory.root["archive-candidate"].items,
      serviceScripts: inventoryData.scriptInventory.service["archive-candidate"].items,
    },
    serviceScriptCount: serviceScriptNames.length,
  };
}

function renderGovernancePolicy(governance) {
  const lines = [
    "# Phase323C Script Governance Policy",
    "",
    "本文件只定义 scripts 分层治理策略，不删除任何既有脚本。",
    "",
  ];

  for (const [tier, info] of Object.entries(governance.tiers)) {
    lines.push(`## ${tier}`);
    lines.push("");
    lines.push(`- 说明：${info.description}`);
    lines.push(`- 数量：${info.commands.length}`);
    for (const command of info.commands.slice(0, 120)) {
      lines.push(`- ${command}`);
    }
    if (info.commands.length > 120) {
      lines.push(`- ... and ${info.commands.length - 120} more`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function renderRecommendedIndex() {
  const lines = [
    "# Phase323C Recommended Command Index",
    "",
    "以下命令是当前长期推荐入口。历史脚本仍保留，但不应作为默认入口继续扩散。",
    "",
  ];

  for (const [section, commands] of Object.entries(recommendedCommands)) {
    lines.push(`## ${section}`);
    lines.push("");
    for (const command of commands) {
      lines.push(`- \`${command}\``);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function unique(items) {
  return [...new Set(items)];
}
