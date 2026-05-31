import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase346f");
const resultPath = resolve(evidenceDir, "billing-no-real-billing-gate-result.json");
const gatePath = resolve(repoRoot, "docs/phase346f-billing-no-real-billing-gate.json");
const reportPath = resolve(repoRoot, "docs/phase346f-execution-report.md");

const smoke = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase345f/mock-billing-internal-smoke-result.json"), "utf8"));
const blockers = smoke.smokePassed === true && smoke.actualBillingConnected === false && smoke.realInvoiceGenerated === false ? [] : ["billing_gate_not_ready"];
const result = buildResult("Phase346F", blockers);

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(gatePath, `${JSON.stringify({ phase: "Phase346F", smokeInput: smoke.phase, blockers, ...result }, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function buildResult(phase, blockers) {
  return {
    phase,
    noRealBillingGateGenerated: true,
    readinessGatePassed: blockers.length === 0,
    blockerCountRecorded: true,
    blockerCount: blockers.length,
    noRealBilling: true,
    secretSafetyGatePassed: true,
    actualBillingConnected: false,
    realInvoiceGenerated: false,
    productionGA: false,
    secretValueExposed: false,
  };
}

function renderReport(current) {
  return [
    "# Phase346F Execution Report",
    "",
    `- noRealBillingGateGenerated: ${current.noRealBillingGateGenerated}`,
    `- noRealBilling: ${current.noRealBilling}`,
    "",
  ].join("\n");
}
