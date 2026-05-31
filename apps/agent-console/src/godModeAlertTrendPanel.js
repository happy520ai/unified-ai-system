export function buildGodModeAlertTrendPanel(trendData = {}) {
  return {
    trendPanelVisible: true,
    trendStatus: trendData.trendStatus,
    insufficientHistory: trendData.trendStatus === "insufficient_history",
    qualityScoreTrend: trendData.trends?.qualityTrend || "unknown",
    conflictResolutionTrend: trendData.trends?.conflictResolutionTrend || "unknown",
    fallbackSpikeStatus: trendData.trends?.fallbackTrend || "unknown",
    latencyRegressionStatus: trendData.trends?.latencyTrend || "unknown",
    costEstimateSpikeStatus: trendData.trends?.costTrend || "unknown",
  };
}
