import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase342f");
const resultPath = resolve(evidenceDir, "billing-visibility-shadow-config-result.json");
const configPath = resolve(repoRoot, "docs/phase342f-billing-visibility-shadow-config.json");
const reportPath = resolve(repoRoot, "docs/phase342f-execution-report.md");

const policy = JSON.parse(await readFile(resolve(repoRoot, "docs/phase341f-mock-billing-beta-visibility-policy.json"), "utf8"));

const shadowConfig = {
  phase: "Phase342F",
  shadowConfigOnly: true,
  runtimeExposureChanged: false,
  providerRealCallExecuted: false,
  secretValueExposed: false,
  visibleTo: policy.visibleTo,
  actualBillingConnected: false,
};

const result = {
  phase: "Phase342F",
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
    "# Phase342F Execution Report",
    "",
    `- shadowConfigOnly: ${current.shadowConfigOnly}`,
    `- runtimeExposureChanged: ${current.runtimeExposureChanged}`,
    "",
  ].join("\n");
}
