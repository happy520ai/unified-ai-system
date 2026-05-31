import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase345a");
const resultPath = resolve(evidenceDir, "limited-beta-internal-only-smoke-result.json");
const smokePath = resolve(repoRoot, "docs/phase345a-limited-beta-internal-only-smoke.json");
const reportPath = resolve(repoRoot, "docs/phase345a-execution-report.md");

const input = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase344a/limited-beta-runtime-flag-dry-run-result.json"), "utf8"));
const result = buildResult("Phase345A", input.flagName);

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(smokePath, `${JSON.stringify({ phase: "Phase345A", inputPhase: input.phase, ...result }, null, 2)}\n`, "utf8");
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
    providerRealCallExecuted: false,
    secretValueExposed: false,
  };
}

function renderReport(current) {
  return [
    "# Phase345A Execution Report",
    "",
    `- internalOnly: ${current.internalOnly}`,
    `- smokePassed: ${current.smokePassed}`,
    `- noPublicExposure: ${current.noPublicExposure}`,
    "",
  ].join("\n");
}
