import {
  getYiyiCharacterCanon,
  getYiyiEmotionBehaviorCanonMap,
  getYiyiScenarioLines,
  yiyiVisualTokens,
} from "../../copy/yiyiCopy.js";

export function buildYiyiPersonaContext(input = {}) {
  const canon = getYiyiCharacterCanon();
  const scenarioLines = getYiyiScenarioLines();
  const canonMap = getYiyiEmotionBehaviorCanonMap();
  const scenarioId = input.scenarioId || "welcome";
  const candidates = scenarioLines
    .filter((item) => item.scenarioId === scenarioId || item.behaviorState === input.behaviorState)
    .flatMap((item) => item.lines || [])
    .slice(0, 3);

  return {
    personaContextId: input.personaContextId || "persona_ctx_001",
    avatarName: canon?.identity?.avatarName || yiyiVisualTokens.avatarName || "Yiyi",
    displayName: canon?.identity?.displayName || yiyiVisualTokens.displayName || "Yiyi",
    role: canon?.identity?.role || "AI Mission Companion",
    authorityLevel: canon?.identity?.authorityLevel || "presentation_and_guidance_only",
    tone: input.tone || "gentle_but_clear",
    speechStyle: canon?.speechStyle?.rules || ["short", "gentle", "clear", "no real execution claim"],
    personalityAnchors: canon?.coreCanon?.personalityAnchors || yiyiVisualTokens.personalityKeywords || ["gentle", "reliable", "guarding"],
    safetyAnchors: [
      "no_secret",
      "no_provider_call",
      "no_deploy",
      "no_evidence_tampering",
      "no_approval_forging",
      "presentation_and_guidance_only",
    ],
    scenarioLineCandidates: candidates.length > 0 ? candidates : [
      "I can explain this safely and keep it dry-run only.",
    ],
    canonReferences: canonMap
      .filter((item) => item.scenarioId === scenarioId || item.emotionState === input.emotionState)
      .map((item) => item.canonReference)
      .flat()
      .slice(0, 6),
    memoryType: "character_persona_memory_only",
    storesUserSensitiveMemory: false,
    hiddenSystemPromptUsed: false,
  };
}
