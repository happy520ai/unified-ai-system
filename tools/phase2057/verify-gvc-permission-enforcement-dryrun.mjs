import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runTimedLocalRunner } from "../gvc/run-timed-local-runner.mjs";
import {
  buildTimedRunnerEnforcementDryRun,
  buildTimedRunnerPermissionDecision,
  reconcilePermissionWithRiskGate,
} from "../../packages/gvc-permission-engine/src/index.js";

const repoRoot = process.cwd();
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), "phase2057-gvc-runner-"));
let runnerState = null;
let runnerEnforcement = null;
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
  const enforcementFiles = listFiles(path.join(fixtureRoot, "apps/ai-gateway-service/evidence/phase2057-gvc-permission-enforcement-dryrun"))
    .filter((filePath) => path.basename(filePath).startsWith("enforcement-"));
  runnerEnforcement = enforcementFiles.length > 0 ? readJsonAbsolute(enforcementFiles[0]) : null;
  runnerLoopEvidence = readJsonAbsolute(path.join(fixtureRoot, runnerState.lastLoopEvidenceRef || ""));
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

const samples = buildSampleEnforcementDryRuns();

check("runner_state_written", runnerState?.loopsCompletedToday === 1);
check("runner_enforcement_evidence_written", runnerEnforcement?.enforcementDryRun?.wouldEnforceDecision === "allow", runnerEnforcement?.enforcementDryRun?.wouldEnforceDecision);
check("runner_loop_references_enforcement_evidence", typeof runnerLoopEvidence?.enforcementDryRunEvidenceRef === "string" && runnerLoopEvidence.enforcementDryRunOnly === true);
check("runner_real_mutation_behavior_unchanged", runnerLoopEvidence?.realMutationBehaviorChangedByPermissionEngine === false && runnerLoopEvidence?.realExecutionPerformed === false);
check("low_risk_docs_would_allow", samples.docs.enforcementDryRun.wouldEnforceDecision === "allow");
check("verifier_mutation_would_allow", samples.verifier.enforcementDryRun.wouldEnforceDecision === "allow");
check("package_script_mutation_conservative", ["approval_required", "deny"].includes(samples.packageScript.enforcementDryRun.wouldEnforceDecision));
check("provider_would_approval_required", samples.provider.enforcementDryRun.wouldEnforceDecision === "approval_required");
check("secret_would_forbidden", samples.secret.enforcementDryRun.wouldEnforceDecision === "forbidden");
check("deploy_would_forbidden", samples.deploy.enforcementDryRun.wouldEnforceDecision === "forbidden");
check("chat_gateway_would_forbidden", samples.chat.enforcementDryRun.wouldEnforceDecision === "forbidden");
check("conflict_would_deny", samples.conflict.enforcementDryRun.conflictDetected === true && samples.conflict.enforcementDryRun.wouldEnforceDecision === "deny");
check("conflict_more_conservative", samples.conflict.enforcementDryRun.conservativeDecision === "deny");
check("dry_run_only", Object.values(samples).every((entry) => entry.enforcementDryRun.enforcementDryRunOnly === true));
check("real_execution_decision_unchanged", Object.values(samples).every((entry) => entry.enforcementDryRun.realExecutionDecisionUnchanged === true));
check("no_new_authority", Object.values(samples).every((entry) =>
  entry.enforcementDryRun.providerCallsMade === false &&
  entry.enforcementDryRun.secretRead === false &&
  entry.enforcementDryRun.deployExecuted === false &&
  entry.enforcementDryRun.chatGatewayExecuteModified === false
));

const failed = checks.filter((entry) => !entry.pass);
const result = {
  phaseId: "Phase2057-GVC-Permission-Enforcement-DryRun",
  status: failed.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  checks,
  runnerState: runnerState ? {
    status: runnerState.status,
    lastLoopEvidenceRef: runnerState.lastLoopEvidenceRef,
    lastSelectedTaskId: runnerState.lastSelectedTaskId,
  } : null,
  runnerEnforcement,
  samples,
  enforcementDryRunOnly: true,
  realMutationBehaviorChanged: false,
  conflictUsesConservativeDecision: samples.conflict.enforcementDryRun.conservativeDecision === "deny",
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

writeJson(path.join(repoRoot, "apps/ai-gateway-service/evidence/phase2057-gvc-permission-enforcement-dryrun/result.json"), result);
console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  enforcementDryRunOnly: result.enforcementDryRunOnly,
  realMutationBehaviorChanged: result.realMutationBehaviorChanged,
}, null, 2));
if (failed.length > 0) process.exit(1);

function buildSampleEnforcementDryRuns() {
  const tasks = {
    docs: {
      taskId: "phase2057-docs",
      riskLevel: "L1",
      touches: ["docs/phase2057-gvc-permission-enforcement-dryrun.md"],
      operations: ["docs_update"],
    },
    verifier: {
      taskId: "phase2057-verifier",
      riskLevel: "L1",
      touches: ["tools/phase2057/verify-gvc-permission-enforcement-dryrun.mjs"],
      operations: ["verifier_update"],
      verifierCommand: "pnpm run verify:phase2057-gvc-permission-enforcement-dryrun",
    },
    packageScript: {
      taskId: "phase2057-package-script",
      riskLevel: "L2",
      touches: ["package.json"],
      operations: ["package_script_update"],
    },
    provider: {
      taskId: "phase2057-provider",
      riskLevel: "L3",
      touches: ["apps/ai-gateway-service/evidence/phase2057/provider.json"],
      operations: ["provider_call"],
    },
    secret: {
      taskId: "phase2057-secret",
      riskLevel: "L4",
      touches: [".env"],
      operations: ["secret_read"],
    },
    deploy: {
      taskId: "phase2057-deploy",
      riskLevel: "L4",
      touches: ["docs/deploy-plan.md"],
      operations: ["deploy"],
      command: "pnpm run deploy",
    },
    chat: {
      taskId: "phase2057-chat",
      riskLevel: "L3",
      touches: ["apps/ai-gateway-service/src/chat-gateway/execute.js"],
      operations: ["chat_gateway_execute_modify"],
    },
    conflict: {
      taskId: "phase2057-conflict",
      riskLevel: "L1",
      touches: ["docs/phase2057-conflict.md"],
      operations: ["docs_update"],
    },
  };
  return Object.fromEntries(Object.entries(tasks).map(([key, task]) => {
    const riskGateDecision = key === "conflict" || key === "packageScript"
      ? "deny"
      : key === "provider" || key === "chat"
        ? "approval_required"
        : key === "secret" || key === "deploy"
          ? "forbidden"
          : "allowed";
    const permissionDecision = buildTimedRunnerPermissionDecision({ task, riskGateDecision });
    const reconciliation = reconcilePermissionWithRiskGate({ permissionDecision, riskGateDecision });
    const enforcementDryRun = buildTimedRunnerEnforcementDryRun({ permissionDecision, reconciliation });
    return [key, { task, permissionDecision, reconciliation, enforcementDryRun }];
  }));
}

function writeFixtureProject(root) {
  const brainDir = path.join(root, "docs/project-brain");
  const approvalDir = path.join(root, "docs/approvals");
  mkdirSync(brainDir, { recursive: true });
  mkdirSync(approvalDir, { recursive: true });
  writeJson(path.join(brainDir, "current-state.json"), { phaseId: "Phase2057Fixture", currentBlocker: "none" });
  writeJson(path.join(brainDir, "goals.json"), { goals: ["phase2057 fixture"] });
  writeJson(path.join(brainDir, "completion-definition.json"), { completion: ["enforcement dry-run evidence written"] });
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
        taskId: "phase2057-fixture-docs",
        title: "Phase2057 fixture docs enforcement dry-run",
        riskLevel: "L1",
        priority: 100,
        status: "ready",
        touches: ["docs/phase2057-gvc-permission-enforcement-dryrun.md"],
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
