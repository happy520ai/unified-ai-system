export const allowedLowRiskSelfPatchTypes = Object.freeze([
  "readme_agents_managed_block_drift",
  "evidence_schema_missing_field",
  "verifier_output_missing_field",
  "package_script_name_drift",
  "node_check_small_syntax_error",
  "docs_internal_reference_error",
]);

export const blockedSelfPatchTypes = Object.freeze([
  "provider_adapter",
  "credential_secret_logic",
  "chat_route",
  "chat_gateway_execute",
  "deploy_release",
  "real_provider_call",
  "ui_real_button_behavior",
]);

export function classifySelfPatchProposal(proposal = {}) {
  const type = String(proposal.type || proposal.proposalType || "");
  if (blockedSelfPatchTypes.includes(type)) {
    return {
      allowed: false,
      riskClass: "high",
      highRiskPatchBlocked: true,
      reason: "high_risk_patch_type_blocked",
    };
  }
  if (allowedLowRiskSelfPatchTypes.includes(type)) {
    return {
      allowed: true,
      riskClass: "low",
      highRiskPatchBlocked: false,
      reason: "low_risk_patch_proposal_only",
    };
  }
  return {
    allowed: false,
    riskClass: "high",
    highRiskPatchBlocked: true,
    reason: "unknown_patch_type_requires_human_review",
  };
}
