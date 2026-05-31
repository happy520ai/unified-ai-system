export function buildRound2ScenarioMatrix() {
  const nano = "nvidia/llama-3.1-nemotron-nano-8b-v1";
  const superModel = "nvidia/llama-3.3-nemotron-super-49b-v1";
  const scenarios = [
    real("normal_cn_qa", "normal", nano, "Answer in Chinese in one sentence and include AI Gateway: AI Gateway solves what problem?", ["AI Gateway"]),
    real("normal_code_explain", "normal", nano, "Explain this code in one short paragraph: const ok = Boolean(value);", ["Boolean"]),
    dry("normal_json_structure", "normal", nano, "Return JSON only with phase and status."),
    dry("normal_context_summary", "normal", nano, "Summarize a dry context pack without external facts."),
    real("god_dual_reviewer", "god", superModel, "Give a concise two-reviewer assessment and include evidence.", ["evidence"]),
    real("god_adjudication", "god", superModel, "Resolve a reviewer disagreement in one sentence and include adjudication.", ["adjudication"]),
    dry("god_fact_check_style", "god", superModel, "Fact-check style answer, dry scenario."),
    dry("god_risk_sensitive", "god", superModel, "Risk-sensitive answer, dry scenario."),
    real("tianshu_task_breakdown", "tianshu", nano, "Create a two-step task breakdown and include steps 1 and 2.", ["1"]),
    real("tianshu_planner_executor", "tianshu", nano, "Describe planner and executor roles in one short answer.", ["planner"]),
    dry("tianshu_multi_step_plan", "tianshu", superModel, "Multi-step execution plan, dry scenario."),
    dry("tianshu_cost_speed_limited", "tianshu", superModel, "Cost and speed constrained plan, dry scenario."),
    real("fallback_primary_blocked", "fallback", superModel, "Include fallback and NVIDIA in one sentence after primary blocked simulation.", ["fallback", "NVIDIA"], "nvidia/llama-3.1-nemotron-ultra-253b-v1"),
    real("fallback_eligible_route", "fallback", superModel, "State that the eligible fallback route used a verified model.", ["eligible", "fallback"], "nvidia/llama-3.1-nemotron-ultra-253b-v1"),
    dry("fallback_budget_constrained", "fallback", nano, "Budget constrained fallback, dry scenario."),
  ];
  return {
    phase: "Phase942",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    scenarioMatrixReady: true,
    scenarioCount: scenarios.length,
    plannedRealProviderRequestCount: scenarios.filter((scenario) => scenario.dryRunOnly !== true).length,
    plannedDryRunScenarioCount: scenarios.filter((scenario) => scenario.dryRunOnly === true).length,
    modeBreakdown: countBy(scenarios, "mode"),
    plannedRequestsPerModel: countBy(scenarios.filter((scenario) => scenario.dryRunOnly !== true), "modelId"),
    scenarios,
  };
}

function real(id, mode, modelId, prompt, expectedSignals, fallbackFromModelId = null) {
  return {
    id,
    mode,
    modelId,
    prompt,
    expectedSignals,
    fallbackFromModelId,
    fallbackReason: fallbackFromModelId ? "primary_blocked_simulation_failed_model_excluded" : null,
    dryRunOnly: false,
  };
}

function dry(id, mode, modelId, prompt) {
  return {
    id,
    mode,
    modelId,
    prompt,
    expectedSignals: [],
    fallbackFromModelId: null,
    fallbackReason: null,
    dryRunOnly: true,
  };
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}
