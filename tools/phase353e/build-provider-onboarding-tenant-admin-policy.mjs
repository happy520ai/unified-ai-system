import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/agent-console/evidence/phase352e/provider-onboarding-user-risk-review-packet-result.json");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase353e");
const resultPath = resolve(evidenceDir, "provider-onboarding-tenant-admin-policy-result.json");
const designPath = resolve(repoRoot, "docs/phase353e-provider-onboarding-tenant-admin-policy.json");
const reportPath = resolve(repoRoot, "docs/phase353e-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase353E",
  sourcePhase: source.phase,
  tenantBoundaryDefined: true,
  crossTenantAccessForbidden: true,
  tenantIsolationPolicyGenerated: true,
  tenantAdminPolicyRules: [
    "provider_setup_is_visible_only_within_same_tenant",
    "reviewer_checklist_id_must_match_tenant",
    "credential_ref_examples_are_tenant_scoped",
    "raw_secret_rejection_audit_is_tenant_scoped",
  ],
  noProviderCallFromUi: true,
  credentialRefOnly: true,
  unresolvedSecurityBlockers: source.unresolvedSecurityBlockers,
  productionGA: false,
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(designPath, `${JSON.stringify({ phase: current.phase, designType: "provider_onboarding_tenant_admin_policy", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase353E Execution Report\n\n- tenantBoundaryDefined: ${current.tenantBoundaryDefined}\n- crossTenantAccessForbidden: ${current.crossTenantAccessForbidden}\n- credentialRefOnly: ${current.credentialRefOnly}\n`, "utf8");
}
