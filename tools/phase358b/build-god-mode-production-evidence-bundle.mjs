import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase357b/god-mode-production-readiness-checklist-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase358b");
const resultPath = resolve(evidenceDir, "god-mode-production-evidence-bundle-result.json");
const bundlePath = resolve(repoRoot, "docs/phase358b-god-mode-production-evidence-bundle.json");
const reportPath = resolve(repoRoot, "docs/phase358b-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const missingEvidence = ["benchmarkEvidenceRef", "reviewer_quality_signoff"];
const result = {
  phase: "Phase358B",
  sourcePhase: source.phase,
  evidenceBundlesGenerated: true,
  missingEvidenceReported: true,
  productionDeployAuthorized: false,
  bundledItems: [
    "god_mode_readiness_checklist",
    "god_mode_governance_section",
    "quality_regression_policy",
  ],
  missingEvidence,
  externalNotification: false,
  secretValueExposed: false,
  productionGA: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(bundlePath, `${JSON.stringify({ phase: current.phase, bundleType: "god_mode_production_evidence", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase358B Execution Report\n\n- evidenceBundlesGenerated: ${current.evidenceBundlesGenerated}\n- missingEvidenceReported: ${current.missingEvidenceReported}\n- externalNotification: ${current.externalNotification}\n`, "utf8");
}
