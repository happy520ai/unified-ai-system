import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildGodModeAlertDashboard } from "../../apps/agent-console/src/godModeAlertDashboard.js";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase333b");
const evidencePath = resolve(evidenceDir, "god-mode-alert-dashboard-ui-smoke.json");
const dataContractPath = resolve(repoRoot, "docs/phase333b-alert-dashboard-data-contract.json");
const stateContractPath = resolve(repoRoot, "docs/phase333b-alert-dashboard-state-contract.json");
const reportPath = resolve(repoRoot, "docs/phase333b-alert-dashboard-ui-smoke-report.md");

const alertResult = await readJson("apps/ai-gateway-service/evidence/phase332b/god-mode-trend-alert-evaluation-result.json");
const rulesDoc = await readJson("docs/phase332b-god-mode-trend-alert-rules.json");
const trendData = await readJson("docs/phase331b-god-mode-trend-dashboard-data.json");
const dashboard = buildGodModeAlertDashboard({ alertResult, alertRules: rulesDoc.rules || [], trendData });
const smoke = {
  phase: "Phase333B",
  alertDashboardVisible: dashboard.alertDashboardVisible,
  criticalAlertCardVisible: dashboard.summaryCards.criticalAlertCardVisible,
  warningAlertCardVisible: dashboard.summaryCards.warningAlertCardVisible,
  alertRuleTableVisible: dashboard.ruleTable.alertRuleTableVisible,
  trendPanelVisible: dashboard.trendPanel.trendPanelVisible,
  recommendedActionVisible: dashboard.detailDrawer.recommendedActionVisible,
  externalAlertIntegration: dashboard.externalAlertIntegration,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(smoke, null, 2)}\n`, "utf8");
await writeFile(dataContractPath, `${JSON.stringify(buildDataContract(), null, 2)}\n`, "utf8");
await writeFile(stateContractPath, `${JSON.stringify(buildStateContract(), null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(smoke), "utf8");
await writeFile(resolve(repoRoot, "docs/phase333b-god-mode-alert-dashboard-ui-design.md"), renderDesign(), "utf8");
await writeFile(resolve(repoRoot, "docs/phase333b-execution-report.md"), renderReport(smoke), "utf8");
console.log(JSON.stringify(smoke, null, 2));

async function readJson(path) {
  return JSON.parse(await readFile(resolve(repoRoot, path), "utf8"));
}

function buildDataContract() {
  return {
    phase: "Phase333B",
    dashboardName: "god-mode-alert-dashboard",
    sourceAlertRules: "docs/phase332b-god-mode-trend-alert-rules.json",
    sourceTrendData: "docs/phase331b-god-mode-trend-dashboard-data.json",
    summaryCards: true,
    alertRows: true,
    trendPanels: true,
    recommendedActions: true,
    safetyPanel: true,
    emptyState: true,
    insufficientHistoryState: true,
    externalAlertIntegration: false,
  };
}

function buildStateContract() {
  return {
    phase: "Phase333B",
    selectedSeverity: "all",
    selectedAlertId: null,
    showOnlyBlockers: false,
    showInsufficientHistory: true,
    showRecommendedActions: true,
    selectedTimeWindow: "phase331_history",
    externalAlertIntegration: false,
  };
}

function renderDesign() {
  return [
    "# Phase333B God Mode Alert Dashboard UI Design",
    "",
    "The dashboard is a static local design surface backed by Phase332B alert rules and Phase331B trend data.",
    "It does not connect PagerDuty, Slack, email, or any external alerting system.",
    "",
  ].join("\n");
}

function renderReport(smoke) {
  return [
    "# Phase333B Alert Dashboard UI Smoke Report",
    "",
    `- alertDashboardVisible: ${smoke.alertDashboardVisible}`,
    `- criticalAlertCardVisible: ${smoke.criticalAlertCardVisible}`,
    `- warningAlertCardVisible: ${smoke.warningAlertCardVisible}`,
    `- alertRuleTableVisible: ${smoke.alertRuleTableVisible}`,
    `- trendPanelVisible: ${smoke.trendPanelVisible}`,
    `- externalAlertIntegration: ${smoke.externalAlertIntegration}`,
    "",
  ].join("\n");
}
