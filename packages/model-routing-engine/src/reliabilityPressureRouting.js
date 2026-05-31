export function applyReliabilityPressureRouting(candidates = [], pressure = {}) {
  const highReliabilityPressure = pressure.reliabilityPressure === "high";
  return candidates.map((candidate) => ({
    ...candidate,
    pressureAdjustments: {
      ...(candidate.pressureAdjustments || {}),
      reliability: highReliabilityPressure && candidate.evidenceId ? 8 : highReliabilityPressure ? -8 : 4,
    },
  }));
}
