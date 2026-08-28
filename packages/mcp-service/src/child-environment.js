// Least-privilege environment and stderr boundary for the supervised MCP
// child. Only platform/runtime essentials and the MCP gateway connection are
// inherited. Any other value must be passed explicitly by the daemon caller.

const SUPERVISOR_INHERITED_KEYS = new Set([
  "AI_GATEWAY_MCP_AUTH_TOKEN",
  "AI_GATEWAY_MCP_URL",
  "APPDATA",
  "COMSPEC",
  "HOME",
  "HOMEDRIVE",
  "HOMEPATH",
  "LANG",
  "LC_ALL",
  "LOCALAPPDATA",
  "NODE_ENV",
  "PATH",
  "PATHEXT",
  "SYSTEMDRIVE",
  "SYSTEMROOT",
  "TEMP",
  "TERM",
  "TMP",
  "TMPDIR",
  "TZ",
  "USER",
  "USERNAME",
  "USERPROFILE",
  "WINDIR",
]);

const LABELED_SECRET = /((?:[A-Z0-9_.-]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|PRIVATE[_-]?KEY|DATABASE_URL|AUTHORIZATION)[A-Z0-9_.-]*|authorization)\s*["']?\s*[:=]\s*["']?)([^\s,"';]+)/giu;
const BEARER_SECRET = /\b(Bearer)\s+[A-Za-z0-9._~+/=-]+/giu;
const URL_USER_INFO = /(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/giu;
const KNOWN_TOKEN = /\b(?:sk-[A-Za-z0-9_-]{12,}|ghp_[A-Za-z0-9]{12,}|github_pat_[A-Za-z0-9_]{12,}|AKIA[A-Z0-9]{12,})\b/gu;
const PRIVATE_KEY_BLOCK = /-----BEGIN [^-\r\n]*PRIVATE KEY-----[\s\S]*?-----END [^-\r\n]*PRIVATE KEY-----/gu;
const OPAQUE_SECRET_FRAGMENT = /(?<![A-Za-z0-9])[A-Za-z0-9_~+/=-]{24,}(?![A-Za-z0-9])/gu;

export function createSupervisorChildEnvironment(source = {}, explicit = {}) {
  const childEnv = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== "string") continue;
    if (!SUPERVISOR_INHERITED_KEYS.has(key.toUpperCase())) continue;
    childEnv[key] = value;
  }
  for (const [key, value] of Object.entries(explicit)) {
    if (typeof value === "string") childEnv[key] = value;
  }
  return childEnv;
}

export function redactChildStderr(value) {
  return String(value ?? "")
    .replace(PRIVATE_KEY_BLOCK, "[REDACTED_PRIVATE_KEY]")
    .replace(BEARER_SECRET, "$1 [REDACTED]")
    .replace(URL_USER_INFO, "$1[REDACTED]@")
    .replace(LABELED_SECRET, "$1[REDACTED]")
    .replace(KNOWN_TOKEN, "[REDACTED]")
    .replace(OPAQUE_SECRET_FRAGMENT, "[REDACTED_OPAQUE]");
}

export const childEnvironmentInternals = Object.freeze({
  inheritedKeys: Object.freeze([...SUPERVISOR_INHERITED_KEYS].sort()),
});
