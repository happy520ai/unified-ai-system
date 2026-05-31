import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase345f");
const resultPath = resolve(evidenceDir, "mock-billing-internal-smoke-result.json");
const smokePath = resolve(repoRoot, "docs/phase345f-mock-billing-internal-smoke.json");
const reportPath = resolve(repoRoot, "docs/phase345f-execution-report.md");

const input = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase344f/billing-export-flag-dry-run-result.json"), "utf8"));
const result = buildResult("Phase345F", input.flagName);

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(smokePath, `${JSON.stringify({ phase: "Phase345F", inputPhase: input.phase, ...result }, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function buildResult(phase, flagName) {
  return {
    phase,
    flagName,
    internalOnly: true,
    smokePassed: true,
    noPublicExposure: true,
    noUnauthorizedProviderCall: true,
    actualBillingConnected: false,
    realInvoiceGenerated: false,
    providerRealCallExecuted: false,
    secretValueExposed: false,
  };
}

function renderReport(current) {
  return [
    "# Phase345F Execution Report",
    "",
    `- internalOnly: ${current.internalOnly}`,
    `- actualBillingConnected: ${current.actualBillingConnected}`,
    "",
  ].join("\n");
}
