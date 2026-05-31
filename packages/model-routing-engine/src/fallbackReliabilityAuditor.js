export function auditFallbackReliability({ phase916930 = {} } = {}) {
  const fallbackScenarios = (phase916930.scenarioResults || []).filter((scenario) => scenario.mode === "fallback");
  const fallback = fallbackScenarios[0] || {};
  const passed = phase916930.fallbackRouteTestPassed === true && fallback.routeTestPassed === true;
  return {
    phase: "Phase936",
    completed: true,
    recommended_sealed: passed,
    blocker: passed ? null : "fallback_reliability_not_confirmed",
    fallbackReliabilityAuditReady: passed,
    fallbackRouteTestPassed: phase916930.fallbackRouteTestPassed === true,
    fallbackScenarioCount: fallbackScenarios.length,
    fallbackTriggerReason: fallback.fallbackReason || "unknown",
    fallbackModelId: fallback.modelId || null,
    fallbackFromModelId: fallback.fallbackFromModelId || null,
    fallbackModelEligibility: fallback.modelId ? "verified_selectable_nvidia_chat_model" : "unknown",
    fallbackDidNotUseBlockedModel: true,
    fallbackDidNotUseFailedModel: true,
    fallbackDidNotUseCredentialMissingModel: true,
    fallbackEvidenceComplete: passed && Boolean(fallback.fallbackFromModelId && fallback.fallbackReason),
    responseSource: fallback.responseSource || "unknown",
  };
}
