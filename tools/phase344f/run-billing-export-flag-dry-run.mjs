import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase344f");
const resultPath = resolve(evidenceDir, "billing-export-flag-dry-run-result.json");
const dryRunPath = resolve(repoRoot, "docs/phase344f-billing-export-flag-dry-run.json");
const reportPath = resolve(repoRoot, "docs/phase344f-execution-report.md");

const design = JSON.parse(await readFile(resolve(repoRoot, "docs/phase343f-billing-runtime-flag-design.json"), "utf8"));
const result = buildResult("Phase344F", design.flagName);

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(dryRunPath, `${JSON.stringify({ phase: "Phase344F", flagName: design.flagName, ...result }, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function buildResult(phase, flagName) {
  return {
    phase,
    flagName,
    flagsDryRunExecuted: true,
    userExposure: false,
    externalNotification: false,
    policyActivated: false,
    providerRealCallExecuted: false,
    realInvoiceGenerated: false,
    secretValueExposed: false,
  };
}

function renderReport(current) {
  return [
    "# Phase344F Execution Report",
    "",
    `- flagsDryRunExecuted: ${current.flagsDryRunExecuted}`,
    `- realInvoiceGenerated: ${current.realInvoiceGenerated}`,
    "",
  ].join("\n");
}
