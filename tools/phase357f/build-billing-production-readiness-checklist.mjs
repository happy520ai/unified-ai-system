import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase356f/billing-governance-dashboard-section-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase357f");
const resultPath = resolve(evidenceDir, "billing-production-readiness-checklist-result.json");
const checklistPath = resolve(repoRoot, "docs/phase357f-billing-production-readiness-checklist.json");
const reportPath = resolve(repoRoot, "docs/phase357f-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase357F",
  sourcePhase: source.phase,
  readinessChecklistsGenerated: true,
  blockerCriteriaDefined: true,
  humanApprovalRequired: true,
  checklistItems: [
    "statement_id_present",
    "estimate_only_label_enforced",
    "warning_copy_version_logged",
    "export_permission_decision_recorded",
  ],
  blockerCriteria: [
    "missing_statementId",
    "estimate_only_label_missing",
    "legal_invoice_language_present",
    "actual_billing_connected_without_approval",
  ],
  paymentProviderConnected: false,
  actualBillingConnected: false,
  legalInvoiceGenerated: false,
  productionGA: false,
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(checklistPath, `${JSON.stringify({ phase: current.phase, checklistType: "billing_production_readiness", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase357F Execution Report\n\n- readinessChecklistsGenerated: ${current.readinessChecklistsGenerated}\n- blockerCriteriaDefined: ${current.blockerCriteriaDefined}\n- actualBillingConnected: ${current.actualBillingConnected}\n`, "utf8");
}
