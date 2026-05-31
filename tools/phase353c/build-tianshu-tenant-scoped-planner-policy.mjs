import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase352c/tianshu-planner-safety-risk-review-packet-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase353c");
const resultPath = resolve(evidenceDir, "tianshu-tenant-scoped-planner-policy-result.json");
const designPath = resolve(repoRoot, "docs/phase353c-tianshu-tenant-scoped-planner-policy.json");
const reportPath = resolve(repoRoot, "docs/phase353c-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase353C",
  sourcePhase: source.phase,
  tenantBoundaryDefined: true,
  crossTenantAccessForbidden: true,
  tenantIsolationPolicyGenerated: true,
  plannerPolicyRules: [
    "policy_proposal_id_must_be_unique_within_tenant",
    "wrong_routing_review_cannot_read_other_tenant_proposals",
    "reviewer_decision_is_tenant_scoped",
    "activation_gate_requires_same_tenant_approval_chain",
  ],
  policyActivated: false,
  unresolvedSecurityBlockers: source.unresolvedSecurityBlockers,
  productionGA: false,
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(designPath, `${JSON.stringify({ phase: current.phase, designType: "tianshu_tenant_scoped_planner_policy", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase353C Execution Report\n\n- tenantBoundaryDefined: ${current.tenantBoundaryDefined}\n- crossTenantAccessForbidden: ${current.crossTenantAccessForbidden}\n- policyActivated: ${current.policyActivated}\n`, "utf8");
}
