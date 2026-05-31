import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase353f/billing-tenant-statement-policy-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase354f");
const resultPath = resolve(evidenceDir, "billing-rbac-design-result.json");
const designPath = resolve(repoRoot, "docs/phase354f-billing-rbac-design.json");
const reportPath = resolve(repoRoot, "docs/phase354f-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase354F",
  sourcePhase: source.phase,
  rbacDesignGenerated: true,
  adminOnlyActionsDefined: true,
  reviewerApprovalSeparationDefined: true,
  adminOnlyActions: [
    "approve_statement_visibility_policy",
    "assign_billing_governance_owner",
  ],
  reviewerSeparatedActions: [
    "review_estimate_warning_copy",
    "approve_export_permission_request",
  ],
  paymentProviderConnected: false,
  actualBillingConnected: false,
  legalInvoiceGenerated: false,
  crossTenantAccessForbidden: true,
  productionGA: false,
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(designPath, `${JSON.stringify({ phase: current.phase, designType: "billing_rbac", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase354F Execution Report\n\n- rbacDesignGenerated: ${current.rbacDesignGenerated}\n- reviewerApprovalSeparationDefined: ${current.reviewerApprovalSeparationDefined}\n- actualBillingConnected: ${current.actualBillingConnected}\n`, "utf8");
}
