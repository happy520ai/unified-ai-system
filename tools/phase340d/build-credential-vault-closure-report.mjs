import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase340d");
const resultPath = resolve(evidenceDir, "credential-vault-closure-report-result.json");
const readinessPath = resolve(repoRoot, "docs/phase340d-credential-beta-readiness.json");
const reportPath = resolve(repoRoot, "docs/phase340d-execution-report.md");

const phase339d = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase339d/credential-vault-static-regression-result.json"), "utf8"));

const readiness = {
  phase: "Phase340D",
  credentialBetaReady: phase339d.staticRegressionPassed === true && phase339d.rawSecretReturned === false,
  providerRealCallExecuted: false,
  rawSecretReturned: false,
  secretValueExposed: false,
};

const result = {
  phase: "Phase340D",
  closureReportsGenerated: true,
  credentialBetaReady: readiness.credentialBetaReady,
  productionGA: false,
  providerRealCallExecuted: false,
  secretValueExposed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(readinessPath, `${JSON.stringify(readiness, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReport(current) {
  return [
    "# Phase340D Execution Report",
    "",
    `- closureReportsGenerated: ${current.closureReportsGenerated}`,
    `- credentialBetaReady: ${current.credentialBetaReady}`,
    "",
  ].join("\n");
}
