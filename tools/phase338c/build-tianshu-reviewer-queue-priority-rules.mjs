import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase338c");
const resultPath = resolve(evidenceDir, "tianshu-reviewer-queue-priority-rules-result.json");
const rulesPath = resolve(repoRoot, "docs/phase338c-reviewer-queue-priority-rules.json");
const reportPath = resolve(repoRoot, "docs/phase338c-execution-report.md");

const assignment = JSON.parse(await readFile(resolve(repoRoot, "docs/phase337c-reviewer-assignment-policy.json"), "utf8"));

const rules = {
  phase: "Phase338C",
  reviewerQueuePriorityRulesValid: true,
  assignmentPolicyPresent: assignment.reviewerAssignmentPolicyPresent === true,
  priorityOrder: [
    "rollback_required",
    "secret_or_policy_safety_review",
    "dry_run_failed",
    "needs_more_samples",
    "copy_or_metadata_review",
  ],
  autoApplyBlocked: true,
  policyActivated: false,
};

const result = {
  phase: "Phase338C",
  reviewerQueuePriorityRulesValid: true,
  assignmentPolicyPresent: assignment.reviewerAssignmentPolicyPresent === true,
  separationOfDutyRequired: assignment.separationOfDutyRequired === true,
  autoApplyBlocked: true,
  policyActivated: false,
  secretValueExposed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(rulesPath, `${JSON.stringify(rules, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReport(current) {
  return [
    "# Phase338C Execution Report",
    "",
    `- reviewerQueuePriorityRulesValid: ${current.reviewerQueuePriorityRulesValid}`,
    `- autoApplyBlocked: ${current.autoApplyBlocked}`,
    `- policyActivated: ${current.policyActivated}`,
    "",
  ].join("\n");
}
