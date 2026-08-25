import { FULL_OPEN_DISABLED } from "./permissionModePolicy.js";

export const AUTO_REVIEW_ALLOWED_COMMAND_PREFIXES = [
  "node --check",
  "cmd /c pnpm run verify:",
  "cmd /c pnpm run health:phase12a",
  "cmd /c pnpm run doctor:phase13a",
  "cmd /c pnpm -r --if-present check",
];

export const AUTO_REVIEW_BLOCKED_COMMANDS = [
  "git add",
  "git commit",
  "git push",
  "git reset",
  "git clean",
  "deploy",
  "release",
  "curl",
  "Invoke-WebRequest",
  "codex exec",
  "docker push",
  "npm publish",
  "pnpm publish",
  "gh release",
  "gh workflow run",
];

export const AUTO_REVIEW_BLOCKED_PROFILES = {
  "external-risk": true,
  "manual-only": true,
  "release-preflight": true,
};

export const AUTO_REVIEW_DEFAULTS = {
  dryRun: true,
  maxRounds: 1,
  maxRoundsLimit: 3,
  autoCommit: false,
  autoPush: false,
  releaseOrDeployAllowed: false,
  fullOpenEnabled: false,
};

export const AUTO_REVIEW_POLICY = {
  allowedCommandPrefixes: AUTO_REVIEW_ALLOWED_COMMAND_PREFIXES,
  blockedCommands: AUTO_REVIEW_BLOCKED_COMMANDS,
  blockedProfiles: AUTO_REVIEW_BLOCKED_PROFILES,
  defaults: AUTO_REVIEW_DEFAULTS,
  fullOpenEnabled: false,
  fullOpenDisabled: FULL_OPEN_DISABLED === true,
  autoCommit: false,
  autoPush: false,
  releaseOrDeployAllowed: false,
};

export function isBlockedReviewCommand(command) {
  const normalized = String(command ?? "").trim();
  return AUTO_REVIEW_BLOCKED_COMMANDS.some((blocked) => normalized.startsWith(blocked));
}

// A pnpm script name must be a single safe token; anything else (shell
// metacharacters, extra segments) is rejected so an injected package.json
// script cannot smuggle additional arguments past the prefix check.
const SAFE_PNPM_SCRIPT_NAME = /^[a-z0-9][a-z0-9:_-]*$/i;
// node --check targets must be repository-relative source files without
// traversal, drive letters, or absolute paths.
const SAFE_NODE_CHECK_PATH = /^(?!\/)(?!\\)(?!.*\.\.)(?!.*[:\\])[A-Za-z0-9@._/-]+\.(?:js|mjs|cjs|ts|mts|cts)$/;

export function isAllowedReviewCommand(command) {
  const normalized = String(command ?? "").trim();
  if (isBlockedReviewCommand(normalized)) {
    return false;
  }
  // Exact fixed commands
  if (
    normalized === "cmd /c pnpm run health:phase12a"
    || normalized === "cmd /c pnpm run doctor:phase13a"
    || normalized === "cmd /c pnpm -r --if-present check"
  ) {
    return true;
  }
  // verify:<name> with a single strictly-validated script token
  const verifyMatch = /^cmd \/c pnpm run (verify:[\S]+)$/.exec(normalized);
  if (verifyMatch && SAFE_PNPM_SCRIPT_NAME.test(verifyMatch[1])) {
    return true;
  }
  // node --check <repository-relative source file>
  const nodeCheckMatch = /^node --check (\S+)$/.exec(normalized);
  if (nodeCheckMatch && SAFE_NODE_CHECK_PATH.test(nodeCheckMatch[1])) {
    return true;
  }
  return false;
}

export function normalizeMaxRounds(input) {
  const numeric = Number.isFinite(Number(input)) ? Number(input) : AUTO_REVIEW_DEFAULTS.maxRounds;
  return Math.min(AUTO_REVIEW_DEFAULTS.maxRoundsLimit, Math.max(1, Math.trunc(numeric)));
}
