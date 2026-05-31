import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2088A-Controlled-Codex-Prompt-Execution";
const defaultResultPath = "apps/ai-gateway-service/evidence/phase2088-controlled-codex-prompt-execution/codex-prompt-smoke-result.json";
const defaultLastMessagePath = "apps/ai-gateway-service/evidence/phase2088-controlled-codex-prompt-execution/codex-last-message.md";
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
  const planPath = args.plan || "docs/phase2088-controlled-codex-prompt-approval.example.json";
  const generatedAt = new Date().toISOString();
  const plan = readJson(planPath);
  const validation = validatePlan(plan);
  const resultPath = plan?.evidence?.resultPath || defaultResultPath;
  const lastMessagePath = plan?.operation?.outputLastMessagePath || defaultLastMessagePath;
  const previousResult = readJson(resultPath);
  const base = buildBaseResult({ plan, validation, generatedAt, resultPath, lastMessagePath, previousResult });

  if (!validation.valid) {
    const blocked = {
      ...base,
      status: "blocked",
      blocker: validation.blocker,
      codexExecExecuted: false,
      codexExecInvocationCount: 0,
      exitCode: null,
    };
    writeJson(resultPath, blocked);
    printSummary(blocked);
    process.exit(1);
  }

  const execution = executeCodexPrompt(plan);
  const completed = execution.exitCode === 0 && execution.outputLastMessageExists && execution.codexProcessStarted;
  const result = {
    ...base,
    status: completed ? "passed" : "failed",
    blocker: completed ? "none" : "codex_exec_failed_or_missing_output",
    codexExecExecuted: execution.codexProcessStarted,
    codexProcessStarted: execution.codexProcessStarted,
    codexExecInvocationCount: execution.codexProcessStarted ? 1 : 0,
    externalToolKind: "codex-cli",
    exitCode: execution.exitCode,
    launcherError: execution.launcherError,
    launcherErrorCode: execution.launcherErrorCode,
    commandTransport: execution.commandTransport,
    stdoutTail: execution.stdoutTail,
    stderrTail: execution.stderrTail,
    isolatedWorkspaceUsed: true,
    isolatedWorkspacePathRecorded: false,
    outputLastMessageExists: execution.outputLastMessageExists,
    outputLastMessagePath: lastMessagePath,
    maxRequests: plan.approvalRecord?.maxRequests,
    promptFileReadRequestAllowed: false,
    codexExternalModelMayHaveBeenCalled: execution.codexProcessStarted,
    evidenceRefs: {
      result: resultPath,
      outputLastMessage: lastMessagePath,
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
  const resultPath = normalizeRelativePath(plan?.evidence?.resultPath || defaultResultPath);
  const lastMessagePath = normalizeRelativePath(operation.outputLastMessagePath || defaultLastMessagePath);
  const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
  const phase2087 = readJson("apps/ai-gateway-service/evidence/phase2087-real-local-operation-bridge/result.json") || {};

  if (plan?.phaseId !== phaseId) reasons.push("phase_id_mismatch");
  if (phase632.preflightPassed !== true || phase632.staleFalse !== true) reasons.push("phase632_preflight_not_passed");
  if (phase2087.recommendedSealed !== true) reasons.push("phase2087_not_sealed");
  if (approval.approved !== true) reasons.push("approval_record_not_approved");
  if (approval.permissionMode !== "bounded-real-codex-prompt") reasons.push("permission_mode_must_be_bounded_real_codex_prompt");
  if (approval.dryRun !== false) reasons.push("dry_run_must_be_false_for_real_codex_prompt");
  if (approval.credentialEnvPassthroughAllowed !== true) reasons.push("credential_env_passthrough_approval_required");
  if (!Array.isArray(approval.credentialEnvAllowlist) || approval.credentialEnvAllowlist.join(",") !== "CRS_OAI_KEY") {
    reasons.push("credential_env_allowlist_must_be_crs_oai_key_only");
  }
  for (const [field, expected] of [
    ["projectProviderAllowed", false],
    ["secretReadAllowed", false],
    ["authJsonReadByRunnerAllowed", false],
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
  if (approval.maxRequests !== 1) reasons.push("max_requests_must_be_1");
  if (approval.maxCostUsd !== 0) reasons.push("max_cost_usd_must_be_0_for_project_provider");
  if (!Array.isArray(approval.approvedAtLeastOnceByOwner) || approval.approvedAtLeastOnceByOwner.length < 1) {
    reasons.push("owner_approval_record_required");
  }
  if (allowedFiles.length < 2) reasons.push("allowed_files_required");
  if (!allowedFiles.includes(resultPath)) reasons.push("result_path_must_be_allowed");
  if (!allowedFiles.includes(lastMessagePath)) reasons.push("last_message_path_must_be_allowed");
  if (operation.externalToolKind !== "codex-cli") reasons.push("only_codex_cli_supported_in_phase2088a");
  if (operation.action !== "bounded-prompt-once") reasons.push("only_bounded_prompt_once_supported_in_phase2088a");
  if (operation.sandbox !== "read-only") reasons.push("codex_sandbox_must_be_read_only");
  if (operation.askForApproval !== "never") reasons.push("codex_approval_policy_must_be_never");
  if (operation.ephemeral !== true) reasons.push("codex_ephemeral_required");
  if (operation.shellEnvironmentInherit !== "none") reasons.push("codex_shell_environment_inherit_none_required");
  if (!String(operation.prompt || "").includes("PHASE2088_CODEX_PROMPT_OK")) reasons.push("prompt_marker_required");
  if (String(operation.prompt || "").toLowerCase().includes("read file")) reasons.push("prompt_must_not_request_file_reads");
  if (isUnsafePath(resultPath)) reasons.push("result_path_unsafe");
  if (isUnsafePath(lastMessagePath)) reasons.push("last_message_path_unsafe");
  if (forbiddenPaths.length < 5) reasons.push("forbidden_paths_required");
  for (const forbidden of forbiddenPaths) {
    if (resultPath === forbidden || resultPath.startsWith(`${forbidden}/`)) reasons.push("result_path_hits_forbidden_path");
    if (lastMessagePath === forbidden || lastMessagePath.startsWith(`${forbidden}/`)) reasons.push("last_message_path_hits_forbidden_path");
  }

  return {
    valid: reasons.length === 0,
    blocker: reasons[0] || "none",
    reasons: Array.from(new Set(reasons)),
    approvalRecordRequired: true,
    allowedFilesRequired: true,
    forbiddenPathsEnforced: true,
    phase632PreflightChecked: true,
    phase2087SealChecked: true,
  };
}

function executeCodexPrompt(plan) {
  const operation = plan.operation;
  const lastMessagePath = normalizeRelativePath(operation.outputLastMessagePath || defaultLastMessagePath);
  const absoluteLastMessagePath = path.join(repoRoot, lastMessagePath);
  mkdirSync(path.dirname(absoluteLastMessagePath), { recursive: true });
  const isolatedWorkspace = mkdtempSync(path.join(os.tmpdir(), "phase2088-codex-"));
  const codexCommand = resolveCommand("codex.cmd") || resolveCommand("codex.exe") || resolveCommand("codex");
  if (!codexCommand) {
    return {
      exitCode: 1,
      stdoutTail: "",
      stderrTail: "codex command not found",
      outputLastMessageExists: false,
    };
  }

  const codexArgs = [
    "--ask-for-approval",
    "never",
    "exec",
    "-c",
    "shell_environment_policy.inherit=none",
    "--skip-git-repo-check",
    "--ephemeral",
    "--sandbox",
    "read-only",
    "--output-last-message",
    absoluteLastMessagePath,
    "-C",
    isolatedWorkspace,
    "-",
  ];
  const result = spawnCodex(codexCommand, codexArgs, {
    cwd: isolatedWorkspace,
    timeout: operation.timeoutMs || 180000,
    env: buildFilteredCodexEnv(plan),
    input: operation.prompt,
  });
  const launcherErrorCode = result.error?.code || null;
  const launcherError = result.error?.message || null;
  const commandNotRecognized = /is not recognized as an internal or external command/i.test(String(result.stderr || ""));
  const codexProcessStarted = !["ENOENT", "EINVAL", "EPERM"].includes(String(launcherErrorCode || "")) && !commandNotRecognized;
  return {
    exitCode: result.status ?? 1,
    launcherError,
    launcherErrorCode,
    codexProcessStarted,
    commandTransport: result.commandTransport,
    stdoutTail: sanitizeOutputTail(result.stdout),
    stderrTail: sanitizeOutputTail(result.stderr),
    outputTailRedacted: true,
    outputLastMessageExists: existsSync(absoluteLastMessagePath),
  };
}

function buildBaseResult({ plan, validation, generatedAt, resultPath, lastMessagePath, previousResult }) {
  return {
    phaseId,
    generatedAt,
    planId: plan?.planId || null,
    approvalRecordRequired: true,
    allowedFilesRequired: true,
    forbiddenPathsEnforced: true,
    validation,
    externalToolKind: plan?.operation?.externalToolKind || null,
    codexDetected: Boolean(resolveCommand("codex.cmd") || resolveCommand("codex.exe") || resolveCommand("codex")),
    opencodeDetected: Boolean(resolveCommand("opencode.exe") || resolveCommand("opencode")),
    maxRequests: plan?.approvalRecord?.maxRequests ?? null,
    credentialEnvPassthroughAllowed: plan?.approvalRecord?.credentialEnvPassthroughAllowed === true,
    credentialEnvAllowlist: Array.isArray(plan?.approvalRecord?.credentialEnvAllowlist)
      ? plan.approvalRecord.credentialEnvAllowlist
      : [],
    credentialEnvPresence: buildCredentialEnvPresence(plan),
    projectProviderCallsMade: false,
    paidProviderCallsMadeByProject: false,
    secretRead: false,
    envRead: false,
    authJsonReadByRunner: false,
    authJsonContentExposed: false,
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
    outputLastMessagePath: lastMessagePath,
    previousSmokeAttempt: summarizePreviousResult(previousResult),
  };
}

function buildCredentialEnvPresence(plan) {
  const presence = {};
  for (const key of plan?.approvalRecord?.credentialEnvAllowlist || []) {
    presence[key] = Boolean(process.env[key]);
  }
  return presence;
}

function spawnCodex(command, args, options) {
  if (process.platform === "win32" && /\.(cmd|bat)$/i.test(command)) {
    const result = spawnSync("cmd.exe", ["/d", "/c", "call", command, ...args], {
      cwd: options.cwd,
      encoding: "utf8",
      shell: false,
      timeout: options.timeout,
      env: options.env,
      input: options.input,
    });
    result.commandTransport = "windows-cmd-shim";
    return result;
  }

  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    shell: false,
    timeout: options.timeout,
    env: options.env,
    input: options.input,
  });
  result.commandTransport = "direct-spawn";
  return result;
}

function summarizePreviousResult(previousResult) {
  if (!previousResult) return null;
  return {
    generatedAt: previousResult.generatedAt || null,
    status: previousResult.status || null,
    blocker: previousResult.blocker || null,
    exitCode: previousResult.exitCode ?? null,
    codexExecExecutedRecorded: previousResult.codexExecExecuted ?? null,
    codexProcessStarted: previousResult.codexProcessStarted ?? null,
    outputLastMessageExists: previousResult.outputLastMessageExists ?? null,
  };
}

function sanitizeOutputTail(value) {
  return String(value || "")
    .replace(/https?:\/\/[^\s")]+/gi, "[redacted-url]")
    .replace(/[A-Za-z]:\\[^\r\n]+/g, "[redacted-windows-path]")
    .replace(/session id:\s*[0-9a-f-]+/gi, "session id: [redacted-session-id]")
    .replace(/CRS_OAI_KEY=[^\s]+/g, "CRS_OAI_KEY=[redacted]")
    .replace(/(api[_-]?key|secret|token)\s*[:=]\s*[^\s]+/gi, "$1=[redacted]")
    .slice(-1800);
}

function buildFilteredCodexEnv(plan) {
  const keep = [
    "PATH",
    "Path",
    "SystemRoot",
    "WINDIR",
    "COMSPEC",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "HOME",
    "APPDATA",
    "LOCALAPPDATA",
    "NUMBER_OF_PROCESSORS",
    "PROCESSOR_ARCHITECTURE",
  ];
  const safeEnv = {};
  for (const key of keep) {
    if (process.env[key]) safeEnv[key] = process.env[key];
  }
  for (const key of plan.approvalRecord?.credentialEnvAllowlist || []) {
    if (key === "CRS_OAI_KEY" && process.env[key]) safeEnv[key] = process.env[key];
  }
  safeEnv.PHASE2088_CONTROLLED_CODEX_PROMPT = "true";
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
  const normalized = String(input || "").replaceAll("\\", "/").replace(/^\.?\//, "").replace(/^\/+/, "");
  return normalized.toLowerCase() === "project_context.md" ? "PROJECT_CONTEXT.md" : normalized;
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
    codexExecExecuted: result.codexExecExecuted,
    codexExecInvocationCount: result.codexExecInvocationCount,
    outputLastMessagePath: result.outputLastMessagePath,
  }, null, 2));
}

main();
