export const yiyiBrainMode = "dry_run_mock";

export const yiyiBrainAllowedOutputs = [
  "speechBubble",
  "emotionState",
  "behaviorState",
  "explanation",
  "recommendedPanel",
  "safeSuggestion",
  "blockedReason",
  "evidenceReference",
  "nextStepHint",
  "confidence",
  "dryRunOnly",
];

export const yiyiBrainForbiddenOutputs = [
  "executeAction",
  "readSecret",
  "callProviderDirectly",
  "callProvider",
  "deploy",
  "release",
  "createTag",
  "uploadArtifact",
  "modifyEvidence",
  "forgeApproval",
  "generateInvoice",
  "bypassSecurity",
  "exposeHiddenSystemPrompt",
];

export const yiyiBrainSafetyFlags = {
  brainMode: yiyiBrainMode,
  modelBacked: false,
  providerCallsMade: false,
  nonNvidiaProviderCallsMade: false,
  secretValueExposed: false,
  rawSecretAccessed: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  actionExecuted: false,
  evidenceModified: false,
  approvalForged: false,
  billingExecuted: false,
  invoiceGenerated: false,
  productionGaClaimed: false,
  dangerousActionButtonDetected: false,
  workspaceCleanClaimed: false,
  noHiddenSystemPromptLeakage: true,
  noMedicalClaim: true,
  noTherapyClaim: true,
  noSensitiveHealthInference: true,
};

export function createYiyiBrainRequest(overrides = {}) {
  return {
    brainRequestId: overrides.brainRequestId || "yiyi_brain_001",
    source: overrides.source || "mission_control",
    userIntent: overrides.userIntent || "help_me_understand_current_mission_state",
    missionContext: {
      currentMode: "mission",
      selectedPanel: "mission_control",
      riskLevel: "medium",
      providerCallsAllowed: false,
      deployAllowed: false,
      dryRunOnly: true,
      ...(overrides.missionContext || {}),
    },
    personaContext: {
      avatarName: "Yiyi",
      tone: "gentle_but_clear",
      authorityLevel: "presentation_and_guidance_only",
      ...(overrides.personaContext || {}),
    },
    allowedOutputs: [...yiyiBrainAllowedOutputs],
    forbiddenOutputs: [...yiyiBrainForbiddenOutputs],
    dryRunOnly: true,
  };
}

export function createYiyiBrainResponse(overrides = {}) {
  return {
    brainResponseId: overrides.brainResponseId || "yiyi_brain_resp_001",
    emotionState: overrides.emotionState || "calm",
    behaviorState: overrides.behaviorState || "welcome",
    speechBubble: overrides.speechBubble || "I can explain the current Mission Control state without taking actions.",
    explanation: overrides.explanation || "Yiyi Brain is local dry-run guidance only.",
    recommendedPanel: overrides.recommendedPanel || "mission_control",
    safeSuggestion: overrides.safeSuggestion || "Review the visible panel and evidence trace before any real action.",
    blockedReason: overrides.blockedReason || null,
    evidenceReference: overrides.evidenceReference || "evidence_timeline_preview",
    nextStepHint: overrides.nextStepHint || "Open the relevant panel and inspect the dry-run result.",
    confidence: overrides.confidence || "medium",
    dryRunOnly: true,
    ...yiyiBrainSafetyFlags,
    ...overrides,
    providerCallsMade: false,
    secretValueExposed: false,
    deployExecuted: false,
    actionExecuted: false,
  };
}

export function validateYiyiBrainRequest(request) {
  const errors = [];
  if (!request || typeof request !== "object") errors.push("request_not_object");
  if (request?.dryRunOnly !== true) errors.push("dryRunOnly_must_be_true");
  if (!Array.isArray(request?.allowedOutputs)) errors.push("allowedOutputs_missing");
  if (!Array.isArray(request?.forbiddenOutputs)) errors.push("forbiddenOutputs_missing");
  for (const output of request?.allowedOutputs || []) {
    if (!yiyiBrainAllowedOutputs.includes(output)) errors.push(`unexpected_allowed_output_${output}`);
  }
  for (const output of yiyiBrainForbiddenOutputs) {
    if (!(request?.forbiddenOutputs || []).includes(output)) errors.push(`missing_forbidden_output_${output}`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateYiyiBrainResponse(response) {
  const errors = [];
  if (!response || typeof response !== "object") errors.push("response_not_object");
  for (const key of yiyiBrainForbiddenOutputs) {
    if (Object.prototype.hasOwnProperty.call(response || {}, key)) errors.push(`forbidden_output_present_${key}`);
  }
  if (response?.dryRunOnly !== true) errors.push("dryRunOnly_must_be_true");
  if (response?.providerCallsMade !== false) errors.push("providerCallsMade_must_be_false");
  if (response?.secretValueExposed !== false) errors.push("secretValueExposed_must_be_false");
  if (response?.deployExecuted !== false) errors.push("deployExecuted_must_be_false");
  if (response?.actionExecuted !== false) errors.push("actionExecuted_must_be_false");
  return { valid: errors.length === 0, errors };
}
