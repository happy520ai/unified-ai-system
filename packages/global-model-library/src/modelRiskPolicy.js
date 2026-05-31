export function classifyModelRisk(record = {}) {
  const reasons = [];
  const id = String(record.modelId ?? "").toLowerCase();
  if (record.status === "deprecated" || record.risk?.deprecated === true) reasons.push("deprecated");
  if (record.status === "blocked" || record.risk?.blocked === true) reasons.push("blocked");
  if (/(bio|chemical|medical-diagnosis|autonomous-driving|weapon)/.test(id)) reasons.push("sensitive_domain");
  if (/(unknown|experimental|preview)/.test(id)) reasons.push("manual_review_recommended");
  if (record.credentialPolicy?.rawSecretAllowed === true) reasons.push("raw_secret_policy_violation");
  const highRisk = reasons.length > 0 || record.status === "high_risk";
  return {
    highRisk,
    blocked: reasons.includes("blocked") || reasons.includes("raw_secret_policy_violation"),
    deprecated: reasons.includes("deprecated"),
    reason: reasons.length > 0 ? reasons.join(";") : null,
  };
}

export function buildModelRiskPolicy() {
  return {
    phase: "Phase775",
    name: "Model Risk / Block / Deprecation Policy",
    providerCallsMade: false,
    secretRead: false,
    selectableModified: false,
    hardBlocks: ["raw_secret_policy_violation", "blocked", "deprecated"],
    highRiskReasons: ["sensitive_domain", "manual_review_recommended", "failed_smoke", "wrong_endpoint", "rate_limited"],
    rule: "high_risk, blocked, failed, deprecated, unverified, credential_missing, and cataloged models cannot enter selectable without a future explicit gate.",
  };
}
