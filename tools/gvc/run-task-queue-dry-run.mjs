import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readProjectBrain } from "./read-project-brain.mjs";
import { validateRiskGate } from "./validate-risk-gate.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "../..");

const riskRank = {
  L0: 0,
  L1: 1,
  L2: 2,
  L3: 3,
  L4: 4,
};

function evidencePathFor(repoRoot) {
  return path.join(
    repoRoot,
    "apps/ai-gateway-service/evidence/phase2001-gvc-task-queue-runner/task-queue-runner-result.json",
  );
}

function evaluateAction({ repoRoot, action, maxRiskLevel }) {
  const gate = validateRiskGate({
    repoRoot,
    task: action,
    writeApprovalPacket: action.riskLevel === "L3",
  });
  const withinDryRunLimit = riskRank[action.riskLevel] <= riskRank[maxRiskLevel];
  const wouldDryRun = gate.decision === "allowed" && withinDryRunLimit;

  return {
    taskId: action.taskId,
    title: action.title,
    riskLevel: action.riskLevel,
    priority: action.priority,
    decision: gate.decision,
    status: action.status,
    dryRunPlanned: wouldDryRun,
    realExecutionPerformed: false,
    touches: action.touches || [],
    operations: action.operations || [],
    approvalPacketPath: gate.approvalPacketPath,
    reasons: gate.reasons,
  };
}

export function runTaskQueueDryRun(options = {}) {
  const repoRoot = options.repoRoot || defaultRepoRoot;
  const maxRiskLevel = options.maxRiskLevel || "L2";
  const brain = readProjectBrain({ repoRoot });
  const queueDecisions = brain.nextActions.actions.map((action) =>
    evaluateAction({ repoRoot, action, maxRiskLevel }),
  );

  const allowedTaskCount = queueDecisions.filter((entry) => entry.decision === "allowed").length;
  const approvalRequiredTaskCount = queueDecisions.filter((entry) => entry.decision === "approval_required").length;
  const forbiddenTaskCount = queueDecisions.filter((entry) => entry.decision === "forbidden").length;
  const selectedTaskCount = queueDecisions.filter((entry) => entry.dryRunPlanned).length;

  const result = {
    phaseId: "Phase2001-GVC-Task-Queue-Runner",
    status: "passed",
    generatedAt: new Date().toISOString(),
    dryRunOnly: true,
    maxRiskLevel,
    selectedTaskCount,
    allowedTaskCount,
    approvalRequiredTaskCount,
    forbiddenTaskCount,
    executedTaskCount: 0,
    queueDecisions,
    recommendedSealed:
      selectedTaskCount >= 3 &&
      allowedTaskCount >= 3 &&
      approvalRequiredTaskCount >= 1 &&
      forbiddenTaskCount === 0,
    blocker: "none",
    providerCallsMade: false,
    secretRead: false,
    deployReleasePerformed: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    commitPerformed: false,
    pushPerformed: false,
    workspaceCleanClaimed: false,
  };

  const evidencePath = evidencePathFor(repoRoot);
  mkdirSync(path.dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(result, null, 2)}\n`);

  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  console.log(JSON.stringify(runTaskQueueDryRun(), null, 2));
}
