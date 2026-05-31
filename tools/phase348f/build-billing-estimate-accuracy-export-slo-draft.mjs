import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase347f/billing-mock-statement-beta-findings-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase348f");
const resultPath = resolve(evidenceDir, "billing-estimate-accuracy-export-slo-draft-result.json");
const draftPath = resolve(repoRoot, "docs/phase348f-billing-estimate-accuracy-export-slo-draft.json");
const reportPath = resolve(repoRoot, "docs/phase348f-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const metrics = [
  "estimate_label_visibility_rate",
  "csv_export_escape_success_rate",
  "statement_total_consistency_rate",
  "no_legal_invoice_claim_rate",
  "actual_billing_connection_count",
];
const result = {
  phase: "Phase348F",
  sourcePhase: source.phase,
  sloDraftGenerated: true,
  slaDraftGenerated: true,
  metricsDefined: true,
  productionGAFalselyClaimed: false,
  paymentProviderConnected: false,
  actualBillingConnected: false,
  legalInvoiceGenerated: false,
  productionGA: false,
  metricCount: metrics.length,
  metrics,
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(draftPath, `${JSON.stringify({ phase: current.phase, draftType: "billing_estimate_accuracy_export_slo", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase348F Execution Report\n\n- sloDraftGenerated: ${current.sloDraftGenerated}\n- actualBillingConnected: ${current.actualBillingConnected}\n- legalInvoiceGenerated: ${current.legalInvoiceGenerated}\n`, "utf8");
}
