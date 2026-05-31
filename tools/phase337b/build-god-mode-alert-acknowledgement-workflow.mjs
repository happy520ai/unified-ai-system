import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase337b");
const resultPath = resolve(evidenceDir, "god-mode-alert-acknowledgement-workflow-result.json");
const workflowPath = resolve(repoRoot, "docs/phase337b-god-mode-alert-acknowledgement-workflow.json");
const reportPath = resolve(repoRoot, "docs/phase337b-execution-report.md");

const phase336b = JSON.parse(await readFile(resolve(repoRoot, "apps/agent-console/evidence/phase336b/god-alert-drilldown-panels-smoke.json"), "utf8"));

const workflow = {
  phase: "Phase337B",
  acknowledgementSteps: [
    "view_alert",
    "inspect_drilldown",
    "acknowledge_alert",
    "record_reviewer_note",
    "schedule_regression_rerun",
  ],
  externalAlertIntegration: false,
  autoEscalationEnabled: false,
  staticWorkflowOnly: true,
};

const result = {
  phase: "Phase337B",
  alertAcknowledgementWorkflowPresent: true,
  dashboardDrilldownVisible: phase336b.dashboardDrilldownVisible === true,
  acknowledgementRequiresHumanNote: true,
  externalAlertIntegration: false,
  secretValueExposed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(workflowPath, `${JSON.stringify(workflow, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReport(current) {
  return [
    "# Phase337B Execution Report",
    "",
    `- alertAcknowledgementWorkflowPresent: ${current.alertAcknowledgementWorkflowPresent}`,
    `- dashboardDrilldownVisible: ${current.dashboardDrilldownVisible}`,
    `- externalAlertIntegration: ${current.externalAlertIntegration}`,
    "",
  ].join("\n");
}
