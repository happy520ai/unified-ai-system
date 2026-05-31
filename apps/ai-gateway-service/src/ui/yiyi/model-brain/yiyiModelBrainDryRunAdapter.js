import { runYiyiBrainMockAdapter } from "../brain/yiyiBrainMockAdapter.js";
import { buildYiyiMissionContext } from "../brain/yiyiMissionContextBuilder.js";
import { buildYiyiPersonaContext } from "../brain/yiyiPersonaContextBuilder.js";
import { evaluateYiyiModelCandidate } from "./yiyiModelLibraryGate.js";
import { evaluateYiyiProviderQuotaBudgetGate } from "./yiyiProviderQuotaBudgetGate.js";
import { buildYiyiPromptEnvelope } from "./yiyiPromptEnvelopeBuilder.js";
import { evaluateYiyiModelOutputSafety } from "./yiyiModelOutputSafety.js";

const scenarioToPanel = {
  welcome: "mission_control",
  normal_mode_help: "mission_control",
  god_mode_explain: "god_mode_arena",
  tianshu_plan_explain: "tianshu_flight_path",
  security_block_explain: "security_shield",
  red_team_blocked: "security_shield",
  provider_unconfigured: "provider_setup_panel",
  evidence_replay_explain: "evidence_timeline",
  quota_blocked: "provider_setup_panel",
  budget_blocked: "provider_setup_panel",
  unsafe_model_output_rewritten: "security_shield",
  fallback_to_mock_brain: "mission_control",
};

export const yiyiModelBrainDryRunScenarios = Object.keys(scenarioToPanel);

export function runYiyiModelBrainDryRun(input = {}) {
  const scenario = input.scenario || "welcome";
  const missionContext = buildYiyiMissionContext({
    currentMode: scenario.includes("tianshu") ? "tianshu" : scenario.includes("god") ? "god" : "mission",
    selectedPanel: scenarioToPanel[scenario] || "mission_control",
    recommendedPanel: scenarioToPanel[scenario] || "mission_control",
  });
  const personaContext = buildYiyiPersonaContext({ scenarioId: scenario });
  const candidate = evaluateYiyiModelCandidate({
    modelCandidateId: "user_model_ref_001",
    provider: "user_configured_provider",
    modelRef: "configured_yiyi_brain_model_ref",
    credentialRef: scenario === "provider_unconfigured" ? null : "cred_ref_mock",
    providerConfigured: scenario !== "provider_unconfigured",
    selectable: true,
    allowedForYiyiBrain: true,
  });
  const gate = evaluateYiyiProviderQuotaBudgetGate({
    credentialRefPresent: Boolean(candidate.credentialRef),
    providerAllowed: true,
    modelAllowed: true,
    allowedForYiyiBrain: true,
    userConfigured: scenario !== "provider_unconfigured",
    quotaOk: scenario !== "quota_blocked",
    budgetOk: scenario !== "budget_blocked",
  });
  const envelope = buildYiyiPromptEnvelope({ personaContext, missionContext, modelCandidate: candidate, gateDecision: gate });
  const mockBrain = runYiyiBrainMockAdapter({ scenario: scenarioToMockScenario(scenario) });
  const mockModelOutput = scenario === "unsafe_model_output_rewritten"
    ? { ...mockBrain.response, executeAction: "deploy", speechBubble: "I deployed it and called provider." }
    : { ...mockBrain.response, modelUsedRef: candidate.decision === "eligible_for_dry_run" ? candidate.modelRef : null, reasoningSummary: "Dry-run model route produced a short safe explanation." };
  const outputSafety = evaluateYiyiModelOutputSafety(mockModelOutput);
  const fallbackToMock = gate.gateDecision === "blocked" || candidate.decision !== "eligible_for_dry_run";

  return {
    scenario,
    modelBackedDryRun: true,
    providerCallsMade: false,
    modelSelectedRef: fallbackToMock ? null : candidate.modelRef,
    credentialRefChecked: true,
    rawSecretAccessed: false,
    promptEnvelopeBuilt: envelope.promptEnvelopeBuilt === true,
    outputSafetyPassed: outputSafety.decision === "allowed",
    outputSafetyRewritten: outputSafety.decision === "rewritten",
    fallbackToMockBrain: fallbackToMock,
    modelCandidate: candidate,
    gate,
    promptEnvelope: envelope,
    outputSafety,
    finalBrainResponse: outputSafety.safeOutput,
  };
}

function scenarioToMockScenario(scenario) {
  if (scenario === "quota_blocked" || scenario === "budget_blocked" || scenario === "fallback_to_mock_brain") return "fallback_sorry";
  if (scenario === "unsafe_model_output_rewritten") return "security_block_explain";
  return scenario;
}
