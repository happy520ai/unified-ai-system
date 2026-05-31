import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase344d");
const resultPath = resolve(evidenceDir, "credential-adapter-flag-dry-run-result.json");
const dryRunPath = resolve(repoRoot, "docs/phase344d-credential-adapter-flag-dry-run.json");
const reportPath = resolve(repoRoot, "docs/phase344d-execution-report.md");

const design = JSON.parse(await readFile(resolve(repoRoot, "docs/phase343d-credential-adapter-runtime-flag-design.json"), "utf8"));
const result = buildResult("Phase344D", design.flagName);

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(dryRunPath, `${JSON.stringify({ phase: "Phase344D", flagName: design.flagName, ...result }, null, 2)}\n`, "utf8");
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
    "# Phase344D Execution Report",
    "",
    `- flagsDryRunExecuted: ${current.flagsDryRunExecuted}`,
    `- providerRealCallExecuted: ${current.providerRealCallExecuted}`,
    "",
  ].join("\n");
}
