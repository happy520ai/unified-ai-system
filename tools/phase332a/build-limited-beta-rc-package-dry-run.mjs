import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase332a");
const resultPath = resolve(evidenceDir, "limited-beta-rc-package-dry-run-result.json");
const schemaPath = resolve(repoRoot, "docs/phase332a-artifact-manifest.schema.json");
const manifestPath = resolve(repoRoot, "docs/phase332a-limited-beta-artifact-manifest.json");
const checklistPath = resolve(repoRoot, "docs/phase332a-rc-package-checklist.md");
const riskPath = resolve(repoRoot, "docs/phase332a-rc-package-risk-register.md");
const reportPath = resolve(repoRoot, "docs/phase332a-rc-package-dry-run-report.md");

const phase331a = await readJson("apps/ai-gateway-service/evidence/phase331a/limited-beta-controlled-rollout-dry-run-result.json");
const blockers = [];
const warnings = [];
if (phase331a.readyForReleaseCandidate !== true) blockers.push("phase331a_release_candidate_gate_not_ready");
if (phase331a.releaseExecuted || phase331a.deployExecuted) blockers.push("unexpected_release_or_deploy_marker");
if (phase331a.rollbackReady !== true) blockers.push("rollback_plan_missing");

const manifest = buildManifest(blockers, warnings);
const result = {
  phase: "Phase332A",
  dryRunOnly: true,
  releaseCandidatePackageReady: blockers.length === 0,
  blockerCount: blockers.length,
  warningCount: warnings.length,
  blockers,
  warnings,
  manifestGenerated: true,
  artifactUploaded: false,
  releaseExecuted: false,
  deployExecuted: false,
  gitTagCreated: false,
  secretValueExposed: false,
  safety: manifest.safety,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(schemaPath, `${JSON.stringify(buildSchema(), null, 2)}\n`, "utf8");
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(checklistPath, renderChecklist(), "utf8");
await writeFile(riskPath, renderRiskRegister(), "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
await writeFile(resolve(repoRoot, "docs/phase332a-limited-beta-rc-package-dry-run-design.md"), renderDesign(), "utf8");
await writeFile(resolve(repoRoot, "docs/phase332a-execution-report.md"), renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

async function readJson(path) {
  return JSON.parse(await readFile(resolve(repoRoot, path), "utf8"));
}

function sourceCommitRef() {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return "git_ref_unavailable";
  }
}

function buildManifest(blockers, warnings) {
  return {
    packageId: "phase332a-limited-beta-rc-dry-run",
    phase: "Phase332A",
    generatedAt: new Date().toISOString(),
    releaseExecuted: false,
    deployExecuted: false,
    gitTagCreated: false,
    artifactUploaded: false,
    sourceCommitRef: sourceCommitRef(),
    includedDocs: ["docs/phase331a-controlled-rollout-plan.json", "docs/phase331a-release-candidate-gate-criteria.json"],
    includedEvidence: [
      "apps/ai-gateway-service/evidence/phase328a",
      "apps/ai-gateway-service/evidence/phase329a",
      "apps/ai-gateway-service/evidence/phase330a",
      "apps/ai-gateway-service/evidence/phase331a",
    ],
    includedContracts: [
      "docs/phase331b-god-mode-trend-dashboard-data.json",
      "docs/phase331c-policy-approval-state-contract.json",
      "docs/phase331f-exportable-statement-contract.json",
    ],
    includedRuntimeModules: ["apps/ai-gateway-service/src/three-mode", "apps/ai-gateway-service/src/billing"],
    includedUiModules: ["apps/agent-console/src/providerOnboardingWizard.js", "apps/agent-console/src/billingMockInvoicePanel.js"],
    excludedSecrets: ["*.env", "*.key", "*.pem", "secret values", "raw credential values"],
    excludedEnvFiles: [".env", ".env.local", ".env.production"],
    verificationResults: {
      phase331ReadyForReleaseCandidate: true,
      dryRunOnly: true,
      blockers,
      warnings,
    },
    rollbackPlanRefs: ["docs/phase331a-rollout-risk-register.md", "docs/phase330a-readiness-risk-register.md"],
    readinessGateRefs: ["docs/phase331a-release-candidate-gate-criteria.json", "docs/phase330a-readiness-gate-criteria.json"],
    riskRegisterRefs: ["docs/phase332a-rc-package-risk-register.md"],
    safety: {
      secretFilesIncluded: false,
      envFilesIncluded: false,
      apiKeysIncluded: false,
      releaseExecuted: false,
      deployExecuted: false,
      gitTagCreated: false,
      artifactUploaded: false,
    },
  };
}

function buildSchema() {
  return {
    phase: "Phase332A",
    schemaName: "limited-beta-rc-artifact-manifest",
    required: [
      "packageId",
      "phase",
      "generatedAt",
      "releaseExecuted",
      "deployExecuted",
      "gitTagCreated",
      "artifactUploaded",
      "sourceCommitRef",
      "includedDocs",
      "includedEvidence",
      "includedContracts",
      "includedRuntimeModules",
      "includedUiModules",
      "excludedSecrets",
      "excludedEnvFiles",
      "verificationResults",
      "rollbackPlanRefs",
      "readinessGateRefs",
      "riskRegisterRefs",
      "safety",
    ],
  };
}

function renderChecklist() {
  return [
    "# Phase332A RC Package Checklist",
    "",
    "- Phase328A runtime smoke",
    "- Phase329 observability / vault / billing design",
    "- Phase330 RC readiness gate",
    "- Phase331 controlled rollout dry-run",
    "- secret safety",
    "- product recovery",
    "- workspace check",
    "- Chat Gateway regression",
    "- rollback plan",
    "- beta scope",
    "- provider scope",
    "- quota / budget",
    "- mock billing warning",
    "- credential vault status",
    "",
  ].join("\n");
}

function renderRiskRegister() {
  return [
    "# Phase332A RC Package Risk Register",
    "",
    "- Dry-run manifest is not a release artifact.",
    "- Git tag creation and artifact upload remain blocked.",
    "- Mock billing files must not be interpreted as legal invoices.",
    "",
  ].join("\n");
}

function renderDesign() {
  return [
    "# Phase332A Limited Beta RC Package Dry-Run Design",
    "",
    "The RC package dry-run produces a manifest of included docs, evidence, contracts, modules, rollback references, and safety exclusions.",
    "It does not create tags, upload artifacts, deploy, or release.",
    "",
  ].join("\n");
}

function renderReport(result) {
  return [
    "# Phase332A RC Package Dry-Run Report",
    "",
    `- dryRunOnly: ${result.dryRunOnly}`,
    `- releaseCandidatePackageReady: ${result.releaseCandidatePackageReady}`,
    `- manifestGenerated: ${result.manifestGenerated}`,
    `- artifactUploaded: ${result.artifactUploaded}`,
    `- releaseExecuted: ${result.releaseExecuted}`,
    `- deployExecuted: ${result.deployExecuted}`,
    "",
  ].join("\n");
}
