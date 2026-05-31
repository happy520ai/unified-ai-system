export function collectThreeModeMetrics(telemetryItems = []) {
  const items = Array.isArray(telemetryItems) ? telemetryItems : [];
  return {
    totalRequests: items.length,
    providerCallCount: items.filter((item) => item.providerCallsMade).length,
    nonNvidiaProviderCallCount: items.filter((item) => item.nonNvidiaProviderCallsMade).length,
    fallbackCount: items.filter((item) => item.fallbackUsed).length,
    secretExposureCount: items.filter((item) => item.secretValueExposed).length,
    unauthorizedProviderCallCount: items.filter((item) => item.nonNvidiaProviderCallsMade && !item.credentialGateDecision?.allowed).length,
    p95LatencyMs: percentile(items.map((item) => item.latencyMs), 0.95),
    averageEstimatedCost: average(items.map((item) => item.estimatedCost).filter((value) => Number.isFinite(Number(value)))),
    modes: countBy(items, "mode"),
  };
}

function percentile(values, ratio) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function average(values) {
  if (!values.length) return 0;
  return Math.round((values.reduce((sum, item) => sum + Number(item), 0) / values.length) * 100000) / 100000;
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = String(item[key] || "unknown");
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}
