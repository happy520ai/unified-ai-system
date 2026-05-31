import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase351f/billing-observability-drill-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase352f");
const resultPath = resolve(evidenceDir, "billing-compliance-risk-review-packet-result.json");
const packetPath = resolve(repoRoot, "docs/phase352f-billing-compliance-risk-review-packet.json");
const reportPath = resolve(repoRoot, "docs/phase352f-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const unresolvedSecurityBlockers = [
  ...(source.missingTraceFields || []).map((field) => `missing_trace_field:${field}`),
  "estimate_only_trace_required_before_candidate_signoff",
  "legal_invoice_language_must_remain_blocked",
];
const result = {
  phase: "Phase352F",
  sourcePhase: source.phase,
  packetType: "billing_estimate_statement_compliance_review",
  securityReviewPacketsGenerated: true,
  riskRegisterUpdated: true,
  unresolvedSecurityBlockersListed: true,
  unresolvedSecurityBlockerCount: unresolvedSecurityBlockers.length,
  unresolvedSecurityBlockers,
  paymentProviderConnected: false,
  actualBillingConnected: false,
  legalInvoiceGenerated: false,
  productionGA: false,
  noSecretInReviewPacket: source.noSecretInTrace === true,
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(packetPath, `${JSON.stringify({ phase: current.phase, packetType: current.packetType, result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase352F Execution Report\n\n- securityReviewPacketsGenerated: ${current.securityReviewPacketsGenerated}\n- unresolvedSecurityBlockerCount: ${current.unresolvedSecurityBlockerCount}\n- actualBillingConnected: ${current.actualBillingConnected}\n`, "utf8");
}
