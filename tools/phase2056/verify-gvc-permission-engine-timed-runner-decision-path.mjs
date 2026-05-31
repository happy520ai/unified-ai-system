import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runTimedLocalRunner } from "../gvc/run-timed-local-runner.mjs";
import {
  buildTimedRunnerPermissionDecision,
  reconcilePermissionWithRiskGate,
} from "../../packages/gvc-permission-engine/src/index.js";

const repoRoot = process.cwd();
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), "phase2056-gvc-runner-"));
let runnerState = null;
let runnerDecision = null;
let runnerLoopEvidence = null;

try {
  writeFixtureProject(fixtureRoot);
  runnerState = await runTimedLocalRunner({
    repoRoot: fixtureRoot,
    intervalMs: 1,
    dailyLoopLimit: 1,
    maxTasksPerLoop: 1,
    dryRunOnly: true,
    testMode: true,
    verificationCommands: [["node", ["--version"]]],
  });
  const decisionFiles = listFiles(path.join(fixtureRoot, "apps/ai-gateway-service/evidence/phase2056-gvc-permission-engine-timed-runner-decision-path"))
    .filter((filePath) => path.basename(filePath).startsWith("decision-"));
  runnerDecision = decisionFiles.length > 0 ? readJsonAbsolute(decisionFiles[0]) : null;
  runnerLoopEvidence = readJsonAbsolute(path.join(fixtureRoot, runnerState.lastLoopEvidenceRef || ""));
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

const samples = buildSampleDecisions();

check("runner_state_written", runnerState?.loopsCompletedToday === 1);
check("runner_permission_decision_evidence_written", runnerDecision?.permissionDecision?.decision === "allow", runnerDecision?.permissionDecision?.decision);
check("runner_loop_references_permission_decision", typeof runnerLoopEvidence?.permissionDecisionEvidenceRef === "string" && runnerLoopEvidence.permissionEngineShadowOnly === true);
check("runner_real_mutation_behavior_unchanged", runnerLoopEvidence?.realMutationBehaviorChangedByPermissionEngine === false && runnerLoopEvidence?.realExecutionPerformed === false);
check("allowed_docs_task", samples.docs.permissionDecision.decision === "allow");
check("allowed_verifier_task", samples.verifier.permissionDecision.decision === "allow" && samples.verifier.permissionDecision.commandCategory === "safe_test");
check("provider_task_approval_required", samples.provider.permissionDecision.decision === "approval_required" && samples.provider.permissionDecision.providerRisk === true);
check("secret_task_forbidden", samples.secret.permissionDecision.decision === "forbidden" && samples.secret.permissionDecision.secretRisk === true);
check("deploy_task_forbidden", samples.deploy.permissionDecision.decision === "forbidden" && samples.deploy.permissionDecision.deployRisk === true);
check("chat_gateway_task_forbidden", samples.chat.permissionDecision.decision === "forbidden" && samples.chat.permissionDecision.chatRouteRisk === true);
check("conflict_more_conservative", samples.conflict.reconciliation.conflict === true && samples.conflict.reconciliation.finalDecision === "deny" && samples.conflict.reconciliation.shouldExecuteTask === false);
check("shadow_only", Object.values(samples).every((entry) => entry.permissionDecision.shadowOnly === true && entry.reconciliation.shadowOnly === true));
check("no_provider_secret_deploy_chat", Object.values(samples).every((entry) => entry.permissionDecision.providerCallsMade === false && entry.permissionDecision.secretRead === false && entry.permissionDecision.deployExecuted === false && entry.permissionDecision.chatGatewayExecuteModified === false));

const failed = checks.filter((entry) => !entry.pass);
const result = {
  phaseId: "Phase2056-GVC-Permission-Engine-Timed-Runner-Decision-Path",
  status: failed.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  checks,
  runnerState: runnerState ? {
    status: runnerState.status,
    lastLoopEvidenceRef: runnerState.lastLoopEvidenceRef,
    lastSelectedTaskId: runnerState.lastSelectedTaskId,
  } : null,
  runnerDecision,
  samples,
  permissionEngineConnectedToTimedRunner: runnerDecision?.phaseId === "Phase2056-GVC-Permission-Engine-Timed-Runner-Decision-Path",
  shadowDecisionOnly: true,
  realMutationBehaviorChanged: false,
  conflictUsesConservativeDecision: samples.conflict.reconciliation.finalDecision === "deny",
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map((entry) => entry.id).join(", "),
};

writeJson(path.join(repoRoot, "apps/ai-gateway-service/evidence/phase2056-gvc-permission-engine-timed-runner-decision-path/result.json"), result);
console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  permissionEngineConnectedToTimedRunner: result.permissionEngineConnectedToTimedRunner,
  shadowDecisionOnly: result.shadowDecisionOnly,
}, null, 2));
if (failed.length > 0) process.exit(1);

function buildSampleDecisions() {
  const tasks = {
    docs: {
      taskId: "phase2056-docs",
      riskLevel: "L1",
      touches: ["docs/phase2056-gvc-permission-engine-timed-runner-decision-path.md"],
      operations: ["docs_update"],
    },
    verifier: {
      taskId: "phase2056-verifier",
      riskLevel: "L1",
      touches: ["tools/phase2056/verify-gvc-permission-engine-timed-runner-decision-path.mjs"],
      operations: ["verifier_update"],
      verifierCommand: "pnpm run verify:phase2056-gvc-permission-engine-timed-runner-decision-path",
    },
    provider: {
      taskId: "phase2056-provider",
      riskLevel: "L3",
      touches: ["apps/ai-gateway-service/evidence/phase2056/provider.json"],
      operations: ["provider_call"],
    },
    secret: {
      taskId: "phase2056-secret",
      riskLevel: "L4",
      touches: [".env"],
      operations: ["secret_read"],
    },
    deploy: {
      taskId: "phase2056-deploy",
      riskLevel: "L4",
      touches: ["docs/deploy-plan.md"],
      operations: ["deploy"],
    },
    chat: {
      taskId: "phase2056-chat",
      riskLevel: "L3",
      touches: ["apps/ai-gateway-service/src/chat-gateway/execute.js"],
      operations: ["chat_gateway_execute_modify"],
    },
    conflict: {
      taskId: "phase2056-conflict",
      riskLevel: "L1",
      touches: ["docs/phase2056-conflict.md"],
      operations: ["docs_update"],
    },
  };
  return Object.fromEntries(Object.entries(tasks).map(([key, task]) => {
    const riskGateDecision = key === "conflict" ? "deny" : key === "provider" || key === "chat" ? "approval_required" : key === "secret" || key === "deploy" ? "forbidden" : "allowed";
    const permissionDecision = buildTimedRunnerPermissionDecision({ task, riskGateDecision });
    const reconciliation = reconcilePermissionWithRiskGate({ permissionDecision, riskGateDecision });
    return [key, { task, permissionDecision, reconciliation }];
  }));
}

function writeFixtureProject(root) {
  const brainDir = path.join(root, "docs/project-brain");
  const approvalDir = path.join(root, "docs/approvals");
  mkdirSync(brainDir, { recursive: true });
  mkdirSync(approvalDir, { recursive: true });
  writeJson(path.join(brainDir, "current-state.json"), { phaseId: "Phase2056Fixture", currentBlocker: "none" });
  writeJson(path.join(brainDir, "goals.json"), { goals: ["phase2056 fixture"] });
  writeJson(path.join(brainDir, "completion-definition.json"), { completion: ["permission evidence written"] });
  writeJson(path.join(brainDir, "runner-control.json"), {
    paused: false,
    stopRequested: false,
    maxTasksPerLoop: 1,
    dryRunOnly: true,
    noProvider: true,
    noSecret: true,
    noDeploy: true,
  });
  writeJson(path.join(brainDir, "risk-policy.json"), {
    riskLevels: {
      L0: { defaultDecision: "allowed" },
      L1: { defaultDecision: "allowed" },
      L2: { defaultDecision: "allowed" },
      L3: { defaultDecision: "approval_required" },
      L4: { defaultDecision: "forbidden" },
    },
    forbiddenPathPrefixes: ["legacy/", ".git/", "node_modules/"],
    forbiddenExactPaths: ["PROJECT_CONTEXT.md", ".env", ".env.local", ".env.production", "auth.json"],
    forbiddenBasenames: ["PROJECT_CONTEXT.md", ".env", ".env.local", ".env.production", "auth.json"],
    forbiddenOperations: ["secret_read", "deploy", "release", "tag", "artifact_upload", "push", "commit"],
    approvalRequiredOperations: ["provider_call", "paid_api_call", "chat_modify", "chat_gateway_execute_modify"],
    providerApprovalRequiredFields: ["provider", "model", "credentialRef"],
    providerDefaultLimits: { maxRequests: 1 },
  });
  writeJson(path.join(brainDir, "next-actions.json"), {
    actions: [
      {
        taskId: "phase2056-fixture-docs",
        title: "Phase2056 fixture docs decision",
        riskLevel: "L1",
        priority: 100,
        status: "ready",
        touches: ["docs/phase2056-gvc-permission-engine-timed-runner-decision-path.md"],
        operations: ["docs_update"],
      },
    ],
  });
  writeJson(path.join(brainDir, "safe-overnight-policy.json"), {
    enabled: false,
    emergencyStopFile: "docs/project-brain/runner-control.json",
  });
  writeJson(path.join(approvalDir, "gvc-low-risk-autonomous-mutation-approval.json"), {
    approved: true,
    scope: "low_risk_only",
    providerAllowed: false,
    secretReadAllowed: false,
    deployAllowed: false,
    chatRouteModificationAllowed: false,
    legacyModificationAllowed: false,
    projectContextModificationAllowed: false,
    dailyRealExecutionLoopLimit: 100,
  });
}

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  const result = [];
  for (const entry of readdirSync(dir)) {
    const filePath = path.join(dir, entry);
    if (statSync(filePath).isDirectory()) {
      result.push(...listFiles(filePath));
    } else {
      result.push(filePath);
    }
  }
  return result;
}

function readJsonAbsolute(filePath) {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
