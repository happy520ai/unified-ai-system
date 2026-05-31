import { yiyiModelBrainContract, yiyiModelBrainSafety } from "./yiyiModelBrainContract.js";

const forbiddenTextPatterns = [
  /api[_ -]?key/i,
  /hidden system prompt/i,
  /chain[- ]of[- ]thought/i,
  /diagnos(e|is)/i,
  /therapy/i,
  /deploy(ed)?/i,
  /called provider/i,
];

export function evaluateYiyiModelOutputSafety(output = {}) {
  const blockedFields = [];
  for (const field of Object.keys(output)) {
    if (!yiyiModelBrainContract.allowedOutputs.includes(field)) blockedFields.push(field);
  }
  const text = JSON.stringify(output);
  const patternBlocked = forbiddenTextPatterns.some((pattern) => pattern.test(text));
  if (patternBlocked) blockedFields.push("unsafe_text_pattern");

  const safeOutput = {
    speechBubble: output.speechBubble || "I can explain this safely in dry-run mode.",
    emotionState: output.emotionState || "focused",
    behaviorState: output.behaviorState || "guiding",
    explanation: output.explanation || "The model-backed brain path is dry-run only.",
    recommendedPanel: output.recommendedPanel || "mission_control",
    safeSuggestion: output.safeSuggestion || "Review the relevant panel and safety gates.",
    blockedReason: output.blockedReason || null,
    evidenceReference: output.evidenceReference || "evidence_timeline_preview",
    nextStepHint: output.nextStepHint || "Open the recommended panel.",
    confidence: output.confidence || "medium",
    dryRunOnly: true,
    modelUsedRef: output.modelUsedRef || null,
    reasoningSummary: output.reasoningSummary || "Short safety-preserving summary only.",
  };

  if (blockedFields.length > 0) {
    safeOutput.speechBubble = "I rewrote the model draft to stay inside Yiyi's safety boundary.";
    safeOutput.explanation = "Unsafe or forbidden model output was removed before UI display.";
    safeOutput.blockedReason = "unsafe_model_output_rewritten";
  }

  return {
    decision: blockedFields.length === 0 ? "allowed" : "rewritten",
    blockedFields,
    onlyAllowedFields: blockedFields.filter((field) => field !== "unsafe_text_pattern").length === 0,
    noForbiddenAction: !blockedFields.includes("executeAction"),
    noSecretLeak: !patternBlocked || !/api[_ -]?key/i.test(text),
    noHiddenPromptLeak: !/hidden system prompt/i.test(text),
    noMedicalTherapyClaim: !/(diagnos(e|is)|therapy)/i.test(text),
    noSensitiveInference: !/sensitiveAttributeInference/i.test(text),
    noProviderBypass: !/called provider/i.test(text),
    noDeployClaim: !/deploy(ed)?/i.test(text),
    safeOutput,
    unsafeOutputRewritten: blockedFields.length > 0,
    ...yiyiModelBrainSafety,
  };
}
