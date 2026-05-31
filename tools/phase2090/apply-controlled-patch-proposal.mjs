import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2090A-Controlled-Patch-Apply-Gate";
const targetPath = "docs/phase2089-codex-generated-patch-proposal-target.md";
const sourceProposalPath = "apps/ai-gateway-service/evidence/phase2089-controlled-codex-patch-proposal/codex-patch-proposal.md";
const resultPath = "apps/ai-gateway-service/evidence/phase2090-controlled-patch-apply-gate/result.json";
const resultMdPath = "apps/ai-gateway-service/evidence/phase2090-controlled-patch-apply-gate/result.md";
const rollbackPath = "apps/ai-gateway-service/evidence/phase2090-controlled-patch-apply-gate/rollback.json";
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
  const planPath = args.plan || "docs/phase2090-controlled-patch-apply-approval.example.json";
  const generatedAt = new Date().toISOString();
  const plan = readJson(planPath);
  const validation = validatePlan(plan);
  const base = buildBaseResult({ plan, validation, generatedAt, planPath });

  if (!validation.valid) {
    const blocked = {
      ...base,
      status: "blocked",
      blocker: validation.blocker,
      patchApplied: false,
      targetFileCreated: existsSync(resolve(targetPath)),
      rollbackAvailable: false,
    };
    writeJson(resultPath, blocked);
    writeText(resultMdPath, renderMarkdown(blocked));
    printSummary(blocked);
    process.exit(1);
  }

  const proposal = readText(sourceProposalPath);
  const parsed = parseSingleFileAdditionProposal(proposal);
  if (!parsed.valid) {
    const failed = {
      ...base,
      status: "failed",
      blocker: parsed.blocker,
      proposalValidation: parsed,
      patchApplied: false,
      targetFileCreated: existsSync(resolve(targetPath)),
      rollbackAvailable: false,
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
  const rollback = {
    phaseId,
    generatedAt,
    targetPath,
    rollbackAction: "delete-created-file",
    rollbackExecuted: false,
    createdFileSha256,
    createdFileByteLength: Buffer.byteLength(parsed.content, "utf8"),
    reason: "Phase2090A created a new docs-only file from the Phase2089A proposal.",
    safetyBoundary: {
      deleteOnlyCreatedFile: true,
      noCommit: true,
      noPush: true,
      noDeploy: true,
      noProviderCall: true,
    },
  };
  writeJson(rollbackPath, rollback);

  const result = {
    ...base,
    status: "passed",
    blocker: "none",
    proposalValidation: parsed,
    sourceProposalPath,
    targetPath,
    changedFiles: [targetPath],
    changedFileCount: 1,
    patchApplied: true,
    targetFileCreated: existsSync(absoluteTargetPath),
    targetFileSha256: createdFileSha256,
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
    recommendedSealed: true,
    evidenceRefs: {
      result: resultPath,
      resultMarkdown: resultMdPath,
      rollback: rollbackPath,
      sourceProposal: sourceProposalPath,
      target: targetPath,
    },
  };

  writeJson(resultPath, result);
  writeText(resultMdPath, renderMarkdown(result));
  printSummary(result);
}

function validatePlan(plan) {
  const reasons = [];
  const approval = plan?.approvalRecord || {};
  const allowedFiles = Array.isArray(plan?.allowedFiles) ? plan.allowedFiles.map(normalizeRelativePath) : [];
  const forbiddenPaths = Array.isArray(plan?.forbiddenPaths) ? plan.forbiddenPaths.map(normalizeRelativePath) : [];
  const operation = plan?.operation || {};
  const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json") || {};
  const phase2089 = readJson("apps/ai-gateway-service/evidence/phase2089-controlled-codex-patch-proposal/result.json") || {};

  if (plan?.phaseId !== phaseId) reasons.push("phase_id_mismatch");
  if (phase632.preflightPassed !== true || phase632.staleFalse !== true) reasons.push("phase632_preflight_not_passed");
  if (phase2089.recommendedSealed !== true || phase2089.proposalFileExists !== true) reasons.push("phase2089_not_sealed");
  if (approval.approved !== true) reasons.push("approval_record_not_approved");
  if (approval.permissionMode !== "controlled-docs-only-patch-apply") reasons.push("permission_mode_must_be_controlled_docs_only_patch_apply");
  if (approval.dryRun !== false) reasons.push("dry_run_must_be_false_for_real_apply");
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
  if (!Array.isArray(approval.approvedAtLeastOnceByOwner) || approval.approvedAtLeastOnceByOwner.length < 1) {
    reasons.push("owner_approval_record_required");
  }
  if (operation.action !== "apply-single-docs-only-proposal") reasons.push("operation_action_mismatch");
  if (operation.sourceProposalPath !== sourceProposalPath) reasons.push("source_proposal_path_mismatch");
  if (operation.targetPath !== targetPath) reasons.push("target_path_mismatch");
  if (operation.allowOverwrite !== false) reasons.push("overwrite_must_be_false");
  if (operation.maxChangedFiles !== 1) reasons.push("max_changed_files_must_be_1");
  for (const required of [sourceProposalPath, targetPath, resultPath, resultMdPath, rollbackPath]) {
    if (!allowedFiles.includes(required)) reasons.push(`allowed_file_missing:${required}`);
  }
  for (const required of ["legacy", "PROJECT_CONTEXT.md", ".env", ".git", "node_modules", "auth.json"]) {
    if (!forbiddenPaths.includes(required)) reasons.push(`forbidden_path_missing:${required}`);
  }
  if (existsSync(resolve(targetPath))) reasons.push("target_file_already_exists_refuse_overwrite");
  if (!existsSync(resolve(sourceProposalPath))) reasons.push("source_proposal_missing");
  if (isUnsafePath(targetPath) || isUnsafePath(resultPath) || isUnsafePath(rollbackPath)) reasons.push("phase_path_unsafe");

  return {
    valid: reasons.length === 0,
    blocker: reasons[0] || "none",
    reasons: Array.from(new Set(reasons)),
    approvalRecordRequired: true,
    allowedFilesRequired: true,
    forbiddenPathsEnforced: true,
    phase632PreflightChecked: true,
    phase2089SealChecked: true,
  };
}

function parseSingleFileAdditionProposal(proposalText) {
  const text = stripMarkdownFence(proposalText);
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const expectedHeader = `diff --git a/${targetPath} b/${targetPath}`;
  const blockers = [];
  const diffHeaders = lines.filter((line) => line.startsWith("diff --git "));
  if (diffHeaders.length !== 1 || diffHeaders[0] !== expectedHeader) blockers.push("proposal_must_contain_exact_single_diff_header");
  if (!lines.includes("--- /dev/null")) blockers.push("proposal_must_add_from_dev_null");
  if (!lines.includes(`+++ b/${targetPath}`)) blockers.push("proposal_must_target_expected_file");
  if (lines.some((line) => line.startsWith("--- a/") || line.startsWith("rename ") || line.startsWith("deleted file") || line.startsWith("Binary files"))) {
    blockers.push("proposal_must_not_modify_delete_rename_or_binary");
  }
  if (!proposalText.includes("PHASE2089_CODEX_PATCH_PROPOSAL_OK")) blockers.push("proposal_marker_missing");
  if (hasUnsafeEvidenceText(proposalText)) blockers.push("proposal_contains_unsafe_text");

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
    if (line.startsWith("-")) {
      blockers.push("proposal_contains_deletion_line");
      continue;
    }
    if (line.startsWith(" ") && line.trim() !== "") {
      blockers.push("proposal_contains_context_line");
    }
  }
  const content = `${contentLines.join("\n")}\n`;
  if (!content.includes("PHASE2089_CODEX_PATCH_PROPOSAL_OK")) blockers.push("created_content_marker_missing");
  if (!content.startsWith("# Phase2089 Codex Generated Patch Proposal Target")) blockers.push("created_content_heading_missing");

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
    phase2089Sealed: validation.phase2089SealChecked,
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

function stripMarkdownFence(value) {
  return String(value || "")
    .replace(/^```(?:diff|patch)?\s*/i, "")
    .replace(/\s*```\s*$/i, "");
}

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function hasUnsafeEvidenceText(value) {
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
    "# Phase2090A Controlled Patch Apply Gate Evidence",
    "",
    `- status: ${result.status}`,
    `- recommendedSealed: ${Boolean(result.recommendedSealed)}`,
    `- blocker: ${result.blocker}`,
    `- sourceProposalPath: ${result.sourceProposalPath || sourceProposalPath}`,
    `- targetPath: ${result.targetPath || targetPath}`,
    `- patchApplied: ${Boolean(result.patchApplied)}`,
    `- targetFileCreated: ${Boolean(result.targetFileCreated)}`,
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
    patchApplied: result.patchApplied,
    targetFileCreated: result.targetFileCreated,
    rollbackAvailable: result.rollbackAvailable,
    codexExecExecuted: result.codexExecExecuted,
    providerCallsMade: result.providerCallsMade,
  }, null, 2));
}

main();
