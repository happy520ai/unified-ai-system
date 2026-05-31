import {
  BLOCKED_COMMAND_PATTERNS,
  BLOCKED_PATHS,
  PERMISSION_MODES,
} from "./permissionModePolicy.js";

export const SUPPORTED_PERMISSION_MODES = ["manual", "auto_review"];

export const ALLOWED_TASK_ACTIONS = [
  "list_dir",
  "read_text_file",
  "search_text",
  "read_package_scripts",
  "git_status_readonly",
  "build_context_summary",
  "propose_plan",
];

export const BLOCKED_TASK_ACTIONS = [
  "write_file",
  "apply_patch",
  "delete_file",
  "run_command",
  "git_commit",
  "git_push",
  "git_reset",
  "git_clean",
  "deploy",
  "release",
  "codex_exec",
  "read_env",
];

export const READ_ONLY_LOCAL_AGENT_TASK_SCHEMA = {
  phase: "296A",
  name: "Read-only Local Agent Runner",
  supportedModes: SUPPORTED_PERMISSION_MODES,
  allowedActions: ALLOWED_TASK_ACTIONS,
  blockedActions: BLOCKED_TASK_ACTIONS,
  blockedPaths: BLOCKED_PATHS,
  blockedCommandPatterns: BLOCKED_COMMAND_PATTERNS,
  outputMode: "deterministic-preview-only",
  writeEnabled: false,
  patchApplyEnabled: false,
  dangerousCommandExecutionEnabled: false,
};

export function normalizeReadOnlyTask(input = {}) {
  return {
    goal: typeof input.goal === "string" ? input.goal.trim() : "",
    mode: typeof input.mode === "string" ? input.mode : "manual",
    actions: Array.isArray(input.actions) ? input.actions : [],
    paths: Array.isArray(input.paths) ? input.paths : [],
    query: typeof input.query === "string" ? input.query.trim() : "",
    includeScripts: input.includeScripts !== false,
  };
}

export function validateReadOnlyTask(input = {}) {
  const task = normalizeReadOnlyTask(input);
  const errors = [];

  if (!SUPPORTED_PERMISSION_MODES.includes(task.mode)) {
    errors.push("unsupported-permission-mode");
  }

  if (!PERMISSION_MODES[task.mode]) {
    errors.push("missing-permission-mode-policy");
  }

  for (const action of task.actions) {
    if (!ALLOWED_TASK_ACTIONS.includes(action)) {
      errors.push("unsupported-action:" + action);
    }
  }

  for (const blockedPath of task.paths) {
    const normalized = String(blockedPath ?? "").replace(/\\/g, "/");
    for (const pattern of BLOCKED_PATHS) {
      if (normalized.includes(pattern.replace(/\\/g, "/"))) {
        errors.push("blocked-path:" + blockedPath);
        break;
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    task,
  };
}
