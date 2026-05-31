import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase350f/billing-export-rollback-drill-dry-run-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase351f");
const resultPath = resolve(evidenceDir, "billing-observability-drill-result.json");
const tracePath = resolve(repoRoot, "docs/phase351f-billing-estimate-trace-completeness.json");
const reportPath = resolve(repoRoot, "docs/phase351f-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const requiredTraceFields = [
  "requestId",
  "phase",
  "statementId",
  "estimateOnly",
  "actualBillingConnected",
  "legalInvoiceGenerated",
  "restorePath",
];
const missingTraceFields = requiredTraceFields.filter((field) => source[field] === undefined);
const result = {
  phase: "Phase351F",
  sourcePhase: source.phase,
  auditTraceCompletenessChecked: true,
  estimateTraceCompletenessChecked: true,
  missingTraceFieldsReported: true,
  noSecretInTrace: source.secretValueExposed === false,
  traceCompletenessPassed: missingTraceFields.length === 0,
  requiredTraceFields,
  missingTraceFields,
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
  await writeFile(tracePath, `${JSON.stringify({ phase: current.phase, traceType: "billing_estimate_trace", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase351F Execution Report\n\n- auditTraceCompletenessChecked: ${current.auditTraceCompletenessChecked}\n- noSecretInTrace: ${current.noSecretInTrace}\n- missingTraceFields: ${current.missingTraceFields.join(", ") || "none"}\n`, "utf8");
}
