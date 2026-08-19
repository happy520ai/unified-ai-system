const INHERITED_CHILD_ENV_KEYS = new Set([
  "APPDATA",
  "COMSPEC",
  "HOME",
  "LANG",
  "LC_ALL",
  "LOCALAPPDATA",
  "NODE_PATH",
  "PATH",
  "PATHEXT",
  "SYSTEMROOT",
  "TEMP",
  "TERM",
  "TMP",
  "TMPDIR",
  "USER",
  "USERNAME",
  "USERPROFILE",
  "WINDIR",
]);

export function createRestrictedChildEnvironment(
  source: Record<string, string | undefined> = process.env,
  explicit: Record<string, string> = {},
): Record<string, string> {
  const inherited: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== "string" || !INHERITED_CHILD_ENV_KEYS.has(key.toUpperCase())) continue;
    inherited[key] = value;
  }
  for (const [key, value] of Object.entries(explicit)) {
    if (typeof value === "string") inherited[key] = value;
  }
  return inherited;
}
