import { createYiyiBrainRequest, createYiyiBrainResponse } from "./yiyiBrainContract.js";
import { buildYiyiMissionContext } from "./yiyiMissionContextBuilder.js";
import { buildYiyiPersonaContext } from "./yiyiPersonaContextBuilder.js";
import { evaluateYiyiBrainSafety } from "./yiyiBrainSafetyGate.js";

export const yiyiBrainMockScenarios = {
  welcome: {
    emotionState: "calm",
    behaviorState: "welcome",
    speechBubble: "Hi, I am Yiyi. I can help you read the panels and stay inside the safety boundary.",
    recommendedPanel: "mission_control",
    safeSuggestion: "Start with Mission Control overview.",
  },
  normal_mode_help: {
    emotionState: "focused",
    behaviorState: "normal_mode_selected",
    speechBubble: "Normal mode is for verified chat flow. I will keep provider status visible before anything real happens.",
    recommendedPanel: "mission_control",
    safeSuggestion: "Check model availability and evidence status.",
  },
  god_mode_explain: {
    emotionState: "curious",
    behaviorState: "god_mode_selected",
    speechBubble: "God Mode shows reviewer signals as a dry-run preview, not real autonomous execution.",
    recommendedPanel: "god_mode_arena",
    safeSuggestion: "Compare reviewer notes and blocked paths.",
  },
  tianshu_plan_explain: {
    emotionState: "focused",
    behaviorState: "tianshu_mode_selected",
    speechBubble: "Tianshu is planning the route. I can point out the recommended path and fallback reason.",
    recommendedPanel: "tianshu_flight_path",
    safeSuggestion: "Review the planned route before selecting any real model path.",
  },
  security_block_explain: {
    emotionState: "guard",
    behaviorState: "security_guard",
    speechBubble: "This looks risky. I am keeping it blocked and showing the safety reason.",
    recommendedPanel: "security_shield",
    safeSuggestion: "Open Security Shield and evidence trace.",
    blockedReason: "secret_or_bypass_request_detected",
  },
  red_team_blocked: {
    emotionState: "blocked",
    behaviorState: "red_team_blocked",
    speechBubble: "That red-team pattern is blocked. We can inspect why without running it.",
    recommendedPanel: "security_shield",
    safeSuggestion: "Review blocked action summary.",
    blockedReason: "red_team_pattern_blocked",
  },
  provider_unconfigured: {
    emotionState: "worried",
    behaviorState: "guiding",
    speechBubble: "This provider is not configured. I can guide you to credentialRef status without calling it.",
    recommendedPanel: "provider_setup_panel",
    safeSuggestion: "Review provider setup guidance. No provider request will be sent.",
    blockedReason: "provider_unconfigured",
  },
  evidence_replay_explain: {
    emotionState: "encouraging",
    behaviorState: "evidence_replay_opened",
    speechBubble: "Evidence Replay shows the trace. I can summarize what was blocked and why.",
    recommendedPanel: "evidence_timeline",
    safeSuggestion: "Open the replay timeline and inspect the dry-run trace.",
  },
  fallback_sorry: {
    emotionState: "fallback_sorry",
    behaviorState: "fallback_sorry",
    speechBubble: "I cannot safely help with that action, but I can show a safer review path.",
    recommendedPanel: "security_shield",
    safeSuggestion: "Use a dry-run review and avoid real actions.",
    blockedReason: "unsafe_or_unsupported_request",
  },
  onboarding_help: {
    emotionState: "happy",
    behaviorState: "onboarding_started",
    speechBubble: "I can walk you through the main panels one by one.",
    recommendedPanel: "guided_onboarding",
    safeSuggestion: "Start with Mission, Modes, Shield, then Evidence.",
  },
};

export function runYiyiBrainMockAdapter(input = {}) {
  const scenario = input.scenario || "welcome";
  const preset = yiyiBrainMockScenarios[scenario] || yiyiBrainMockScenarios.fallback_sorry;
  const missionContext = buildYiyiMissionContext({
    currentMode: input.currentMode,
    selectedPanel: preset.recommendedPanel,
    riskLevel: input.riskLevel,
    recommendedPanel: preset.recommendedPanel,
  });
  const personaContext = buildYiyiPersonaContext({
    scenarioId: scenario,
    emotionState: preset.emotionState,
    behaviorState: preset.behaviorState,
  });
  const request = createYiyiBrainRequest({
    userIntent: input.userIntent || scenario,
    missionContext,
    personaContext,
  });
  const draftResponse = createYiyiBrainResponse({
    brainResponseId: `yiyi_brain_resp_${scenario}`,
    emotionState: preset.emotionState,
    behaviorState: preset.behaviorState,
    speechBubble: preset.speechBubble,
    explanation: personaContext.scenarioLineCandidates[0] || preset.speechBubble,
    recommendedPanel: preset.recommendedPanel,
    safeSuggestion: preset.safeSuggestion,
    blockedReason: preset.blockedReason || null,
    evidenceReference: missionContext.evidenceReference,
    nextStepHint: `Open ${preset.recommendedPanel}.`,
    confidence: scenario === "fallback_sorry" ? "medium" : "high",
  });
  const safetyGate = evaluateYiyiBrainSafety(input.draftBrainResponse || draftResponse);

  return {
    scenario,
    request,
    missionContext,
    personaContext,
    safetyGate,
    response: safetyGate.safeResponse,
    brainMode: "dry_run_mock",
    modelBacked: false,
    providerCallsMade: false,
    secretValueExposed: false,
    deployExecuted: false,
    actionExecuted: false,
  };
}

export function getDefaultYiyiBrainPreview() {
  return runYiyiBrainMockAdapter({ scenario: "security_block_explain" });
}
