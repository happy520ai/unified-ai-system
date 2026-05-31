import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase337c");
const resultPath = resolve(evidenceDir, "tianshu-reviewer-assignment-design-result.json");
const policyPath = resolve(repoRoot, "docs/phase337c-reviewer-assignment-policy.json");
const reportPath = resolve(repoRoot, "docs/phase337c-execution-report.md");

const trace = JSON.parse(await readFile(resolve(repoRoot, "docs/phase336c-tianshu-rollback-trace.json"), "utf8"));

const policy = {
  phase: "Phase337C",
  reviewerAssignmentPolicyPresent: true,
  roles: [
    "queue_owner",
    "dry_run_approver",
    "rollback_reviewer",
  ],
  separationOfDutyRequired: true,
  rollbackRequiresReviewerDifferentFromApprover: true,
  sampleAssignment: {
    proposalId: trace.events[0]?.proposalId || "unknown",
    approverIdRef: "reviewer_alpha",
    rollbackReviewerIdRef: "reviewer_beta",
  },
};

const result = {
  phase: "Phase337C",
  reviewerAssignmentPolicyPresent: true,
  approvalHistoryInputPresent: Array.isArray(trace.events) && trace.events.length > 0,
  rollbackSeparationDefined: policy.rollbackRequiresReviewerDifferentFromApprover === true,
  secretValueExposed: false,
  policyActivated: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(policyPath, `${JSON.stringify(policy, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReport(current) {
  return [
    "# Phase337C Execution Report",
    "",
    `- reviewerAssignmentPolicyPresent: ${current.reviewerAssignmentPolicyPresent}`,
    `- rollbackSeparationDefined: ${current.rollbackSeparationDefined}`,
    `- policyActivated: ${current.policyActivated}`,
    "",
  ].join("\n");
}
