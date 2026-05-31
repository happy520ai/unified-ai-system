import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2087A-Real-Local-Operation-Bridge";
const defaultResultPath = "apps/ai-gateway-service/evidence/phase2087-real-local-operation-bridge/real-local-smoke-result.json";
const forbiddenPathFragments = [
  "legacy/",
  ".git/",
  "node_modules/",
  "/auth.json",
  "auth.json",
  ".env",
  "project_context.md",
  "credential",
  "secret",
  "webhook",
  "provider-runtime",
  "chat-gateway/execute",
];

function main() {
  const args = parseArgs(process.argv.slice(2));
  const planPath = args.plan || "docs/phase2087-real-local-operation-approval.example.json";
  const generatedAt = new Date().toISOString();
  const plan = readJson(planPath);
  const validation = validatePlan(plan);
  const resultPath = plan?.evidence?.resultPath || defaultResultPath;
  const base = buildBaseResult({ plan, validation, generatedAt, resultPath });

  if (!validation.valid) {
    const blocked = {
      ...base,
      status: "blocked",
      blocker: validation.blocker,
      realExecutionPerformed: false,
      externalToolInvoked: false,
      exitCode: null,
    };
    writeJson(resultPath, blocked);
    printSummary(blocked);
    process.exit(1);
  }

  const execution = executeOperation(plan);
  const completed = execution.exitCode === 0;
  const result = {
    ...base,
    status: completed ? "passed" : "failed",
    blocker: completed ? "none" : "external_tool_failed",
    realLocalOperationBridgeReady: completed,
    realExecutionPerformed: completed,
    externalToolInvoked: true,
    externalToolKind: plan.operation.externalToolKind,
    exitCode: execution.exitCode,
    stdoutTail: execution.stdoutTail,
    stderrTail: execution.stderrTail,
    writtenFiles: execution.writtenFiles,
    evidenceRefs: {
      result: resultPath,
      operationOutput: plan.operation.outputPath,
    },
  };

  writeJson(resultPath, result);
  printSummary(result);
  if (!completed) process.exit(1);
}

function validatePlan(plan) {
  const reasons = [];
  const approval = plan?.approvalRecord || {};
  const operation = plan?.operation || {};
  const allowedFiles = Array.isArray(plan?.allowedFiles) ? plan.allowedFiles.map(normalizeRelativePath) : [];
  const forbiddenPaths = Array.isArray(plan?.forbiddenPaths) ? plan.forbiddenPaths.map(normalizeRelativePath) : [];
  const outputPath = normalizeRelativePath(operation.outputPath);
  const resultPath = normalizeRelativePath(plan?.evidence?.resultPath || defaultResultPath);
  const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};

  if (plan?.phaseId !== phaseId) reasons.push("phase_id_mismatch");
  if (phase632.preflightPassed !== true || phase632.staleFalse !== true) reasons.push("phase632_preflight_not_passed");
  if (approval.approved !== true) reasons.push("approval_record_not_approved");
  if (approval.permissionMode !== "bounded-real-local") reasons.push("permission_mode_must_be_bounded_real_local");
  if (approval.dryRun !== false) reasons.push("dry_run_must_be_false_for_real_bridge_smoke");
  for (const [field, expected] of [
    ["providerAllowed", false],
    ["secretReadAllowed", false],
    ["authJsonReadAllowed", false],
    ["envReadAllowed", false],
    ["codexConfigWriteAllowed", false],
    ["chatModificationAllowed", false],
    ["chatGatewayExecuteModificationAllowed", false],
    ["legacyModificationAllowed", false],
    ["deployAllowed", false],
    ["releaseAllowed", false],
    ["pushAllowed", false],
    ["commitAllowed", false],
  ]) {
    if (approval[field] !== expected) reasons.push(`${field}_must_be_${expected}`);
  }
  if (approval.maxExternalToolInvocations !== 1) reasons.push("max_external_tool_invocations_must_be_1");
  if (approval.maxRequests !== 0) reasons.push("max_requests_must_be_0");
  if (approval.maxCostUsd !== 0) reasons.push("max_cost_usd_must_be_0");
  if (!Array.isArray(approval.approvedAtLeastOnceByOwner) || approval.approvedAtLeastOnceByOwner.length < 1) {
    reasons.push("owner_approval_record_required");
  }
  if (allowedFiles.length < 1) reasons.push("allowed_files_required");
  if (!allowedFiles.includes(outputPath)) reasons.push("operation_output_must_be_allowed");
  if (!allowedFiles.includes(resultPath)) reasons.push("result_path_must_be_allowed");
  if (operation.externalToolKind !== "local-node") reasons.push("only_local_node_supported_in_phase2087a");
  if (operation.action !== "write-json") reasons.push("only_write_json_supported_in_phase2087a");
  if (!outputPath) reasons.push("operation_output_path_required");
  if (isUnsafePath(outputPath)) reasons.push("operation_output_path_unsafe");
  if (isUnsafePath(resultPath)) reasons.push("result_path_unsafe");
  if (forbiddenPaths.length < 5) reasons.push("forbidden_paths_required");
  for (const forbidden of forbiddenPaths) {
    if (outputPath === forbidden || outputPath.startsWith(`${forbidden}/`)) reasons.push("operation_output_hits_forbidden_path");
    if (resultPath === forbidden || resultPath.startsWith(`${forbidden}/`)) reasons.push("result_path_hits_forbidden_path");
  }
  if (operation.payload?.realLocalSmoke !== true) reasons.push("real_local_smoke_payload_required");

  return {
    valid: reasons.length === 0,
    blocker: reasons[0] || "none",
    reasons: Array.from(new Set(reasons)),
    approvalRecordRequired: true,
    allowedFilesRequired: true,
    forbiddenPathsEnforced: true,
    phase632PreflightChecked: true,
  };
}

function executeOperation(plan) {
  const operation = plan.operation;
  const outputPath = normalizeRelativePath(operation.outputPath);
  const absoluteOutputPath = path.join(repoRoot, outputPath);
  mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });

  const payload = {
    ...operation.payload,
    generatedAt: new Date().toISOString(),
  };
  const childCode = [
    "const fs = require('node:fs');",
    "const path = require('node:path');",
    "const target = process.argv[1];",
    "const payload = process.argv[2];",
    "fs.mkdirSync(path.dirname(target), { recursive: true });",
    "fs.writeFileSync(target, `${payload}\\n`, 'utf8');",
  ].join(" ");
  const result = spawnSync(process.execPath, ["-e", childCode, absoluteOutputPath, JSON.stringify(payload, null, 2)], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
    timeout: operation.timeoutMs || 30000,
    env: buildSanitizedEnv(),
  });

  return {
    exitCode: result.status ?? 1,
    stdoutTail: String(result.stdout || "").slice(-1200),
    stderrTail: String(result.stderr || "").slice(-1200),
    writtenFiles: result.status === 0 ? [outputPath] : [],
  };
}

function buildBaseResult({ plan, validation, generatedAt, resultPath }) {
  return {
    phaseId,
    generatedAt,
    planId: plan?.planId || null,
    approvalRecordRequired: true,
    allowedFilesRequired: true,
    forbiddenPathsEnforced: true,
    validation,
    opencodeDetected: Boolean(resolveCommand("opencode") || resolveCommand("opencode.exe")),
    codexDetected: Boolean(resolveCommand("codex") || resolveCommand("codex.exe")),
    providerCallsMade: false,
    paidProviderCallsMade: false,
    secretRead: false,
    authJsonRead: false,
    envRead: false,
    codexConfigModified: false,
    codexBaseUrlModified: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    pushExecuted: false,
    commitCreated: false,
    legacyModified: false,
    projectContextCreated: false,
    workspaceCleanClaimed: false,
    productionReadyClaimed: false,
    releaseReadyClaimed: false,
    resultPath,
  };
}

function buildSanitizedEnv() {
  const keep = ["PATH", "Path", "SystemRoot", "WINDIR", "COMSPEC", "TEMP", "TMP", "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE"];
  const safeEnv = {};
  for (const key of keep) {
    if (process.env[key]) safeEnv[key] = process.env[key];
  }
  safeEnv.PHASE2087_REAL_LOCAL_BRIDGE = "true";
  return safeEnv;
}

function resolveCommand(command) {
  const where = process.platform === "win32" ? "where.exe" : "which";
  const result = spawnSync(where, [command], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
    timeout: 5000,
  });
  if (result.status !== 0) return null;
  return String(result.stdout || "").split(/\r?\n/).find(Boolean) || null;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--plan") {
      args.plan = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

function normalizeRelativePath(input) {
  return String(input || "")
    .replaceAll("\\", "/")
    .replace(/^\.?\//, "")
    .replace(/^\/+/, "")
    .toLowerCase() === "project_context.md"
    ? "PROJECT_CONTEXT.md"
    : String(input || "")
        .replaceAll("\\", "/")
        .replace(/^\.?\//, "")
        .replace(/^\/+/, "");
}

function isUnsafePath(relativePath) {
  const normalized = normalizeRelativePath(relativePath).toLowerCase();
  return (
    !normalized ||
    path.isAbsolute(String(relativePath || "")) ||
    normalized.includes("..") ||
    forbiddenPathFragments.some((fragment) => normalized.includes(fragment))
  );
}

function readJson(relativePath) {
  const filePath = path.join(repoRoot, normalizeRelativePath(relativePath));
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(relativePath, value) {
  const filePath = path.join(repoRoot, normalizeRelativePath(relativePath));
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function printSummary(result) {
  console.log(JSON.stringify({
    status: result.status,
    blocker: result.blocker,
    realExecutionPerformed: result.realExecutionPerformed,
    externalToolKind: result.externalToolKind,
    resultPath: result.resultPath,
  }, null, 2));
}

main();
