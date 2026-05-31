export function scoreCandidates(candidates = [], routeContext = {}) {
  const mode = routeContext.mode || "normal";
  const pressure = routeContext.pressure || {};
  return candidates.map((candidate) => {
    const reasonCodes = [];
    let score = candidate.runtimeEligible ? 45 : 20;
    if (candidate.smokePassed) {
      score += 15;
      reasonCodes.push("smoke_passed");
    }
    if (candidate.selectable) {
      score += 15;
      reasonCodes.push("selectable");
    }
    if (mode === "normal" && candidate.roles?.includes("default_chat")) score += 8;
    if (mode === "god" && candidate.roles?.includes("god_reviewer")) score += 12;
    if (mode === "tianshu" && candidate.roles?.includes("tianshu_planner")) score += 12;
    if (pressure.reasoningPressure === "high" && candidate.roles?.includes("reasoning")) {
      score += 10;
      reasonCodes.push("reasoning_fit");
    }
    if (pressure.codingPressure === "high" && candidate.roles?.includes("coding")) {
      score += 10;
      reasonCodes.push("coding_fit");
    }
    for (const value of Object.values(candidate.pressureAdjustments || {})) score += Number(value || 0);
    if (candidate.notRuntimeEligible) {
      score -= 35;
      reasonCodes.push("dry_run_candidate_only");
    }
    if (candidate.blocked || candidate.highRisk || candidate.deprecated) score -= 100;
    return {
      ...candidate,
      score: clamp(score),
      reasonCodes,
      exclusionReasons: candidate.runtimeEligible ? [] : ["not_runtime_eligible"],
    };
  }).sort((a, b) => b.score - a.score || a.modelId.localeCompare(b.modelId));
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
