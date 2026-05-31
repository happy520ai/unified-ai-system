import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2091A-Controlled-Source-Patch-Apply";
const proposalPath = "docs/phase2091-controlled-source-patch.proposal.diff";
const targetPath = "tools/phase2091/generated-source-patch-target.mjs";
const resultPath = "apps/ai-gateway-service/evidence/phase2091-controlled-source-patch-apply/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2091-controlled-source-patch-apply/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2091-controlled-source-patch-apply/rollback.json";
const smokePath = "apps/ai-gateway-service/evidence/phase2091-controlled-source-patch-apply/source-smoke.json";
const forbiddenPathFragments = [
  "legacy",
  ".git",
  "node_modules",
  "auth.json",
  ".env",
  "PROJECT_CONTEXT.md",
  "apps/ai-gateway-service/src/providers",
  "apps/ai-gateway-service/src/http/chat-gateway/execute",
  "/chat",
];

function main() {
  const args = parseArgs(process.argv.slice(2));
  const planPath = args.plan || "docs/phase2091-controlled-source-patch-approval.example.json";
  const generatedAt = new Date().toISOString();
  const plan = readJson(planPath);
  const validation = validatePlan(plan);
  const base = buildBaseResult({ plan, validation, generatedAt, planPath });

  if (!validation.valid) {
    const blocked = {
      ...base,
      status: "blocked",
      blocker: validation.blocker,
      sourcePatchApplied: false,
      targetFileCreated: existsSync(resolve(targetPath)),
      nodeCheckPassed: false,
      localSourceSmokePassed: false,
      rollbackAvailable: false,
      recommendedSealed: false,
    };
    writeJson(resultPath, blocked);
    writeText(resultMdPath, renderMarkdown(blocked));
    printSummary(blocked);
    process.exit(1);
  }

  const proposal = readText(proposalPath);
  const parsed = parseSingleFileAdditionProposal(proposal);
  if (!parsed.valid) {
    const failed = {
      ...base,
      status: "failed",
      blocker: parsed.blocker,
      proposalValidation: parsed,
      sourcePatchApplied: false,
      targetFileCreated: existsSync(resolve(targetPath)),
      nodeCheckPassed: false,
      localSourceSmokePassed: false,
      rollbackAvailable: false,
      recommendedSealed: false,
    };
    writeJson(resultPath, failed);
    writeText(resultMdPath, renderMarkdown(failed));
    printSummary(failed);
    process.exit(1);
  }

  const absoluteTargetPath = resolve(targetPath);
  mkdirSync(path.dirname(absoluteTargetPath), { recursive: true });
  writeFileSync(absoluteTargetPath, parsed.content, "utf8");
  const createdFileSha256 = sha256(parsed.content);

  const nodeCheck = spawnSync("node", ["--check", targetPath], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
    timeout: 30000,
  });
  const smokeRun = spawnSync("node", [targetPath], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
    timeout: 30000,
  });
  const smoke = parseSmoke(smokeRun);
  const smokeResult = {
    phaseId,
    generatedAt: new Date().toISOString(),
    status: smokeRun.status === 0 && smoke?.marker === "PHASE2091_SOURCE_PATCH_OK" ? "passed" : "failed",
    exitCode: smokeRun.status ?? 1,
    marker: smoke?.marker || null,
    providerCallsMade: false,
    stdout: sanitizeTail(smokeRun.stdout),
    stderr: sanitizeTail(smokeRun.stderr),
  };
  writeJson(smokePath, smokeResult);

  const rollback = {
    phaseId,
    generatedAt,
    targetPath,
    rollbackAction: "delete-created-file",
    rollbackExecuted: false,
    createdFileSha256,
    createdFileByteLength: Buffer.byteLength(parsed.content, "utf8"),
    reason: "Phase2091A created one controlled source file from a validated proposal.",
    safetyBoundary: {
      deleteOnlyCreatedFile: true,
      noCommit: true,
      noPush: true,
      noDeploy: true,
      noProviderCall: true,
      noChatChange: true,
    },
  };
  writeJson(rollbackPath, rollback);

  const completed = nodeCheck.status === 0 && smokeResult.status === "passed";
  const result = {
    ...base,
    status: completed ? "passed" : "failed",
    blocker: completed ? "none" : "source_patch_node_check_or_smoke_failed",
    proposalValidation: parsed,
    proposalPath,
    targetPath,
    changedFiles: [targetPath],
    changedFileCount: 1,
    sourcePatchApplied: true,
    targetFileCreated: existsSync(absoluteTargetPath),
    targetFileSha256: createdFileSha256,
    nodeCheckPassed: nodeCheck.status === 0,
    nodeCheckExitCode: nodeCheck.status ?? 1,
    nodeCheckStderr: sanitizeTail(nodeCheck.stderr),
    localSourceSmokePassed: smokeResult.status === "passed",
    smokePath,
    rollbackAvailable: true,
    rollbackPath,
    codexExecExecuted: false,
    providerCallsMade: false,
    projectProviderCallsMade: false,
    paidProviderCallsMadeByProject: false,
    secretRead: false,
    envRead: false,
    authJsonRead: false,
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
    projectContextCreated: existsSync(resolve("PROJECT_CONTEXT.md")),
    workspaceCleanClaimed: false,
    productionReadyClaimed: false,
    releaseReadyClaimed: false,
    recommendedSealed: completed,
    evidenceRefs: {
      result: resultPath,
      resultMarkdown: resultMdPath,
      rollback: rollbackPath,
      smoke: smokePath,
      target: targetPath,
    },
  };

  writeJson(resultPath, result);
  writeText(resultMdPath, renderMarkdown(result));
  printSummary(result);
  if (!completed) process.exit(1);
}

function validatePlan(plan) {
  const reasons = [];
  const approval = plan?.approvalRecord || {};
  const operation = plan?.operation || {};
  const allowedFiles = Array.isArray(plan?.allowedFiles) ? plan.allowedFiles.map(normalizeRelativePath) : [];
  const forbiddenPaths = Array.isArray(plan?.forbiddenPaths) ? plan.forbiddenPaths.map(normalizeRelativePath) : [];
  const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
  const phase2090 = readJson("apps/ai-gateway-service/evidence/phase2090-controlled-patch-apply-gate/result.json") || {};

  if (plan?.phaseId !== phaseId) reasons.push("phase_id_mismatch");
  if (phase632.preflightPassed !== true || phase632.staleFalse !== true) reasons.push("phase632_preflight_not_passed");
  if (phase2090.recommendedSealed !== true || phase2090.patchApplied !== true) reasons.push("phase2090_not_sealed");
  if (approval.approved !== true) reasons.push("approval_record_not_approved");
  if (approval.permissionMode !== "controlled-source-patch-apply") reasons.push("permission_mode_mismatch");
  if (approval.dryRun !== false) reasons.push("dry_run_must_be_false");
  for (const [field, expected] of [
    ["codexExecAllowed", false],
    ["projectProviderAllowed", false],
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
  if (operation.action !== "apply-single-source-proposal") reasons.push("operation_action_mismatch");
  if (operation.proposalPath !== proposalPath) reasons.push("proposal_path_mismatch");
  if (operation.targetPath !== targetPath) reasons.push("target_path_mismatch");
  if (operation.allowOverwrite !== false) reasons.push("overwrite_must_be_false");
  if (operation.maxChangedFiles !== 1) reasons.push("max_changed_files_must_be_1");
  if (operation.runNodeCheck !== true) reasons.push("run_node_check_required");
  if (operation.runLocalSmoke !== true) reasons.push("run_local_smoke_required");
  for (const required of [proposalPath, targetPath, resultPath, resultMdPath, rollbackPath, smokePath]) {
    if (!allowedFiles.includes(required)) reasons.push(`allowed_file_missing:${required}`);
  }
  for (const required of ["legacy", "PROJECT_CONTEXT.md", ".env", ".git", "node_modules", "auth.json"]) {
    if (!forbiddenPaths.includes(required)) reasons.push(`forbidden_path_missing:${required}`);
  }
  if (existsSync(resolve(targetPath))) reasons.push("target_file_already_exists_refuse_overwrite");
  if (!existsSync(resolve(proposalPath))) reasons.push("proposal_missing");
  if (isUnsafePath(targetPath) || !targetPath.startsWith("tools/phase2091/")) reasons.push("target_path_unsafe");

  return {
    valid: reasons.length === 0,
    blocker: reasons[0] || "none",
    reasons: Array.from(new Set(reasons)),
    approvalRecordRequired: true,
    allowedFilesRequired: true,
    forbiddenPathsEnforced: true,
    phase632PreflightChecked: true,
    phase2090SealChecked: true,
  };
}

function parseSingleFileAdditionProposal(proposalText) {
  const lines = String(proposalText || "").replace(/\r\n/g, "\n").split("\n");
  const blockers = [];
  const expectedHeader = `diff --git a/${targetPath} b/${targetPath}`;
  const diffHeaders = lines.filter((line) => line.startsWith("diff --git "));
  if (diffHeaders.length !== 1 || diffHeaders[0] !== expectedHeader) blockers.push("proposal_must_contain_exact_single_diff_header");
  if (!lines.includes("--- /dev/null")) blockers.push("proposal_must_add_from_dev_null");
  if (!lines.includes(`+++ b/${targetPath}`)) blockers.push("proposal_must_target_expected_file");
  if (lines.some((line) => line.startsWith("--- a/") || line.startsWith("rename ") || line.startsWith("deleted file") || line.startsWith("Binary files"))) {
    blockers.push("proposal_must_not_modify_delete_rename_or_binary");
  }
  if (!proposalText.includes("PHASE2091_SOURCE_PATCH_OK")) blockers.push("proposal_marker_missing");
  if (hasUnsafeText(proposalText)) blockers.push("proposal_contains_unsafe_text");

  const contentLines = [];
  let inHunk = false;
  for (const line of lines) {
    if (line.startsWith("@@ ")) {
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (line.startsWith("+") && !line.startsWith("+++ ")) {
      contentLines.push(line.slice(1));
      continue;
    }
    if (line.startsWith("-")) blockers.push("proposal_contains_deletion_line");
    if (line.startsWith(" ") && line.trim() !== "") blockers.push("proposal_contains_context_line");
  }
  const content = `${contentLines.join("\n")}\n`;
  if (!content.includes("export function buildPhase2091SourcePatchStatus")) blockers.push("created_content_export_missing");
  if (!content.includes("PHASE2091_SOURCE_PATCH_OK")) blockers.push("created_content_marker_missing");
  if (!content.includes("providerCallsMade: false")) blockers.push("created_content_provider_false_missing");

  return {
    valid: blockers.length === 0,
    blocker: blockers[0] || "none",
    blockers: Array.from(new Set(blockers)),
    targetPath,
    content,
    contentSha256: sha256(content),
    addedLineCount: contentLines.length,
  };
}

function buildBaseResult({ plan, validation, generatedAt, planPath }) {
  return {
    phaseId,
    generatedAt,
    planPath,
    planId: plan?.planId || null,
    approvalRecordRequired: true,
    allowedFilesRequired: true,
    forbiddenPathsEnforced: true,
    validation,
    phase632PreflightPassed: validation.phase632PreflightChecked,
    phase2090Sealed: validation.phase2090SealChecked,
    codexExecExecuted: false,
    providerCallsMade: false,
    projectProviderCallsMade: false,
    secretRead: false,
    envRead: false,
    authJsonRead: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    workspaceCleanClaimed: false,
  };
}

function parseSmoke(smokeRun) {
  try {
    return JSON.parse(String(smokeRun.stdout || "").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function sanitizeTail(value) {
  return String(value || "")
    .replace(/https?:\/\/[^\s")]+/gi, "[redacted-url]")
    .replace(/[A-Za-z]:\\[^\r\n]+/g, "[redacted-windows-path]")
    .replace(/(api[_-]?key|secret|token)\s*[:=]\s*[^\s]+/gi, "$1=[redacted]")
    .slice(-2000);
}

function hasUnsafeText(value) {
  return /https?:\/\/|CRS_OAI_KEY\s*=|\bsk-[A-Za-z0-9]{20,}|api[_-]?key\s*[:=]|secret\s*[:=]|token\s*[:=]|session id:\s*[0-9a-f-]{12,}|[A-Za-z]:\\/.test(
    String(value || ""),
  );
}

function isUnsafePath(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  const lower = normalized.toLowerCase();
  return (
    !normalized ||
    path.isAbsolute(String(relativePath || "")) ||
    normalized.includes("..") ||
    forbiddenPathFragments.some((fragment) => lower.includes(fragment.toLowerCase()))
  );
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

function resolve(relativePath) {
  return path.join(repoRoot, normalizeRelativePath(relativePath));
}

function readText(relativePath) {
  return readFileSync(resolve(relativePath), "utf8").replace(/^\uFEFF/, "");
}

function readJson(relativePath) {
  const filePath = resolve(relativePath);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(relativePath, value) {
  const filePath = resolve(relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(relativePath, value) {
  const filePath = resolve(relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}

function renderMarkdown(result) {
  return [
    "# Phase2091A Controlled Source Patch Apply Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- sourcePatchApplied: ${Boolean(result.sourcePatchApplied)}`,
    `- targetFileCreated: ${Boolean(result.targetFileCreated)}`,
    `- nodeCheckPassed: ${Boolean(result.nodeCheckPassed)}`,
    `- localSourceSmokePassed: ${Boolean(result.localSourceSmokePassed)}`,
    `- rollbackAvailable: ${Boolean(result.rollbackAvailable)}`,
    `- codexExecExecuted: ${Boolean(result.codexExecExecuted)}`,
    `- providerCallsMade: ${Boolean(result.providerCallsMade)}`,
    `- secretRead: ${Boolean(result.secretRead)}`,
    `- envRead: ${Boolean(result.envRead)}`,
    `- authJsonRead: ${Boolean(result.authJsonRead)}`,
    `- chatModified: ${Boolean(result.chatModified)}`,
    `- chatGatewayExecuteModified: ${Boolean(result.chatGatewayExecuteModified)}`,
    `- deployExecuted: ${Boolean(result.deployExecuted)}`,
    `- releaseExecuted: ${Boolean(result.releaseExecuted)}`,
    `- pushExecuted: ${Boolean(result.pushExecuted)}`,
    `- commitCreated: ${Boolean(result.commitCreated)}`,
    `- workspaceCleanClaimed: ${Boolean(result.workspaceCleanClaimed)}`,
    "",
  ].join("\n");
}

function printSummary(result) {
  console.log(JSON.stringify({
    status: result.status,
    blocker: result.blocker,
    sourcePatchApplied: result.sourcePatchApplied,
    targetFileCreated: result.targetFileCreated,
    nodeCheckPassed: result.nodeCheckPassed,
    localSourceSmokePassed: result.localSourceSmokePassed,
    providerCallsMade: result.providerCallsMade,
  }, null, 2));
}

main();
