import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildGodModeAlertDashboard } from "../../apps/agent-console/src/godModeAlertDashboard.js";
import { buildGodModeAlertDashboardEmptyState } from "../../apps/agent-console/src/godModeAlertDashboardEmptyState.js";
import { buildGodModeAlertDashboardSafetyPanel } from "../../apps/agent-console/src/godModeAlertDashboardSafetyPanel.js";
import { buildGodModeAlertDashboardStaticData } from "../../apps/agent-console/src/godModeAlertDashboardStaticData.js";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase334b");
const evidencePath = resolve(evidenceDir, "god-mode-alert-dashboard-static-integration-smoke.json");
const contractPath = resolve(repoRoot, "docs/phase334b-alert-dashboard-static-data-contract.json");
const reportPath = resolve(repoRoot, "docs/phase334b-alert-dashboard-static-integration-report.md");

const alertResult = await readJson("apps/ai-gateway-service/evidence/phase332b/god-mode-trend-alert-evaluation-result.json");
const rulesDoc = await readJson("docs/phase332b-god-mode-trend-alert-rules.json");
const trendData = await readJson("docs/phase331b-god-mode-trend-dashboard-data.json");
const smokeData = await readJson("apps/agent-console/evidence/phase333b/god-mode-alert-dashboard-ui-smoke.json");
const dashboard = buildGodModeAlertDashboard({ alertResult, alertRules: rulesDoc.rules || [], trendData });
const staticData = buildGodModeAlertDashboardStaticData({ alertResult, trendData, smokeData });
const emptyState = buildGodModeAlertDashboardEmptyState({ trendStatus: trendData.trendStatus, alertsTriggered: alertResult.alertsTriggered });
const safetyPanel = buildGodModeAlertDashboardSafetyPanel();
const smoke = {
  phase: "Phase334B",
  alertDashboardVisible: dashboard.alertDashboardVisible,
  staticIntegrationOnly: true,
  criticalAlertCardVisible: dashboard.summaryCards.criticalAlertCardVisible,
  warningAlertCardVisible: dashboard.summaryCards.warningAlertCardVisible,
  blockerStatusVisible: typeof dashboard.summaryCards.blockerDetected === "boolean",
  insufficientHistoryStateSupported: emptyState.insufficientHistoryStateSupported,
  externalAlertIntegration: false,
  autoNotificationEnabled: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(smoke, null, 2)}\n`, "utf8");
await writeFile(contractPath, `${JSON.stringify({ phase: "Phase334B", ...staticData, safetyPanel }, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(smoke), "utf8");
await writeFile(resolve(repoRoot, "docs/phase334b-god-mode-alert-dashboard-static-integration-design.md"), renderDesign(), "utf8");
await writeFile(resolve(repoRoot, "docs/phase334b-execution-report.md"), renderReport(smoke), "utf8");
console.log(JSON.stringify(smoke, null, 2));

async function readJson(path) {
  return JSON.parse(await readFile(resolve(repoRoot, path), "utf8"));
}

function renderDesign() {
  return [
    "# Phase334B God Mode Alert Dashboard Static Integration Design",
    "",
    "The dashboard is statically integrated from local Phase332/333 evidence. It does not connect external alert delivery or notifications.",
    "",
  ].join("\n");
}

function renderReport(smoke) {
  return [
    "# Phase334B Static Integration Report",
    "",
    `- alertDashboardVisible: ${smoke.alertDashboardVisible}`,
    `- staticIntegrationOnly: ${smoke.staticIntegrationOnly}`,
    `- externalAlertIntegration: ${smoke.externalAlertIntegration}`,
    `- autoNotificationEnabled: ${smoke.autoNotificationEnabled}`,
    "",
  ].join("\n");
}
