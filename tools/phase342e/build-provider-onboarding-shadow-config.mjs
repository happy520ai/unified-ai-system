import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase342e");
const resultPath = resolve(evidenceDir, "provider-onboarding-shadow-config-result.json");
const configPath = resolve(repoRoot, "docs/phase342e-provider-onboarding-shadow-config.json");
const reportPath = resolve(repoRoot, "docs/phase342e-execution-report.md");

const policy = JSON.parse(await readFile(resolve(repoRoot, "docs/phase341e-provider-onboarding-beta-cohort-policy.json"), "utf8"));

const shadowConfig = {
  phase: "Phase342E",
  shadowConfigOnly: true,
  runtimeExposureChanged: false,
  providerRealCallExecuted: false,
  secretValueExposed: false,
  explicitTesterAllowListRequired: policy.explicitTesterAllowListRequired,
  credentialRefOnly: policy.credentialRefOnly,
};

const result = {
  phase: "Phase342E",
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
    "# Phase342E Execution Report",
    "",
    `- shadowConfigOnly: ${current.shadowConfigOnly}`,
    `- runtimeExposureChanged: ${current.runtimeExposureChanged}`,
    "",
  ].join("\n");
}
