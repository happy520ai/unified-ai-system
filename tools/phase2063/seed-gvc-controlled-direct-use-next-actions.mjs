import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2063-GVC-Controlled-Direct-Use-Run";
const backupDir = "apps/ai-gateway-service/evidence/phase2063-gvc-controlled-direct-use-run/backups";
const nextActionsPath = "docs/project-brain/next-actions.json";
const statePath = "docs/project-brain/timed-runner-state.json";
const safePolicyPath = "docs/project-brain/safe-overnight-policy.json";
const runnerControlPath = "docs/project-brain/runner-control.json";
const approvalPath = "docs/approvals/gvc-low-risk-autonomous-mutation-approval.json";

for (const file of [nextActionsPath, statePath, safePolicyPath, runnerControlPath, approvalPath]) {
  backup(file);
}

writeJson(nextActionsPath, {
  phaseId,
  generatedAt: new Date().toISOString(),
  seededBy: "Phase2063-Controlled-Direct-Use-Run",
  actions: [
    allowedAction("phase2063-docs-direct-use", "docs/phase2063-controlled-direct-use-fixture.md", "Phase2063 controlled direct-use docs fixture\n", "docs_update", "L0", 100),
    allowedAction("phase2063-evidence-direct-use", "apps/ai-gateway-service/evidence/phase2063-gvc-controlled-direct-use-run/fixture-evidence.json", `${JSON.stringify({ phaseId, fixture: "evidence", providerCallsMade: false, secretRead: false }, null, 2)}\n`, "evidence_update", "L1", 99),
    allowedAction("phase2063-verifier-direct-use", "tools/phase2063/fixture-verifier.mjs", "console.log('phase2063 fixture verifier');\n", "verifier_update", "L2", 98),
    providerCandidate(),
    secretCandidate(),
  ],
  rejectedByQualityGate: [],
});

writeJson(safePolicyPath, {
  phaseId: "SafeOvernightMode",
  enabled: true,
  intervalMs: 30000,
  dailyLoopLimit: 500,
  realMutationLoopLimit: 30,
  maxTasksPerLoop: 1,
  dryRunDefault: true,
  ownerManualStartOnly: true,
  emergencyStopFile: "docs/project-brain/runner-control.json",
  stopConditions: {
    consecutiveNoOpLimit: 3,
    consecutiveVerifierFailLimit: 2,
    rollbackFailureLimit: 0,
    sameFileTouchLimitPerDay: 3,
    consecutiveLowValueBlockedLimit: 2,
    providerSecretDeployChatRiskStopsImmediately: true,
  },
  forbiddenPaths: ["legacy/", "PROJECT_CONTEXT.md", "/chat", "/chat-gateway/execute", "credential/provider core", "billing/payment"],
  forbiddenActions: ["provider_call", "secret_read", "deploy", "release", "tag", "artifact_upload", "push", "commit"],
  evidenceRequiredEveryLoop: true,
  mutationSummaryRequiredEveryLoop: true,
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
});

writeJson(runnerControlPath, {
  paused: false,
  stopRequested: false,
  maxTasksPerLoop: 1,
  dryRunOnly: true,
  noProvider: true,
  noSecret: true,
  noDeploy: true,
});

writeJson(approvalPath, {
  approved: true,
  scope: "low_risk_only",
  allowDocs: true,
  allowEvidence: true,
  allowVerifier: true,
  allowNonCoreUi: true,
  allowPackageScripts: true,
  maxMutationsPerLoop: 3,
  dailyRealExecutionLoopLimit: 100,
  rollbackRequired: true,
  providerAllowed: false,
  secretReadAllowed: false,
  deployAllowed: false,
  chatRouteModificationAllowed: false,
  legacyModificationAllowed: false,
  projectContextModificationAllowed: false,
});

writeJson(statePath, {
  phaseId: "Phase2019-GVC-Timed-Local-Runner-30s-DailyCap",
  status: "initialized",
  date: localDate(),
  dailyLoopLimit: 20,
  intervalMs: 30000,
  maxTasksPerLoop: 1,
  dryRunOnly: false,
  autonomousMutationEnabled: true,
  realExecutionLoopLimit: 30,
  realExecutionLoopsCompletedToday: 0,
  consecutiveNoOpLoops: 0,
  consecutiveLowValueBlockedLoops: 0,
  fileTouchCounts: {},
  completedTaskIds: [],
  ownerManualStartOnly: true,
  windowsTaskSchedulerRegistered: false,
  startupAutoRunRegistered: false,
  loopsCompletedToday: 0,
  consecutiveVerifierFailures: 0,
  lastLoopEvidenceRef: null,
  lastSelectedTaskId: null,
  currentBlocker: "none",
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
  gracefulShutdown: false,
  updatedAt: new Date().toISOString(),
});

writeJson("apps/ai-gateway-service/evidence/phase2063-gvc-controlled-direct-use-run/seed-result.json", {
  phaseId,
  seeded: true,
  generatedAt: new Date().toISOString(),
  backupDir,
  taskCount: 5,
  allowedTaskCount: 3,
  blockedTaskCount: 2,
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
});

console.log(JSON.stringify({ seeded: true, phaseId, backupDir }, null, 2));

function allowedAction(taskId, targetPath, content, operation, riskLevel, priority) {
  return {
    taskId,
    title: taskId,
    riskLevel,
    priority,
    status: "ready",
    touches: [targetPath],
    targetFiles: [targetPath],
    rollbackPlan: `Restore ${targetPath} from low-risk executor snapshot if verifier fails.`,
    verifierCommand: "pnpm run verify:phase2062-gvc-direct-use-readiness-gate",
    operations: [operation],
    quality: {
      ownerValueScore: 100,
      engineeringValueScore: 85,
      duplicateRiskScore: 5,
      staleRiskScore: 5,
      evidenceValueScore: 90,
      totalScore: 265,
      recommendedAction: "allow",
    },
    mutationPlan: {
      planId: `phase2063-${taskId}`,
      operations: [operation],
      mutations: [{ type: "write_file", path: targetPath, content }],
      verifierCommands: [{ command: process.execPath, args: ["-e", "process.exit(0)"] }],
    },
  };
}

function providerCandidate() {
  return {
    taskId: "phase2063-provider-candidate",
    title: "Provider candidate remains approval-required",
    riskLevel: "L3",
    priority: 70,
    status: "approval_required",
    touches: ["apps/ai-gateway-service/evidence/phase2063-gvc-controlled-direct-use-run/provider-should-not-write.json"],
    targetFiles: ["apps/ai-gateway-service/evidence/phase2063-gvc-controlled-direct-use-run/provider-should-not-write.json"],
    operations: ["provider_call"],
    rollbackPlan: "No write is allowed.",
    verifierCommand: "node -e process.exit(0)",
    quality: { recommendedAction: "approval_required" },
  };
}

function secretCandidate() {
  return {
    taskId: "phase2063-secret-read",
    title: "Secret read remains forbidden",
    riskLevel: "L4",
    priority: 60,
    status: "ready",
    touches: [".env"],
    targetFiles: [".env"],
    operations: ["secret_read"],
    rollbackPlan: "No secret read or write is allowed.",
    verifierCommand: "node -e process.exit(0)",
    quality: { recommendedAction: "forbidden" },
  };
}

function backup(relativePath) {
  const source = path.join(repoRoot, relativePath);
  const target = path.join(repoRoot, backupDir, `${relativePath.replaceAll(/[\\/]/g, "__")}.bak`);
  mkdirSync(path.dirname(target), { recursive: true });
  if (existsSync(source)) {
    writeFileSync(target, readFileSync(source, "utf8"), "utf8");
  } else {
    writeFileSync(`${target}.missing`, "missing\n", "utf8");
  }
}

function localDate(now = new Date()) {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function writeJson(relativePath, value) {
  const filePath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
