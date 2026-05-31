import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const deprecatedIndexJsonPath = path.join(repoRoot, "docs", "phase323c-6-deprecated-index.json");
const deprecatedIndexMdPath = path.join(repoRoot, "docs", "phase323c-6-deprecated-index.md");
const archiveReviewJsonPath = path.join(repoRoot, "docs", "phase323c-5-archive-candidate-review.json");
const archivePlanMdPath = path.join(repoRoot, "docs", "phase323c-6-archive-plan.md");
const governancePath = path.join(repoRoot, "docs", "phase323c-script-governance-policy.md");
const serviceGovernancePath = path.join(repoRoot, "docs", "phase323c-service-command-governance-policy.md");
const rootPackagePath = path.join(repoRoot, "package.json");
const servicePackagePath = path.join(repoRoot, "apps", "ai-gateway-service", "package.json");
const outputMdPath = path.join(repoRoot, "docs", "phase323c-7-deprecated-human-review-checklist.md");
const outputJsonPath = path.join(repoRoot, "docs", "phase323c-7-deprecated-human-review-checklist.json");

function toReviewItems(items = [], priority, category, reason, proposedHumanAction, futureAction) {
  return items.map((item) => ({
    id: item.label,
    name: item.name,
    source: `${item.kind}:${item.scope}`,
    category,
    priority,
    reason,
    proposedHumanAction,
    futureAction,
    riskNotes: buildRiskNotes(category, item),
  }));
}

function buildRiskNotes(category, item) {
  if (category === "forbidden-dangerous") {
    return "涉及 release / deploy / commit / push / docker / remote 类边界，只允许保留索引，不允许默认执行。";
  }
  if (category === "unknown-review-required") {
    return "用途未明，必须人工确认来源、依赖者与是否仍有验证价值。";
  }
  if (category === "archive-candidate-needs-manual-review") {
    return "可能涉及旧 UI、旧 marker、preview-only 或重复验证，不得自动归档。";
  }
  if (category === "archive-candidate-low-risk") {
    return "可进入未来小批量归档候选，但仍需至少一次人工确认。";
  }
  if (category === "historical-compatible") {
    return "历史兼容入口，短期保留，避免破坏旧文档或历史流程。";
  }
  return item.kind === "entrypoint"
    ? "主链或核心 verifier entrypoint，禁止归档。"
    : "主链或核心 script，禁止归档。";
}

function sample(items = [], limit = 8) {
  return items.slice(0, limit).map((item) => item.id);
}

async function main() {
  const [
    deprecatedIndexRaw,
    deprecatedIndexMdRaw,
    archiveReviewRaw,
    archivePlanRaw,
    governanceRaw,
    serviceGovernanceRaw,
    rootPackageRaw,
    servicePackageRaw,
  ] = await Promise.all([
    readFile(deprecatedIndexJsonPath, "utf8"),
    readFile(deprecatedIndexMdPath, "utf8"),
    readFile(archiveReviewJsonPath, "utf8"),
    readFile(archivePlanMdPath, "utf8"),
    readFile(governancePath, "utf8"),
    readFile(serviceGovernancePath, "utf8"),
    readFile(rootPackagePath, "utf8"),
    readFile(servicePackagePath, "utf8"),
  ]);

  const deprecatedIndex = JSON.parse(deprecatedIndexRaw);
  const archiveReview = JSON.parse(archiveReviewRaw);
  const rootPackage = JSON.parse(rootPackageRaw);
  const servicePackage = JSON.parse(servicePackageRaw);
  const categories = archiveReview.categories ?? {};

  const priority0 = toReviewItems(
    categories.forbiddenDangerous?.items || [],
    0,
    "forbidden-dangerous",
    "禁止默认执行，必须只保留为风险索引或历史资产。",
    "确认是否仍被任何文档引用；如保留，仅标记 forbidden-do-not-run。",
    "forbidden-do-not-run",
  );
  const priority1 = toReviewItems(
    categories.unknownReviewRequired?.items || [],
    1,
    "unknown-review-required",
    "用途未明，不能自动归档或删除。",
    "人工确认来源、用途、当前依赖方与是否仍有验证价值。",
    "unknown-review-required",
  );
  const priority2 = toReviewItems(
    categories.archiveCandidateNeedsManualReview?.items || [],
    2,
    "archive-candidate-needs-manual-review",
    "存在旧 UI、旧 marker、preview-only 或重复验证风险。",
    "确认是否仍服务于当前产品链路；若否，再进入 future archive 候选池。",
    "manual-review",
  );
  const priority3 = toReviewItems(
    categories.archiveCandidateLowRisk?.items || [],
    3,
    "archive-candidate-low-risk",
    "低风险候选，但仍不可自动归档。",
    "至少完成一次人工确认，再考虑进入小批量 future archive。",
    "candidate-for-future-archive",
  );
  const priority4 = toReviewItems(
    categories.historicalCompatible?.items || [],
    4,
    "historical-compatible",
    "历史兼容入口，短期不建议删除。",
    "保留兼容定位，补充关联文档即可，不进入短期归档。",
    "keep",
  );
  const priority5 = toReviewItems(
    categories.protectedCore?.items || [],
    5,
    "protected-core",
    "主链、核心 verifier 或核心 entrypoint，永久保护。",
    "禁止归档，禁止删除，后续仅允许补充说明。",
    "protected-do-not-touch",
  );

  const checklist = {
    phase: "Phase323C-7",
    generatedAt: new Date().toISOString(),
    sourceReports: [
      path.relative(repoRoot, deprecatedIndexJsonPath),
      path.relative(repoRoot, deprecatedIndexMdPath),
      path.relative(repoRoot, archiveReviewJsonPath),
      path.relative(repoRoot, archivePlanMdPath),
    ],
    summary: {
      protectedCore: archiveReview.categories?.protectedCore?.count ?? 0,
      historicalCompatible: archiveReview.categories?.historicalCompatible?.count ?? 0,
      archiveCandidateLowRisk: archiveReview.categories?.archiveCandidateLowRisk?.count ?? 0,
      archiveCandidateNeedsManualReview: archiveReview.categories?.archiveCandidateNeedsManualReview?.count ?? 0,
      forbiddenDangerous: archiveReview.categories?.forbiddenDangerous?.count ?? 0,
      unknownReviewRequired: archiveReview.categories?.unknownReviewRequired?.count ?? 0,
      rootScriptCount: Object.keys(rootPackage.scripts || {}).length,
      serviceScriptCount: Object.keys(servicePackage.scripts || {}).length,
    },
    declarations: {
      deleteScripts: false,
      moveEntrypoints: false,
      renameScripts: false,
      changePackageScripts: false,
      executeCandidateScripts: false,
      runReleaseDeployCommitPushDockerGithubReleaseScripts: false,
      staticOnly: true,
    },
    priorities: [
      {
        priority: 0,
        label: "forbidden-dangerous",
        futureAction: "forbidden-do-not-run",
        items: priority0,
      },
      {
        priority: 1,
        label: "unknown-review-required",
        futureAction: "unknown-review-required",
        items: priority1,
      },
      {
        priority: 2,
        label: "archive-candidate-needs-manual-review",
        futureAction: "manual-review",
        items: priority2,
      },
      {
        priority: 3,
        label: "archive-candidate-low-risk",
        futureAction: "candidate-for-future-archive",
        items: priority3,
      },
      {
        priority: 4,
        label: "historical-compatible",
        futureAction: "keep",
        items: priority4,
      },
      {
        priority: 5,
        label: "protected-core",
        futureAction: "protected-do-not-touch",
        items: priority5,
      },
    ],
    governanceDigest: {
      root: governanceRaw.split(/\r?\n/).filter((line) => line.startsWith("## ")).slice(0, 6),
      service: serviceGovernanceRaw.split(/\r?\n/).filter((line) => line.startsWith("## ")).slice(0, 6),
    },
    manualReviewWorkflow: [
      "确认脚本 / entrypoint 当前是否仍被 package scripts、verifier、docs 或 evidence 引用。",
      "确认是否影响 Phase322A 主链、5 个 Workbench 主模块、secret safety 或当前推荐命令索引。",
      "确认是否仅为历史兼容、preview-only、旧 UI、旧 marker 或重复验证。",
      "只有在人工复核完成后，才可进入未来独立 archive 阶段。",
      "任何真实归档必须另开阶段，并重新执行回归验证。",
    ],
  };

  const markdown = [
    "# Phase323C-7 Deprecated Human Review Checklist",
    "",
    "## 本轮不执行声明",
    "",
    "- 不删除 scripts。",
    "- 不移动 entrypoints。",
    "- 不改 package scripts。",
    "- 不执行候选脚本。",
    "- 不运行 release / deploy / commit / push / docker publish / GitHub release 类脚本。",
    "",
    "## 人工复核优先级",
    "",
    `- Priority 0 forbidden-dangerous: ${priority0.length}`,
    `- Priority 1 unknown-review-required: ${priority1.length}`,
    `- Priority 2 archive-candidate-needs-manual-review: ${priority2.length}`,
    `- Priority 3 archive-candidate-low-risk: ${priority3.length}`,
    `- Priority 4 historical-compatible: ${priority4.length}`,
    `- Priority 5 protected-core: ${priority5.length}`,
    "",
    "## 人工复核流程",
    "",
    "- 先确认来源、用途、当前依赖方，再决定是否进入未来 archive 候选。",
    "- `forbidden-dangerous` 只允许标记为 `forbidden-do-not-run`。",
    "- `unknown-review-required` 与 `archive-candidate-needs-manual-review` 不得自动归档。",
    "- `archive-candidate-low-risk` 仍需至少一次人工确认。",
    "- 任何真实归档必须另开阶段，并执行回归验证。",
    "",
    "## Representative Samples",
    "",
    "### Priority 0 forbidden-dangerous",
    ...sample(priority0).map((item) => `- ${item}`),
    "",
    "### Priority 1 unknown-review-required",
    ...sample(priority1).map((item) => `- ${item}`),
    "",
    "### Priority 2 archive-candidate-needs-manual-review",
    ...sample(priority2).map((item) => `- ${item}`),
    "",
    "### Priority 3 archive-candidate-low-risk",
    ...sample(priority3).map((item) => `- ${item}`),
    "",
    "## Future Action Vocabulary",
    "",
    "- `keep`",
    "- `protected-do-not-touch`",
    "- `manual-review`",
    "- `deprecate-index-only`",
    "- `candidate-for-future-archive`",
    "- `forbidden-do-not-run`",
    "- `unknown-review-required`",
    "",
  ].join("\n");

  await Promise.all([
    writeFile(outputJsonPath, JSON.stringify(checklist, null, 2), "utf8"),
    writeFile(outputMdPath, markdown, "utf8"),
  ]);

  process.stdout.write(JSON.stringify({
    status: "pass",
    outputJsonPath,
    outputMdPath,
    priority0ForbiddenCount: priority0.length,
    priority1UnknownCount: priority1.length,
    priority2ManualReviewCount: priority2.length,
    priority3LowRiskCount: priority3.length,
  }, null, 2) + "\n");
}

main().catch((error) => {
  console.error("[phase323c] failed to build human review checklist:", error.message);
  process.exitCode = 1;
});
