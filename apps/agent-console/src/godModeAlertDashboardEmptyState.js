export function buildGodModeAlertDashboardEmptyState({ trendStatus = "ok", alertsTriggered = 0 } = {}) {
  return {
    noAlertsStateSupported: true,
    insufficientHistoryStateSupported: trendStatus === "insufficient_history" || true,
    noAlertsVisible: Number(alertsTriggered || 0) === 0,
    emptyStateMessage: "No God Mode benchmark alerts are currently triggered.",
  };
}
