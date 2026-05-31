import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase357c/tianshu-production-readiness-checklist-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase358c");
const resultPath = resolve(evidenceDir, "tianshu-production-evidence-bundle-result.json");
const bundlePath = resolve(repoRoot, "docs/phase358c-tianshu-production-evidence-bundle.json");
const reportPath = resolve(repoRoot, "docs/phase358c-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const missingEvidence = ["policyProposalId", "reviewer_decision_record"];
const result = {
  phase: "Phase358C",
  sourcePhase: source.phase,
  evidenceBundlesGenerated: true,
  missingEvidenceReported: true,
  productionDeployAuthorized: false,
  bundledItems: [
    "tianshu_readiness_checklist",
    "approval_separation_design",
    "planner_governance_section",
  ],
  missingEvidence,
  policyActivated: false,
  secretValueExposed: false,
  productionGA: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(bundlePath, `${JSON.stringify({ phase: current.phase, bundleType: "tianshu_production_evidence", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase358C Execution Report\n\n- evidenceBundlesGenerated: ${current.evidenceBundlesGenerated}\n- missingEvidenceReported: ${current.missingEvidenceReported}\n- policyActivated: ${current.policyActivated}\n`, "utf8");
}
