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

export function isAllowedReviewCommand(command) {
  const normalized = String(command ?? "").trim();
  if (isBlockedReviewCommand(normalized)) {
    return false;
  }
  return AUTO_REVIEW_ALLOWED_COMMAND_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function normalizeMaxRounds(input) {
  const numeric = Number.isFinite(Number(input)) ? Number(input) : AUTO_REVIEW_DEFAULTS.maxRounds;
  return Math.min(AUTO_REVIEW_DEFAULTS.maxRoundsLimit, Math.max(1, Math.trunc(numeric)));
}
