// Environment boundary for the managed Gateway child started by MCP.
// Keep this list intentionally small: provider, GitHub, database, and cloud
// credentials from the MCP host must never be inherited implicitly.

const MANAGED_GATEWAY_INHERITED_KEYS = new Set([
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

const LABELED_SECRET = /((?:[A-Z0-9_.-]*(?:API[_-]?KEY|AUTHORIZATION|PASSWORD|PRIVATE[_-]?KEY|SECRET|TOKEN)[A-Z0-9_.-]*|authorization|token)\s*["']?\s*[:=]\s*["']?)([^\s,"';}]+)/giu;
const BEARER_SECRET = /\b(Bearer)\s+[A-Za-z0-9._~+/=-]+/giu;
const OPAQUE_SECRET_FRAGMENT = /(?<![A-Za-z0-9])[A-Za-z0-9_~+/=-]{24,}(?![A-Za-z0-9])/gu;

export function createManagedGatewayEnvironment(source = {}, explicit = {}) {
  const childEnv = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== "string") continue;
    if (!MANAGED_GATEWAY_INHERITED_KEYS.has(key.toUpperCase())) continue;
    childEnv[key] = value;
  }
  for (const [key, value] of Object.entries(explicit)) {
    if (typeof value === "string") childEnv[key] = value;
  }
  return childEnv;
}

export function redactManagedGatewayOutput(value) {
  return String(value ?? "")
    .replace(BEARER_SECRET, "$1 [REDACTED]")
    .replace(LABELED_SECRET, "$1[REDACTED]")
    .replace(OPAQUE_SECRET_FRAGMENT, "[REDACTED_OPAQUE]");
}

export const runtimeEnvironmentInternals = Object.freeze({
  inheritedKeys: Object.freeze([...MANAGED_GATEWAY_INHERITED_KEYS].sort()),
});
