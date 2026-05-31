import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase340f");
const resultPath = resolve(evidenceDir, "mock-billing-closure-report-result.json");
const readinessPath = resolve(repoRoot, "docs/phase340f-estimate-only-billing-readiness.json");
const reportPath = resolve(repoRoot, "docs/phase340f-execution-report.md");

const phase339f = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase339f/mock-statement-export-static-regression-result.json"), "utf8"));

const readiness = {
  phase: "Phase340F",
  estimateOnlyBillingReady: phase339f.staticRegressionPassed === true && phase339f.actualBillingConnected === false,
  actualBillingConnected: false,
  legalInvoiceGenerated: false,
  estimateOnly: true,
};

const result = {
  phase: "Phase340F",
  closureReportsGenerated: true,
  estimateOnlyBillingReady: readiness.estimateOnlyBillingReady,
  productionGA: false,
  actualBillingConnected: false,
  legalInvoiceGenerated: false,
  secretValueExposed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(readinessPath, `${JSON.stringify(readiness, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReport(current) {
  return [
    "# Phase340F Execution Report",
    "",
    `- closureReportsGenerated: ${current.closureReportsGenerated}`,
    `- estimateOnlyBillingReady: ${current.estimateOnlyBillingReady}`,
    "",
  ].join("\n");
}
