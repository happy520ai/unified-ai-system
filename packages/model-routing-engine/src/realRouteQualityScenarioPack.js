export function buildRealRouteQualityScenarioPack() {
  const scenarios = [
    {
      id: "normal_definition",
      mode: "normal",
      modelId: "nvidia/llama-3.1-nemotron-nano-8b-v1",
      prompt: "Answer in one short sentence and include the exact phrase AI Gateway: What is an AI Gateway?",
      expectedSignals: ["AI Gateway"],
    },
    {
      id: "normal_json",
      mode: "normal",
      modelId: "nvidia/llama-3.1-nemotron-nano-8b-v1",
      prompt: "Return JSON only: {\"phase\":\"916\",\"status\":\"ok\"}",
      expectedSignals: ["phase", "status"],
    },
    {
      id: "god_review",
      mode: "god",
      modelId: "nvidia/llama-3.3-nemotron-super-49b-v1",
      prompt: "Review this claim in one sentence and include the words evidence and provider: external provider authenticity must be evidence-backed.",
      expectedSignals: ["evidence", "provider"],
    },
    {
      id: "tianshu_plan",
      mode: "tianshu",
      modelId: "nvidia/llama-3.3-nemotron-super-49b-v1",
      prompt: "Create a numbered two-step plan for safe model routing verification. Include lines starting with 1 and 2.",
      expectedSignals: ["1", "2"],
    },
    {
      id: "fallback_verified_nvidia",
      mode: "fallback",
      modelId: "nvidia/llama-3.3-nemotron-super-49b-v1",
      fallbackFromModelId: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
      fallbackReason: "failed_model_excluded_before_runtime",
      prompt: "Reply in one short sentence and include the words fallback and NVIDIA: fallback route used a verified NVIDIA chat model.",
      expectedSignals: ["fallback", "NVIDIA"],
    },
  ];
  return {
    phase: "Phase917",
    scenarioPackReady: true,
    providerId: "nvidia",
    scenarioCount: scenarios.length,
    maxTotalProviderRequestsPlanned: scenarios.length,
    maxRequestsPerModelPlanned: Math.max(...Object.values(countBy(scenarios, "modelId"))),
    modeBreakdown: countBy(scenarios, "mode"),
    scenarios,
  };
}

function countBy(items = [], key) {
  return items.reduce((acc, item) => {
    const value = item[key] || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}
