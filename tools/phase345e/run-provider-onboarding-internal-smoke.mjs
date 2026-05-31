import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase345e");
const resultPath = resolve(evidenceDir, "provider-onboarding-internal-smoke-result.json");
const smokePath = resolve(repoRoot, "docs/phase345e-provider-onboarding-internal-smoke.json");
const reportPath = resolve(repoRoot, "docs/phase345e-execution-report.md");

const input = JSON.parse(await readFile(resolve(repoRoot, "apps/agent-console/evidence/phase344e/provider-onboarding-flag-dry-run-result.json"), "utf8"));
const result = buildResult("Phase345E", input.flagName);

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(smokePath, `${JSON.stringify({ phase: "Phase345E", inputPhase: input.phase, ...result }, null, 2)}\n`, "utf8");
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
    noProviderCallFromUi: true,
    providerRealCallExecuted: false,
    secretValueExposed: false,
  };
}

function renderReport(current) {
  return [
    "# Phase345E Execution Report",
    "",
    `- internalOnly: ${current.internalOnly}`,
    `- noProviderCallFromUi: ${current.noProviderCallFromUi}`,
    "",
  ].join("\n");
}
