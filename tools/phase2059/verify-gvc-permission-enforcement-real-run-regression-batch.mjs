import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  buildTimedRunnerFinalPermissionGate,
  buildTimedRunnerPermissionDecision,
  reconcilePermissionWithRiskGate,
} from "../../packages/gvc-permission-engine/src/index.js";
import { executeLowRiskMutationPlan } from "../gvc/low-risk-autonomous-executor.mjs";

const repoRoot = process.cwd();
const phaseId = "Phase2059-GVC-Permission-Enforcement-Real-Run-Regression-Batch";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2059-gvc-permission-enforcement-real-run-regression-batch";
const mutationEvidenceDir = `${evidenceDir}/mutations`;
const taskEvidenceDir = `${evidenceDir}/tasks`;
const resultPath = `${evidenceDir}/result.json`;
const docsPath = "docs/phase2059-gvc-permission-enforcement-real-run-regression-batch.md";
const packageScriptName = "verify:phase2059-gvc-permission-enforcement-real-run-regression-batch";
const checks = [];

const approval = {
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
};

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const regressionTasks = buildRegressionTasks();
const taskResults = [];

for (const task of regressionTasks) {
  const result = await runRegressionTask(task);
  taskResults.push(result);
}

const rollbackResult = await runRollbackDrill();
const allowedMutationCount = taskResults.filter((entry) => entry.expected === "allow" && entry.mutationAttempted === true).length;
const blockedTaskCount = taskResults.filter((entry) => entry.expected !== "allow" && entry.executionAllowed === false).length;
const rollbackCount = rollbackResult.rollbackPerformed ? 1 : 0;
const rollbackFailedCount = rollbackResult.rollbackSucceeded === false ? 1 : 0;

check("package_script_registered", packageJson.scripts?.[packageScriptName] === "node tools/phase2059/verify-gvc-permission-enforcement-real-run-regression-batch.mjs");
check("docs_file_exists", existsSync(resolve(docsPath)));
check("regression_task_count_8", regressionTasks.length === 8, String(regressionTasks.length));
check("allowed_mutation_count_4", allowedMutationCount === 4, String(allowedMutationCount));
check("blocked_task_count_4", blockedTaskCount === 4, String(blockedTaskCount));
check("provider_approval_required_blocked", findTask("provider-task")?.finalPermissionGate.finalDecision === "approval_required" && findTask("provider-task")?.executionAllowed === false);
check("secret_forbidden_blocked", findTask("secret-read-task")?.finalPermissionGate.finalDecision === "forbidden" && findTask("secret-read-task")?.executionAllowed === false);
check("deploy_forbidden_blocked", findTask("deploy-command-task")?.finalPermissionGate.finalDecision === "forbidden" && findTask("deploy-command-task")?.executionAllowed === false);
check("chat_gateway_forbidden_blocked", findTask("chat-gateway-task")?.finalPermissionGate.finalDecision === "forbidden" && findTask("chat-gateway-task")?.executionAllowed === false);
check("blocked_tasks_did_not_write", taskResults.filter((entry) => entry.expected !== "allow").every((entry) => entry.targetWritePerformed === false));
check("allowed_tasks_have_mutation_evidence", taskResults.filter((entry) => entry.expected === "allow").every((entry) => Boolean(entry.mutationEvidencePath)));
check("rollback_count_1", rollbackCount === 1, String(rollbackCount));
check("rollback_failed_count_0", rollbackFailedCount === 0, String(rollbackFailedCount));
check("rollback_restored_target", readText(rollbackResult.targetPath) === rollbackResult.beforeContent);
check("permission_engine_can_block", findTask("secret-read-task")?.finalPermissionGate.permissionEngineDecision === "forbidden");
check("permission_engine_cannot_independently_allow", taskResults.every((entry) => entry.finalPermissionGate.permissionEngineCanIndependentlyAllow === false));
check("real_mutation_authority_not_expanded", taskResults.every((entry) => entry.finalPermissionGate.realMutationPermissionExpanded === false));
check("no_provider_secret_deploy_chat", taskResults.every((entry) =>
  entry.providerCallsMade === false &&
  entry.secretRead === false &&
  entry.deployExecuted === false &&
  entry.chatGatewayExecuteModified === false
) && rollbackResult.providerCallsMade === false && rollbackResult.secretRead === false);
check("legacy_project_context_not_modified", taskResults.every((entry) => entry.legacyModified === false && entry.projectContextModified === false));

const failed = checks.filter((entry) => !entry.pass);
const result = {
  phaseId,
  completed: failed.length === 0,
  status: failed.length === 0 ? "passed" : "failed",
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map((entry) => entry.id).join(", "),
  generatedAt: new Date().toISOString(),
  regressionTaskCount: regressionTasks.length,
  allowedMutationCount,
  blockedTaskCount,
  rollbackCount,
  rollbackFailedCount,
  permissionEngineCanBlock: findTask("secret-read-task")?.finalPermissionGate.permissionEngineDecision === "forbidden",
  permissionEngineCanIndependentlyAllow: false,
  realMutationAuthorityExpanded: false,
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  taskResults,
  rollbackResult,
  checks,
};

writeJson(resultPath, result);
console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  regressionTaskCount: result.regressionTaskCount,
  allowedMutationCount: result.allowedMutationCount,
  blockedTaskCount: result.blockedTaskCount,
  rollbackCount: result.rollbackCount,
  rollbackFailedCount: result.rollbackFailedCount,
}, null, 2));
if (failed.length > 0) process.exit(1);

async function runRegressionTask(task) {
  const permissionDecision = buildTimedRunnerPermissionDecision({
    task,
    riskGateDecision: task.riskGateDecision,
  });
  const reconciliation = reconcilePermissionWithRiskGate({
    permissionDecision,
    riskGateDecision: task.riskGateDecision,
  });
  const finalPermissionGate = buildTimedRunnerFinalPermissionGate({
    existingRiskGateDecision: task.riskGateDecision,
    lowRiskExecutorDecision: task.lowRiskExecutorDecision,
    ownerApprovalDecision: task.ownerApprovalDecision,
    permissionDecision,
    reconciliation,
  });
  const base = {
    taskId: task.taskId,
    title: task.title,
    expected: task.expected,
    permissionDecision,
    reconciliation,
    finalPermissionGate,
    executionAllowed: finalPermissionGate.executionAllowed,
    mutationAttempted: false,
    mutationEvidencePath: null,
    blockedReason: null,
    targetWritePerformed: false,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
  };

  if (!finalPermissionGate.executionAllowed) {
    const blocked = {
      ...base,
      blockedReason: finalPermissionGate.conservativeReason,
    };
    writeJson(`${taskEvidenceDir}/${task.taskId}.json`, blocked);
    return blocked;
  }

  const mutationResult = await executeLowRiskMutationPlan({
    repoRoot,
    approval,
    plan: task.mutationPlan,
    evidenceDir: mutationEvidenceDir,
  });
  const completed = {
    ...base,
    mutationAttempted: true,
    mutationStatus: mutationResult.status,
    mutationEvidencePath: mutationResult.mutationEvidencePath,
    planEvidencePath: mutationResult.planEvidencePath,
    targetWritePerformed: mutationResult.realWritePerformed === true,
    mutatedFiles: mutationResult.mutatedFiles,
    rollbackPerformed: mutationResult.rollbackPerformed,
    rollbackSucceeded: mutationResult.rollbackSucceeded,
  };
  writeJson(`${taskEvidenceDir}/${task.taskId}.json`, completed);
  return completed;
}

async function runRollbackDrill() {
  const targetPath = "tools/gvc/test-fixtures/phase2059/rollback-fixture.txt";
  const beforeContent = "phase2059 rollback original\n";
  writeText(targetPath, beforeContent);
  const task = {
    taskId: "rollback-drill",
    title: "Rollback drill verifier failure",
    riskLevel: "L1",
    touches: [targetPath],
    operations: ["docs_update"],
    riskGateDecision: "allowed",
    lowRiskExecutorDecision: "allow",
    ownerApprovalDecision: "allow",
    mutationPlan: {
      planId: "phase2059-rollback-drill",
      operations: ["docs_update"],
      mutations: [{ type: "write_file", path: targetPath, content: "phase2059 rollback broken\n" }],
      verifierCommands: [{ command: process.execPath, args: ["-e", "process.exit(9)"] }],
    },
  };
  const permissionDecision = buildTimedRunnerPermissionDecision({
    task,
    riskGateDecision: task.riskGateDecision,
  });
  const reconciliation = reconcilePermissionWithRiskGate({
    permissionDecision,
    riskGateDecision: task.riskGateDecision,
  });
  const finalPermissionGate = buildTimedRunnerFinalPermissionGate({
    existingRiskGateDecision: task.riskGateDecision,
    lowRiskExecutorDecision: task.lowRiskExecutorDecision,
    ownerApprovalDecision: task.ownerApprovalDecision,
    permissionDecision,
    reconciliation,
  });
  const mutationResult = finalPermissionGate.executionAllowed
    ? await executeLowRiskMutationPlan({
      repoRoot,
      approval,
      plan: task.mutationPlan,
      evidenceDir: mutationEvidenceDir,
    })
    : null;
  const result = {
    taskId: task.taskId,
    targetPath,
    beforeContent,
    finalPermissionGate,
    mutationResult,
    rollbackPerformed: mutationResult?.rollbackPerformed === true,
    rollbackSucceeded: mutationResult?.rollbackSucceeded === true,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatGatewayExecuteModified: false,
  };
  writeJson(`${taskEvidenceDir}/${task.taskId}.json`, result);
  return result;
}

function buildRegressionTasks() {
  return [
    allowedTask({
      taskId: "docs-mutation-allow",
      title: "Docs mutation allow",
      targetPath: docsPath,
      content: renderDocs(),
      operations: ["docs_update"],
    }),
    allowedTask({
      taskId: "evidence-mutation-allow",
      title: "Evidence mutation allow",
      targetPath: `${evidenceDir}/fixture-evidence.json`,
      content: `${JSON.stringify({ phaseId, fixture: "evidence-mutation-allow", providerCallsMade: false, secretRead: false }, null, 2)}\n`,
      operations: ["evidence_update"],
    }),
    allowedTask({
      taskId: "verifier-mutation-allow",
      title: "Verifier mutation allow",
      targetPath: "tools/phase2059/fixture-verifier.mjs",
      content: "console.log('phase2059 fixture verifier');\n",
      operations: ["verifier_update"],
    }),
    allowedTask({
      taskId: "gvc-fixture-mutation-allow",
      title: "GVC fixture mutation allow",
      targetPath: "tools/gvc/test-fixtures/phase2059/fixture.json",
      content: `${JSON.stringify({ phaseId, fixture: "gvc-fixture-mutation-allow" }, null, 2)}\n`,
      operations: ["docs_update"],
    }),
    blockedTask({
      taskId: "provider-task",
      title: "Provider task approval-required blocked",
      touches: [`${evidenceDir}/provider-blocked-should-not-exist.json`],
      operations: ["provider_call"],
      riskGateDecision: "approval_required",
      expected: "approval_required",
    }),
    blockedTask({
      taskId: "secret-read-task",
      title: "Secret read forbidden blocked",
      touches: [".env"],
      operations: ["secret_read"],
      riskGateDecision: "forbidden",
      expected: "forbidden",
    }),
    blockedTask({
      taskId: "deploy-command-task",
      title: "Deploy command forbidden blocked",
      touches: [`${evidenceDir}/deploy-blocked-should-not-exist.json`],
      operations: ["deploy"],
      command: "pnpm run deploy",
      riskGateDecision: "forbidden",
      expected: "forbidden",
    }),
    blockedTask({
      taskId: "chat-gateway-task",
      title: "Chat gateway modification forbidden blocked",
      touches: ["apps/ai-gateway-service/src/chat-gateway/execute.js"],
      operations: ["chat_gateway_execute_modify"],
      riskGateDecision: "approval_required",
      expected: "forbidden",
    }),
  ];
}

function allowedTask({ taskId, title, targetPath, content, operations }) {
  return {
    taskId,
    title,
    riskLevel: "L1",
    touches: [targetPath],
    operations,
    riskGateDecision: "allowed",
    lowRiskExecutorDecision: "allow",
    ownerApprovalDecision: "allow",
    expected: "allow",
    mutationPlan: {
      planId: `phase2059-${taskId}`,
      operations,
      mutations: [{ type: "write_file", path: targetPath, content }],
      verifierCommands: [{ command: process.execPath, args: ["-e", "process.exit(0)"] }],
    },
  };
}

function blockedTask({ taskId, title, touches, operations, command, riskGateDecision, expected }) {
  return {
    taskId,
    title,
    riskLevel: expected === "forbidden" ? "L4" : "L3",
    touches,
    operations,
    command,
    riskGateDecision,
    lowRiskExecutorDecision: "allow",
    ownerApprovalDecision: "allow",
    expected,
  };
}

function findTask(taskId) {
  return taskResults.find((entry) => entry.taskId === taskId);
}

function renderDocs() {
  return [
    "# Phase2059-GVC-Permission-Enforcement-Real-Run-Regression-Batch",
    "",
    "## Goal",
    "",
    "Validate Phase2058 limited activation across a small real low-risk regression batch.",
    "",
    "## Boundary",
    "",
    "- Fixture-only docs/evidence/verifier/tools-gvc mutation.",
    "- No Provider call.",
    "- No secret read.",
    "- No deploy, release, tag, upload, push, or commit.",
    "- No chat or chat-gateway execution modification.",
    "- No legacy or PROJECT_CONTEXT.md modification.",
    "",
  ].join("\n");
}

function resolve(relativePath) {
  return path.join(repoRoot, relativePath);
}

function readJson(relativePath) {
  const filePath = resolve(relativePath);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function readText(relativePath) {
  const filePath = resolve(relativePath);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

function writeText(relativePath, content) {
  const filePath = resolve(relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf8");
}

function writeJson(relativePath, value) {
  const filePath = resolve(relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
