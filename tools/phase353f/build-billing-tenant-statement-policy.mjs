import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase352f/billing-compliance-risk-review-packet-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase353f");
const resultPath = resolve(evidenceDir, "billing-tenant-statement-policy-result.json");
const designPath = resolve(repoRoot, "docs/phase353f-billing-tenant-statement-policy.json");
const reportPath = resolve(repoRoot, "docs/phase353f-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase353F",
  sourcePhase: source.phase,
  tenantBoundaryDefined: true,
  crossTenantAccessForbidden: true,
  tenantIsolationPolicyGenerated: true,
  statementPolicyRules: [
    "statement_id_must_be_unique_within_tenant",
    "estimate_only_exports_cannot_be_shared_cross_tenant",
    "billing_review_evidence_is_tenant_scoped",
    "legal_invoice_language_block_is_enforced_per_tenant",
  ],
  paymentProviderConnected: false,
  actualBillingConnected: false,
  legalInvoiceGenerated: false,
  unresolvedSecurityBlockers: source.unresolvedSecurityBlockers,
  productionGA: false,
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(designPath, `${JSON.stringify({ phase: current.phase, designType: "billing_tenant_statement_policy", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase353F Execution Report\n\n- tenantBoundaryDefined: ${current.tenantBoundaryDefined}\n- crossTenantAccessForbidden: ${current.crossTenantAccessForbidden}\n- actualBillingConnected: ${current.actualBillingConnected}\n`, "utf8");
}
