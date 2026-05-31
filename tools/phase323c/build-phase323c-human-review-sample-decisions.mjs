import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const INPUT_FILES = {
  sampleBatchJson: path.join(repoRoot, "docs", "phase323c-9-human-review-sample-batch.json"),
  sampleBatchMd: path.join(repoRoot, "docs", "phase323c-9-human-review-sample-batch.md"),
  workflowJson: path.join(repoRoot, "docs", "phase323c-8-human-review-workflow-template.json"),
  checklistJson: path.join(repoRoot, "docs", "phase323c-7-deprecated-human-review-checklist.json"),
  deprecatedIndexJson: path.join(repoRoot, "docs", "phase323c-6-deprecated-index.json"),
  rootPackageJson: path.join(repoRoot, "package.json"),
  servicePackageJson: path.join(repoRoot, "apps", "ai-gateway-service", "package.json"),
};

const OUTPUT_JSON = path.join(repoRoot, "docs", "phase323c-10-human-review-sample-decisions.json");
const OUTPUT_MD = path.join(repoRoot, "docs", "phase323c-10-human-review-sample-decisions.md");

const ALLOWED_STATUS = [
  "pending",
  "reviewed-keep",
  "reviewed-mark-deprecated-only",
  "reviewed-future-archive-candidate",
  "reviewed-needs-more-context",
];

const ALLOWED_FUTURE_ACTIONS = [
  "no-op",
  "document-only",
  "deprecated-index-only",
  "manual-review-again",
  "future-archive-candidate",
];

const DEFAULT_REQUIRED_EVIDENCE = [
  "人工 reviewerDecision 记录",
  "回归命令执行结果",
  "后续独立 Phase 的归档或 deprecated 证据",
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

function mapDecisionItem(item) {
  const proposedHumanDecision = String(item.proposedHumanDecision || "").trim();
  const proposedFutureAction = String(item.proposedFutureAction || "").trim();

  let futureAction = "manual-review-again";
  if (proposedFutureAction === "document-only") {
    futureAction = "document-only";
  } else if (proposedFutureAction === "deprecated-index-only") {
    futureAction = "deprecated-index-only";
  } else if (proposedFutureAction === "future-archive-candidate") {
    futureAction = "future-archive-candidate";
  }

  let status = "pending";
  if (proposedHumanDecision === "keep" || proposedHumanDecision === "keep-historical-compatible") {
    status = "pending";
  } else if (proposedHumanDecision === "mark-deprecated-only") {
    status = "pending";
  } else if (proposedHumanDecision === "candidate-for-future-archive") {
    status = "pending";
  } else if (proposedHumanDecision === "needs-more-context") {
    status = "pending";
  }

  return {
    id: item.id,
    name: item.name,
    source: item.source,
    currentCategory: item.currentCategory,
    priority: item.priority,
    originalReason: item.reason || item.originalReason || "",
    proposedHumanDecision,
    reviewerDecision: "pending-human-review",
    reviewer: "",
    reviewDate: "",
    futureAction,
    requiredEvidence: DEFAULT_REQUIRED_EVIDENCE,
    requiredRegressionCommands: Array.isArray(item.requiredRegressionCommands) ? item.requiredRegressionCommands : [],
    rollbackNotes: item.rollbackNotes || "如误判，仅允许后续通过 git revert 回退；不得使用 git reset / git clean。",
    riskNotes: item.riskNotes || "",
    status,
  };
}

function buildMarkdown(report) {
  const lines = [];
  const items = report.decisionItems;

  lines.push("# Phase323C-10 Human Review Sample Decisions");
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
  lines.push("- 本轮只是记录人工结论模板。");
  lines.push("");

  lines.push("## 样板范围");
  lines.push("");
  lines.push(`- 仅处理 Phase323C-9 的 20 个 low-risk sample items。`);
  lines.push(`- 当前 decision item 数量: ${items.length}`);
  lines.push(`- 默认 reviewerDecision: pending-human-review`);
  lines.push(`- 允许的 status: ${ALLOWED_STATUS.join(", ")}`);
  lines.push(`- 允许的 futureAction: ${ALLOWED_FUTURE_ACTIONS.join(", ")}`);
  lines.push("");

  lines.push("## 20 个样板列表");
  lines.push("");
  lines.push("| # | id | name | reviewerDecision | futureAction | status |");
  lines.push("|---|----|------|------------------|--------------|--------|");
  items.forEach((item, index) => {
    lines.push(`| ${index + 1} | ${item.id} | ${item.name} | ${item.reviewerDecision} | ${item.futureAction} | ${item.status} |`);
  });
  lines.push("");

  lines.push("## 人工填写说明");
  lines.push("");
  lines.push("- reviewerDecision 只能由人工填写，不允许脚本自动改成 archive 或 delete。");
  lines.push("- reviewer 可填写人工审核人标识。");
  lines.push("- reviewDate 可填写人工审核日期。");
  lines.push("- 如人工认为应保留，仅允许改为 `reviewed-keep` 或保留 pending。");
  lines.push("- 如人工认为只做 deprecated 标记，仅允许改为 `reviewed-mark-deprecated-only`。");
  lines.push("- 如人工认为未来可归档，仅允许改为 `reviewed-future-archive-candidate`。");
  lines.push("- 如仍需更多上下文，仅允许改为 `reviewed-needs-more-context`。");
  lines.push("");

  lines.push("## 仍然不允许触发的动作");
  lines.push("");
  lines.push("- 不允许删除 scripts。");
  lines.push("- 不允许移动 entrypoints。");
  lines.push("- 不允许修改 package.json。");
  lines.push("- 不允许修改 apps/ai-gateway-service/package.json。");
  lines.push("- 不允许执行 archive candidate 脚本。");
  lines.push("- 不允许把 pending-human-review 自动转成真实归档动作。");
  lines.push("- 未来真实处理必须另开新 Phase。");
  lines.push("");

  lines.push("## Required Regression Commands");
  lines.push("");
  report.requiredRegressionCommands.forEach((command) => {
    lines.push(`- \`${command}\``);
  });
  lines.push("");

  lines.push("## 未来真实处理边界");
  lines.push("");
  lines.push("- 未来若要做 deprecated-index-only 之外的真实动作，必须另开独立 Phase。");
  lines.push("- 未来若要归档或删除，必须先人工确认引用链，再执行完整回归。");
  lines.push("- 本文件不是删除计划，也不是自动归档授权。");
  lines.push("");

  return lines.join("\n");
}

async function main() {
  const [
    sampleBatch,
    workflow,
    checklist,
    deprecatedIndex,
    rootPackage,
    servicePackage,
  ] = await Promise.all([
    readJson(INPUT_FILES.sampleBatchJson),
    readJson(INPUT_FILES.workflowJson),
    readJson(INPUT_FILES.checklistJson),
    readJson(INPUT_FILES.deprecatedIndexJson),
    readJson(INPUT_FILES.rootPackageJson),
    readJson(INPUT_FILES.servicePackageJson),
    readFile(INPUT_FILES.sampleBatchMd, "utf-8"),
  ]);

  void checklist;
  void deprecatedIndex;
  void rootPackage;
  void servicePackage;

  assert(sampleBatch.phase === "Phase323C-9", "Input sample batch must be Phase323C-9.");
  assert(Array.isArray(sampleBatch.sampleItems), "Phase323C-9 sample items missing.");
  assert(sampleBatch.sampleItems.length === 20, "Phase323C-9 sample batch must contain exactly 20 items.");
  assert(
    sampleBatch.sampleItems.every((item) => item.priority === 3 && item.currentCategory === "archive-candidate-low-risk"),
    "Phase323C-10 only accepts Phase323C-9 Priority 3 low-risk sample items.",
  );
  assert(
    Array.isArray(workflow.allowedFutureActions) && workflow.allowedFutureActions.includes("future-archive-candidate"),
    "Workflow template missing allowed future actions.",
  );

  const decisionItems = sampleBatch.sampleItems.map(mapDecisionItem);
  assert(
    decisionItems.every((item) => item.reviewerDecision === "pending-human-review"),
    "All decision items must default to pending-human-review.",
  );
  assert(
    decisionItems.every((item) => ALLOWED_FUTURE_ACTIONS.includes(item.futureAction)),
    "Found disallowed futureAction in decision items.",
  );
  assert(
    decisionItems.every((item) => ALLOWED_STATUS.includes(item.status)),
    "Found disallowed status in decision items.",
  );

  const output = {
    phase: "Phase323C-10",
    title: "Human Review Sample Decisions",
    generatedAt: new Date().toISOString(),
    sourcePhase: "Phase323C-9",
    declarations: {
      deleteScripts: false,
      moveEntrypoints: false,
      renameScripts: false,
      changePackageScripts: false,
      executeCandidateScripts: false,
      staticOnly: true,
      realArchiveExecuted: false,
    },
    sourceBatchId: sampleBatch.batchId,
    sourceSelectedCount: sampleBatch.selectedCount,
    decisionItemCount: decisionItems.length,
    allowedStatus: ALLOWED_STATUS,
    allowedFutureActions: ALLOWED_FUTURE_ACTIONS,
    defaultReviewerDecision: "pending-human-review",
    requiredRegressionCommands: Array.isArray(sampleBatch.requiredRegressionCommands)
      ? sampleBatch.requiredRegressionCommands
      : [],
    productionRegressionCommands: Array.isArray(sampleBatch.productionRegressionCommands)
      ? sampleBatch.productionRegressionCommands
      : [],
    decisionItems,
    notes: [
      "本轮仅生成人工结论记录模板。",
      "本轮不删除 scripts。",
      "本轮不移动 entrypoints。",
      "本轮不修改 package scripts。",
      "本轮不执行任何候选脚本。",
      "本轮不做真实归档。",
      "未来真实处理必须另开独立 Phase。",
    ],
  };

  await writeFile(OUTPUT_JSON, JSON.stringify(output, null, 2), "utf-8");
  await writeFile(OUTPUT_MD, buildMarkdown(output), "utf-8");

  console.log("[Phase323C-10] Human review sample decisions JSON written:", OUTPUT_JSON);
  console.log("[Phase323C-10] Human review sample decisions Markdown written:", OUTPUT_MD);
  console.log(`[Phase323C-10] Decision items: ${output.decisionItemCount}`);
}

main().catch((error) => {
  console.error("[Phase323C-10] Failed:", error.message);
  process.exit(1);
});
