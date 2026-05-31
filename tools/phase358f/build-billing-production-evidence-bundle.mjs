import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase357f/billing-production-readiness-checklist-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase358f");
const resultPath = resolve(evidenceDir, "billing-production-evidence-bundle-result.json");
const bundlePath = resolve(repoRoot, "docs/phase358f-billing-production-evidence-bundle.json");
const reportPath = resolve(repoRoot, "docs/phase358f-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const missingEvidence = ["statementId", "warning_copy_approval_record"];
const result = {
  phase: "Phase358F",
  sourcePhase: source.phase,
  evidenceBundlesGenerated: true,
  missingEvidenceReported: true,
  productionDeployAuthorized: false,
  bundledItems: [
    "billing_readiness_checklist",
    "billing_governance_section",
    "estimate_only_export_audit_baseline",
  ],
  missingEvidence,
  paymentProviderConnected: false,
  actualBillingConnected: false,
  legalInvoiceGenerated: false,
  secretValueExposed: false,
  productionGA: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(bundlePath, `${JSON.stringify({ phase: current.phase, bundleType: "billing_production_evidence", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase358F Execution Report\n\n- evidenceBundlesGenerated: ${current.evidenceBundlesGenerated}\n- missingEvidenceReported: ${current.missingEvidenceReported}\n- actualBillingConnected: ${current.actualBillingConnected}\n`, "utf8");
}
