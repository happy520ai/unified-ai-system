export const BLOCKED_PATHS = [
  "legacy/",
  "PROJECT_CONTEXT.md",
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
];

export const ALLOWED_COMMAND_PREFIXES = [
  "node --check",
  "cmd /c pnpm run verify:",
  "cmd /c pnpm run health:phase12a",
  "cmd /c pnpm run doctor:phase13a",
];

export const BLOCKED_COMMAND_PATTERNS = [
  "git commit",
  "git push",
  "git reset",
  "git clean",
  "deploy",
  "release",
  "curl",
  "codex exec",
];

export const FULL_OPEN_DISABLED = true;

export const PERMISSION_MODES = {
  manual: {
    id: "manual",
    label: "Manual Approval Mode",
    fullOpenEnabled: false,
    blockedPaths: BLOCKED_PATHS,
    allowedCommandPrefixes: ALLOWED_COMMAND_PREFIXES,
    blockedCommandPatterns: BLOCKED_COMMAND_PATTERNS,
    requireApprovalBeforeWrite: true,
    requireApprovalBeforePatchApply: true,
    autoRunSafeVerifiers: false,
    autoCommit: false,
    autoPush: false,
    releaseOrDeployAllowed: false,
    unattendedExecutionAllowed: false,
    realLocalAgentRunnerAllowed: false,
    readEnvAllowed: false,
    notes: [
      "Read-only inspection, planning, and patch proposal generation are allowed.",
      "Any write or patch apply requires human approval first.",
      "Commit, push, deploy, and release remain blocked.",
    ],
  },
  auto_review: {
    id: "auto_review",
    label: "Auto Review Mode",
    fullOpenEnabled: false,
    blockedPaths: BLOCKED_PATHS,
    allowedCommandPrefixes: ALLOWED_COMMAND_PREFIXES,
    blockedCommandPatterns: BLOCKED_COMMAND_PATTERNS,
    requireApprovalBeforeWrite: true,
    requireApprovalBeforePatchApply: true,
    autoRunSafeVerifiers: true,
    autoCommit: false,
    autoPush: false,
    releaseOrDeployAllowed: false,
    unattendedExecutionAllowed: false,
    realLocalAgentRunnerAllowed: false,
    readEnvAllowed: false,
    notes: [
      "Whitelisted local reads and safe verifier execution are allowed.",
      "Review, go-no-go, and evidence generation are allowed.",
      "Patch apply still requires task-level approval.",
    ],
  },
};

export const DISABLED_MODES = {
  full_open: {
    id: "full_open",
    enabled: false,
    reason: "Phase295A allows only manual and auto_review modes.",
  },
};

export function getPermissionModePolicy(mode) {
  return PERMISSION_MODES[mode] ?? null;
}

export function listPermissionModes() {
  return Object.values(PERMISSION_MODES);
}
