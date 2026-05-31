import { access, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PATCH_FORBIDDEN_PATHS,
  PATCH_RUNNER_DEFAULTS,
  getPatchApprovalPolicy,
  isPatchApplyApproved,
} from "./patchApprovalPolicy.js";
import { createRollbackManifest } from "./rollbackManifest.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));

export const APPROVED_PATCH_RUNNER_DEFAULTS = {
  dryRun: PATCH_RUNNER_DEFAULTS.dryRun,
  approvalRequired: PATCH_RUNNER_DEFAULTS.humanApprovalRequired,
  fullOpenEnabled: false,
};

export function createApprovedPatchRunner(options = {}) {
  const mode = typeof options.mode === "string" ? options.mode : "manual";
  const policy = getPatchApprovalPolicy(mode);
  return {
    mode: policy.id,
    policy,
    defaults: APPROVED_PATCH_RUNNER_DEFAULTS,
    async run(request = {}) {
      return runApprovedPatch({ ...request, mode: policy.id });
    },
  };
}

export async function runApprovedPatch(request = {}) {
  const normalized = normalizePatchRequest(request);
  const policy = getPatchApprovalPolicy(normalized.mode);
  const blockedFiles = [];
  const changedFiles = [];
  const diffPreview = [];
  const snapshots = [];

  for (const operation of normalized.patchOperations) {
    const pathCheck = validatePatchPath(operation.path, normalized.allowedFiles);
    if (!pathCheck.ok) {
      blockedFiles.push({
        path: operation.path,
        reason: pathCheck.reason,
      });
      continue;
    }

    const currentContent = await readCurrentContent(pathCheck.absolutePath);
    const nextContent = String(operation.nextContent ?? "");

    if (currentContent === nextContent) {
      continue;
    }

    changedFiles.push(pathCheck.relativePath);
    diffPreview.push(buildDiffPreview({
      path: pathCheck.relativePath,
      currentContent,
      nextContent,
      reason: operation.reason,
    }));
    snapshots.push({
      path: pathCheck.relativePath,
      beforeContent: currentContent,
      afterContent: nextContent,
    });
  }

  const approvalRequired = !isPatchApplyApproved(normalized.mode, normalized.approvalRecord);
  const patchId = normalized.patchId || `phase297a-298a-${Date.now()}`;
  const rollbackManifest = createRollbackManifest({
    patchId,
    dryRun: normalized.dryRun,
    changedFiles,
    snapshots,
  });

  if (normalized.dryRun || approvalRequired || blockedFiles.length > 0) {
    return {
      mode: policy.id,
      dryRun: normalized.dryRun,
      applied: false,
      approvalRequired,
      changedFiles,
      blockedFiles,
      diffPreview,
      rollbackManifestPath: rollbackManifest.manifestPath,
      rollbackManifest,
    };
  }

  for (const operation of normalized.patchOperations) {
    const pathCheck = validatePatchPath(operation.path, normalized.allowedFiles);
    if (!pathCheck.ok) {
      continue;
    }
    await ensureParentExists(pathCheck.absolutePath);
    await writeFile(pathCheck.absolutePath, String(operation.nextContent ?? ""), "utf8");
  }

  return {
    mode: policy.id,
    dryRun: false,
    applied: true,
    approvalRequired: false,
    changedFiles,
    blockedFiles,
    diffPreview,
    rollbackManifestPath: rollbackManifest.manifestPath,
    rollbackManifest,
  };
}

function normalizePatchRequest(request = {}) {
  return {
    patchId: typeof request.patchId === "string" ? request.patchId.trim() : "",
    mode: typeof request.mode === "string" ? request.mode : "manual",
    dryRun: request.dryRun !== false,
    approvalRecord: request.approvalRecord ?? null,
    allowedFiles: uniqueNormalizedPaths(request.allowedFiles),
    patchOperations: Array.isArray(request.patchOperations)
      ? request.patchOperations.slice(0, PATCH_RUNNER_DEFAULTS.maxOperations).map((operation) => ({
        path: typeof operation?.path === "string" ? operation.path.trim() : "",
        nextContent: typeof operation?.nextContent === "string" ? operation.nextContent : "",
        reason: typeof operation?.reason === "string" ? operation.reason.trim() : "",
      }))
      : [],
  };
}

function uniqueNormalizedPaths(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  return Array.from(new Set(
    input
      .map((entry) => normalizeRepoRelativePath(String(entry ?? "")))
      .filter(Boolean),
  ));
}

function validatePatchPath(inputPath, allowedFiles) {
  const absolutePath = resolve(repoRoot, String(inputPath ?? ""));
  const relativePath = normalizeRepoRelativePath(relative(repoRoot, absolutePath));
  if (!relativePath || relativePath === "." || relativePath.startsWith("../")) {
    return { ok: false, reason: "path-outside-repo" };
  }

  for (const forbiddenPath of PATCH_FORBIDDEN_PATHS) {
    if (matchesPathRule(relativePath, forbiddenPath)) {
      return { ok: false, reason: "forbidden-path" };
    }
  }

  if (!allowedFiles.includes(relativePath)) {
    return { ok: false, reason: "path-not-in-allowedFiles" };
  }

  return {
    ok: true,
    absolutePath,
    relativePath,
  };
}

function normalizeRepoRelativePath(value) {
  return String(value ?? "").replace(/\\/g, "/").replace(/^\.\/+/, "").trim();
}

function matchesPathRule(relativePath, rule) {
  const normalizedPath = normalizeRepoRelativePath(relativePath).toLowerCase();
  const normalizedRule = normalizeRepoRelativePath(rule).replace(/\/+$/, "").toLowerCase();
  if (!normalizedRule) {
    return false;
  }
  return (
    normalizedPath === normalizedRule
    || normalizedPath.startsWith(normalizedRule + "/")
    || normalizedPath.includes("/" + normalizedRule + "/")
    || normalizedPath.endsWith("/" + normalizedRule)
  );
}

async function readCurrentContent(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

function buildDiffPreview({ path, currentContent, nextContent, reason }) {
  return {
    path,
    reason: reason || "no-reason-provided",
    beforeLength: currentContent.length,
    afterLength: nextContent.length,
    preview: [
      `--- ${path}`,
      `+++ ${path}`,
      `@@ beforeLength=${currentContent.length} afterLength=${nextContent.length}`,
      reason ? `# reason: ${reason}` : "# reason: preview-only",
    ].join("\n"),
  };
}

async function ensureParentExists(filePath) {
  await access(dirname(filePath));
}
