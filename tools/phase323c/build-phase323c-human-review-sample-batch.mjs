import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const INPUT_FILES = {
  checklistJson: path.join(repoRoot, "docs", "phase323c-7-deprecated-human-review-checklist.json"),
  workflowJson: path.join(repoRoot, "docs", "phase323c-8-human-review-workflow-template.json"),
  deprecatedIndex: path.join(repoRoot, "docs", "phase323c-6-deprecated-index.json"),
  archivePlan: path.join(repoRoot, "docs", "phase323c-6-archive-plan.md"),
};

const OUTPUT_JSON = path.join(repoRoot, "docs", "phase323c-9-human-review-sample-batch.json");
const OUTPUT_MD = path.join(repoRoot, "docs", "phase323c-9-human-review-sample-batch.md");

const REQUIRED_REGRESSION_COMMANDS = [
  "cmd /c pnpm run health:phase12a",
  "cmd /c pnpm run doctor:phase13a",
  "cmd /c pnpm run verify:phase321a-workbench-product-recovery",
  "cmd /c pnpm run verify:phase313a-model-usability-matrix",
  "cmd /c pnpm run verify:phase107a-secret-safety",
  "cmd /c pnpm -r --if-present check",
];

const PRODUCTION_REGRESSION_COMMANDS = [
  "cmd /c pnpm run verify:phase322a-workbench-chat-gateway-real-nvidia",
];

function buildSampleItem(item, index) {
  const name = item.name || "";
  const source = item.source || item.kind || "unknown";
  const reason = item.reason || item.proposedHumanAction || "";
  const riskNotes = item.riskNotes || "";

  let proposedHumanDecision = "candidate-for-future-archive";
  let proposedFutureAction = "future-archive-candidate";
  const requiredManualChecks = [
    "确认不被当前 Phase322A 主链使用",
    "确认不被 5 个 Workbench 主模块使用",
    "确认不被 secret safety 验证链使用",
    "确认不被 diagnostics / providerConfig / fileContext bridge 使用",
  ];

  if (name.includes("legacy") || name.includes("deprecated")) {
    proposedHumanDecision = "mark-deprecated-only";
    proposedFutureAction = "deprecated-index-only";
  }
  if (name.includes("old") || name.includes("archive") || name.includes("snapshot")) {
    proposedHumanDecision = "candidate-for-future-archive";
    proposedFutureAction = "future-archive-candidate";
  }
  if (name.includes("benchmark") || name.includes("demo") || name.includes("example")) {
    proposedHumanDecision = "keep-historical-compatible";
    proposedFutureAction = "document-only";
  }

  return {
    id: item.id || item.label || `low-risk-${index}`,
    name,
    source,
    currentCategory: "archive-candidate-low-risk",
    priority: 3,
    reason,
    proposedHumanDecision,
    proposedFutureAction,
    requiredManualChecks,
    requiredRegressionCommands: REQUIRED_REGRESSION_COMMANDS,
    rollbackNotes: "如误删，必须通过 git revert 回退。不 reset、不 clean、不 force push。",
    riskNotes: riskNotes || "低风险候选，但仍需至少一次人工确认。",
  };
}

async function main() {
  let checklist = null;
  try {
    const raw = await readFile(INPUT_FILES.checklistJson, "utf-8");
    checklist = JSON.parse(raw);
  } catch (error) {
    console.error("[Phase323C-9] Cannot read checklist:", error.message);
    process.exit(1);
  }

  let lowRiskItems = [];
  if (checklist && Array.isArray(checklist.priorities)) {
    for (const p of checklist.priorities) {
      if (p.priority === 3 && Array.isArray(p.items)) {
        lowRiskItems = p.items;
      }
    }
  }

  if (lowRiskItems.length === 0) {
    console.error("[Phase323C-9] No low-risk candidates found. STOP.");
    process.exit(1);
  }

  const selectedCount = Math.min(lowRiskItems.length, 20);
  const selectedItems = lowRiskItems.slice(0, selectedCount);
  const sampleItems = selectedItems.map((item, idx) => buildSampleItem(item, idx + 1));

  const decisionSummary = {
    keep: 0,
    keepHistoricalCompatible: 0,
    markDeprecatedOnly: 0,
    candidateForFutureArchive: 0,
    needsMoreContext: 0,
  };
  for (const item of sampleItems) {
    if (item.proposedHumanDecision === "keep") decisionSummary.keep++;
    else if (item.proposedHumanDecision === "keep-historical-compatible") decisionSummary.keepHistoricalCompatible++;
    else if (item.proposedHumanDecision === "mark-deprecated-only") decisionSummary.markDeprecatedOnly++;
    else if (item.proposedHumanDecision === "candidate-for-future-archive") decisionSummary.candidateForFutureArchive++;
    else if (item.proposedHumanDecision === "needs-more-context") decisionSummary.needsMoreContext++;
  }

  const outputJson = {
    phase: "Phase323C-9",
    title: "Human Review Sample Batch",
    generatedAt: new Date().toISOString(),
    declarations: {
      deleteScripts: false,
      moveEntrypoints: false,
      renameScripts: false,
      changePackageScripts: false,
      executeCandidateScripts: false,
      staticOnly: true,
    },
    batchId: "low-risk-sample-batch-001",
    batchLabel: "Phase323C-9: Low-Risk Sample Batch",
    sourceCategory: "archive-candidate-low-risk",
    totalLowRiskCandidates: lowRiskItems.length,
    selectedCount,
    decisionSummary,
    sampleItems,
    requiredRegressionCommands: REQUIRED_REGRESSION_COMMANDS,
    productionRegressionCommands: PRODUCTION_REGRESSION_COMMANDS,
    rollbackPlan: {
      description: "如误删或误移动，必须通过 git revert 回退。不 reset、不 clean、不 force push、不自动恢复。",
      revertCommand: "git diff --name-only 检查变动范围，确认后 git revert <commit>",
      safetyRule: "不 reset、不 clean、不 force push、不自动恢复。",
    },
    notes: "本轮只生成样板，不删除、不移动、不重命名、不修改任何 scripts 或 entrypoints。未来真实处理必须另开阶段。",
  };

  await writeFile(OUTPUT_JSON, JSON.stringify(outputJson, null, 2), "utf-8");
  console.log("[Phase323C-9] Sample batch JSON written:", OUTPUT_JSON);

  const md = buildMarkdown(outputJson);
  await writeFile(OUTPUT_MD, md, "utf-8");
  console.log("[Phase323C-9] Sample batch Markdown written:", OUTPUT_MD);

  console.log(`[Phase323C-9] Selected ${selectedCount} low-risk candidates (of ${lowRiskItems.length} total).`);
  return { selectedCount, totalLowRisk: lowRiskItems.length };
}

function buildMarkdown(output) {
  const { sampleItems, decisionSummary, selectedCount, totalLowRiskCandidates } = output;
  const lines = [];

  lines.push("# Phase323C-9 Human Review Sample Batch");
  lines.push("");
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push("");

  lines.push("## Declarations");
  lines.push("");
  lines.push("- **本轮不删除 scripts**");
  lines.push("- **本轮不移动 entrypoints**");
  lines.push("- **本轮不改 package scripts**");
  lines.push("- **本轮不执行候选脚本**");
  lines.push("- **本轮不做真实归档**");
  lines.push("");

  lines.push("## Current Baseline");
  lines.push("");
  lines.push(`- Total low-risk candidates: ${totalLowRiskCandidates}`);
  lines.push(`- Selected for this sample: ${selectedCount}`);
  lines.push("");

  lines.push("## Decision Summary");
  lines.push("");
  lines.push(`- keep: ${decisionSummary.keep}`);
  lines.push(`- keep-historical-compatible: ${decisionSummary.keepHistoricalCompatible}`);
  lines.push(`- mark-deprecated-only: ${decisionSummary.markDeprecatedOnly}`);
  lines.push(`- candidate-for-future-archive: ${decisionSummary.candidateForFutureArchive}`);
  lines.push(`- needs-more-context: ${decisionSummary.needsMoreContext}`);
  lines.push("");

  lines.push("## Sample Items");
  lines.push("");
  lines.push("| # | id | name | proposedHumanDecision | proposedFutureAction |");
  lines.push("|---|-----|------|----------------------|---------------------|");
  for (const item of sampleItems) {
    lines.push(`| ${item.id.replace("low-risk-", "")} | ${(item.id || "").substring(0, 50)} | ${(item.name || "").substring(0, 35)} | ${item.proposedHumanDecision} | ${item.proposedFutureAction} |`);
  }
  lines.push("");

  lines.push("## Why These Are Samples Only");
  lines.push("");
  lines.push("Each item in this batch is a **Priority 3 low-risk candidate**:");
  lines.push("");
  lines.push("- They are not part of the Phase322A real Chat main chain.");
  lines.push("- They are not part of the 5 Workbench main modules.");
  lines.push("- They are not part of the secret safety verification chain.");
  lines.push("- They are not part of the diagnostics / providerConfig / fileContext bridge.");
  lines.push("- They have been classified as low-risk by the Phase323C archive review.");
  lines.push("- However, **no item has been verified as truly unused by any verification chain** in this phase.");
  lines.push("- Therefore, this batch is **human review template only**, not a deletion plan.");
  lines.push("");

  lines.push("## Batch Review Operation Steps");
  lines.push("");
  lines.push("1. **Read**: Review each item's id, name, source, and reason.");
  lines.push("2. **Check**: For each item, verify it is not referenced by any active verification script or documentation.");
  lines.push("3. **Decide**: Assign one of the allowed human decisions:");
  lines.push("   - `keep`");
  lines.push("   - `keep-historical-compatible`");
  lines.push("   - `mark-deprecated-only`");
  lines.push("   - `candidate-for-future-archive`");
  lines.push("   - `needs-more-context`");
  lines.push("4. **Record**: Fill in the decision in the batch JSON.");
  lines.push("5. **Do NOT execute any deletion or movement in this phase.**");
  lines.push("");

  lines.push("## Required Regression Commands");
  lines.push("");
  for (const cmd of REQUIRED_REGRESSION_COMMANDS) {
    lines.push(`- \`${cmd}\``);
  }
  lines.push("");

  lines.push("## Rollback Plan");
  lines.push("");
  lines.push("- 如误删或误移动，必须通过 `git revert` 回退。");
  lines.push("- 不 reset、不 clean、不 force push、不自动恢复。");
  lines.push("");

  lines.push("## Next Phase Requirement");
  lines.push("");
  lines.push("如要对这批候选做真实处理（删除、移动、归档），**必须另开新 Phase**，并在新 Phase 中：");
  lines.push("");
  lines.push("1. 对每个 item 做独立人工确认。");
  lines.push("2. 执行完整回归验证（health + doctor + product recovery + model usability + secret safety + check）。");
  lines.push("3. 如果涉及生产 UI 或 Chat 主链，额外执行 `verify:phase322a-workbench-chat-gateway-real-nvidia`。");
  lines.push("4. 用 `git revert` 做回滚保障。");
  lines.push("5. 不得批量删除或移动。");
  lines.push("");

  return lines.join("\n");
}

main().catch((error) => {
  console.error("[Phase323C-9] Failed:", error.message);
  process.exit(1);
});