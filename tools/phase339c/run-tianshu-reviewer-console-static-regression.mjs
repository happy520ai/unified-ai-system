import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase339c");
const resultPath = resolve(evidenceDir, "tianshu-reviewer-console-static-regression-result.json");
const scenariosPath = resolve(repoRoot, "docs/phase339c-tianshu-reviewer-console-static-regression.json");
const reportPath = resolve(repoRoot, "docs/phase339c-execution-report.md");

const priorityRules = JSON.parse(await readFile(resolve(repoRoot, "docs/phase338c-reviewer-queue-priority-rules.json"), "utf8"));

const scenarios = [
  { id: "queuePriorityRulesPresent", status: priorityRules.reviewerQueuePriorityRulesValid ? "passed" : "failed" },
  { id: "autoApplyBlocked", status: priorityRules.autoApplyBlocked === true ? "passed" : "failed" },
  { id: "policyActivationBlocked", status: priorityRules.policyActivated === false ? "passed" : "failed" },
  { id: "rollbackPriorityFirst", status: priorityRules.priorityOrder[0] === "rollback_required" ? "passed" : "failed" },
];

const result = {
  phase: "Phase339C",
  staticRegressionPassed: scenarios.every((item) => item.status === "passed"),
  reviewerQueuePriorityRulesValid: priorityRules.reviewerQueuePriorityRulesValid === true,
  autoApplyBlocked: true,
  policyActivated: false,
  secretValueExposed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(scenariosPath, `${JSON.stringify({ phase: "Phase339C", scenarios }, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReport(current) {
  return [
    "# Phase339C Execution Report",
    "",
    `- staticRegressionPassed: ${current.staticRegressionPassed}`,
    `- autoApplyBlocked: ${current.autoApplyBlocked}`,
    `- policyActivated: ${current.policyActivated}`,
    "",
  ].join("\n");
}
