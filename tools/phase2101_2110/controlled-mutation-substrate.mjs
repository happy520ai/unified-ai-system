import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

export const defaultForbiddenPathFragments = [
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

export function validateControlledMutationPlan({
  plan,
  expectedPhaseId,
  expectedPermissionMode,
  expectedOperationCount,
  expectedMaxChangedFiles,
  requiredAllowedFiles,
  requiredForbiddenPaths,
  requiredTargets,
  upstreamChecks = [],
  requireNodeCheck = true,
  requireLocalSmoke = true,
  forbiddenPathFragments = defaultForbiddenPathFragments,
}) {
  const reasons = [];
  const approval = plan?.approvalRecord || {};
  const operations = Array.isArray(plan?.operations) ? plan.operations : [];
  const allowedFiles = Array.isArray(plan?.allowedFiles) ? plan.allowedFiles.map(normalizeRelativePath) : [];
  const forbiddenPaths = Array.isArray(plan?.forbiddenPaths) ? plan.forbiddenPaths.map(normalizeRelativePath) : [];

  if (plan?.phaseId !== expectedPhaseId) reasons.push("phase_id_mismatch");
  if (approval.approved !== true) reasons.push("approval_record_not_approved");
  if (approval.permissionMode !== expectedPermissionMode) reasons.push("permission_mode_mismatch");
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

  if (operations.length !== expectedOperationCount) reasons.push(`operations_length_must_be_${expectedOperationCount}`);
  if (plan?.maxChangedFiles !== expectedMaxChangedFiles) reasons.push(`max_changed_files_must_be_${expectedMaxChangedFiles}`);
  if (requireNodeCheck && plan?.runNodeCheck !== true) reasons.push("run_node_check_required");
  if (requireLocalSmoke && plan?.runLocalSmoke !== true) reasons.push("run_local_smoke_required");

  for (const required of requiredAllowedFiles) {
    if (!allowedFiles.includes(normalizeRelativePath(required))) reasons.push(`allowed_file_missing:${required}`);
  }
  for (const required of requiredForbiddenPaths) {
    if (!forbiddenPaths.includes(normalizeRelativePath(required))) reasons.push(`forbidden_path_missing:${required}`);
  }

  const targetSet = new Set();
  for (const operation of operations) {
    if (operation.action !== "apply-single-existing-tool-source-mutation") reasons.push("operation_action_mismatch");
    if (typeof operation.expectedBeforeSha256 !== "string" || operation.expectedBeforeSha256.length !== 64) {
      reasons.push(`expected_before_sha_required:${operation.targetPath || "unknown"}`);
    }
    if (operation.allowCreate !== false || operation.allowDelete !== false) reasons.push("create_delete_must_be_false");
    if (!operation.targetPath || isUnsafePath(operation.targetPath, forbiddenPathFragments)) {
      reasons.push(`target_path_unsafe:${operation.targetPath || "unknown"}`);
    }
    if (!existsSync(resolveRelativePath(operation.targetPath || ""))) reasons.push(`target_file_missing:${operation.targetPath || "unknown"}`);
    if (!existsSync(resolveRelativePath(operation.proposalPath || ""))) reasons.push(`proposal_missing:${operation.proposalPath || "unknown"}`);
    targetSet.add(operation.targetPath);
  }

  for (const expectedTarget of requiredTargets) {
    if (!targetSet.has(expectedTarget)) reasons.push(`expected_target_missing:${expectedTarget}`);
  }

  const upstreamResults = upstreamChecks.map((entry) => {
    const evidence = readJsonFile(entry.path) || {};
    const passed = Boolean(entry.predicate(evidence));
    if (!passed) reasons.push(entry.blocker);
    return {
      id: entry.id,
      path: entry.path,
      passed,
    };
  });

  return {
    valid: reasons.length === 0,
    blocker: reasons[0] || "none",
    reasons: Array.from(new Set(reasons)),
    approvalRecordRequired: true,
    allowedFilesRequired: true,
    forbiddenPathsEnforced: true,
    upstreamResults,
  };
}

export function parseUnifiedHunks(lines, { minHunks = 1, maxHunks = 4 } = {}) {
  const blockers = [];
  const hunks = [];
  let current = null;
  for (const line of lines) {
    if (current && line === "") continue;
    const header = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (header) {
      current = { oldStart: Number(header[1]), lines: [] };
      hunks.push(current);
      continue;
    }
    if (!current) continue;
    if (line.startsWith("\\ No newline at end of file")) continue;
    const prefix = line[0];
    if (![" ", "+", "-"].includes(prefix)) {
      blockers.push("proposal_contains_invalid_hunk_line");
      continue;
    }
    current.lines.push({ type: prefix, text: line.slice(1) });
  }
  if (hunks.length < minHunks || hunks.length > maxHunks) {
    blockers.push(`proposal_hunk_count_must_be_${minHunks}_to_${maxHunks}`);
  }
  return { valid: blockers.length === 0, blockers, hunks };
}

export function applyUnifiedMutationHunks(content, hunks, blockers) {
  const originalLines = content.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
  const output = [];
  let cursor = 0;
  for (const hunk of hunks) {
    const hunkStart = hunk.oldStart - 1;
    if (hunkStart < cursor || hunkStart > originalLines.length) {
      blockers.push("hunk_start_out_of_range");
      return content;
    }
    output.push(...originalLines.slice(cursor, hunkStart));
    cursor = hunkStart;
    for (const entry of hunk.lines) {
      if (entry.type === " ") {
        if (originalLines[cursor] !== entry.text) {
          blockers.push("hunk_context_mismatch");
          return content;
        }
        output.push(originalLines[cursor]);
        cursor += 1;
      }
      if (entry.type === "-") {
        if (originalLines[cursor] !== entry.text) {
          blockers.push("hunk_deletion_mismatch");
          return content;
        }
        cursor += 1;
      }
      if (entry.type === "+") output.push(entry.text);
    }
  }
  output.push(...originalLines.slice(cursor));
  return `${output.join("\n")}\n`;
}

export function parseSingleExistingFileMutationProposal({
  proposalText,
  beforeContent,
  targetPath,
  requiredMarkers = [],
  requiredExports = [],
  maxHunks = 4,
}) {
  const lines = String(proposalText || "").replace(/\r\n/g, "\n").split("\n");
  const blockers = [];
  const expectedHeader = `diff --git a/${targetPath} b/${targetPath}`;
  const diffHeaders = lines.filter((line) => line.startsWith("diff --git "));
  if (diffHeaders.length !== 1 || diffHeaders[0] !== expectedHeader) blockers.push("proposal_must_contain_exact_single_diff_header");
  if (!lines.includes(`--- a/${targetPath}`)) blockers.push("proposal_must_modify_expected_existing_file_from_a");
  if (!lines.includes(`+++ b/${targetPath}`)) blockers.push("proposal_must_modify_expected_existing_file_to_b");
  if (lines.some((line) => line.includes("/dev/null") || line.startsWith("new file") || line.startsWith("deleted file") || line.startsWith("rename ") || line.startsWith("Binary files"))) {
    blockers.push("proposal_must_not_create_delete_rename_or_binary");
  }
  if (hasUnsafeText(proposalText)) blockers.push("proposal_contains_unsafe_text");

  const patch = parseUnifiedHunks(lines, { minHunks: 1, maxHunks });
  if (!patch.valid) blockers.push(...patch.blockers);
  const afterContent = blockers.length === 0 ? applyUnifiedMutationHunks(beforeContent, patch.hunks, blockers) : beforeContent;
  if (afterContent === beforeContent) blockers.push("proposal_did_not_change_target");
  for (const marker of requiredMarkers) {
    if (!afterContent.includes(marker)) blockers.push(`required_marker_missing:${marker}`);
  }
  for (const exportName of requiredExports) {
    if (!afterContent.includes(exportName)) blockers.push(`required_export_missing:${exportName}`);
  }
  if (!afterContent.includes("providerCallsMade: false")) blockers.push("provider_false_missing");

  return {
    valid: blockers.length === 0,
    blocker: blockers[0] || "none",
    blockers: Array.from(new Set(blockers)),
    targetPath,
    beforeSha256: sha256Text(beforeContent),
    afterSha256: sha256Text(afterContent),
    afterContent,
  };
}

export function validateAlreadyAppliedTargetContent({
  currentContent,
  currentSha256,
  operation,
  extraValidators = [],
}) {
  const blockers = [];
  if (hasPlainSecretValue(currentContent)) blockers.push("already_applied_content_contains_plain_secret_value");
  for (const marker of operation.requiredMarkers || []) {
    if (!currentContent.includes(marker)) blockers.push(`required_marker_missing:${marker}`);
  }
  for (const exportName of operation.requiredExports || []) {
    if (!currentContent.includes(exportName)) blockers.push(`required_export_missing:${exportName}`);
  }
  if (!currentContent.includes("providerCallsMade: false")) blockers.push("provider_false_missing");
  for (const validate of extraValidators) {
    const extraBlocker = validate(currentContent);
    if (extraBlocker) blockers.push(extraBlocker);
  }
  return {
    valid: blockers.length === 0,
    blocker: blockers[0] || "none",
    blockers: Array.from(new Set(blockers)),
    targetPath: operation.targetPath,
    alreadyAppliedSha256: currentSha256,
  };
}

export function runNodeCheckForTargets(targetPaths) {
  return targetPaths.map((targetPath) => ({
    targetPath,
    result: spawnSync("node", ["--check", targetPath], {
      cwd: repoRoot,
      encoding: "utf8",
      shell: false,
      timeout: 30000,
    }),
  }));
}

export function runJsonCommandSmokes(smokeSpecs) {
  return smokeSpecs.map((spec) => {
    const result = spawnSync(spec.command, spec.args, {
      cwd: repoRoot,
      encoding: "utf8",
      shell: false,
      timeout: spec.timeoutMs || 30000,
    });
    return {
      id: spec.id,
      result,
      parsed: parseJsonSafe(result.stdout),
    };
  });
}

export function sha256Text(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

export function sanitizeTail(value) {
  return String(value || "")
    .replace(/https?:\/\/[^\s")]+/gi, "[redacted-url]")
    .replace(/[A-Za-z]:\\[^\r\n]+/g, "[redacted-windows-path]")
    .replace(/(api[_-]?key|secret|token)\s*[:=]\s*[^\s]+/gi, "$1=[redacted]")
    .slice(-2000);
}

export function hasUnsafeText(value) {
  return /https?:\/\/|CRS_OAI_KEY\s*=|\bsk-[A-Za-z0-9]{20,}|api[_-]?key\s*[:=]|secret\s*[:=]|token\s*[:=]|session id:\s*[0-9a-f-]{12,}|[A-Za-z]:\\/.test(
    String(value || ""),
  );
}

export function hasPlainSecretValue(value) {
  return /\bsk-[A-Za-z0-9]{20,}|CRS_OAI_KEY\s*=\s*\S+|api[_-]?key\s*[:=]\s*[A-Za-z0-9_-]{16,}|secret\s*[:=]\s*[A-Za-z0-9_-]{16,}|token\s*[:=]\s*[A-Za-z0-9_-]{16,}|session id:\s*[0-9a-f-]{12,}/i.test(
    String(value || ""),
  );
}

export function parseJsonSafe(value) {
  try {
    return JSON.parse(String(value || "").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

export function isUnsafePath(relativePath, forbiddenPathFragments = defaultForbiddenPathFragments) {
  const normalized = normalizeRelativePath(relativePath);
  const lower = normalized.toLowerCase();
  return (
    !normalized ||
    path.isAbsolute(String(relativePath || "")) ||
    normalized.includes("..") ||
    forbiddenPathFragments.some((fragment) => lower.includes(fragment.toLowerCase()))
  );
}

export function normalizeRelativePath(input) {
  const normalized = String(input || "").replaceAll("\\", "/").replace(/^\.?\//, "").replace(/^\/+/, "");
  return normalized.toLowerCase() === "project_context.md" ? "PROJECT_CONTEXT.md" : normalized;
}

export function resolveRelativePath(relativePath) {
  return path.join(repoRoot, normalizeRelativePath(relativePath));
}

export function readTextFile(relativePath) {
  return readFileSync(resolveRelativePath(relativePath), "utf8").replace(/^\uFEFF/, "");
}

export function readJsonFile(relativePath) {
  const filePath = resolveRelativePath(relativePath);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

export function writeJsonFile(relativePath, value) {
  const filePath = resolveRelativePath(relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeTextFile(relativePath, value) {
  const filePath = resolveRelativePath(relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}
