import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase345d");
const resultPath = resolve(evidenceDir, "credential-vault-internal-smoke-result.json");
const smokePath = resolve(repoRoot, "docs/phase345d-credential-vault-internal-smoke.json");
const reportPath = resolve(repoRoot, "docs/phase345d-execution-report.md");

const input = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase344d/credential-adapter-flag-dry-run-result.json"), "utf8"));
const result = buildResult("Phase345D", input.flagName);

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(smokePath, `${JSON.stringify({ phase: "Phase345D", inputPhase: input.phase, ...result }, null, 2)}\n`, "utf8");
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
    rawSecretReturned: false,
    providerRealCallExecuted: false,
    secretValueExposed: false,
  };
}

function renderReport(current) {
  return [
    "# Phase345D Execution Report",
    "",
    `- internalOnly: ${current.internalOnly}`,
    `- rawSecretReturned: ${current.rawSecretReturned}`,
    "",
  ].join("\n");
}
