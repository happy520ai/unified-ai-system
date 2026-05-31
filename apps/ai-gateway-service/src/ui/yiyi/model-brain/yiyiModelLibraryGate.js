export const yiyiModelCandidateRejectionReasons = [
  "missing_credential_ref",
  "provider_not_configured",
  "model_not_selectable",
  "yiyi_brain_capability_missing",
  "quota_gate_failed",
  "budget_gate_failed",
  "provider_policy_blocked",
];

export function evaluateYiyiModelCandidate(candidate = {}) {
  const blockedBy = [];
  if (!candidate.credentialRef) blockedBy.push("missing_credential_ref");
  if (candidate.providerConfigured !== true) blockedBy.push("provider_not_configured");
  if (candidate.selectable !== true) blockedBy.push("model_not_selectable");
  if (candidate.allowedForYiyiBrain !== true) blockedBy.push("yiyi_brain_capability_missing");
  if (candidate.rawSecretValuePresent === true) blockedBy.push("raw_secret_value_present");
  const eligible = blockedBy.length === 0;
  return {
    modelCandidateId: candidate.modelCandidateId || "user_model_ref_001",
    provider: candidate.provider || "user_configured_provider",
    modelRef: candidate.modelRef || "configured_model_ref",
    credentialRef: candidate.credentialRef || null,
    rawSecretValuePresent: false,
    selectable: candidate.selectable === true,
    allowedForYiyiBrain: candidate.allowedForYiyiBrain === true,
    directProviderCallAllowed: false,
    capabilityTags: candidate.capabilityTags || ["chat", "safety_explanation", "persona_response", "concise_response", "low_latency", "no_tool_execution"],
    decision: eligible ? "eligible_for_dry_run" : "rejected",
    blockedBy,
  };
}
