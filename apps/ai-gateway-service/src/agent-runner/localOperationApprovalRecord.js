import { createHash } from "node:crypto";

import { classifyLocalAgentIntent } from "./localAgentIntentClassifier.js";
import { getPermissionModePolicy } from "./permissionModePolicy.js";
import { PATCH_FORBIDDEN_PATHS } from "./patchApprovalPolicy.js";

export const LOCAL_OPERATION_APPROVAL_STATUSES = ["draft", "approved", "rejected"];

export const LOCAL_OPERATION_FORBIDDEN_PATHS = Array.from(new Set([
  ...PATCH_FORBIDDEN_PATHS,
  "legacy/",
  "PROJECT_CONTEXT.md",
  ".env",
  ".git",
  "node_modules",
]));

export const LOCAL_OPERATION_APPROVAL_DEFAULTS = {
  status: "draft",
  dryRun: true,
  fullOpenAllowed: false,
  autoCommit: false,
  autoPush: false,
  releaseOrDeploy: false,
};

export function createLocalOperationApprovalRecord(request = {}) {
  const normalizedRequest = normalizeApprovalRequest(request);
  const classification = normalizedRequest.classification ?? classifyLocalAgentIntent(normalizedRequest.input);
  const permissionModeCheck = normalizePermissionMode(
    normalizedRequest.permissionMode ?? classification.recommendedPermissionMode ?? "manual",
  );
  const status = normalizeStatus(normalizedRequest.status);
  const approvedByUser = normalizedRequest.approvedByUser === true && status === "approved";
  const approvedAt = approvedByUser
    ? normalizeApprovedAt(normalizedRequest.approvedAt)
    : null;

  const record = {
    operationId: normalizedRequest.operationId || buildLocalOperationId(normalizedRequest.input, normalizedRequest.allowedFiles),
    input: normalizedRequest.input,
    intentType: normalizedRequest.intentType ?? classification.intentType,
    riskLevel: normalizedRequest.riskLevel ?? classification.riskLevel,
    permissionMode: permissionModeCheck.permissionMode,
    allowedFiles: normalizeLocalOperationAllowedFiles(normalizedRequest.allowedFiles),
    approvedByUser,
    approvedAt,
    status,
    dryRun: normalizedRequest.dryRun !== false,
    fullOpenAllowed: false,
    autoCommit: false,
    autoPush: false,
    releaseOrDeploy: false,
    scope: normalizedRequest.scope === "task" ? "task" : "patch",
    requestedPermissionMode: permissionModeCheck.requestedPermissionMode,
  };

  const validation = validateLocalOperationApprovalRecord(record, {
    classification,
    requireApplyGate: status === "approved",
    requestedFullOpen: permissionModeCheck.requestedFullOpen,
  });

  if (record.status === "approved" && !validation.approvalAllowed) {
    return {
      ...record,
      approvedByUser: false,
      approvedAt: null,
      status: "draft",
      blockers: Array.from(new Set([
        "approval-downgraded-to-draft",
        ...validation.blockers,
      ])),
      warnings: validation.warnings,
      readyToApply: false,
      forbiddenPathCheck: validation.forbiddenPathCheck,
    };
  }

  return {
    ...record,
    blockers: validation.blockers,
    warnings: validation.warnings,
    readyToApply: validation.canApply,
    forbiddenPathCheck: validation.forbiddenPathCheck,
  };
}

export function validateLocalOperationApprovalRecord(record = {}, options = {}) {
  const input = typeof record.input === "string" ? record.input : "";
  const classification = options.classification ?? classifyLocalAgentIntent(input);
  const blockers = [];
  const warnings = [];
  const allowedFiles = normalizeLocalOperationAllowedFiles(record.allowedFiles);
  const forbiddenPathCheck = checkLocalOperationForbiddenPaths(allowedFiles);
  const requestedMode = String(record.requestedPermissionMode ?? record.permissionMode ?? "");
  const status = normalizeStatus(record.status);
  const requireApplyGate = options.requireApplyGate === true || status === "approved";

  if (!record.operationId || typeof record.operationId !== "string") {
    blockers.push("operation-id-required");
  }

  if (classification.blocked || record.riskLevel === "blocked" || String(record.intentType ?? "").startsWith("unsafe_")) {
    blockers.push("blocked-intent-cannot-be-approved");
  }

  if (options.requestedFullOpen === true || requestedMode.toLowerCase().includes("full_open")) {
    blockers.push("full-open-disabled");
  }

  if (!getPermissionModePolicy(record.permissionMode)) {
    blockers.push("unsupported-permission-mode");
  }

  if (record.fullOpenAllowed !== false) {
    blockers.push("full-open-not-allowed");
  }

  if (record.autoCommit !== false) {
    blockers.push("auto-commit-disabled");
  }

  if (record.autoPush !== false) {
    blockers.push("auto-push-disabled");
  }

  if (record.releaseOrDeploy !== false) {
    blockers.push("release-or-deploy-disabled");
  }

  if (!LOCAL_OPERATION_APPROVAL_STATUSES.includes(status)) {
    blockers.push("invalid-approval-status");
  }

  if (requireApplyGate && allowedFiles.length === 0) {
    blockers.push("allowed-files-required-before-approval");
  }

  if (!forbiddenPathCheck.ok && requireApplyGate) {
    blockers.push("forbidden-paths-blocked");
  }

  if (!forbiddenPathCheck.ok && !requireApplyGate) {
    warnings.push("forbidden-paths-present-but-not-approved");
  }

  if (status === "approved") {
    if (record.approvedByUser !== true) {
      blockers.push("explicit-user-approval-required");
    }
    if (!isIsoTimestamp(record.approvedAt)) {
      blockers.push("approved-at-required");
    }
  }

  if (status !== "approved") {
    warnings.push("approval-record-not-approved");
  }

  if (status === "approved" && record.dryRun !== false) {
    warnings.push("dry-run-default-prevents-real-apply");
  }

  const uniqueBlockers = Array.from(new Set(blockers));
  const uniqueWarnings = Array.from(new Set(warnings));

  return {
    ok: uniqueBlockers.length === 0,
    approvalAllowed: uniqueBlockers.length === 0,
    canApply: uniqueBlockers.length === 0 && status === "approved" && record.dryRun === false,
    blockers: uniqueBlockers,
    warnings: uniqueWarnings,
    allowedFiles,
    forbiddenPathCheck,
    fullOpenAllowed: false,
    autoCommit: false,
    autoPush: false,
    releaseOrDeploy: false,
  };
}

export function normalizeLocalOperationAllowedFiles(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return Array.from(new Set(
    input
      .map((entry) => normalizeLocalOperationPath(entry))
      .filter(Boolean),
  ));
}

export function checkLocalOperationForbiddenPaths(input) {
  const files = normalizeLocalOperationAllowedFiles(input);
  const blocked = files
    .map((filePath) => ({
      path: filePath,
      reason: getForbiddenPathReason(filePath),
    }))
    .filter((entry) => entry.reason);

  return {
    ok: blocked.length === 0,
    blocked,
    forbiddenPaths: LOCAL_OPERATION_FORBIDDEN_PATHS,
  };
}

export function buildLocalOperationId(input, allowedFiles = []) {
  const seed = [
    String(input ?? "").trim().toLowerCase(),
    ...normalizeLocalOperationAllowedFiles(allowedFiles),
  ].join("|") || "phase303a-305a-local-operation";
  return `phase303a-305a-${createHash("sha256").update(seed, "utf8").digest("hex").slice(0, 12)}`;
}

function normalizeApprovalRequest(request) {
  if (typeof request === "string") {
    return { input: request, allowedFiles: [] };
  }

  return {
    ...request,
    input: String(request?.input ?? ""),
    allowedFiles: Array.isArray(request?.allowedFiles) ? request.allowedFiles : [],
  };
}

function normalizePermissionMode(input) {
  const requestedPermissionMode = String(input ?? "manual").trim() || "manual";
  const normalized = requestedPermissionMode.toLowerCase();
  const requestedFullOpen = normalized.includes("full_open") || normalized.includes("full-open") || normalized.includes("full open");

  if (normalized === "auto_review") {
    return {
      permissionMode: "auto_review",
      requestedPermissionMode,
      requestedFullOpen,
    };
  }

  return {
    permissionMode: "manual",
    requestedPermissionMode,
    requestedFullOpen,
  };
}

function normalizeStatus(input) {
  const status = String(input ?? LOCAL_OPERATION_APPROVAL_DEFAULTS.status).trim();
  return LOCAL_OPERATION_APPROVAL_STATUSES.includes(status) ? status : "draft";
}

function normalizeApprovedAt(input) {
  if (isIsoTimestamp(input)) {
    return input;
  }
  return new Date().toISOString();
}

function isIsoTimestamp(input) {
  if (typeof input !== "string" || !input.trim()) {
    return false;
  }
  const parsed = Date.parse(input);
  return Number.isFinite(parsed);
}

function normalizeLocalOperationPath(input) {
  return String(input ?? "")
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .trim();
}

function getForbiddenPathReason(filePath) {
  const normalizedPath = normalizeLocalOperationPath(filePath);
  const lowerPath = normalizedPath.toLowerCase();

  if (!normalizedPath || normalizedPath === "." || normalizedPath.includes("\0")) {
    return "invalid-path";
  }

  if (lowerPath.startsWith("/") || /^[a-z]:\//i.test(lowerPath)) {
    return "absolute-path-blocked";
  }

  if (lowerPath === ".." || lowerPath.startsWith("../") || lowerPath.includes("/../")) {
    return "path-traversal-blocked";
  }

  for (const rule of LOCAL_OPERATION_FORBIDDEN_PATHS) {
    if (matchesForbiddenPathRule(lowerPath, rule)) {
      return "forbidden-path";
    }
  }

  return "";
}

function matchesForbiddenPathRule(lowerPath, rule) {
  const normalizedRule = normalizeLocalOperationPath(rule).replace(/\/+$/, "").toLowerCase();
  if (!normalizedRule) {
    return false;
  }

  if (normalizedRule === ".env") {
    return lowerPath
      .split("/")
      .some((segment) => segment === ".env" || segment.startsWith(".env."));
  }

  return (
    lowerPath === normalizedRule
    || lowerPath.startsWith(normalizedRule + "/")
    || lowerPath.includes("/" + normalizedRule + "/")
    || lowerPath.endsWith("/" + normalizedRule)
  );
}
