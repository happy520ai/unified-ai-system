import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const reviewJsonPath = path.join(repoRoot, "docs", "phase323c-5-archive-candidate-review.json");
const archivePlanPath = path.join(repoRoot, "docs", "phase323c-6-archive-plan.md");
const outputJsonPath = path.join(repoRoot, "docs", "phase323c-6-deprecated-index.json");
const outputMdPath = path.join(repoRoot, "docs", "phase323c-6-deprecated-index.md");

function withFutureAction(items = [], futureAction, limit) {
  const selected = typeof limit === "number" ? items.slice(0, limit) : items;
  return selected.map((item) => ({
    ...item,
    futureAction,
  }));
}

function sample(items = [], limit = 10) {
  return items.slice(0, limit).map((item) => item.label);
}

async function main() {
  const [reviewRaw, archivePlanRaw] = await Promise.all([
    readFile(reviewJsonPath, "utf8"),
    readFile(archivePlanPath, "utf8"),
  ]);

  const review = JSON.parse(reviewRaw);
  const categories = review.categories ?? {};

  const summary = {
    protectedCore: categories.protectedCore?.count ?? 0,
    activeSupport: categories.activeSupport?.count ?? 0,
    historicalCompatible: categories.historicalCompatible?.count ?? 0,
    archiveCandidateLowRisk: categories.archiveCandidateLowRisk?.count ?? 0,
    archiveCandidateNeedsManualReview: categories.archiveCandidateNeedsManualReview?.count ?? 0,
    forbiddenDangerous: categories.forbiddenDangerous?.count ?? 0,
    unknownReviewRequired: categories.unknownReviewRequired?.count ?? 0,
  };

  const deprecatedIndex = {
    phase: "Phase323C-6",
    generatedAt: new Date().toISOString(),
    sourceReports: [
      path.relative(repoRoot, reviewJsonPath),
      path.relative(repoRoot, archivePlanPath),
    ],
    summary,
    protectedCore: withFutureAction(categories.protectedCore?.items, "keep"),
    activeSupportSamples: withFutureAction(categories.activeSupport?.items, "keep", 20),
    historicalCompatibleSamples: withFutureAction(categories.historicalCompatible?.items, "keep", 30),
    lowRiskCandidates: withFutureAction(categories.archiveCandidateLowRisk?.items, "deprecate-index-only", 40),
    manualReviewRequired: withFutureAction(categories.archiveCandidateNeedsManualReview?.items, "manual-review", 40),
    forbiddenDangerous: withFutureAction(categories.forbiddenDangerous?.items, "forbidden-do-not-run", 40),
    unknownReviewRequired: withFutureAction(categories.unknownReviewRequired?.items, "unknown-review-required", 40),
    notes: {
      staticOnly: true,
      deletedScripts: false,
      movedEntrypoints: false,
      executedCandidateScripts: false,
      packageScriptSemanticsChanged: false,
      archivePlanLineCount: archivePlanRaw.split(/\r?\n/).length,
    },
  };

  const markdown = [
    "# Phase323C-6 Deprecated Index",
    "",
    "## Summary",
    "",
    `- protected-core: ${summary.protectedCore}`,
    `- active-support: ${summary.activeSupport}`,
    `- historical-compatible: ${summary.historicalCompatible}`,
    `- archive-candidate-low-risk: ${summary.archiveCandidateLowRisk}`,
    `- archive-candidate-needs-manual-review: ${summary.archiveCandidateNeedsManualReview}`,
    `- forbidden-dangerous: ${summary.forbiddenDangerous}`,
    `- unknown-review-required: ${summary.unknownReviewRequired}`,
    "",
    "## Future Action Rules",
    "",
    "- `keep`: 当前必须保留或仍然是活跃支撑入口。",
    "- `deprecate-index-only`: 允许进入弃用索引，但本轮不删除、不移动。",
    "- `manual-review`: 必须先人工复核，再决定是否进入弃用索引下一阶段。",
    "- `forbidden-do-not-run`: 仅保留历史记录和风险说明，不允许默认执行。",
    "- `unknown-review-required`: 用途未明，必须先人工确认。",
    "",
    "## Protected Core",
    ...sample(deprecatedIndex.protectedCore).map((label) => `- ${label}`),
    "",
    "## Low Risk Candidates",
    ...sample(deprecatedIndex.lowRiskCandidates).map((label) => `- ${label}`),
    "",
    "## Manual Review Required",
    ...sample(deprecatedIndex.manualReviewRequired).map((label) => `- ${label}`),
    "",
    "## Forbidden Dangerous",
    ...sample(deprecatedIndex.forbiddenDangerous).map((label) => `- ${label}`),
    "",
    "## Unknown Review Required",
    ...sample(deprecatedIndex.unknownReviewRequired).map((label) => `- ${label}`),
    "",
    "## Safety Statement",
    "",
    "- 本轮只生成 deprecated index，不删除 scripts，不移动 entrypoints。",
    "- 本轮不执行任何 candidate 脚本，不改变 package scripts 语义。",
    "",
  ].join("\n");

  await Promise.all([
    writeFile(outputJsonPath, JSON.stringify(deprecatedIndex, null, 2), "utf8"),
    writeFile(outputMdPath, markdown, "utf8"),
  ]);

  process.stdout.write(JSON.stringify({
    status: "pass",
    outputJsonPath,
    outputMdPath,
    summary,
  }, null, 2) + "\n");
}

main().catch((error) => {
  console.error("[phase323c] failed to build deprecated index:", error.message);
  process.exitCode = 1;
});
