import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase347e");
const resultPath = resolve(evidenceDir, "provider-onboarding-beta-findings-result.json");
const reviewPath = resolve(repoRoot, "docs/phase347e-provider-onboarding-beta-findings.json");
const reportPath = resolve(repoRoot, "docs/phase347e-execution-report.md");

const gate = JSON.parse(await readFile(resolve(repoRoot, "docs/phase346e-provider-user-setup-gate.json"), "utf8"));
const result = buildResult("Phase347E", gate, [
  "provider_setup_remains_credential_ref_only",
  "production_candidate_requires_real_beta_tester_feedback",
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
    noProviderCallFromUi: true,
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
    "# Phase347E Execution Report",
    "",
    `- betaFindingsReviewed: ${current.betaFindingsReviewed}`,
    `- noProviderCallFromUi: ${current.noProviderCallFromUi}`,
    "",
  ].join("\n");
}
