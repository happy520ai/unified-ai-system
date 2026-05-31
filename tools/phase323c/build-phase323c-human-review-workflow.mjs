import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const INPUT_FILES = {
  checklistJson: path.join(repoRoot, "docs", "phase323c-7-deprecated-human-review-checklist.json"),
  checklistMd: path.join(repoRoot, "docs", "phase323c-7-deprecated-human-review-checklist.md"),
  deprecatedIndex: path.join(repoRoot, "docs", "phase323c-6-deprecated-index.json"),
  archivePlan: path.join(repoRoot, "docs", "phase323c-6-archive-plan.md"),
  archiveReview: path.join(repoRoot, "docs", "phase323c-5-archive-candidate-review.json"),
  governance: path.join(repoRoot, "docs", "phase323c-script-governance-policy.md"),
  serviceGovernance: path.join(repoRoot, "docs", "phase323c-service-command-governance-policy.md"),
  rootPackage: path.join(repoRoot, "package.json"),
  servicePackage: path.join(repoRoot, "apps", "ai-gateway-service", "package.json"),
};

const OUTPUT_JSON = path.join(repoRoot, "docs", "phase323c-8-human-review-workflow-template.json");
const OUTPUT_MD = path.join(repoRoot, "docs", "phase323c-8-human-review-workflow-template.md");

const ALLOWED_HUMAN_DECISIONS = [
  "keep",
  "keep-historical-compatible",
  "mark-deprecated-only",
  "candidate-for-future-archive",
  "forbidden-do-not-run",
  "needs-more-context",
];

const ALLOWED_FUTURE_ACTIONS = [
  "no-op",
  "document-only",
  "deprecated-index-only",
  "manual-review-again",
  "future-archive-candidate",
  "forbidden-do-not-run",
];

const REQUIRED_REGRESSION_COMMANDS = [
  "cmd /c pnpm run health:phase12a",
  "cmd /c pnpm run doctor:phase13a",
  "cmd /c pnpm run verify:phase321a-workbench-product-recovery",
  "cmd /c pnpm run verify:phase313a-model-usability-matrix",
  "cmd /c pnpm run verify:phase107a-secret-safety",
  "cmd /c pnpm -r --if-present check",
];

const TOUCHING_PRODUCTION_REGRESSION = [
  "cmd /c pnpm run verify:phase322a-workbench-chat-gateway-real-nvidia",
];

const PRIORITY_RULES = {
  0: { label: "forbidden-dangerous", defaultDecision: "forbidden-do-not-run", defaultFutureAction: "forbidden-do-not-run", canDelete: false },
  1: { label: "unknown-review-required", defaultDecision: "needs-more-context", defaultFutureAction: "manual-review-again", canDelete: false },
  2: { label: "manual-review", defaultDecision: null, defaultFutureAction: "manual-review-again", canDelete: false },
  3: { label: "low-risk", defaultDecision: null, defaultFutureAction: "future-archive-candidate", canDelete: false },
};

function createBatchTemplate(batchId, sourceCategory, candidateSample = []) {
  return {
    batchId,
    batchLabel: `Batch ${batchId}: ${sourceCategory}`,
    sourceCategory,
    maxItemsPerBatch: 20,
    phase: "Phase323C-8",
    declarations: {
      deleteScripts: false,
      moveEntrypoints: false,
      renameScripts: false,
      changePackageScripts: false,
      executeCandidateScripts: false,
      runReleaseDeployCommitPushDockerGithubReleaseScripts: false,
      staticOnly: true,
    },
    reviewer: "(人工填写)",
    reviewDate: "(人工填写)",
    status: "template",
    candidateItems: candidateSample.map((item, idx) => ({
      id: item.id,
      name: item.name,
      source: item.source,
      category: item.category,
      priority: item.priority,
      currentCommand: item.currentCommand || `script:${item.name}`,
      linkedEntrypoint: item.linkedEntrypoint || "",
      reason: item.reason,
      humanDecision: "",
      riskLevel: item.riskLevel || priorityLabel(item.priority),
      futureAction: "",
      requiredEvidence: "人工签署 + 回归验证",
      notes: item.riskNotes || "",
      batchIndex: idx + 1,
    })),
    decisionSummary: {
      keep: 0,
      keepHistoricalCompatible: 0,
      markDeprecatedOnly: 0,
      candidateForFutureArchive: 0,
      forbiddenDoNotRun: 0,
      needsMoreContext: 0,
      total: candidateSample.length,
    },
    requiredRegressionCommands: REQUIRED_REGRESSION_COMMANDS,
    touchingProductionRegressionCommands: TOUCHING_PRODUCTION_REGRESSION,
    rollbackPlan: {
      description: "如果在复核过程中误改了 package scripts 或删除了 entrypoints，必须通过 git revert 回退。不得使用 git reset --hard 覆盖未知文件。",
      revertCommand: "git diff --name-only 检查变动范围，确认后 git revert <commit>",
      safetyRule: "不 reset、不 clean、不 force push、不自动恢复。",
    },
    reviewChecklist: [
      "确认每个 candidate 没有在当前 product recovery 验证链中使用。",
      "确认每个 candidate 没有在 /chat-gateway/execute 主链中使用。",
      "确认每个 candidate 不影响 5 个 Workbench 主模块。",
      "确认每个 candidate 不影响 secret safety 验证。",
      "forbidden-dangerous 只允许 forbidden-do-not-run，不允许其他动作。",
      "unknown-review-required 必须先提升为 manual-review 再决策。",
      "任何删除或移动都必须另开独立阶段，不能在本批中执行。",
    ],
  };
}

function priorityLabel(priority) {
  const rule = PRIORITY_RULES[priority];
  return rule ? rule.label : `priority-${priority}`;
}

function defaultDecisionForPriority(priority) {
  const rule = PRIORITY_RULES[priority];
  return rule?.defaultDecision || "";
}

function defaultFutureActionForPriority(priority) {
  const rule = PRIORITY_RULES[priority];
  return rule?.defaultFutureAction || "manual-review-again";
}

function buildSampleItems(checklist, category, priority, maxSamples = 5) {
  if (!checklist) return [];
  const allItems = Object.entries(checklist).reduce((acc, [, value]) => {
    if (Array.isArray(value)) return acc.concat(value);
    return acc;
  }, []);
  return allItems
    .filter((item) => item.priority === priority || item.category === category)
    .slice(0, maxSamples)
    .map((item) => ({
      id: item.id || item.label || `${category}-${priority}`,
      name: item.name,
      source: item.source || item.kind || "unknown",
      category,
      priority,
      currentCommand: item.name,
      linkedEntrypoint: "",
      reason: item.reason || item.proposedHumanAction || "",
      riskLevel: priorityLabel(priority),
      riskNotes: item.riskNotes || "",
    }));
}

function buildBatchSamples(checklist) {
  if (!checklist) return [];
  const samples = [];

  let forbiddenItems = [];
  let unknownItems = [];
  let manualReviewItems = [];
  let lowRiskItems = [];

  if (Array.isArray(checklist)) {
    forbiddenItems = checklist.filter((item) => item.priority === 0);
    unknownItems = checklist.filter((item) => item.priority === 1);
    manualReviewItems = checklist.filter((item) => item.priority === 2);
    lowRiskItems = checklist.filter((item) => item.priority === 3);
  } else if (checklist && typeof checklist === "object") {
    const priorities = checklist.priorities;
    if (Array.isArray(priorities)) {
      for (const p of priorities) {
        if (p.priority === 0) forbiddenItems = p.items || [];
        if (p.priority === 1) unknownItems = p.items || [];
        if (p.priority === 2) manualReviewItems = p.items || [];
        if (p.priority === 3) lowRiskItems = p.items || [];
      }
    }
  }

  const categories = [
    { label: "forbidden-dangerous-p0", items: forbiddenItems, priority: 0 },
    { label: "unknown-review-required-p1", items: unknownItems, priority: 1 },
    { label: "archive-candidate-manual-review-p2", items: manualReviewItems, priority: 2 },
    { label: "archive-candidate-low-risk-p3", items: lowRiskItems, priority: 3 },
  ];

  for (const cat of categories) {
    if (cat.items.length > 0) {
      const batchId = `p${cat.priority}-batch-001`;
      const candidateSample = cat.items.slice(0, 15).map((item) => ({
        id: item.id || item.label,
        name: item.name,
        source: item.source || item.kind || "unknown",
        category: cat.label,
        priority: cat.priority,
        currentCommand: item.name,
        linkedEntrypoint: "",
        reason: item.reason || item.proposedHumanAction || "",
        riskLevel: priorityLabel(cat.priority),
        riskNotes: item.riskNotes || "",
      }));
      samples.push(createBatchTemplate(batchId, cat.label, candidateSample));
    }
  }

  return samples;
}

async function main() {
  let checklist = null;
  let deprecatedIndex = null;

  try {
    const raw = await readFile(INPUT_FILES.checklistJson, "utf-8");
    checklist = JSON.parse(raw);
  } catch {
    console.log("[Phase323C-8] Human review checklist not found, building from deprecated index.");
  }

  try {
    const raw = await readFile(INPUT_FILES.deprecatedIndex, "utf-8");
    deprecatedIndex = JSON.parse(raw);
  } catch {
    console.log("[Phase323C-8] Deprecated index not found, proceeding with minimal template.");
  }

  const summary = checklist?.summary || deprecatedIndex?.summary || {
    protectedCore: 0,
    historicalCompatible: 0,
    archiveCandidateLowRisk: 0,
    archiveCandidateNeedsManualReview: 0,
    forbiddenDangerous: 0,
    unknownReviewRequired: 0,
    rootScriptCount: 0,
    serviceScriptCount: 0,
  };

  const batchSamples = buildBatchSamples(checklist);

  const workflowTemplate = {
    phase: "Phase323C-8",
    title: "Human Review Workflow Template",
    generatedAt: new Date().toISOString(),
    sourceReports: [
      "docs/phase323c-7-deprecated-human-review-checklist.json",
      "docs/phase323c-6-deprecated-index.json",
      "docs/phase323c-6-archive-plan.md",
      "docs/phase323c-5-archive-candidate-review.json",
      "docs/phase323c-script-governance-policy.md",
      "docs/phase323c-service-command-governance-policy.md",
    ],
    declarations: {
      deleteScripts: false,
      moveEntrypoints: false,
      renameScripts: false,
      changePackageScripts: false,
      executeCandidateScripts: false,
      runReleaseDeployCommitPushDockerGithubReleaseScripts: false,
      staticOnly: true,
    },
    summary,
    allowedHumanDecisions: ALLOWED_HUMAN_DECISIONS,
    allowedFutureActions: ALLOWED_FUTURE_ACTIONS,
    priorityRules: Object.entries(PRIORITY_RULES).map(([key, rule]) => ({
      priority: Number(key),
      label: rule.label,
      defaultDecision: rule.defaultDecision,
      defaultFutureAction: rule.defaultFutureAction,
      canDelete: rule.canDelete,
    })),
    reviewItemTemplate: {
      id: "(required)",
      name: "(required)",
      source: "(required, e.g. script:root, entrypoint:service)",
      category: "(required)",
      priority: "(required, 0-3)",
      currentCommand: "(required)",
      linkedEntrypoint: "(optional)",
      reason: "(required)",
      humanDecision: "(required, one of allowedHumanDecisions)",
      riskLevel: "(required)",
      futureAction: "(required, one of allowedFutureActions)",
      requiredEvidence: "(required)",
      notes: "(optional)",
    },
    batchTemplate: {
      batchId: "(required)",
      sourceCategory: "(required)",
      maxItemsPerBatch: 20,
      declarations: {
        deleteScripts: false,
        moveEntrypoints: false,
        staticOnly: true,
      },
      reviewer: "(人工填写)",
      reviewDate: "(人工填写)",
      candidateItems: [],
      decisionSummary: {
        keep: 0,
        keepHistoricalCompatible: 0,
        markDeprecatedOnly: 0,
        candidateForFutureArchive: 0,
        forbiddenDoNotRun: 0,
        needsMoreContext: 0,
      },
      requiredRegressionCommands: REQUIRED_REGRESSION_COMMANDS,
      touchingProductionRegressionCommands: TOUCHING_PRODUCTION_REGRESSION,
      rollbackPlan: {
        description: "如果误改 package scripts 或删除 entrypoints，必须通过 git revert 回退。",
        revertCommand: "git revert <commit>",
        safetyRule: "不 reset、不 clean、不 force push、不自动恢复。",
      },
      reviewChecklist: [
        "确认每个 candidate 不在 product recovery 验证链中。",
        "确认每个 candidate 不影响 /chat-gateway/execute 主链。",
        "确认每个 candidate 不影响 5 个 Workbench 主模块。",
        "确认每个 candidate 不影响 secret safety。",
        "forbidden-dangerous 只允许 forbidden-do-not-run。",
        "unknown 必须先提升为 manual-review 再决策。",
        "任何删除或移动必须另开独立阶段。",
      ],
    },
    batchSamples,
    regressionCommandsForAllBatches: REQUIRED_REGRESSION_COMMANDS,
    productionRegressionWhenTouchingChatOrUI: TOUCHING_PRODUCTION_REGRESSION,
    futureArchiveStages: [
      "Stage A: 只读索引刷新 (inventory + archive-review + deprecated-index)",
      "Stage B: 人工复核 low-risk / manual-review (逐项确认引用关系)",
      "Stage C: deprecated alias / warning index 生成",
      "Stage D: 归档路径设计 (独立目录 + 说明 + 回滚路径)",
      "Stage E: 小批量迁移 (每次 ≤20 项, 禁止批量移动)",
      "Stage F: 验证回归 (product recovery + secret safety + 主链)",
      "Stage G: 最终删除或长期保留",
    ],
    protectedCoreBoundary: "protected-core 中的 25 个入口禁止归档，禁止被标记为 candidate-for-future-archive 或 forbidden-do-not-run。",
  };

  await writeFile(OUTPUT_JSON, JSON.stringify(workflowTemplate, null, 2), "utf-8");
  console.log("[Phase323C-8] Human review workflow JSON written:", OUTPUT_JSON);

  const md = buildMarkdown(workflowTemplate);
  await writeFile(OUTPUT_MD, md, "utf-8");
  console.log("[Phase323C-8] Human review workflow Markdown written:", OUTPUT_MD);

  return { json: OUTPUT_JSON, md: OUTPUT_MD, summary };
}

function buildMarkdown(workflow) {
  const { summary, batchSamples, priorityRules } = workflow;
  const lines = [];

  lines.push("# Phase323C-8 Human Review Workflow Template");
  lines.push("");
  lines.push(`Generated: ${workflow.generatedAt}`);
  lines.push("");

  lines.push("## Declarations");
  lines.push("");
  lines.push("- 不删除 scripts");
  lines.push("- 不移动 entrypoints");
  lines.push("- 不改 package scripts 语义");
  lines.push("- 不执行候选脚本");
  lines.push("- 不运行 release / deploy / commit / push / docker publish / GitHub release 类脚本");
  lines.push("");

  lines.push("## Current Baseline");
  lines.push("");
  lines.push(`- rootScriptCount: ${summary.rootScriptCount}`);
  lines.push(`- serviceScriptCount: ${summary.serviceScriptCount}`);
  lines.push(`- protected-core: ${summary.protectedCore}`);
  lines.push(`- historical-compatible: ${summary.historicalCompatible}`);
  lines.push(`- archive-candidate-low-risk: ${summary.archiveCandidateLowRisk}`);
  lines.push(`- archive-candidate-needs-manual-review: ${summary.archiveCandidateNeedsManualReview}`);
  lines.push(`- forbidden-dangerous: ${summary.forbiddenDangerous}`);
  lines.push(`- unknown-review-required: ${summary.unknownReviewRequired}`);
  lines.push("");

  lines.push("## Allowed Human Decisions");
  lines.push("");
  for (const decision of ALLOWED_HUMAN_DECISIONS) {
    lines.push(`- \`${decision}\``);
  }
  lines.push("");

  lines.push("## Allowed Future Actions");
  lines.push("");
  for (const action of ALLOWED_FUTURE_ACTIONS) {
    lines.push(`- \`${action}\``);
  }
  lines.push("");

  lines.push("## Priority Rules");
  lines.push("");
  lines.push("| Priority | Label | Default Decision | Default Future Action | Can Delete |");
  lines.push("|----------|-------|-----------------|----------------------|------------|");
  for (const rule of priorityRules) {
    lines.push(`| ${rule.priority} | ${rule.label} | ${rule.defaultDecision || "manual-review-required"} | ${rule.defaultFutureAction} | ${rule.canDelete ? "yes" : "no"} |`);
  }
  lines.push("");

  lines.push("## Review Item Template");
  lines.push("");
  lines.push("Each item must contain:");
  lines.push("");
  lines.push("- `id` (required)");
  lines.push("- `name` (required)");
  lines.push("- `source` (required, e.g. `script:root`, `entrypoint:service`)");
  lines.push("- `category` (required)");
  lines.push("- `priority` (required, 0-3)");
  lines.push("- `currentCommand` (required)");
  lines.push("- `linkedEntrypoint` (optional)");
  lines.push("- `reason` (required)");
  lines.push("- `humanDecision` (required, one of allowed values)");
  lines.push("- `riskLevel` (required)");
  lines.push("- `futureAction` (required, one of allowed values)");
  lines.push("- `requiredEvidence` (required)");
  lines.push("- `notes` (optional)");
  lines.push("");

  lines.push("## Review Batch Template");
  lines.push("");
  lines.push("- maxItemsPerBatch: 20");
  lines.push("- Each batch must include: batchId, sourceCategory, reviewer, reviewDate, candidateItems, decisionSummary, requiredRegressionCommands, rollbackPlan");
  lines.push("");

  lines.push("## Rollback Plan");
  lines.push("");
  lines.push("- 如果误改 package scripts 或删除 entrypoints：`git revert <commit>`");
  lines.push("- 不 reset、不 clean、不 force push、不自动恢复。");
  lines.push("");

  lines.push("## Required Regression Commands (All Batches)");
  lines.push("");
  for (const cmd of REQUIRED_REGRESSION_COMMANDS) {
    lines.push(`- \`${cmd}\``);
  }
  lines.push("");

  lines.push("## Extra Regression When Touching Chat/UI");
  lines.push("");
  for (const cmd of TOUCHING_PRODUCTION_REGRESSION) {
    lines.push(`- \`${cmd}\``);
  }
  lines.push("");

  lines.push("## Batch Samples");
  lines.push("");

  for (const batch of batchSamples) {
    lines.push(`### ${batch.batchLabel}`);
    lines.push("");
    lines.push(`- batchId: \`${batch.batchId}\``);
    lines.push(`- maxItemsPerBatch: ${batch.maxItemsPerBatch}`);
    lines.push(`- status: \`${batch.status}\``);
    lines.push("");

    const items = batch.candidateItems || [];
    if (items.length > 0) {
      lines.push("#### Sample Candidates (first 5)");
      lines.push("");
      lines.push("| # | id | name | priority | humanDecision | futureAction |");
      lines.push("|---|-----|------|----------|---------------|-------------|");
      for (const item of items.slice(0, 5)) {
        const decision = defaultDecisionForPriority(item.priority);
        const action = defaultFutureActionForPriority(item.priority);
        lines.push(`| ${item.batchIndex || "-"} | ${(item.id || "").substring(0, 40)} | ${(item.name || "").substring(0, 30)} | ${item.priority} | (需人工填写, 建议 ${decision}) | (需人工填写, 建议 ${action}) |`);
      }
      lines.push("");
    }
  }

  lines.push("## Future Archive Stages");
  lines.push("");
  for (const stage of workflow.futureArchiveStages) {
    lines.push(`- ${stage}`);
  }
  lines.push("");

  lines.push("## Protected Core Boundary");
  lines.push("");
  lines.push(workflow.protectedCoreBoundary);
  lines.push("");

  return lines.join("\n");
}

main().catch((error) => {
  console.error("[Phase323C-8] Failed:", error.message);
  process.exit(1);
});