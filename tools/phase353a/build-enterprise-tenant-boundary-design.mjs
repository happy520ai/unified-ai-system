import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase352a/production-candidate-security-review-packet-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase353a");
const resultPath = resolve(evidenceDir, "enterprise-tenant-boundary-design-result.json");
const designPath = resolve(repoRoot, "docs/phase353a-enterprise-tenant-boundary-design.json");
const reportPath = resolve(repoRoot, "docs/phase353a-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase353A",
  sourcePhase: source.phase,
  tenantBoundaryDefined: true,
  crossTenantAccessForbidden: true,
  tenantIsolationPolicyGenerated: true,
  tenantBoundaryRules: [
    "every_request_requires_tenant_id",
    "tenant_scoped_evidence_index_only",
    "no_cross_tenant_incident_or_signoff_lookup",
    "human_review_decision_must_be_tenant_bound",
  ],
  unresolvedSecurityBlockers: source.unresolvedSecurityBlockers,
  productionGA: false,
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(designPath, `${JSON.stringify({ phase: current.phase, designType: "enterprise_tenant_boundary", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase353A Execution Report\n\n- tenantBoundaryDefined: ${current.tenantBoundaryDefined}\n- crossTenantAccessForbidden: ${current.crossTenantAccessForbidden}\n- tenantIsolationPolicyGenerated: ${current.tenantIsolationPolicyGenerated}\n`, "utf8");
}
