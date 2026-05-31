import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase340b");
const resultPath = resolve(evidenceDir, "god-mode-alerting-closure-report-result.json");
const readinessPath = resolve(repoRoot, "docs/phase340b-god-mode-beta-monitoring-readiness.json");
const reportPath = resolve(repoRoot, "docs/phase340b-execution-report.md");

const phase339b = JSON.parse(await readFile(resolve(repoRoot, "apps/agent-console/evidence/phase339b/god-mode-alert-dashboard-static-regression-result.json"), "utf8"));

const readiness = {
  phase: "Phase340B",
  betaMonitoringReady: phase339b.staticRegressionPassed === true && phase339b.externalAlertIntegration === false,
  externalAlertIntegration: false,
  autoNotificationEnabled: false,
  staticDashboardRegressionPassed: phase339b.staticRegressionPassed === true,
};

const result = {
  phase: "Phase340B",
  closureReportsGenerated: true,
  betaMonitoringReady: readiness.betaMonitoringReady,
  productionGA: false,
  externalAlertIntegration: false,
  secretValueExposed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(readinessPath, `${JSON.stringify(readiness, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReport(current) {
  return [
    "# Phase340B Execution Report",
    "",
    `- closureReportsGenerated: ${current.closureReportsGenerated}`,
    `- betaMonitoringReady: ${current.betaMonitoringReady}`,
    "",
  ].join("\n");
}
