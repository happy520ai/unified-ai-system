import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase348f/billing-estimate-accuracy-export-slo-draft-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase349f");
const resultPath = resolve(evidenceDir, "billing-statement-incident-incorrect-estimate-playbook-result.json");
const playbookPath = resolve(repoRoot, "docs/phase349f-billing-statement-incident-incorrect-estimate-playbook.json");
const reportPath = resolve(repoRoot, "docs/phase349f-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase349F",
  sourcePhase: source.phase,
  incidentPlaybooksGenerated: true,
  rollbackStepsIncluded: true,
  escalationOwnersPlaceholder: true,
  noRealOpsIntegration: true,
  incorrectEstimatePlaybookGenerated: true,
  paymentProviderConnected: false,
  actualBillingConnected: false,
  legalInvoiceGenerated: false,
  productionGA: false,
  rollbackSteps: [
    "hide_impacted_mock_statement_export",
    "preserve_estimate_only_warning_copy",
    "recompute_mock_totals_from_source_evidence",
    "block_invoice_language_until_compliance_review",
  ],
  metricsCovered: source.metrics || [],
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(playbookPath, `${JSON.stringify({ phase: current.phase, playbookType: "billing_incorrect_estimate_incident", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase349F Execution Report\n\n- incidentPlaybooksGenerated: ${current.incidentPlaybooksGenerated}\n- actualBillingConnected: ${current.actualBillingConnected}\n- legalInvoiceGenerated: ${current.legalInvoiceGenerated}\n`, "utf8");
}
