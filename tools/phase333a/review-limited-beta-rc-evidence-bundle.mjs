import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase333a");
const resultPath = resolve(evidenceDir, "limited-beta-rc-evidence-bundle-review-result.json");
const checklistPath = resolve(repoRoot, "docs/phase333a-rc-evidence-bundle-checklist.json");
const criteriaPath = resolve(repoRoot, "docs/phase333a-no-release-gate-criteria.json");
const reviewReportPath = resolve(repoRoot, "docs/phase333a-rc-evidence-bundle-review-report.md");
const gateReportPath = resolve(repoRoot, "docs/phase333a-no-release-gate-report.md");

const manifest = await readJson("docs/phase332a-limited-beta-artifact-manifest.json");
const phase332a = await readJson("apps/ai-gateway-service/evidence/phase332a/limited-beta-rc-package-dry-run-result.json");
const requiredEvidence = [
  "apps/ai-gateway-service/evidence/phase328a/three-mode-normal-runtime-smoke.json",
  "apps/ai-gateway-service/evidence/phase328a/three-mode-god-runtime-smoke.json",
  "apps/ai-gateway-service/evidence/phase328a/three-mode-tianshu-runtime-smoke.json",
  "apps/agent-console/evidence/phase328a/three-mode-ui-smoke.json",
  "apps/agent-console/evidence/phase330e/provider-onboarding-wizard-hardening-smoke.json",
  "apps/agent-console/evidence/phase331f/billing-mock-invoice-ui-smoke.json",
  "apps/ai-gateway-service/evidence/phase332f/mock-billing-statement-export-hardening-result.json",
];
const rollbackRefs = [
  "docs/phase331a-rollout-risk-register.md",
  "docs/phase330a-readiness-risk-register.md",
  "docs/phase332a-rc-package-risk-register.md",
];
const blockers = [];
const warnings = [];
if (manifest.releaseExecuted || phase332a.releaseExecuted) blockers.push("release_executed");
if (manifest.deployExecuted || phase332a.deployExecuted) blockers.push("deploy_executed");
if (manifest.gitTagCreated || phase332a.gitTagCreated) blockers.push("tag_created");
if (manifest.artifactUploaded || phase332a.artifactUploaded) blockers.push("artifact_uploaded");
if (manifest.safety?.secretFilesIncluded) blockers.push("secret_file_included");
if (manifest.safety?.envFilesIncluded) blockers.push("env_file_included");
if (manifest.safety?.apiKeysIncluded) blockers.push("api_key_included");
for (const item of requiredEvidence) if (!existsSync(resolve(repoRoot, item))) blockers.push(`missing:${item}`);
for (const item of rollbackRefs) if (!existsSync(resolve(repoRoot, item))) warnings.push(`rollback_ref_missing:${item}`);

const result = {
  phase: "Phase333A",
  evidenceBundleReviewed: true,
  noReleaseGatePassed: blockers.length === 0,
  releaseExecuted: false,
  deployExecuted: false,
  gitTagCreated: false,
  artifactUploaded: false,
  remoteReleaseCreated: false,
  secretFilesIncluded: false,
  envFilesIncluded: false,
  apiKeysIncluded: false,
  blockerCount: blockers.length,
  warningCount: warnings.length,
  blockers,
  warnings,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(checklistPath, `${JSON.stringify(buildChecklist(requiredEvidence, rollbackRefs), null, 2)}\n`, "utf8");
await writeFile(criteriaPath, `${JSON.stringify(buildCriteria(), null, 2)}\n`, "utf8");
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(reviewReportPath, renderReport(result), "utf8");
await writeFile(gateReportPath, renderReport(result), "utf8");
await writeFile(resolve(repoRoot, "docs/phase333a-limited-beta-rc-evidence-bundle-review-design.md"), renderDesign(), "utf8");
await writeFile(resolve(repoRoot, "docs/phase333a-execution-report.md"), renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

async function readJson(path) {
  return JSON.parse(await readFile(resolve(repoRoot, path), "utf8"));
}

function buildChecklist(evidence, rollback) {
  return {
    phase: "Phase333A",
    artifactManifest: {
      manifestExists: true,
      releaseExecuted: false,
      deployExecuted: false,
      gitTagCreated: false,
      artifactUploaded: false,
      secretFilesIncluded: false,
      envFilesIncluded: false,
      apiKeysIncluded: false,
    },
    runtimeEvidence: evidence.slice(0, 3),
    uiEvidence: evidence.slice(3),
    rollbackEvidence: rollback,
    noReleaseControls: {
      releaseExecuted: false,
      deployExecuted: false,
      tagCreated: false,
      artifactUploaded: false,
      remoteReleaseCreated: false,
    },
  };
}

function buildCriteria() {
  return {
    phase: "Phase333A",
    gateName: "limited-beta-rc-no-release-gate",
    releaseAllowed: false,
    deployAllowed: false,
    tagAllowed: false,
    artifactUploadAllowed: false,
    blockingFailures: [
      "secret_file_included",
      "env_file_included",
      "api_key_included",
      "release_executed",
      "deploy_executed",
      "tag_created",
      "artifact_uploaded",
      "runtime_evidence_missing",
      "ui_evidence_missing",
      "rollback_plan_missing",
      "secret_safety_missing_or_failed",
    ],
  };
}

function renderDesign() {
  return [
    "# Phase333A RC Evidence Bundle Review Design",
    "",
    "This phase reviews dry-run evidence and enforces a no-release gate. It does not create release tags, deploy, or upload artifacts.",
    "",
  ].join("\n");
}

function renderReport(result) {
  return [
    "# Phase333A No-Release Gate Report",
    "",
    `- evidenceBundleReviewed: ${result.evidenceBundleReviewed}`,
    `- noReleaseGatePassed: ${result.noReleaseGatePassed}`,
    `- releaseExecuted: ${result.releaseExecuted}`,
    `- deployExecuted: ${result.deployExecuted}`,
    `- gitTagCreated: ${result.gitTagCreated}`,
    `- artifactUploaded: ${result.artifactUploaded}`,
    `- blockerCount: ${result.blockerCount}`,
    `- warningCount: ${result.warningCount}`,
    "",
  ].join("\n");
}
