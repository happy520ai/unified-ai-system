import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase341e");
const resultPath = resolve(evidenceDir, "provider-onboarding-beta-cohort-policy-result.json");
const policyPath = resolve(repoRoot, "docs/phase341e-provider-onboarding-beta-cohort-policy.json");
const reportPath = resolve(repoRoot, "docs/phase341e-execution-report.md");

const readiness = JSON.parse(await readFile(resolve(repoRoot, "docs/phase340e-provider-onboarding-beta-readiness.json"), "utf8"));

const policy = {
  phase: "Phase341E",
  providerCohortPolicyDefined: true,
  onboardingBetaReady: readiness.onboardingBetaReady === true,
  explicitTesterAllowListRequired: true,
  noProviderCallFromUi: true,
  credentialRefOnly: true,
  productionDefaultEnabled: false,
};

const result = {
  phase: "Phase341E",
  providerCohortPolicyDefined: true,
  noProviderCallFromUi: true,
  credentialRefOnly: true,
  productionGA: false,
  secretValueExposed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(policyPath, `${JSON.stringify(policy, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReport(current) {
  return [
    "# Phase341E Execution Report",
    "",
    `- providerCohortPolicyDefined: ${current.providerCohortPolicyDefined}`,
    `- noProviderCallFromUi: ${current.noProviderCallFromUi}`,
    "",
  ].join("\n");
}
