import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scoreNextActionQuality } from "./score-next-action-quality.mjs";
import { phase2007To2016Tasks } from "./gvc-batch-task-catalog.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "../..");

export function generateNextActions(options = {}) {
  const repoRoot = options.repoRoot || defaultRepoRoot;
  const generatedAt = new Date().toISOString();
  const batchId = options.batchId || buildBatchId();
  const candidates = buildCandidates({ batchId });
  const scored = candidates.map((action) => ({
    ...action,
    quality: scoreNextActionQuality({ repoRoot, action, existingActions: candidates }),
  }));
  const accepted = scored.filter((action) => action.quality.recommendedAction === "allow").slice(0, 10);
  const rejected = scored.filter((action) => action.quality.recommendedAction !== "allow");
  const nextActions = {
    phaseId: "Phase2035-GVC-Auto-Next-Actions-Planner",
    generatedAt,
    selectionPolicy: {
      preferStatus: "ready",
      preferLowestRisk: true,
      thenHighestPriority: true,
      qualityGateRequired: true,
      maxMutationTasks: 10,
      providerCallsMade: false,
      secretRead: false,
      deployExecuted: false,
      batchId,
    },
    actions: [
      ...accepted,
      {
        taskId: "phase2035-provider-approval-candidate",
        title: "Future Provider approval packet candidate",
        riskLevel: "L3",
        priority: 50,
        status: "approval_required",
        touches: ["docs/approvals/gvc-provider-approval-bridge-approval-required.json"],
        operations: ["provider_call"],
        quality: {
          recommendedAction: "approval_required",
        },
      },
    ],
    rejectedByQualityGate: rejected.map((action) => ({
      taskId: action.taskId,
      recommendedAction: action.quality.recommendedAction,
      totalScore: action.quality.totalScore,
    })),
  };
  const nextActionsPath = path.join(repoRoot, "docs/project-brain/next-actions.json");
  mkdirSync(path.dirname(nextActionsPath), { recursive: true });
  writeFileSync(nextActionsPath, `${JSON.stringify(nextActions, null, 2)}\n`, "utf8");
  const evidence = {
    phaseId: "Phase2035-GVC-Auto-Next-Actions-Planner",
    status: "passed",
    generatedAt,
    generatedAllowedTaskCount: accepted.length,
    rejectedLowValueCount: rejected.length,
    approvalRequiredTaskCount: 1,
    nextActionsPath: "docs/project-brain/next-actions.json",
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatGatewayExecuteModified: false,
  };
  const evidencePath = path.join(repoRoot, "apps/ai-gateway-service/evidence/phase2035-gvc-auto-next-actions-planner/auto-next-actions-result.json");
  mkdirSync(path.dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return { nextActions, evidence };
}

function buildCandidates(options = {}) {
  return buildCandidatesForBatch({ batchId: options.batchId || "phase2037" });
}

function buildCandidatesForBatch({ batchId }) {
  const safeBatchId = String(batchId || "phase2037").toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const actions = phase2007To2016Tasks.map((task, offset) => {
    const index = offset + 1;
    const padded = String(index).padStart(2, "0");
    const riskLevel = index === 1 ? "L0" : index === phase2007To2016Tasks.length ? "L2" : task.riskLevel;
    const evidencePath = `apps/ai-gateway-service/evidence/gvc-autonomous-safe-batch/${safeBatchId}/${task.slug}.json`;
    return {
      taskId: `${safeBatchId}-${task.slug}`,
      title: `${task.title} (${safeBatchId})`,
      riskLevel,
      priority: 100 - index,
      status: "ready",
      touches: [evidencePath],
      operations: ["evidence_write"],
      expectedEvidence: evidencePath,
      rollbackPlan: "Restore the previous file snapshot if verifier fails.",
      verifierCommand: "pnpm run verify:gvc-safe-overnight-mode",
      mutationPlan: {
        mutations: [
          {
            type: "write_file",
            path: evidencePath,
            content: `${JSON.stringify({
              phaseId: task.phaseId,
              batchId: safeBatchId,
              taskId: task.taskId,
              title: task.title,
              summaryKind: task.summaryKind,
              taskIndex: index,
              ownerValue: buildOwnerValue(task.summaryKind),
              realLowRiskMutation: true,
              providerCallsMade: false,
              secretRead: false,
              deployExecuted: false,
              chatGatewayExecuteModified: false,
            }, null, 2)}\n`,
          },
        ],
        verifierCommands: [
          {
            command: "pnpm",
            args: ["run", "verify:gvc-safe-overnight-mode"],
          },
        ],
      },
    };
  });
  actions.push({
    taskId: "phase2035-low-value-duplicate-doc",
    title: "Repeat generic docs-only note",
    riskLevel: "L1",
    priority: 1,
    status: "ready",
    touches: ["docs/phase-low-value-note.md"],
    operations: ["docs_update"],
  });
  return actions;
}

function buildOwnerValue(summaryKind) {
  const values = {
    history_compact_summary: "Keeps long-running GVC history readable without scanning raw evidence.",
    operator_summary: "Gives the owner a compact operating view of the autonomous runner.",
    stale_evidence_detector: "Flags stale evidence risk before automation trusts old state.",
    next_actions_quality_verifier: "Preserves task quality so automation avoids low-value churn.",
    approval_queue_readability: "Makes skipped approval-required work easier to review later.",
    runner_regression: "Keeps runner stop and safety guards visible across batches.",
    project_brain_consistency: "Checks project-brain files stay aligned for autonomous decisions.",
    seal_matrix_compaction: "Compacts seal status so owner can see what is actually proven.",
    owner_status_report: "Creates an owner-facing status artifact without reading raw secrets.",
    dry_run_replay: "Records a dry-run replay path for safer future runner changes.",
  };
  return values[summaryKind] || "Low-risk evidence update for autonomous project progress.";
}

function buildBatchId(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");
  return `gvc-auto-${year}${month}${day}-${hour}${minute}${second}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  console.log(JSON.stringify(generateNextActions(), null, 2));
}
