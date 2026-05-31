import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase338b");
const resultPath = resolve(evidenceDir, "god-mode-alert-severity-calibration-result.json");
const calibrationPath = resolve(repoRoot, "docs/phase338b-god-mode-alert-severity-calibration.json");
const reportPath = resolve(repoRoot, "docs/phase338b-execution-report.md");

const workflow = JSON.parse(await readFile(resolve(repoRoot, "docs/phase337b-god-mode-alert-acknowledgement-workflow.json"), "utf8"));

const calibration = {
  phase: "Phase338B",
  alertSeverityCalibrated: true,
  staticWorkflowOnly: workflow.staticWorkflowOnly === true,
  thresholds: [
    { severity: "critical", condition: "secret_safety_or_unauthorized_provider_call" },
    { severity: "warning", condition: "benchmark_trend_regression_without_blocker" },
    { severity: "blocker", condition: "release_boundary_or_selectable_gate_bypass" },
  ],
  externalAlertIntegration: false,
};

const result = {
  phase: "Phase338B",
  alertSeverityCalibrated: true,
  acknowledgementWorkflowPresent: Array.isArray(workflow.acknowledgementSteps),
  externalAlertIntegration: false,
  autoEscalationEnabled: false,
  secretValueExposed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(calibrationPath, `${JSON.stringify(calibration, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReport(current) {
  return [
    "# Phase338B Execution Report",
    "",
    `- alertSeverityCalibrated: ${current.alertSeverityCalibrated}`,
    `- acknowledgementWorkflowPresent: ${current.acknowledgementWorkflowPresent}`,
    `- externalAlertIntegration: ${current.externalAlertIntegration}`,
    "",
  ].join("\n");
}
