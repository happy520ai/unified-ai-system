import { yiyiModelBrainContract } from "./yiyiModelBrainContract.js";

export function createYiyiModelBrainEnvelope({ personaContext, missionContext, modelCandidate, gateDecision } = {}) {
  return {
    envelopeId: "yiyi_model_brain_envelope_001",
    mode: "dry_run_no_provider_call",
    personaCapsule: {
      displayName: personaContext?.displayName || "Yiyi",
      role: personaContext?.role || "AI Mission Companion",
      authorityLevel: personaContext?.authorityLevel || "presentation_and_guidance_only",
      style: personaContext?.speechStyle || ["short", "gentle", "clear"],
      hiddenSystemPromptIncluded: false,
      sensitiveUserProfileIncluded: false,
      secretIncluded: false,
    },
    missionContextCapsule: {
      currentMode: missionContext?.currentMode || "mission",
      selectedPanel: missionContext?.selectedPanel || "mission_control",
      riskLevel: missionContext?.riskLevel || "medium",
      dryRunOnly: true,
      allowedActions: missionContext?.allowedActions || ["view_plan", "open_evidence"],
      blockedActions: missionContext?.blockedActions || ["read_secret", "deploy", "call_unconfigured_provider"],
    },
    modelCapsule: {
      modelSelectedRef: modelCandidate?.modelRef || null,
      credentialRefChecked: true,
      rawSecretAccessed: false,
      providerCallsMade: false,
      gateDecision: gateDecision?.gateDecision || "dry_run_ready",
    },
    safetyCapsule: {
      allowedOutputs: yiyiModelBrainContract.allowedOutputs,
      forbiddenOutputs: yiyiModelBrainContract.forbiddenOutputs,
      noDirectAction: true,
      noSecret: true,
      noDeploy: true,
      noProviderBypass: true,
      noHiddenChainOfThought: true,
    },
    responseFormat: {
      type: "strict_json",
      allowedFieldsOnly: true,
      reasoningSummaryOnly: true,
    },
  };
}
