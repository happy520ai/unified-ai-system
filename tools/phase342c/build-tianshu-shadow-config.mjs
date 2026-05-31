import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase342c");
const resultPath = resolve(evidenceDir, "tianshu-shadow-config-result.json");
const configPath = resolve(repoRoot, "docs/phase342c-tianshu-shadow-config.json");
const reportPath = resolve(repoRoot, "docs/phase342c-execution-report.md");

const plan = JSON.parse(await readFile(resolve(repoRoot, "docs/phase341c-tianshu-guarded-enablement-plan.json"), "utf8"));

const shadowConfig = {
  phase: "Phase342C",
  shadowConfigOnly: true,
  runtimeExposureChanged: false,
  providerRealCallExecuted: false,
  secretValueExposed: false,
  manualApprovalRequired: plan.manualApprovalRequired,
  policyActivated: false,
};

const result = {
  phase: "Phase342C",
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
    "# Phase342C Execution Report",
    "",
    `- shadowConfigOnly: ${current.shadowConfigOnly}`,
    `- runtimeExposureChanged: ${current.runtimeExposureChanged}`,
    "",
  ].join("\n");
}
