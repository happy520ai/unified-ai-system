import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const INPUT_FILES = {
  sampleDecisionsJson: path.join(repoRoot, "docs", "phase323c-10-human-review-sample-decisions.json"),
  sampleDecisionsMd: path.join(repoRoot, "docs", "phase323c-10-human-review-sample-decisions.md"),
  sampleBatchJson: path.join(repoRoot, "docs", "phase323c-9-human-review-sample-batch.json"),
  workflowJson: path.join(repoRoot, "docs", "phase323c-8-human-review-workflow-template.json"),
  rootPackageJson: path.join(repoRoot, "package.json"),
  servicePackageJson: path.join(repoRoot, "apps", "ai-gateway-service", "package.json"),
};

const OUTPUT_JSON = path.join(repoRoot, "docs", "phase323c-11-human-review-sample-decision-updates.json");
const OUTPUT_MD = path.join(repoRoot, "docs", "phase323c-11-human-review-sample-decision-updates.md");

const ALLOWED_REVIEWER_DECISIONS = [
  "reviewed-keep",
  "reviewed-mark-deprecated-only",
  "reviewed-needs-more-context",
];

const ALLOWED_FUTURE_ACTIONS = [
  "no-op",
  "document-only",
  "deprecated-index-only",
  "manual-review-again",
];

const DECISION_UPDATES = [
  {
    id: "script:root:verify:phase156a-guided-onboarding-demo-dataset",
    reviewerDecision: "reviewed-keep",
    futureAction: "document-only",
    status: "reviewed-keep",
    reviewer: "phase323c11-human-sample",
    reviewDate: "2026-05-06",
    decisionReason: "保留为历史兼容验证样板，仅记录文档说明，不触发删除或移动。",
    rollbackNotes: "如后续人工判断失误，仅允许通过独立 Phase 的 git revert 回退；本轮不做真实变更。",
    riskNotes: "当前只给出示例人工结论，仍不得删除脚本或移动入口。",
  },
  {
    id: "script:root:verify:phase168a-guided-demo-mode-polish",
    reviewerDecision: "reviewed-mark-deprecated-only",
    futureAction: "deprecated-index-only",
    status: "reviewed-mark-deprecated-only",
    reviewer: "phase323c11-human-sample",
    reviewDate: "2026-05-06",
    decisionReason: "可先做 deprecated/index 级别记录，但不进入真实归档和删除动作。",
    rollbackNotes: "若后续索引判断需撤销，仅在独立阶段回滚文档或索引记录。",
    riskNotes: "只允许 deprecated-index-only，仍不允许移动 entrypoint 或执行候选脚本。",
  },
  {
    id: "script:root:verify:phase173a-manual-qa-checklist",
    reviewerDecision: "reviewed-needs-more-context",
    futureAction: "manual-review-again",
    status: "reviewed-needs-more-context",
    reviewer: "phase323c11-human-sample",
    reviewDate: "2026-05-06",
    decisionReason: "该样板仍需更多上下文确认引用关系，本轮只记录需再次人工复核。",
    rollbackNotes: "无需代码回滚；后续仅在独立阶段继续人工复核。",
    riskNotes: "状态保持为更多上下文待补充，避免误升为 future archive candidate。",
  },
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

function buildMarkdown(report) {
  const lines = [];
  lines.push("# Phase323C-11 Human Review Sample Decision Updates");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push("");
  lines.push("## 本轮不执行声明");
  lines.push("");
  lines.push("- 本轮不删除 scripts。");
  lines.push("- 本轮不移动 entrypoints。");
  lines.push("- 本轮不修改 package scripts。");
  lines.push("- 本轮不执行任何候选脚本。");
  lines.push("- 本轮不做真实归档。");
  lines.push("- 本轮只是人工结论示例记录。");
  lines.push("");
  lines.push("## 示例样板范围");
  lines.push("");
  lines.push(`- 来源阶段：${report.sourcePhase}`);
  lines.push(`- 来源样板总数：${report.sourceDecisionItemCount}`);
  lines.push(`- 本轮更新样板数：${report.updatedItemCount}`);
  lines.push(`- 允许 reviewerDecision：${ALLOWED_REVIEWER_DECISIONS.join(", ")}`);
  lines.push(`- 允许 futureAction：${ALLOWED_FUTURE_ACTIONS.join(", ")}`);
  lines.push("");
  lines.push("## 选中的 3 个样板");
  lines.push("");
  lines.push("| # | id | reviewerDecision | futureAction | status | 不触发删除原因 |");
  lines.push("|---|----|------------------|--------------|--------|----------------|");
  report.updatedItems.forEach((item, index) => {
    lines.push(`| ${index + 1} | ${item.id} | ${item.reviewerDecision} | ${item.futureAction} | ${item.status} | ${item.decisionReason} |`);
  });
  lines.push("");
  lines.push("## 每个样板的人工结论示例");
  lines.push("");
  report.updatedItems.forEach((item) => {
    lines.push(`### ${item.name}`);
    lines.push("");
    lines.push(`- reviewerDecision: \`${item.reviewerDecision}\``);
    lines.push(`- futureAction: \`${item.futureAction}\``);
    lines.push(`- status: \`${item.status}\``);
    lines.push(`- reviewer: \`${item.reviewer}\``);
    lines.push(`- reviewDate: \`${item.reviewDate}\``);
    lines.push(`- 结论说明：${item.decisionReason}`);
    lines.push(`- 为什么不触发删除：${item.noDeleteReason}`);
    lines.push(`- 风险说明：${item.riskNotes}`);
    lines.push("");
  });
  lines.push("## Required Regression Commands");
  lines.push("");
  report.requiredRegressionCommands.forEach((command) => {
    lines.push(`- \`${command}\``);
  });
  lines.push("");
  lines.push("## 后续边界");
  lines.push("");
  lines.push("- 未来真实处理仍需另开独立 Phase。");
  lines.push("- 本文件不是删除授权，也不是归档授权。");
  lines.push("- 本轮不允许将样板提升为 reviewed-future-archive-candidate。");
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const [
    sampleDecisions,
    sampleBatch,
    workflow,
    rootPackage,
    servicePackage,
    sampleDecisionsMd,
  ] = await Promise.all([
    readJson(INPUT_FILES.sampleDecisionsJson),
    readJson(INPUT_FILES.sampleBatchJson),
    readJson(INPUT_FILES.workflowJson),
    readJson(INPUT_FILES.rootPackageJson),
    readJson(INPUT_FILES.servicePackageJson),
    readFile(INPUT_FILES.sampleDecisionsMd, "utf-8"),
  ]);

  void rootPackage;
  void servicePackage;
  void sampleDecisionsMd;

  assert(sampleDecisions.phase === "Phase323C-10", "Input decisions must be Phase323C-10.");
  assert(Array.isArray(sampleDecisions.decisionItems), "Phase323C-10 decision items missing.");
  assert(sampleDecisions.decisionItems.length === 20, "Phase323C-10 must contain exactly 20 decision items.");
  assert(sampleBatch.phase === "Phase323C-9", "Sample batch must remain Phase323C-9.");
  assert(Array.isArray(workflow.allowedFutureActions), "Workflow template missing allowed future actions.");
  assert(
    workflow.allowedFutureActions.includes("manual-review-again"),
    "Workflow template must allow manual-review-again.",
  );

  const decisionMap = new Map(sampleDecisions.decisionItems.map((item) => [item.id, item]));
  const updatedItems = DECISION_UPDATES.map((update) => {
    const sourceItem = decisionMap.get(update.id);
    assert(sourceItem, `Missing Phase323C-10 source item for ${update.id}.`);
    assert(sourceItem.reviewerDecision === "pending-human-review", `${update.id} is no longer pending-human-review.`);
    assert(sourceItem.priority === 3, `${update.id} is not Priority 3.`);
    assert(sourceItem.currentCategory === "archive-candidate-low-risk", `${update.id} is not low-risk.`);
    assert(ALLOWED_REVIEWER_DECISIONS.includes(update.reviewerDecision), `${update.id} reviewerDecision not allowed.`);
    assert(ALLOWED_FUTURE_ACTIONS.includes(update.futureAction), `${update.id} futureAction not allowed.`);
    return {
      id: sourceItem.id,
      name: sourceItem.name,
      source: sourceItem.source,
      currentCategory: sourceItem.currentCategory,
      priority: sourceItem.priority,
      originalReason: sourceItem.originalReason,
      proposedHumanDecision: sourceItem.proposedHumanDecision,
      previousReviewerDecision: sourceItem.reviewerDecision,
      reviewerDecision: update.reviewerDecision,
      reviewer: update.reviewer,
      reviewDate: update.reviewDate,
      futureAction: update.futureAction,
      requiredEvidence: sourceItem.requiredEvidence,
      requiredRegressionCommands: sourceItem.requiredRegressionCommands,
      rollbackNotes: update.rollbackNotes,
      riskNotes: update.riskNotes,
      decisionReason: update.decisionReason,
      noDeleteReason: "本轮只允许文档或索引层处理，不允许删除 scripts、移动 entrypoints 或执行候选脚本。",
      status: update.status,
    };
  });

  assert(updatedItems.length >= 3 && updatedItems.length <= 5, "Phase323C-11 must update 3-5 items.");

  const output = {
    phase: "Phase323C-11",
    title: "Human Review Sample Decision Updates",
    generatedAt: new Date().toISOString(),
    sourcePhase: "Phase323C-10",
    sourceDecisionItemCount: sampleDecisions.decisionItems.length,
    updatedItemCount: updatedItems.length,
    declarations: {
      deleteScripts: false,
      moveEntrypoints: false,
      renameScripts: false,
      changePackageScripts: false,
      executeCandidateScripts: false,
      staticOnly: true,
      realArchiveExecuted: false,
    },
    allowedReviewerDecisions: ALLOWED_REVIEWER_DECISIONS,
    allowedFutureActions: ALLOWED_FUTURE_ACTIONS,
    requiredRegressionCommands: Array.isArray(sampleDecisions.requiredRegressionCommands)
      ? sampleDecisions.requiredRegressionCommands
      : [],
    productionRegressionCommands: Array.isArray(sampleDecisions.productionRegressionCommands)
      ? sampleDecisions.productionRegressionCommands
      : [],
    updatedItems,
    notes: [
      "本轮只记录少量人工结论示例。",
      "本轮不删除 scripts。",
      "本轮不移动 entrypoints。",
      "本轮不修改 package.json 或 service package.json。",
      "本轮不执行任何候选脚本。",
      "本轮不做真实归档。",
      "未来真实处理必须另开独立 Phase。",
    ],
  };

  await writeFile(OUTPUT_JSON, JSON.stringify(output, null, 2), "utf-8");
  await writeFile(OUTPUT_MD, buildMarkdown(output), "utf-8");

  console.log("[Phase323C-11] Human review sample decision updates JSON written:", OUTPUT_JSON);
  console.log("[Phase323C-11] Human review sample decision updates Markdown written:", OUTPUT_MD);
  console.log(`[Phase323C-11] Updated items: ${output.updatedItemCount}`);
}

main().catch((error) => {
  console.error("[Phase323C-11] Failed:", error.message);
  process.exit(1);
});
