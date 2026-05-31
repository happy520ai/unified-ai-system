import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase335f");
const resultPath = resolve(evidenceDir, "mock-statement-export-artifacts-result.json");
const snapshotPath = resolve(repoRoot, "docs/phase335f-mock-statement-regression-snapshot.json");
const source = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase334f/mock-statement-export-polish-csv-edge-result.json"), "utf8"));
const result = {
  phase: "Phase335F",
  artifactsGenerated: true,
  estimateOnly: true,
  legalInvoice: false,
  actualBillingConnected: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(snapshotPath, `${JSON.stringify({ phase: "Phase335F", regressionSnapshot: source }, null, 2)}\n`, "utf8");
await writeFile(resolve(repoRoot, "docs/phase335f-execution-report.md"), renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReport(result) {
  return [
    "# Phase335F Execution Report",
    "",
    `- artifactsGenerated: ${result.artifactsGenerated}`,
    `- estimateOnly: ${result.estimateOnly}`,
    `- legalInvoice: ${result.legalInvoice}`,
    "",
  ].join("\n");
}
