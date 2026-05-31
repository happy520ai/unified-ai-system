export function buildGodModeAlertDashboardStaticData({ alertResult = {}, trendData = {}, smokeData = {} } = {}) {
  return {
    sourceAlertRules: "docs/phase332b-god-mode-trend-alert-rules.json",
    sourceTrendData: "docs/phase331b-god-mode-trend-dashboard-data.json",
    sourceSmokeData: "apps/agent-console/evidence/phase333b/god-mode-alert-dashboard-ui-smoke.json",
    staticFallbackData: {
      criticalAlerts: Number(alertResult.criticalAlerts || 0),
      warningAlerts: Number(alertResult.warningAlerts || 0),
      blockerDetected: alertResult.blockerDetected === true,
      trendStatus: trendData.trendStatus || "unknown",
      alertDashboardVisible: smokeData.alertDashboardVisible === true,
    },
    externalAlertIntegration: false,
    autoNotificationEnabled: false,
    dashboardRuntimeStatus: "static_integration",
  };
}
