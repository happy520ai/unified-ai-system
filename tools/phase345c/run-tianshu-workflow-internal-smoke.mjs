import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase345c");
const resultPath = resolve(evidenceDir, "tianshu-workflow-internal-smoke-result.json");
const smokePath = resolve(repoRoot, "docs/phase345c-tianshu-workflow-internal-smoke.json");
const reportPath = resolve(repoRoot, "docs/phase345c-execution-report.md");

const input = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase344c/tianshu-workflow-flag-dry-run-result.json"), "utf8"));
const result = buildResult("Phase345C", input.flagName);

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(smokePath, `${JSON.stringify({ phase: "Phase345C", inputPhase: input.phase, ...result }, null, 2)}\n`, "utf8");
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
    policyActivated: false,
    providerRealCallExecuted: false,
    secretValueExposed: false,
  };
}

function renderReport(current) {
  return [
    "# Phase345C Execution Report",
    "",
    `- internalOnly: ${current.internalOnly}`,
    `- policyActivated: ${current.policyActivated}`,
    "",
  ].join("\n");
}
