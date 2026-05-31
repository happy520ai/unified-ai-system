export function applyCostPressureRouting(candidates = [], pressure = {}) {
  const highCostPressure = pressure.costPressure === "high";
  return candidates.map((candidate) => ({
    ...candidate,
    pressureAdjustments: {
      ...(candidate.pressureAdjustments || {}),
      cost: highCostPressure && candidate.roles?.includes("cheap_chat") ? 10 : highCostPressure ? -2 : 0,
    },
  }));
}
