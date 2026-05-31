import { exists, readJson, readText, writeJson, writeText, hasSecretLikeValue } from "./phase372-common.mjs";

export { exists, readJson, readText, writeJson, writeText, hasSecretLikeValue };

export function includesAll(source, patterns) {
  return patterns.every((pattern) => source.includes(pattern));
}

export function findVisibleIssuePatterns(source) {
  const patterns = ["?/button>", "?/div>", "?/h1>", "?/h2>", "?/h3>", "????"];
  return patterns.filter((pattern) => source.includes(pattern));
}

export function boolChecklist(entries) {
  return entries.map((entry) => ({
    id: entry.id,
    label: entry.label,
    pass: Boolean(entry.pass),
    detail: entry.detail || "",
  }));
}
