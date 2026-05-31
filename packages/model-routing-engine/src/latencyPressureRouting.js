export function applyLatencyPressureRouting(candidates = [], pressure = {}) {
  const highLatencyPressure = pressure.latencyPressure === "high";
  return candidates.map((candidate) => ({
    ...candidate,
    pressureAdjustments: {
      ...(candidate.pressureAdjustments || {}),
      latency: highLatencyPressure && candidate.roles?.includes("fast_chat") ? 10 : highLatencyPressure ? -2 : 0,
    },
  }));
}
