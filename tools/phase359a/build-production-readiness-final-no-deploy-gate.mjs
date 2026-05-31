import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase358a/production-readiness-evidence-bundle-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase359a");
const resultPath = resolve(evidenceDir, "production-readiness-final-no-deploy-gate-result.json");
const gatePath = resolve(repoRoot, "docs/phase359a-production-readiness-final-no-deploy-gate.json");
const reportPath = resolve(repoRoot, "docs/phase359a-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const blockers = source.missingEvidence || [];
const result = {
  phase: "Phase359A",
  sourcePhase: source.phase,
  finalNoDeployGateGenerated: true,
  deployApproved: false,
  releaseApproved: false,
  productionGaApproved: false,
  blockerCountRecorded: true,
  blockerCount: blockers.length,
  blockers,
  humanApprovalRequired: source.humanApprovalRequired === true,
  productionDeployAuthorized: false,
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(gatePath, `${JSON.stringify({ phase: current.phase, gateType: "production_readiness_final_no_deploy", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase359A Execution Report\n\n- finalNoDeployGateGenerated: ${current.finalNoDeployGateGenerated}\n- deployApproved: ${current.deployApproved}\n- blockerCount: ${current.blockerCount}\n`, "utf8");
}
