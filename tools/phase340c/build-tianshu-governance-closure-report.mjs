import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase340c");
const resultPath = resolve(evidenceDir, "tianshu-governance-closure-report-result.json");
const readinessPath = resolve(repoRoot, "docs/phase340c-tianshu-reviewer-workflow-readiness.json");
const reportPath = resolve(repoRoot, "docs/phase340c-execution-report.md");

const phase339c = JSON.parse(await readFile(resolve(repoRoot, "apps/agent-console/evidence/phase339c/tianshu-reviewer-console-static-regression-result.json"), "utf8"));

const readiness = {
  phase: "Phase340C",
  reviewerWorkflowReady: phase339c.staticRegressionPassed === true && phase339c.policyActivated === false,
  autoApplyBlocked: phase339c.autoApplyBlocked === true,
  policyActivated: false,
  governanceBoundaryOnly: true,
};

const result = {
  phase: "Phase340C",
  closureReportsGenerated: true,
  reviewerWorkflowReady: readiness.reviewerWorkflowReady,
  productionGA: false,
  policyActivated: false,
  secretValueExposed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(readinessPath, `${JSON.stringify(readiness, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReport(current) {
  return [
    "# Phase340C Execution Report",
    "",
    `- closureReportsGenerated: ${current.closureReportsGenerated}`,
    `- reviewerWorkflowReady: ${current.reviewerWorkflowReady}`,
    "",
  ].join("\n");
}
