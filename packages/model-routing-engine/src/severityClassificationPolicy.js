export const severityClassificationPolicy = {
  P0: [
    "secret leak",
    "raw secret/auth.json read",
    "unexpected deploy/release/tag/artifact",
    "default /chat broken",
    "default /chat-gateway/execute broken",
    "data loss"
  ],
  P1: [
    "core UI unusable",
    "core routing unusable",
    "rollback/safe mode broken",
    "provider gate broken"
  ],
  P2: [
    "UX friction",
    "route quality issue",
    "evidence confusion",
    "scoring issue",
    "fallback weakness"
  ],
  P3: [
    "copy",
    "docs",
    "layout polish",
    "minor panel clarity"
  ]
};

export function classifySeverity(text = "") {
  const value = String(text).toLowerCase();
  if (/secret|auth\.json|deploy|release|tag|artifact|data loss|default \/chat/.test(value)) return "P0";
  if (/unusable|provider gate|rollback|safe mode/.test(value)) return "P1";
  if (/ux|confus|route|evidence|scoring|fallback|friction/.test(value)) return "P2";
  if (/copy|docs|layout|polish|minor|panel/.test(value)) return "P3";
  return "unknown";
}
