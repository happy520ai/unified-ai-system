export function buildGodModeAlertSummaryCards(alertResult = {}) {
  return {
    criticalAlertCardVisible: true,
    warningAlertCardVisible: true,
    blockerDetected: alertResult.blockerDetected === true,
    criticalAlerts: Number(alertResult.criticalAlerts || 0),
    warningAlerts: Number(alertResult.warningAlerts || 0),
    alertsTriggered: Number(alertResult.alertsTriggered || 0),
  };
}
