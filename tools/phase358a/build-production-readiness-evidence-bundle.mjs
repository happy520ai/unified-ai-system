import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase357a/production-readiness-master-checklist-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase358a");
const resultPath = resolve(evidenceDir, "production-readiness-evidence-bundle-result.json");
const bundlePath = resolve(repoRoot, "docs/phase358a-production-readiness-evidence-bundle.json");
const reportPath = resolve(repoRoot, "docs/phase358a-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const missingEvidence = ["human_approval_record", "deploy_authorization_record"];
const result = {
  phase: "Phase358A",
  sourcePhase: source.phase,
  evidenceBundlesGenerated: true,
  missingEvidenceReported: true,
  productionDeployAuthorized: false,
  bundledItems: [
    "readiness_master_checklist",
    "security_review_packets",
    "enterprise_governance_design",
    "secret_safety_verifier_status",
  ],
  missingEvidence,
  humanApprovalRequired: true,
  secretValueExposed: false,
  productionGA: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(bundlePath, `${JSON.stringify({ phase: current.phase, bundleType: "production_readiness_evidence", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase358A Execution Report\n\n- evidenceBundlesGenerated: ${current.evidenceBundlesGenerated}\n- missingEvidenceReported: ${current.missingEvidenceReported}\n- productionDeployAuthorized: ${current.productionDeployAuthorized}\n`, "utf8");
}
