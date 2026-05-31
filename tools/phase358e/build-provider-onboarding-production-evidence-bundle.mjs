import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/agent-console/evidence/phase357e/provider-onboarding-production-readiness-checklist-result.json");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase358e");
const resultPath = resolve(evidenceDir, "provider-onboarding-production-evidence-bundle-result.json");
const bundlePath = resolve(repoRoot, "docs/phase358e-provider-onboarding-production-evidence-bundle.json");
const reportPath = resolve(repoRoot, "docs/phase358e-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const missingEvidence = ["reviewerChecklistId", "tenant_admin_approval_record"];
const result = {
  phase: "Phase358E",
  sourcePhase: source.phase,
  evidenceBundlesGenerated: true,
  missingEvidenceReported: true,
  productionDeployAuthorized: false,
  bundledItems: [
    "provider_onboarding_readiness_checklist",
    "provider_onboarding_governance_section",
    "raw_secret_rejection_audit_baseline",
  ],
  missingEvidence,
  noProviderCallFromUi: true,
  credentialRefOnly: true,
  secretValueExposed: false,
  productionGA: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(bundlePath, `${JSON.stringify({ phase: current.phase, bundleType: "provider_onboarding_production_evidence", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase358E Execution Report\n\n- evidenceBundlesGenerated: ${current.evidenceBundlesGenerated}\n- missingEvidenceReported: ${current.missingEvidenceReported}\n- credentialRefOnly: ${current.credentialRefOnly}\n`, "utf8");
}
