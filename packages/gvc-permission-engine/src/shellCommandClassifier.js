const categoryOrder = [
  "secret_risk",
  "provider_risk",
  "deploy_risk",
  "git_risk",
  "network",
  "mutation",
  "safe_test",
  "safe_read",
];

export function classifyShellCommand(command) {
  const normalized = String(command || "").trim();
  const lower = normalized.toLowerCase();
  const matchedCategories = [];

  if (/(^|[\s"'=:/\\])(\.env(?:\.[\w-]+)?|auth\.json|secret|token|api[_-]?key|authorization)(?=$|[\s"'=:/\\.])/.test(lower)) matchedCategories.push("secret_risk");
  if (/\b(openai|openrouter|claude|mimo|nvidia|provider|credentialref)\b/.test(lower)) matchedCategories.push("provider_risk");
  if (/\b(deploy|release|tag|artifact|publish)\b/.test(lower)) matchedCategories.push("deploy_risk");
  if (/\bgit\s+(push|commit|reset|clean|tag|checkout)\b/.test(lower)) matchedCategories.push("git_risk");
  if (/\b(curl|wget|invoke-webrequest|iwr|fetch|http:\/\/|https:\/\/)\b/.test(lower)) matchedCategories.push("network");
  if (/\b(set-content|new-item|remove-item|move-item|copy-item|out-file|apply_patch|rm\s|del\s|mkdir|writefile|writefilesync)\b/.test(lower)) matchedCategories.push("mutation");
  if (/\b(pnpm|npm|node|cmd)\b.*\b(verify|check|test|smoke|health|doctor)\b/.test(lower) || /\bnode\s+--check\b/.test(lower)) matchedCategories.push("safe_test");
  if (/\b(get-content|select-string|rg|type|dir|ls|gc|cat)\b/.test(lower)) matchedCategories.push("safe_read");

  const category = categoryOrder.find((item) => matchedCategories.includes(item)) || "mutation";
  return {
    commandPreview: normalized.slice(0, 200),
    category,
    riskFlags: matchedCategories.filter((item) => item.endsWith("_risk") || item === "network" || item === "mutation"),
    dryRunOnly: true,
    realExecutionPerformed: false,
    providerCallsMade: false,
    secretRead: false,
  };
}
