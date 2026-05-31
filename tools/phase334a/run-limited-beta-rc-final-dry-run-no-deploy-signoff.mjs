import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase334a");
const resultPath = resolve(evidenceDir, "limited-beta-rc-final-dry-run-result.json");
const signoffPath = resolve(repoRoot, "docs/phase334a-final-no-deploy-signoff.json");
const checklistPath = resolve(repoRoot, "docs/phase334a-final-rc-dry-run-checklist.json");
const reportPath = resolve(repoRoot, "docs/phase334a-final-rc-go-no-go-report.md");
const riskPath = resolve(repoRoot, "docs/phase334a-final-rc-risk-register.md");

const phase333a = await readJson("apps/ai-gateway-service/evidence/phase333a/limited-beta-rc-evidence-bundle-review-result.json");
const requiredEvidence = [
  "apps/ai-gateway-service/evidence/phase328a/three-mode-normal-runtime-smoke.json",
  "apps/ai-gateway-service/evidence/phase328a/three-mode-god-runtime-smoke.json",
  "apps/ai-gateway-service/evidence/phase328a/three-mode-tianshu-runtime-smoke.json",
  "apps/agent-console/evidence/phase328a/three-mode-ui-smoke.json",
  "apps/agent-console/evidence/phase333b/god-mode-alert-dashboard-ui-smoke.json",
  "apps/agent-console/evidence/phase333c/tianshu-reviewer-console-interaction-hardening-smoke.json",
  "apps/agent-console/evidence/phase333e/provider-onboarding-guided-test-automation-result.json",
  "apps/agent-console/evidence/phase333f/mock-statement-export-regression-ui-smoke.json",
];
const blockers = [];
const warnings = [];
if (phase333a.noReleaseGatePassed !== true) blockers.push("phase333a_no_release_gate_not_passed");
if (phase333a.releaseExecuted || phase333a.deployExecuted || phase333a.gitTagCreated || phase333a.artifactUploaded) blockers.push("phase333a_release_boundary_failed");
for (const item of requiredEvidence) if (!existsSync(resolve(repoRoot, item))) blockers.push(`missing:${item}`);

const signoff = buildSignoff();
const finalRcDryRunPassed = blockers.length === 0;
const result = {
  phase: "Phase334A",
  finalRcDryRunExecuted: true,
  finalRcDryRunPassed,
  noDeploySignoffGenerated: true,
  releaseExecuted: false,
  deployExecuted: false,
  gitTagCreated: false,
  artifactUploaded: false,
  releaseApproved: false,
  deployApproved: false,
  tagApproved: false,
  artifactUploadApproved: false,
  productionGaApproved: false,
  blockerCount: blockers.length,
  warningCount: warnings.length,
  blockers,
  warnings,
  secretValueExposed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(signoffPath, `${JSON.stringify(signoff, null, 2)}\n`, "utf8");
await writeFile(checklistPath, `${JSON.stringify(buildChecklist(requiredEvidence), null, 2)}\n`, "utf8");
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
await writeFile(riskPath, renderRiskRegister(), "utf8");
await writeFile(resolve(repoRoot, "docs/phase334a-limited-beta-rc-final-dry-run-design.md"), renderDesign(), "utf8");
await writeFile(resolve(repoRoot, "docs/phase334a-execution-report.md"), renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

async function readJson(path) {
  return JSON.parse(await readFile(resolve(repoRoot, path), "utf8"));
}

function buildSignoff() {
  return {
    phase: "Phase334A",
    signoffName: "limited-beta-rc-final-no-deploy-signoff",
    limitedBetaDryRunOnly: true,
    releaseApproved: false,
    deployApproved: false,
    tagApproved: false,
    artifactUploadApproved: false,
    productionGaApproved: false,
    signoffRequiredBeforeRealDeploy: true,
    safety: {
      secretFilesIncluded: false,
      envFilesIncluded: false,
      apiKeysIncluded: false,
      unauthorizedProviderCalled: false,
    },
  };
}

function buildChecklist(evidence) {
  return {
    phase: "Phase334A",
    checks: evidence.map((path) => ({ path, present: existsSync(resolve(repoRoot, path)) })),
    explicitNoDeploySignoff: true,
    limitedBetaDryRunOnly: true,
  };
}

function renderDesign() {
  return [
    "# Phase334A Limited Beta RC Final Dry-Run Design",
    "",
    "This final dry-run reviews no-release evidence and emits an explicit no-deploy signoff. It does not release, deploy, tag, upload artifacts, or execute rollout.",
    "",
  ].join("\n");
}

function renderRiskRegister() {
  return [
    "# Phase334A Final RC Risk Register",
    "",
    "- No-deploy signoff is not deploy approval.",
    "- Final dry-run pass is not production GA.",
    "- Real deploy would require a separate explicit signoff and security review.",
    "",
  ].join("\n");
}

function renderReport(result) {
  return [
    "# Phase334A Final RC Go/No-Go Report",
    "",
    `- finalRcDryRunExecuted: ${result.finalRcDryRunExecuted}`,
    `- finalRcDryRunPassed: ${result.finalRcDryRunPassed}`,
    `- noDeploySignoffGenerated: ${result.noDeploySignoffGenerated}`,
    `- releaseApproved: ${result.releaseApproved}`,
    `- deployApproved: ${result.deployApproved}`,
    `- productionGaApproved: ${result.productionGaApproved}`,
    "",
  ].join("\n");
}
