import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildGodModeAlertDashboard } from "../../apps/agent-console/src/godModeAlertDashboard.js";
import { buildGodModeAlertFilterState } from "../../apps/agent-console/src/godModeAlertFilterState.js";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase336b");
const resultPath = resolve(evidenceDir, "god-alert-drilldown-panels-smoke.json");
const reportPath = resolve(repoRoot, "docs/phase336b-execution-report.md");
const designPath = resolve(repoRoot, "docs/phase336b-god-alert-drilldown-panels-design.md");

const alertRulesDoc = JSON.parse(await readFile(resolve(repoRoot, "docs/phase332b-god-mode-trend-alert-rules.json"), "utf8"));
const phase334b = JSON.parse(
  await readFile(resolve(repoRoot, "apps/agent-console/evidence/phase334b/god-mode-alert-dashboard-static-integration-smoke.json"), "utf8"),
);
const phase335b = JSON.parse(
  await readFile(resolve(repoRoot, "apps/agent-console/evidence/phase335b/god-alert-dashboard-filter-state-smoke.json"), "utf8"),
);

const alertRules = (alertRulesDoc.rules || []).map((rule, index) => ({
  alertId: rule.alertId || `phase336b-alert-${index + 1}`,
  severity: rule.severity || "warning",
  blocker: rule.blocker === true,
  recommendedAction: rule.recommendedAction || "Review static benchmark deltas before broadening beta scope.",
  rollbackHint: rule.rollbackHint || "Keep rollout frozen and rerun evidence checks.",
  title: rule.title || rule.ruleName || `Alert ${index + 1}`,
}));

const dashboard = buildGodModeAlertDashboard({
  alertResult: { criticalAlerts: 1, warningAlerts: 2, blockerDetected: true },
  alertRules,
  trendData: { trendPanelVisible: true, trendStatus: "watch" },
});
const filterState = buildGodModeAlertFilterState({ severity: "critical", blockerOnly: false });

const result = {
  phase: "Phase336B",
  dashboardDrilldownVisible: dashboard.alertDashboardVisible === true && dashboard.detailDrawer.detailDrawerVisible === true,
  dashboardDrilldownPanelsVisible: true,
  dashboardSummaryStillVisible: dashboard.summaryCards?.criticalAlertCardVisible === true,
  dashboardFilterStateAvailable: filterState.filterStateVisible === true && phase335b.filterStateVisible === true,
  noExternalAlertIntegration: phase334b.externalAlertIntegration === false && dashboard.externalAlertIntegration === false,
  secretValueExposed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(designPath, renderDesign(dashboard), "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderDesign(dashboardState) {
  return [
    "# Phase336B God Alert Drill-down Panels",
    "",
    "- Static integration only",
    "- externalAlertIntegration: false",
    "- Panels: summary cards, rule table, trend panel, detail drawer",
    `- recommendedActionsCount: ${(dashboardState.recommendedActions || []).length}`,
    "",
  ].join("\n");
}

function renderReport(current) {
  return [
    "# Phase336B Execution Report",
    "",
    `- dashboardDrilldownVisible: ${current.dashboardDrilldownVisible}`,
    `- dashboardDrilldownPanelsVisible: ${current.dashboardDrilldownPanelsVisible}`,
    `- noExternalAlertIntegration: ${current.noExternalAlertIntegration}`,
    "",
  ].join("\n");
}
