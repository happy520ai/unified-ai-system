import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const rootPackagePath = path.join(repoRoot, "package.json");
const servicePackagePath = path.join(repoRoot, "apps", "ai-gateway-service", "package.json");
const inventoryPath = path.join(repoRoot, "docs", "phase323c-script-entrypoint-inventory.json");
const archiveCandidatePath = path.join(repoRoot, "docs", "phase323c-archive-candidate-scripts.json");
const governancePath = path.join(repoRoot, "docs", "phase323c-script-governance-policy.md");
const entrypointsDir = path.join(repoRoot, "apps", "ai-gateway-service", "src", "entrypoints");
const outputJsonPath = path.join(repoRoot, "docs", "phase323c-5-archive-candidate-review.json");
const outputMdPath = path.join(repoRoot, "docs", "phase323c-5-archive-candidate-review-report.md");

const protectedCoreNames = new Set([
  "check",
  "health:phase12a",
  "doctor:phase13a",
  "verify:phase322a-workbench-chat-gateway-real-nvidia",
  "verify:phase321a-workbench-product-recovery",
  "verify:phase319a-functional-landing",
  "verify:phase314a-chat-gateway-task-closure",
  "verify:phase313a-model-usability-matrix",
  "verify:phase312a-unified-model-library",
  "verify:phase107a-secret-safety",
]);

const activeSupportPatterns = [
  /phase32[12]a/i,
  /phase319a/i,
  /phase314a/i,
  /phase313a/i,
  /phase312a/i,
  /phase107a/i,
  /phase12a/i,
  /phase13a/i,
  /phase323c/i,
  /workbench/i,
  /chat-gateway/i,
  /model-usability/i,
  /model-library/i,
  /secret-safety/i,
  /provider-config/i,
  /diagnostics/i,
  /inventory/i,
  /governance/i,
  /recommended-command/i,
];

const lowRiskPatterns = [
  /copy/i,
  /docs/i,
  /readability/i,
  /polish/i,
  /guide/i,
  /navigation/i,
  /terminology/i,
  /microcopy/i,
  /accessibility/i,
  /quickstart/i,
  /index/i,
  /manifest/i,
  /report/i,
  /outline/i,
  /checklist/i,
  /notice/i,
  /closure/i,
  /decision/i,
];

const manualReviewPatterns = [
  /ui/i,
  /browser/i,
  /real/i,
  /runtime/i,
  /click/i,
  /acceptance/i,
  /trial/i,
  /manual/i,
  /preview/i,
  /desktop/i,
  /human/i,
  /product/i,
  /workflow/i,
  /agent/i,
  /workforce/i,
];

const forbiddenPatterns = [
  /deploy/i,
  /release/i,
  /commit/i,
  /push/i,
  /docker/i,
  /github/i,
  /publish/i,
  /remote/i,
];

function sample(items, limit = 8) {
  return items.slice(0, limit).map(({ label }) => label);
}

function createCategory() {
  return [];
}

function pushCategory(store, name, item) {
  store[name].push(item);
}

function hasPattern(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}

function toLabel(kind, scope, name) {
  return `${kind}:${scope}:${name}`;
}

async function main() {
  const [rootPackageRaw, servicePackageRaw, inventoryRaw, archiveRaw, governanceRaw, entrypointDirEntries] = await Promise.all([
    readFile(rootPackagePath, "utf8"),
    readFile(servicePackagePath, "utf8"),
    readFile(inventoryPath, "utf8"),
    readFile(archiveCandidatePath, "utf8"),
    readFile(governancePath, "utf8"),
    readdir(entrypointsDir, { withFileTypes: true }),
  ]);

  const rootPackage = JSON.parse(rootPackageRaw);
  const servicePackage = JSON.parse(servicePackageRaw);
  const inventory = JSON.parse(inventoryRaw);
  const archive = JSON.parse(archiveRaw);
  const governanceDigest = governanceRaw
    .split(/\r?\n/)
    .filter((line) => /^## /.test(line))
    .slice(0, 8);

  const categories = {
    protectedCore: createCategory(),
    activeSupport: createCategory(),
    historicalCompatible: createCategory(),
    archiveCandidateLowRisk: createCategory(),
    archiveCandidateNeedsManualReview: createCategory(),
    forbiddenDangerous: createCategory(),
    unknownReviewRequired: createCategory(),
  };

  const rootHistorical = new Set(inventory.scriptInventory?.root?.["historical-compatible"]?.items || []);
  const serviceHistorical = new Set(inventory.scriptInventory?.service?.["historical-compatible"]?.items || []);
  const rootForbidden = new Set(inventory.scriptInventory?.root?.["forbidden-touch"]?.items || []);
  const serviceForbidden = new Set(inventory.scriptInventory?.service?.["forbidden-touch"]?.items || []);
  const archiveCandidates = new Set([
    ...(archive.rootScripts || []),
    ...(archive.serviceScripts || []),
  ]);

  const seen = new Set();

  function classifyScript(scope, name) {
    const key = toLabel("script", scope, name);
    if (seen.has(key)) return;
    seen.add(key);

    const lower = name.toLowerCase();
    const item = { kind: "script", scope, name, label: key };

    if (protectedCoreNames.has(name)) {
      pushCategory(categories, "protectedCore", item);
      return;
    }
    if (rootForbidden.has(name) || serviceForbidden.has(name) || hasPattern(lower, forbiddenPatterns)) {
      pushCategory(categories, "forbiddenDangerous", item);
      return;
    }
    if (rootHistorical.has(name) || serviceHistorical.has(name)) {
      pushCategory(categories, "historicalCompatible", item);
      return;
    }
    if (hasPattern(lower, activeSupportPatterns)) {
      pushCategory(categories, "activeSupport", item);
      return;
    }
    if (archiveCandidates.has(name)) {
      if (hasPattern(lower, lowRiskPatterns)) {
        pushCategory(categories, "archiveCandidateLowRisk", item);
        return;
      }
      if (hasPattern(lower, manualReviewPatterns)) {
        pushCategory(categories, "archiveCandidateNeedsManualReview", item);
        return;
      }
      pushCategory(categories, "unknownReviewRequired", item);
      return;
    }
    pushCategory(categories, "unknownReviewRequired", item);
  }

  function classifyEntrypoint(name) {
    const key = toLabel("entrypoint", "service", name);
    if (seen.has(key)) return;
    seen.add(key);

    const lower = name.toLowerCase();
    const item = { kind: "entrypoint", scope: "service", name, label: key };

    if (
      name === "verifyPhase322AWorkbenchChatGatewayRealNvidia.js" ||
      name === "verifyPhase321AWorkbenchProductRecovery.js" ||
      name === "verifyPhase319AFunctionalLanding.js" ||
      name === "verifyPhase314AChatGatewayTaskClosure.js" ||
      name === "verifyPhase313AModelUsabilityMatrix.js" ||
      name === "verifyPhase312AUnifiedModelLibrary.js" ||
      name === "verifySecretSafety.js"
    ) {
      pushCategory(categories, "protectedCore", item);
      return;
    }
    if (hasPattern(lower, forbiddenPatterns)) {
      pushCategory(categories, "forbiddenDangerous", item);
      return;
    }
    if (hasPattern(lower, activeSupportPatterns)) {
      pushCategory(categories, "activeSupport", item);
      return;
    }
    if (archiveCandidates.has(name.replace(/\.js$/i, "").replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^-/, ""))) {
      if (hasPattern(lower, lowRiskPatterns)) {
        pushCategory(categories, "archiveCandidateLowRisk", item);
        return;
      }
      if (hasPattern(lower, manualReviewPatterns)) {
        pushCategory(categories, "archiveCandidateNeedsManualReview", item);
        return;
      }
    }
    if (hasPattern(lower, manualReviewPatterns)) {
      pushCategory(categories, "archiveCandidateNeedsManualReview", item);
      return;
    }
    if (hasPattern(lower, lowRiskPatterns)) {
      pushCategory(categories, "archiveCandidateLowRisk", item);
      return;
    }
    pushCategory(categories, "unknownReviewRequired", item);
  }

  Object.keys(rootPackage.scripts || {}).forEach((name) => classifyScript("root", name));
  Object.keys(servicePackage.scripts || {}).forEach((name) => classifyScript("service", name));
  entrypointDirEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => entry.name)
    .sort()
    .forEach((name) => classifyEntrypoint(name));

  const categorySummary = {
    protectedCore: {
      count: categories.protectedCore.length,
      samples: sample(categories.protectedCore),
      items: categories.protectedCore,
    },
    activeSupport: {
      count: categories.activeSupport.length,
      samples: sample(categories.activeSupport),
      items: categories.activeSupport,
    },
    historicalCompatible: {
      count: categories.historicalCompatible.length,
      samples: sample(categories.historicalCompatible),
      items: categories.historicalCompatible,
    },
    archiveCandidateLowRisk: {
      count: categories.archiveCandidateLowRisk.length,
      samples: sample(categories.archiveCandidateLowRisk),
      items: categories.archiveCandidateLowRisk,
    },
    archiveCandidateNeedsManualReview: {
      count: categories.archiveCandidateNeedsManualReview.length,
      samples: sample(categories.archiveCandidateNeedsManualReview),
      items: categories.archiveCandidateNeedsManualReview,
    },
    forbiddenDangerous: {
      count: categories.forbiddenDangerous.length,
      samples: sample(categories.forbiddenDangerous),
      items: categories.forbiddenDangerous,
    },
    unknownReviewRequired: {
      count: categories.unknownReviewRequired.length,
      samples: sample(categories.unknownReviewRequired),
      items: categories.unknownReviewRequired,
    },
  };

  const outputJson = {
    phase: "Phase323C-5",
    generatedAt: new Date().toISOString(),
    inputs: {
      rootPackagePath,
      servicePackagePath,
      inventoryPath,
      archiveCandidatePath,
      governancePath,
      entrypointsDir,
    },
    notes: {
      staticOnly: true,
      executedCandidateScripts: false,
      deletedScripts: false,
      movedEntrypoints: false,
      governanceDigest,
    },
    categories: categorySummary,
  };

  const outputMd = [
    "# Phase323C-5 Archive Candidate Review Report",
    "",
    "本报告基于静态分析生成。",
    "",
    "- staticOnly: true",
    "- executedCandidateScripts: false",
    "- deletedScripts: false",
    "- movedEntrypoints: false",
    "- package script 语义未改变",
    "",
    "## Category Summary",
    "",
    `- protected-core: ${categorySummary.protectedCore.count}`,
    `- active-support: ${categorySummary.activeSupport.count}`,
    `- historical-compatible: ${categorySummary.historicalCompatible.count}`,
    `- archive-candidate-low-risk: ${categorySummary.archiveCandidateLowRisk.count}`,
    `- archive-candidate-needs-manual-review: ${categorySummary.archiveCandidateNeedsManualReview.count}`,
    `- forbidden-dangerous: ${categorySummary.forbiddenDangerous.count}`,
    `- unknown-review-required: ${categorySummary.unknownReviewRequired.count}`,
    "",
    "## Protected Core",
    ...categorySummary.protectedCore.samples.map((item) => `- ${item}`),
    "",
    "## Active Support",
    ...categorySummary.activeSupport.samples.map((item) => `- ${item}`),
    "",
    "## Historical Compatible",
    ...categorySummary.historicalCompatible.samples.map((item) => `- ${item}`),
    "",
    "## Archive Candidate Low Risk",
    ...categorySummary.archiveCandidateLowRisk.samples.map((item) => `- ${item}`),
    "",
    "## Archive Candidate Needs Manual Review",
    ...categorySummary.archiveCandidateNeedsManualReview.samples.map((item) => `- ${item}`),
    "",
    "## Forbidden Dangerous",
    ...categorySummary.forbiddenDangerous.samples.map((item) => `- ${item}`),
    "",
    "## Unknown Review Required",
    ...categorySummary.unknownReviewRequired.samples.map((item) => `- ${item}`),
    "",
    "## Notes",
    "",
    "- 本轮不删除 scripts，不移动 entrypoints，不重命名任何入口。",
    "- 本轮不执行候选脚本，只做静态分类。",
    "- `archive-candidate-needs-manual-review` 与 `unknown-review-required` 必须继续人工复核后，才可进入未来 archive plan。",
    "",
  ].join("\n");

  await Promise.all([
    writeFile(outputJsonPath, JSON.stringify(outputJson, null, 2), "utf8"),
    writeFile(outputMdPath, outputMd, "utf8"),
  ]);

  process.stdout.write(JSON.stringify({
    status: "pass",
    outputJsonPath,
    outputMdPath,
    protectedCoreCount: categorySummary.protectedCore.count,
    historicalCompatibleCount: categorySummary.historicalCompatible.count,
    archiveCandidateLowRiskCount: categorySummary.archiveCandidateLowRisk.count,
    archiveCandidateNeedsManualReviewCount: categorySummary.archiveCandidateNeedsManualReview.count,
    forbiddenDangerousCount: categorySummary.forbiddenDangerous.count,
    unknownReviewRequiredCount: categorySummary.unknownReviewRequired.count,
  }, null, 2) + "\n");
}

main().catch((error) => {
  console.error("[phase323c] failed to build archive review:", error.message);
  process.exitCode = 1;
});
