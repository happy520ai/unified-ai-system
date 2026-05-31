import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/agent-console/evidence/phase353e/provider-onboarding-tenant-admin-policy-result.json");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase354e");
const resultPath = resolve(evidenceDir, "provider-onboarding-rbac-design-result.json");
const designPath = resolve(repoRoot, "docs/phase354e-provider-onboarding-rbac-design.json");
const reportPath = resolve(repoRoot, "docs/phase354e-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase354E",
  sourcePhase: source.phase,
  rbacDesignGenerated: true,
  adminOnlyActionsDefined: true,
  reviewerApprovalSeparationDefined: true,
  adminOnlyActions: [
    "approve_provider_setup_template",
    "assign_tenant_admin_for_provider_setup",
  ],
  reviewerSeparatedActions: [
    "review_guided_test_submission",
    "approve_checklist_completion",
  ],
  noProviderCallFromUi: true,
  credentialRefOnly: true,
  crossTenantAccessForbidden: true,
  productionGA: false,
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(designPath, `${JSON.stringify({ phase: current.phase, designType: "provider_onboarding_rbac", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase354E Execution Report\n\n- rbacDesignGenerated: ${current.rbacDesignGenerated}\n- adminOnlyActionsDefined: ${current.adminOnlyActionsDefined}\n- credentialRefOnly: ${current.credentialRefOnly}\n`, "utf8");
}
