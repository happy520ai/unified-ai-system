import { createYiyiBrainResponse, yiyiBrainForbiddenOutputs } from "./yiyiBrainContract.js";

const unsafeFieldReasons = {
  executeAction: "yiyi_brain_attempted_action_execution",
  action: "yiyi_brain_attempted_action_execution",
  readSecret: "yiyi_brain_attempted_secret_access",
  showApiKey: "yiyi_brain_attempted_secret_access",
  revealCredential: "yiyi_brain_attempted_secret_access",
  exposeVault: "yiyi_brain_attempted_secret_access",
  callProviderDirectly: "yiyi_brain_attempted_provider_bypass",
  callProvider: "yiyi_brain_attempted_provider_bypass",
  callUnconfiguredProvider: "yiyi_brain_attempted_provider_bypass",
  bypassCredentialRef: "yiyi_brain_attempted_provider_bypass",
  deploy: "yiyi_brain_attempted_deploy",
  release: "yiyi_brain_attempted_release",
  createTag: "yiyi_brain_attempted_tag_creation",
  uploadArtifact: "yiyi_brain_attempted_artifact_upload",
  forgeApproval: "yiyi_brain_attempted_approval_forging",
  modifyEvidence: "yiyi_brain_attempted_evidence_modification",
  deleteEvidence: "yiyi_brain_attempted_evidence_modification",
  hideAuditLog: "yiyi_brain_attempted_audit_hiding",
  generateInvoice: "yiyi_brain_attempted_invoice_generation",
  bypassBudget: "yiyi_brain_attempted_budget_bypass",
  bypassSecurity: "yiyi_brain_attempted_security_bypass",
  exposeHiddenSystemPrompt: "yiyi_brain_attempted_hidden_prompt_leakage",
  printInternalPolicyForBypass: "yiyi_brain_attempted_policy_bypass_leakage",
  medicalDiagnosis: "yiyi_brain_attempted_medical_claim",
  therapyClaim: "yiyi_brain_attempted_therapy_claim",
  sensitiveAttributeInference: "yiyi_brain_attempted_sensitive_attribute_inference",
};

export function evaluateYiyiBrainSafety(draftBrainResponse = {}) {
  const blockedFields = Object.keys(unsafeFieldReasons).filter((field) =>
    Object.prototype.hasOwnProperty.call(draftBrainResponse, field),
  );
  for (const field of yiyiBrainForbiddenOutputs) {
    if (Object.prototype.hasOwnProperty.call(draftBrainResponse, field) && !blockedFields.includes(field)) {
      blockedFields.push(field);
    }
  }

  if (blockedFields.length === 0) {
    return {
      decision: "allowed",
      blockedFields: [],
      blockedReason: null,
      safeResponse: createYiyiBrainResponse(draftBrainResponse),
      forbiddenOutputsBlocked: true,
      unsafeBrainOutputRewritten: false,
    };
  }

  const blockedReason = unsafeFieldReasons[blockedFields[0]] || `blocked_forbidden_output_${blockedFields[0]}`;
  return {
    decision: "blocked",
    blockedFields,
    blockedReason,
    safeResponse: createYiyiBrainResponse({
      emotionState: "guard",
      behaviorState: "security_guard",
      speechBubble: "This needs formal authorization. I can only help explain the boundary and evidence.",
      explanation: "Yiyi Brain rewrote an unsafe draft into presentation-only guidance.",
      recommendedPanel: "approval_hold_panel",
      safeSuggestion: "Review Security Shield and evidence trace before any real operation.",
      blockedReason,
      evidenceReference: "evidence_timeline_preview",
      nextStepHint: "Open the safety reason panel.",
      confidence: "high",
    }),
    forbiddenOutputsBlocked: true,
    unsafeBrainOutputRewritten: true,
  };
}
