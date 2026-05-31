import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase358f/billing-production-evidence-bundle-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase359f");
const resultPath = resolve(evidenceDir, "billing-final-production-risk-gate-result.json");
const gatePath = resolve(repoRoot, "docs/phase359f-billing-final-production-risk-gate.json");
const reportPath = resolve(repoRoot, "docs/phase359f-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const blockers = source.missingEvidence || [];
const result = {
  phase: "Phase359F",
  sourcePhase: source.phase,
  finalNoDeployGateGenerated: true,
  deployApproved: false,
  releaseApproved: false,
  productionGaApproved: false,
  blockerCountRecorded: true,
  blockerCount: blockers.length,
  blockers,
  paymentProviderConnected: false,
  actualBillingConnected: false,
  legalInvoiceGenerated: false,
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(gatePath, `${JSON.stringify({ phase: current.phase, gateType: "billing_final_production_risk", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase359F Execution Report\n\n- finalNoDeployGateGenerated: ${current.finalNoDeployGateGenerated}\n- blockerCount: ${current.blockerCount}\n- actualBillingConnected: ${current.actualBillingConnected}\n`, "utf8");
}
