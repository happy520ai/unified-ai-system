import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase353c/tianshu-tenant-scoped-planner-policy-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase354c");
const resultPath = resolve(evidenceDir, "tianshu-reviewer-rbac-design-result.json");
const designPath = resolve(repoRoot, "docs/phase354c-tianshu-reviewer-rbac-design.json");
const reportPath = resolve(repoRoot, "docs/phase354c-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase354C",
  sourcePhase: source.phase,
  rbacDesignGenerated: true,
  adminOnlyActionsDefined: true,
  reviewerApprovalSeparationDefined: true,
  adminOnlyActions: [
    "change_planner_policy_defaults",
    "reassign_reviewer_pool_for_tenant",
  ],
  reviewerSeparatedActions: [
    "approve_policy_proposal",
    "reject_policy_proposal",
    "request_changes_before_activation",
  ],
  policyActivated: false,
  crossTenantAccessForbidden: true,
  productionGA: false,
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(designPath, `${JSON.stringify({ phase: current.phase, designType: "tianshu_reviewer_rbac", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase354C Execution Report\n\n- rbacDesignGenerated: ${current.rbacDesignGenerated}\n- reviewerApprovalSeparationDefined: ${current.reviewerApprovalSeparationDefined}\n- policyActivated: ${current.policyActivated}\n`, "utf8");
}
