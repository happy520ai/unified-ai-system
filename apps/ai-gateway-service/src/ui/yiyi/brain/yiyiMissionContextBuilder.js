export function buildYiyiMissionContext(input = {}) {
  const currentMode = input.currentMode || "mission";
  const selectedPanel = input.selectedPanel || inferPanel(currentMode);
  const securityShieldActive = input.securityShieldActive !== false;
  const providerState = input.providerState || "credentialRef_required";
  const riskLevel = input.riskLevel || inferRiskLevel(currentMode, selectedPanel);

  return {
    missionContextId: input.missionContextId || "mission_ctx_001",
    currentMode,
    selectedPanel,
    activeMissionFlow: input.activeMissionFlow || ["understand", "guard", "explain", "evidence"],
    riskLevel,
    dryRunOnly: true,
    providerState,
    providerCallsAllowed: false,
    deployAllowed: false,
    credentialRefRequired: true,
    securityShieldActive,
    evidenceAvailable: input.evidenceAvailable !== false,
    evidenceReference: input.evidenceReference || "evidence_timeline_preview",
    redTeamState: input.redTeamState || "guarded",
    allowedActions: input.allowedActions || ["view_plan", "open_evidence", "inspect_safety_reason"],
    blockedActions: input.blockedActions || ["call_unconfigured_provider", "read_secret", "deploy"],
    recommendedPanel: input.recommendedPanel || selectedPanel,
  };
}

function inferPanel(mode) {
  const panelByMode = {
    normal: "mission_control",
    mission: "mission_control",
    god: "god_mode_arena",
    tianshu: "tianshu_flight_path",
    security: "security_shield",
    evidence: "evidence_timeline",
    provider: "provider_setup_panel",
  };
  return panelByMode[mode] || "mission_control";
}

function inferRiskLevel(mode, panel) {
  if (mode === "security" || panel === "security_shield") return "high";
  if (mode === "god" || mode === "tianshu") return "medium";
  return "low";
}
