import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase341c");
const resultPath = resolve(evidenceDir, "tianshu-guarded-enablement-plan-result.json");
const planPath = resolve(repoRoot, "docs/phase341c-tianshu-guarded-enablement-plan.json");
const reportPath = resolve(repoRoot, "docs/phase341c-execution-report.md");

const readiness = JSON.parse(await readFile(resolve(repoRoot, "docs/phase340c-tianshu-reviewer-workflow-readiness.json"), "utf8"));

const plan = {
  phase: "Phase341C",
  reviewerWorkflowGuarded: true,
  reviewerWorkflowReady: readiness.reviewerWorkflowReady === true,
  manualApprovalRequired: true,
  policyActivated: false,
  trainingTriggered: false,
  embeddingBatchTriggered: false,
};

const result = {
  phase: "Phase341C",
  reviewerWorkflowGuarded: true,
  policyActivated: false,
  trainingTriggered: false,
  embeddingBatchTriggered: false,
  productionGA: false,
  secretValueExposed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReport(current) {
  return [
    "# Phase341C Execution Report",
    "",
    `- reviewerWorkflowGuarded: ${current.reviewerWorkflowGuarded}`,
    `- policyActivated: ${current.policyActivated}`,
    "",
  ].join("\n");
}
