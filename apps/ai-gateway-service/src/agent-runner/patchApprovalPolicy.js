import {
  BLOCKED_PATHS,
  DISABLED_MODES,
  FULL_OPEN_DISABLED,
  PERMISSION_MODES,
} from "./permissionModePolicy.js";

export const PATCH_RUNNER_ALLOWED_MODES = ["manual", "auto_review"];

export const PATCH_FORBIDDEN_PATHS = Array.from(new Set([
  ...BLOCKED_PATHS,
  ".git",
  ".git/",
  "node_modules",
  "node_modules/",
]));

export const PATCH_BLOCKED_COMMANDS = [
  "git add",
  "git commit",
  "git push",
  "git reset",
  "git clean",
  "deploy",
  "release",
  "curl",
  "codex exec",
];

export const PATCH_RUNNER_DEFAULTS = {
  dryRun: true,
  humanApprovalRequired: true,
  realPatchApplyDefault: false,
  autoCommit: false,
  autoPush: false,
  releaseOrDeployAllowed: false,
  fullOpenEnabled: false,
  maxOperations: 25,
};

export const PATCH_APPROVAL_POLICIES = {
  manual: {
    id: "manual",
    label: "Manual Approval Mode",
    permissionModeId: PERMISSION_MODES.manual.id,
    fullOpenEnabled: false,
    humanApprovalRequired: true,
    approvalScope: "patch",
    allowTaskLevelApproval: false,
    allowedModes: PATCH_RUNNER_ALLOWED_MODES,
    forbiddenPaths: PATCH_FORBIDDEN_PATHS,
    blockedCommands: PATCH_BLOCKED_COMMANDS,
    requireApprovalBeforeApply: true,
    requireApprovalBeforeWrite: true,
    autoCommit: false,
    autoPush: false,
    releaseOrDeployAllowed: false,
  },
  auto_review: {
    id: "auto_review",
    label: "Auto Review Mode",
    permissionModeId: PERMISSION_MODES.auto_review.id,
    fullOpenEnabled: false,
    humanApprovalRequired: true,
    approvalScope: "task-or-patch",
    allowTaskLevelApproval: true,
    allowedModes: PATCH_RUNNER_ALLOWED_MODES,
    forbiddenPaths: PATCH_FORBIDDEN_PATHS,
    blockedCommands: PATCH_BLOCKED_COMMANDS,
    requireApprovalBeforeApply: true,
    requireApprovalBeforeWrite: true,
    autoCommit: false,
    autoPush: false,
    releaseOrDeployAllowed: false,
  },
};

export function getPatchApprovalPolicy(mode = "manual") {
  return PATCH_APPROVAL_POLICIES[mode] ?? PATCH_APPROVAL_POLICIES.manual;
}

export function isFullOpenDisabledForPatchRunner() {
  return FULL_OPEN_DISABLED === true && DISABLED_MODES.full_open?.enabled === false;
}

export function isPatchApplyApproved(mode, approvalRecord = {}) {
  const policy = getPatchApprovalPolicy(mode);
  if (!policy || !isFullOpenDisabledForPatchRunner()) {
    return false;
  }

  if (approvalRecord?.status !== "approved") {
    return false;
  }

  const scope = typeof approvalRecord.scope === "string" ? approvalRecord.scope : "patch";
  if (policy.id === "manual") {
    return scope === "patch";
  }

  if (policy.id === "auto_review") {
    return scope === "task" || scope === "patch";
  }

  return false;
}
