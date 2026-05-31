import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const reviewJsonPath = path.join(repoRoot, "docs", "phase323c-5-archive-candidate-review.json");
const reviewReportPath = path.join(repoRoot, "docs", "phase323c-5-archive-candidate-review-report.md");
const inventoryPath = path.join(repoRoot, "docs", "phase323c-script-entrypoint-inventory.json");
const governancePath = path.join(repoRoot, "docs", "phase323c-script-governance-policy.md");
const serviceGovernancePath = path.join(repoRoot, "docs", "phase323c-service-command-governance-policy.md");
const outputPath = path.join(repoRoot, "docs", "phase323c-6-archive-plan.md");

function takeLabels(items = [], limit = 8) {
  return items.slice(0, limit).map((item) => item.label);
}

async function main() {
  const [reviewRaw, reviewReportRaw, inventoryRaw, governanceRaw, serviceGovernanceRaw] = await Promise.all([
    readFile(reviewJsonPath, "utf8"),
    readFile(reviewReportPath, "utf8"),
    readFile(inventoryPath, "utf8"),
    readFile(governancePath, "utf8"),
    readFile(serviceGovernancePath, "utf8"),
  ]);

  const review = JSON.parse(reviewRaw);
  const inventory = JSON.parse(inventoryRaw);
  const categories = review.categories ?? {};

  const summary = {
    rootScriptCount: inventory.summary?.rootScriptCount ?? 0,
    serviceScriptCount: inventory.summary?.serviceScriptCount ?? 0,
    entrypointCount: inventory.summary?.entrypointCount ?? 0,
    protectedCore: categories.protectedCore?.count ?? 0,
    activeSupport: categories.activeSupport?.count ?? 0,
    historicalCompatible: categories.historicalCompatible?.count ?? 0,
    archiveCandidateLowRisk: categories.archiveCandidateLowRisk?.count ?? 0,
    archiveCandidateNeedsManualReview: categories.archiveCandidateNeedsManualReview?.count ?? 0,
    forbiddenDangerous: categories.forbiddenDangerous?.count ?? 0,
    unknownReviewRequired: categories.unknownReviewRequired?.count ?? 0,
  };

  const governanceHeadings = [
    ...governanceRaw.split(/\r?\n/).filter((line) => line.startsWith("## ")).slice(0, 6),
    ...serviceGovernanceRaw.split(/\r?\n/).filter((line) => line.startsWith("## ")).slice(0, 4),
  ];

  const markdown = [
    "# Phase323C-6 Archive Plan",
    "",
    "## 不执行归档声明",
    "",
    "- 本轮不删除 scripts。",
    "- 本轮不移动 entrypoints。",
    "- 本轮不改 package scripts 语义。",
    "- 本轮不执行任何 archive candidate 脚本。",
    "- 本轮只做静态索引、只读规划和人工复核流程设计。",
    "",
    "## 当前基线摘要",
    "",
    `- rootScriptCount: ${summary.rootScriptCount}`,
    `- serviceScriptCount: ${summary.serviceScriptCount}`,
    `- entrypointCount: ${summary.entrypointCount}`,
    `- protected-core: ${summary.protectedCore}`,
    `- active-support: ${summary.activeSupport}`,
    `- historical-compatible: ${summary.historicalCompatible}`,
    `- archive-candidate-low-risk: ${summary.archiveCandidateLowRisk}`,
    `- archive-candidate-needs-manual-review: ${summary.archiveCandidateNeedsManualReview}`,
    `- forbidden-dangerous: ${summary.forbiddenDangerous}`,
    `- unknown-review-required: ${summary.unknownReviewRequired}`,
    "",
    "## 未来归档流程建议",
    "",
    "- Stage A：只读索引。持续刷新 inventory、archive review、deprecated index，不执行候选脚本。",
    "- Stage B：人工复核 low-risk / manual-review。逐项确认是否仍被当前产品链路、验证链路或文档引用。",
    "- Stage C：deprecated alias / warning index。先生成面向人的弃用索引，不删除原入口。",
    "- Stage D：归档路径设计。为未来归档保留独立目录、说明文档和回滚路径。",
    "- Stage E：小批量迁移。每次只处理一小组低风险候选，禁止批量移动。",
    "- Stage F：验证回归。每次迁移后必须重跑 product recovery、secret safety、主链回归。",
    "- Stage G：最终删除或长期保留。只有在多轮人工复核和回归后，才决定删除或继续保留为历史入口。",
    "",
    "## 归档候选门槛",
    "",
    "- 必须不属于 protected-core。",
    "- 必须不影响 Phase322A 主链。",
    "- 必须不影响 5 个 Workbench 主模块。",
    "- 必须不影响 secret safety。",
    "- 必须不是 providerConfig / diagnostics / chat-gateway 主链验证。",
    "- 必须至少经过一轮人工复核。",
    "",
    "## 禁止默认执行类别",
    "",
    "- forbidden-dangerous 中的 release / deploy / commit / push / docker publish / GitHub release 等脚本只能作为历史资产保留，不允许默认执行。",
    "- 这类入口未来只能出现在只读索引、风险说明或人工操作手册中，不能加入推荐命令集。",
    "",
    "## 人工复核优先级",
    "",
    "- 第一优先级：archive-candidate-needs-manual-review。",
    "- 第二优先级：unknown-review-required。",
    "- 第三优先级：forbidden-dangerous。",
    "",
    "## 代表性样例",
    "",
    "### protected-core",
    ...takeLabels(categories.protectedCore?.items).map((label) => `- ${label}`),
    "",
    "### archive-candidate-low-risk",
    ...takeLabels(categories.archiveCandidateLowRisk?.items).map((label) => `- ${label}`),
    "",
    "### archive-candidate-needs-manual-review",
    ...takeLabels(categories.archiveCandidateNeedsManualReview?.items).map((label) => `- ${label}`),
    "",
    "### forbidden-dangerous",
    ...takeLabels(categories.forbiddenDangerous?.items).map((label) => `- ${label}`),
    "",
    "### unknown-review-required",
    ...takeLabels(categories.unknownReviewRequired?.items).map((label) => `- ${label}`),
    "",
    "## 输入来源",
    "",
    `- review json: \`${path.relative(repoRoot, reviewJsonPath)}\``,
    `- review report: \`${path.relative(repoRoot, reviewReportPath)}\``,
    `- inventory: \`${path.relative(repoRoot, inventoryPath)}\``,
    `- governance: \`${path.relative(repoRoot, governancePath)}\``,
    `- service governance: \`${path.relative(repoRoot, serviceGovernancePath)}\``,
    "",
    "## Governance Headings Snapshot",
    "",
    ...governanceHeadings.map((line) => `- ${line.replace(/^##\s*/, "")}`),
    "",
    "## Archive Review Report Note",
    "",
    `- 上游 review report 行数: ${reviewReportRaw.split(/\r?\n/).length}`,
    "- 本计划沿用 Phase323C-5 的静态分类结果，不新增运行时判断。",
    "",
  ].join("\n");

  await writeFile(outputPath, markdown, "utf8");

  process.stdout.write(JSON.stringify({
    status: "pass",
    outputPath,
    summary,
  }, null, 2) + "\n");
}

main().catch((error) => {
  console.error("[phase323c] failed to build archive plan:", error.message);
  process.exitCode = 1;
});
