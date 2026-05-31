import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase342d");
const resultPath = resolve(evidenceDir, "credential-resolver-shadow-config-result.json");
const configPath = resolve(repoRoot, "docs/phase342d-credential-resolver-shadow-config.json");
const reportPath = resolve(repoRoot, "docs/phase342d-execution-report.md");

const gate = JSON.parse(await readFile(resolve(repoRoot, "docs/phase341d-credential-adapter-enablement-gate.json"), "utf8"));

const shadowConfig = {
  phase: "Phase342D",
  shadowConfigOnly: true,
  runtimeExposureChanged: false,
  providerRealCallExecuted: false,
  secretValueExposed: false,
  explicitCohortFlagRequired: gate.explicitCohortFlagRequired,
  defaultEnabled: false,
};

const result = {
  phase: "Phase342D",
  shadowConfigOnly: true,
  runtimeExposureChanged: false,
  providerRealCallExecuted: false,
  secretValueExposed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(configPath, `${JSON.stringify(shadowConfig, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReport(current) {
  return [
    "# Phase342D Execution Report",
    "",
    `- shadowConfigOnly: ${current.shadowConfigOnly}`,
    `- runtimeExposureChanged: ${current.runtimeExposureChanged}`,
    "",
  ].join("\n");
}
