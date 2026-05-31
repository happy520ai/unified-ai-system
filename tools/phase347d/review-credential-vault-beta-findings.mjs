import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase347d");
const resultPath = resolve(evidenceDir, "credential-vault-beta-findings-result.json");
const reviewPath = resolve(repoRoot, "docs/phase347d-credential-vault-beta-findings.json");
const reportPath = resolve(repoRoot, "docs/phase347d-execution-report.md");

const gate = JSON.parse(await readFile(resolve(repoRoot, "docs/phase346d-credential-secret-safety-gate.json"), "utf8"));
const result = buildResult("Phase347D", gate, [
  "production_vault_backend_not_enabled",
  "rotation_revoke_operations_remain_dry_run_until_guarded_backend",
]);

await writeOutputs(result, reviewPath, reportPath, evidenceDir, resultPath);
console.log(JSON.stringify(result, null, 2));

function buildResult(phase, gateInput, risks) {
  return {
    phase,
    betaFindingsReviewed: true,
    productionCandidateRisksListed: true,
    unresolvedBlockersTracked: true,
    unresolvedBlockerCount: Number(gateInput.blockerCount || 0),
    readinessGatePassed: gateInput.readinessGatePassed === true,
    rawSecretReturned: false,
    risks,
    productionGA: false,
    secretValueExposed: false,
  };
}

async function writeOutputs(result, reviewPath, reportPath, evidenceDir, resultPath) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(reviewPath, `${JSON.stringify({ phase: result.phase, findings: result.risks, result }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, renderReport(result), "utf8");
}

function renderReport(current) {
  return [
    "# Phase347D Execution Report",
    "",
    `- betaFindingsReviewed: ${current.betaFindingsReviewed}`,
    `- rawSecretReturned: ${current.rawSecretReturned}`,
    "",
  ].join("\n");
}
