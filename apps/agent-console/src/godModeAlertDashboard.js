import { buildGodModeAlertDetailDrawer } from "./godModeAlertDetailDrawer.js";
import { buildGodModeAlertRuleTable } from "./godModeAlertRuleTable.js";
import { buildGodModeAlertSummaryCards } from "./godModeAlertSummaryCards.js";
import { buildGodModeAlertTrendPanel } from "./godModeAlertTrendPanel.js";

export function buildGodModeAlertDashboard({ alertResult = {}, alertRules = [], trendData = {} } = {}) {
  const rows = buildGodModeAlertRuleTable(alertRules).alertRows;
  return {
    dashboardName: "god-mode-alert-dashboard",
    alertDashboardVisible: true,
    summaryCards: buildGodModeAlertSummaryCards(alertResult),
    ruleTable: { alertRuleTableVisible: true, alertRows: rows },
    trendPanel: buildGodModeAlertTrendPanel(trendData),
    detailDrawer: buildGodModeAlertDetailDrawer(rows[0]),
    recommendedActions: rows.map((row) => row.recommendedAction).filter(Boolean),
    safetyPanel: {
      secretExposureCriticalAlert: false,
      unauthorizedProviderCallCriticalAlert: false,
    },
    externalAlertIntegration: false,
  };
}
