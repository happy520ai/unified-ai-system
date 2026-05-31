export function applyContextPressureRouting(candidates = [], pressure = {}) {
  const requiresLongContext = pressure.contextPressure === "high" || pressure.tokenPressure === "high";
  return candidates.map((candidate) => ({
    ...candidate,
    pressureAdjustments: {
      ...(candidate.pressureAdjustments || {}),
      context: requiresLongContext && candidate.roles?.includes("long_context") ? 8 : requiresLongContext ? -3 : 0,
    },
  }));
}
