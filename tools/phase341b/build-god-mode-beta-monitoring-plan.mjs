import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase341b");
const resultPath = resolve(evidenceDir, "god-mode-beta-monitoring-plan-result.json");
const planPath = resolve(repoRoot, "docs/phase341b-god-mode-beta-monitoring-plan.json");
const reportPath = resolve(repoRoot, "docs/phase341b-execution-report.md");

const readiness = JSON.parse(await readFile(resolve(repoRoot, "docs/phase340b-god-mode-beta-monitoring-readiness.json"), "utf8"));

const plan = {
  phase: "Phase341B",
  betaMonitoringReady: readiness.betaMonitoringReady === true,
  alertEscalationDryRunOnly: true,
  externalAlertIntegration: false,
  autoNotificationEnabled: false,
  escalationPolicy: [
    "internal_review_note",
    "manual_regression_rerun",
    "freeze_cohort_expansion",
  ],
};

const result = {
  phase: "Phase341B",
  betaMonitoringReady: plan.betaMonitoringReady,
  alertEscalationDryRunOnly: true,
  productionGA: false,
  externalAlertIntegration: false,
  secretValueExposed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReport(current) {
  return [
    "# Phase341B Execution Report",
    "",
    `- betaMonitoringReady: ${current.betaMonitoringReady}`,
    `- alertEscalationDryRunOnly: ${current.alertEscalationDryRunOnly}`,
    "",
  ].join("\n");
}
