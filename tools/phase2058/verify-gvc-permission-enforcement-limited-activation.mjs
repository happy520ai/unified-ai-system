import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runTimedLocalRunner } from "../gvc/run-timed-local-runner.mjs";
import {
  buildTimedRunnerFinalPermissionGate,
  buildTimedRunnerPermissionDecision,
  reconcilePermissionWithRiskGate,
} from "../../packages/gvc-permission-engine/src/index.js";

const repoRoot = process.cwd();
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const samples = buildGateSamples();
const docsRun = await runFixtureScenario("docs-allow", [
  allowedMutationAction("phase2058-docs-allow", "docs/phase2058-fixture-doc.md", "docs\n"),
]);
const verifierRun = await runFixtureScenario("verifier-allow", [
  allowedMutationAction("phase2058-verifier-allow", "tools/phase2058/fixture-verifier.mjs", "console.log('ok');\n", ["verifier_update"]),
]);
const permissionDeniedRun = await runFixtureScenario("permission-deny", [
  {
    ...allowedMutationAction("phase2058-permission-deny", "docs/phase2058-denied-by-permission.md", "deny\n"),
    command: "node -e process.exit(0)",
  },
]);

check("docs_mutation_real_run_passed", docsRun.realMutationCount === 1 && docsRun.gateEvidence?.finalPermissionGate?.executionAllowed === true);
check("docs_gate_evidence_written", docsRun.gateEvidence?.phaseId === "Phase2058-GVC-Permission-Enforcement-Limited-Activation");
check("verifier_mutation_real_run_passed", verifierRun.realMutationCount === 1 && verifierRun.gateEvidence?.finalPermissionGate?.executionAllowed === true);
check("permission_deny_blocks_before_mutation", permissionDeniedRun.realMutationCount === 0 && permissionDeniedRun.loop?.blocker === "permission_limited_activation_blocked");
check("permission_deny_did_not_write_file", readFixtureFile(permissionDeniedRun.fixtureRoot, "docs/phase2058-denied-by-permission.md") === "");
check("permission_deny_gate_evidence_written", permissionDeniedRun.gateEvidence?.finalPermissionGate?.permissionEngineDecision === "deny");

check("sample_docs_allow", samples.docs.finalPermissionGate.finalDecision === "allow" && samples.docs.finalPermissionGate.executionAllowed === true);
check("sample_verifier_allow", samples.verifier.finalPermissionGate.finalDecision === "allow" && samples.verifier.finalPermissionGate.executionAllowed === true);
check("sample_provider_approval_required", samples.provider.finalPermissionGate.finalDecision === "approval_required" && samples.provider.finalPermissionGate.executionAllowed === false);
check("sample_secret_forbidden", samples.secret.finalPermissionGate.finalDecision === "forbidden" && samples.secret.finalPermissionGate.executionAllowed === false);
check("sample_deploy_forbidden", samples.deploy.finalPermissionGate.finalDecision === "forbidden" && samples.deploy.finalPermissionGate.executionAllowed === false);
check("sample_chat_forbidden", samples.chat.finalPermissionGate.finalDecision === "forbidden" && samples.chat.finalPermissionGate.executionAllowed === false);
check("sample_package_conservative", ["deny", "approval_required"].includes(samples.packageScript.finalPermissionGate.finalDecision));
check("permission_allow_cannot_override_risk_deny", samples.riskGateDeny.finalPermissionGate.finalDecision === "deny" && samples.riskGateDeny.finalPermissionGate.executionAllowed === false);
check("permission_deny_overrides_risk_allow", samples.permissionDeny.finalPermissionGate.finalDecision === "deny" && samples.permissionDeny.finalPermissionGate.executionAllowed === false);
check("conflict_more_conservative", samples.conflict.finalPermissionGate.conflictDetected === true && samples.conflict.finalPermissionGate.finalDecision === "deny");
check("limited_activation_true", Object.values(samples).every((entry) => entry.finalPermissionGate.permissionEnforcementLimitedActivation === true));
check("no_new_provider_secret_deploy_chat_authority", Object.values(samples).every((entry) =>
  entry.finalPermissionGate.providerCallsMade === false &&
  entry.finalPermissionGate.secretRead === false &&
  entry.finalPermissionGate.deployExecuted === false &&
  entry.finalPermissionGate.chatGatewayExecuteModified === false
));

for (const scenario of [docsRun, verifierRun, permissionDeniedRun]) {
  if (scenario?.fixtureRoot) rmSync(scenario.fixtureRoot, { recursive: true, force: true });
}

const failed = checks.filter((entry) => !entry.pass);
const result = {
  phaseId: "Phase2058-GVC-Permission-Enforcement-Limited-Activation",
  status: failed.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  checks,
  samples,
  runnerScenarios: {
    docs: summarizeRun(docsRun),
    verifier: summarizeRun(verifierRun),
    permissionDenied: summarizeRun(permissionDeniedRun),
  },
  permissionEnforcementLimitedActivation: true,
  permissionEngineParticipatesBeforeRealMutation: docsRun.gateEvidence?.finalPermissionGate?.permissionEngineDecision === "allow",
  realMutationPermissionExpanded: false,
  allowCannotIndependentlyRelease: samples.riskGateDeny.finalPermissionGate.executionAllowed === false,
  denyForbiddenCanBlockRealMutation: permissionDeniedRun.realMutationCount === 0,
  conflictUsesConservativeDecision: samples.conflict.finalPermissionGate.finalDecision === "deny",
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

writeJson(path.join(repoRoot, "apps/ai-gateway-service/evidence/phase2058-gvc-permission-enforcement-limited-activation/result.json"), result);
console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  permissionEnforcementLimitedActivation: result.permissionEnforcementLimitedActivation,
  realMutationPermissionExpanded: result.realMutationPermissionExpanded,
}, null, 2));
if (failed.length > 0) process.exit(1);

function buildGateSamples() {
  const tasks = {
    docs: {
      taskId: "phase2058-docs",
      riskLevel: "L1",
      touches: ["docs/phase2058-gvc-permission-enforcement-limited-activation.md"],
      operations: ["docs_update"],
    },
    verifier: {
      taskId: "phase2058-verifier",
      riskLevel: "L1",
      touches: ["tools/phase2058/verify-gvc-permission-enforcement-limited-activation.mjs"],
      operations: ["verifier_update"],
      verifierCommand: "pnpm run verify:phase2058-gvc-permission-enforcement-limited-activation",
    },
    packageScript: {
      taskId: "phase2058-package",
      riskLevel: "L2",
      touches: ["package.json"],
      operations: ["package_script_update"],
    },
    provider: {
      taskId: "phase2058-provider",
      riskLevel: "L3",
      touches: ["apps/ai-gateway-service/evidence/phase2058/provider.json"],
      operations: ["provider_call"],
    },
    secret: {
      taskId: "phase2058-secret",
      riskLevel: "L4",
      touches: [".env"],
      operations: ["secret_read"],
    },
    deploy: {
      taskId: "phase2058-deploy",
      riskLevel: "L4",
      touches: ["docs/deploy-plan.md"],
      operations: ["deploy"],
      command: "pnpm run deploy",
    },
    chat: {
      taskId: "phase2058-chat",
      riskLevel: "L3",
      touches: ["apps/ai-gateway-service/src/chat-gateway/execute.js"],
      operations: ["chat_gateway_execute_modify"],
    },
    riskGateDeny: {
      taskId: "phase2058-risk-deny",
      riskLevel: "L1",
      touches: ["docs/phase2058-risk-deny.md"],
      operations: ["docs_update"],
    },
    permissionDeny: {
      taskId: "phase2058-permission-deny",
      riskLevel: "L1",
      touches: ["docs/phase2058-denied-by-permission.md"],
      operations: ["docs_update"],
      command: "node -e process.exit(0)",
    },
    conflict: {
      taskId: "phase2058-conflict",
      riskLevel: "L1",
      touches: ["docs/phase2058-conflict.md"],
      operations: ["docs_update"],
    },
  };
  return Object.fromEntries(Object.entries(tasks).map(([key, task]) => {
    const riskGateDecision = ["riskGateDeny", "conflict", "packageScript"].includes(key)
      ? "deny"
      : key === "provider" || key === "chat"
        ? "approval_required"
        : key === "secret" || key === "deploy"
          ? "forbidden"
          : "allowed";
    let permissionDecision = buildTimedRunnerPermissionDecision({ task, riskGateDecision });
    if (key === "permissionDeny") {
      permissionDecision = {
        ...permissionDecision,
        decision: "deny",
        reason: "Phase2058 fixture simulates permission engine denial.",
        matchedRules: [],
      };
    }
    const reconciliation = reconcilePermissionWithRiskGate({ permissionDecision, riskGateDecision });
    const lowRiskExecutorDecision = ["docs", "verifier", "permissionDeny"].includes(key) ? "allow" : key === "packageScript" ? "deny" : "allow";
    const ownerApprovalDecision = ["docs", "verifier", "permissionDeny", "riskGateDeny", "conflict"].includes(key) ? "allow" : key === "provider" ? "approval_required" : key === "secret" || key === "deploy" || key === "chat" ? "forbidden" : "deny";
    const finalPermissionGate = buildTimedRunnerFinalPermissionGate({
      existingRiskGateDecision: riskGateDecision,
      lowRiskExecutorDecision,
      ownerApprovalDecision,
      permissionDecision,
      reconciliation,
    });
    return [key, { task, permissionDecision, reconciliation, finalPermissionGate }];
  }));
}

async function runFixtureScenario(name, actions) {
  const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), `phase2058-${name}-`));
  writeFixtureProject(fixtureRoot, actions);
  const state = await runTimedLocalRunner({
    repoRoot: fixtureRoot,
    intervalMs: 1,
    dailyLoopLimit: 1,
    maxTasksPerLoop: 1,
    dryRunOnly: false,
    autonomousMutationEnabled: true,
    verificationCommands: [[process.execPath, ["-e", "process.exit(0)"]]],
    testMode: true,
  });
  const loop = readJsonAbsolute(path.join(fixtureRoot, state.lastLoopEvidenceRef || ""));
  const gateFiles = listFiles(path.join(fixtureRoot, "apps/ai-gateway-service/evidence/phase2058-gvc-permission-enforcement-limited-activation"))
    .filter((filePath) => path.basename(filePath).startsWith("gate-"));
  const gateEvidence = gateFiles.length > 0 ? readJsonAbsolute(gateFiles[0]) : null;
  return {
    fixtureRoot,
    state,
    loop,
    gateEvidence,
    realMutationCount: loop?.realExecutionPerformed === true ? 1 : 0,
  };
}

function allowedMutationAction(taskId, mutationPath, content, operations = ["docs_update"]) {
  return {
    taskId,
    title: taskId,
    riskLevel: "L1",
    priority: 100,
    status: "ready",
    touches: [mutationPath],
    operations,
    mutationPlan: {
      mutations: [{ type: "write_file", path: mutationPath, content }],
      verifierCommands: [{ command: process.execPath, args: ["-e", "process.exit(0)"] }],
    },
  };
}

function writeFixtureProject(root, actions) {
  const brainDir = path.join(root, "docs/project-brain");
  const approvalDir = path.join(root, "docs/approvals");
  mkdirSync(brainDir, { recursive: true });
  mkdirSync(approvalDir, { recursive: true });
  writeJson(path.join(brainDir, "current-state.json"), { phaseId: "Phase2058Fixture", currentBlocker: "none" });
  writeJson(path.join(brainDir, "goals.json"), { goals: ["phase2058 fixture"] });
  writeJson(path.join(brainDir, "completion-definition.json"), { completion: ["limited activation evidence written"] });
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
    phaseId: "Phase2058-Fixture-Next-Actions",
    actions,
  });
  writeJson(path.join(brainDir, "safe-overnight-policy.json"), {
    enabled: false,
    emergencyStopFile: "docs/project-brain/runner-control.json",
  });
  writeJson(path.join(approvalDir, "gvc-low-risk-autonomous-mutation-approval.json"), {
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
}

function summarizeRun(run) {
  return {
    status: run.state?.status || null,
    blocker: run.state?.currentBlocker || null,
    realMutationCount: run.realMutationCount,
    finalPermissionGate: run.gateEvidence?.finalPermissionGate || null,
  };
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

function readFixtureFile(fixtureRoot, relativePath) {
  if (!fixtureRoot) return "";
  const absolutePath = path.join(fixtureRoot, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
}

function readJsonAbsolute(filePath) {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
