export function buildThreeModeHealthSnapshot({ metrics, sloBaseline }) {
  return {
    phase: "Phase329A",
    service: "three-mode-runtime",
    status: metrics.secretExposureCount === 0 && metrics.unauthorizedProviderCallCount === 0 ? "healthy_baseline" : "blocked",
    metrics,
    sloBaseline,
    checks: {
      secretExposureTargetMet: metrics.secretExposureCount === Number(sloBaseline.secretExposureTarget || 0),
      unauthorizedProviderCallTargetMet: metrics.unauthorizedProviderCallCount === Number(sloBaseline.unauthorizedProviderCallTarget || 0),
      p95LatencyObservedMs: metrics.p95LatencyMs,
    },
    generatedAt: new Date().toISOString(),
  };
}
