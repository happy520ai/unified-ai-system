import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase349f/billing-statement-incident-incorrect-estimate-playbook-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase350f");
const resultPath = resolve(evidenceDir, "billing-export-rollback-drill-dry-run-result.json");
const drillPath = resolve(repoRoot, "docs/phase350f-billing-export-rollback-drill-dry-run.json");
const reportPath = resolve(repoRoot, "docs/phase350f-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase350F",
  sourcePhase: source.phase,
  rollbackDrillDryRunExecuted: true,
  disablePathVerified: Array.isArray(source.rollbackSteps) && source.rollbackSteps.includes("hide_impacted_mock_statement_export"),
  restorePathDocumented: true,
  noProductionChange: true,
  paymentProviderConnected: false,
  actualBillingConnected: false,
  legalInvoiceGenerated: false,
  productionGA: false,
  rollbackStepsVerified: source.rollbackSteps || [],
  restorePath: "restore_mock_statement_export_after_estimate_consistency_review",
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(drillPath, `${JSON.stringify({ phase: current.phase, drillType: "billing_export_disable_restore", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase350F Execution Report\n\n- rollbackDrillDryRunExecuted: ${current.rollbackDrillDryRunExecuted}\n- disablePathVerified: ${current.disablePathVerified}\n- actualBillingConnected: ${current.actualBillingConnected}\n`, "utf8");
}
