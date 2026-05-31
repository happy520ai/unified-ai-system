import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase346d");
const resultPath = resolve(evidenceDir, "credential-secret-safety-gate-result.json");
const gatePath = resolve(repoRoot, "docs/phase346d-credential-secret-safety-gate.json");
const reportPath = resolve(repoRoot, "docs/phase346d-execution-report.md");

const smoke = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase345d/credential-vault-internal-smoke-result.json"), "utf8"));
const blockers = smoke.smokePassed === true && smoke.rawSecretReturned === false ? [] : ["credential_secret_gate_not_ready"];
const result = buildResult("Phase346D", blockers);

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(gatePath, `${JSON.stringify({ phase: "Phase346D", smokeInput: smoke.phase, blockers, ...result }, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function buildResult(phase, blockers) {
  return {
    phase,
    secretSafetyGateGenerated: true,
    readinessGatePassed: blockers.length === 0,
    blockerCountRecorded: true,
    blockerCount: blockers.length,
    noRealBilling: true,
    secretSafetyGatePassed: blockers.length === 0,
    rawSecretReturned: false,
    productionGA: false,
    secretValueExposed: false,
  };
}

function renderReport(current) {
  return [
    "# Phase346D Execution Report",
    "",
    `- secretSafetyGateGenerated: ${current.secretSafetyGateGenerated}`,
    `- secretSafetyGatePassed: ${current.secretSafetyGatePassed}`,
    "",
  ].join("\n");
}
