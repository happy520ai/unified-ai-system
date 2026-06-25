import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, readText } from "./entrypointUtils.js"

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const jsonPath = "apps/ai-gateway-service/evidence/phase-279a-full-codebase-audit.json";
const mdPath = "apps/ai-gateway-service/evidence/phase-279a-full-codebase-audit.md";

const requiredFiles = [
  "apps/ai-gateway-service/src/audit/fullCodebaseAudit.js",
  "apps/ai-gateway-service/src/audit/codebaseAuditPolicy.js",
  "apps/ai-gateway-service/src/audit/codebaseAuditFileScanner.js",
  "apps/ai-gateway-service/src/audit/codebaseAuditSecretScanner.js",
  "apps/ai-gateway-service/src/audit/codebaseAuditPackageScripts.js",
  "apps/ai-gateway-service/src/audit/codebaseAuditPhaseEvidence.js",
  "apps/ai-gateway-service/src/audit/codebaseAuditBoundaryCheck.js",
  "apps/ai-gateway-service/src/audit/codebaseAuditRepairPlan.js",
  "apps/ai-gateway-service/src/entrypoints/runFullCodebaseAudit.js",
  "apps/ai-gateway-service/src/entrypoints/verifyFullCodebaseAudit.js",
  "docs/FULL_CODEBASE_AUDIT_AND_REPAIR.md",
  jsonPath,
  mdPath,
];

const requiredDocSections = [
  "Purpose",
  "Current status",
  "Audit scope",
  "Hard boundaries",
  "Workspace boundary",
  "Secret safety audit",
  "Provider boundary audit",
  "Package script audit",
  "Syntax and module health",
  "Evidence chain audit",
  "UI observability audit",
  "HTTP endpoint boundary audit",
  "Documentation consistency audit",
  "Minimal repair policy",
  "Repairs applied",
  "Repairs intentionally skipped",
  "Remaining risks",
  "Verification commands",
  "Regression results",
  "What this audit does not prove",
  "Next phase options",
];

function main() {
  const evidence = readJson(jsonPath);
  const docsText = readText("docs/FULL_CODEBASE_AUDIT_AND_REPAIR.md");
  const uiText = readText("apps/ai-gateway-service/src/ui/consolePage.js");
  const rootPackage = readJson("package.json");
  const servicePackage = readJson("apps/ai-gateway-service/package.json");
  const combinedText = [
    docsText,
    readText(jsonPath),
    readText(mdPath),
    uiText,
  ].join("\n");

  const summary = evidence.summary ?? {};
  const safety = evidence.safety ?? {};
  const dimensions = Array.isArray(evidence.dimensions) ? evidence.dimensions : [];
  const hasDimension = (name) => dimensions.some((dimension) => dimension.name === name);
  const statusAllowed = evidence.status === "passed"
    || Boolean(["failed", "blocked"].includes(evidence.status) && evidence.conclusion);
  const criticalBlocksPass = !(summary.criticalIssues > 0 && evidence.status === "passed");
  const highBlocksPass = !(summary.highIssues > 0 && evidence.status === "passed");

  const checks = {
    requiredFilesExist: requiredFiles.every(fileExists),
    packageScriptsExist: Boolean(rootPackage.scripts?.["audit:full-codebase"])
      && Boolean(rootPackage.scripts?.["verify:phase279a-full-codebase-audit"])
      && Boolean(servicePackage.scripts?.["audit:full-codebase"])
      && Boolean(servicePackage.scripts?.["verify:phase279a-full-codebase-audit"]),
    uiMarkerExists: uiText.includes("Full Codebase Audit / 全代码库审查验证"),
    requiredDocsSectionsPresent: requiredDocSections.every((section) => docsText.includes(`## ${section}`)),
    evidenceStatusExplicit: statusAllowed,
    paidApiCallCountZero: evidence.paidApiCallCount === 0,
    externalApiCalledFalse: evidence.externalApiCalled === false,
    mimoApiCalledFalse: evidence.mimoApiCalled === false,
    embeddingApiCalledFalse: evidence.embeddingApiCalled === false,
    defaultNvidiaChatLaneChangedFalse: evidence.defaultNvidiaChatLaneChanged === false,
    mimoSetAsDefaultFalse: evidence.mimoSetAsDefault === false,
    legacyModifiedFalse: evidence.workspace?.legacyModified === false && safety.legacyModified === false,
    projectContextCreatedFalse: evidence.workspace?.projectContextExists === false && safety.projectContextCreated === false && !fileExists("PROJECT_CONTEXT.md"),
    autoCommitFalse: safety.autoCommit === false,
    autoPushFalse: safety.autoPush === false,
    fullRepoFormatFalse: safety.fullRepoFormat === false,
    largeRefactorFalse: safety.largeRefactor === false,
    noPlaintextApiKeyInDocsEvidenceUi: !containsPlaintextApiKey(combinedText),
    healthDoctorResultsRecorded: evidence.regression?.healthPassed === true && evidence.regression?.doctorPassed === true,
    pnpmCheckResultRecorded: evidence.regression?.pnpmCheckPassed === true,
    packageScriptAuditPresent: hasDimension("Package Scripts") && Boolean(evidence.scans?.packageScripts),
    evidenceChainAuditPresent: hasDimension("Evidence Chain") && Boolean(evidence.scans?.phaseEvidence),
    secretSafetyAuditPresent: hasDimension("Secret Safety") && Boolean(evidence.scans?.secretScan),
    repairPlanPresent: Array.isArray(evidence.repairsProposed) && Array.isArray(evidence.repairsApplied),
    criticalIssueStatusRule: criticalBlocksPass,
    highIssueStatusRule: highBlocksPass,
  };

  const failures = Object.entries(checks).filter(([, value]) => value !== true).map(([key]) => key);
  const result = {
    phase: "279A-full-codebase-audit",
    status: failures.length === 0 ? "passed" : "failed",
    checks: Object.keys(checks).length,
    failures,
    auditStatus: evidence.status,
    filesScanned: summary.filesScanned ?? 0,
    jsFilesChecked: summary.jsFilesChecked ?? 0,
    packageScriptsChecked: summary.packageScriptsChecked ?? 0,
    phaseEvidenceChecked: summary.phaseEvidenceChecked ?? 0,
    docsChecked: summary.docsChecked ?? 0,
    uiPanelsChecked: summary.uiPanelsChecked ?? 0,
    httpEndpointsChecked: summary.httpEndpointsChecked ?? 0,
    issuesFoundCount: summary.issuesFoundCount ?? 0,
    criticalIssues: summary.criticalIssues ?? 0,
    highIssues: summary.highIssues ?? 0,
    repairsAppliedCount: summary.repairsAppliedCount ?? 0,
    verifiersPassedCount: summary.verifiersPassedCount ?? 0,
    verifiersFailedCount: summary.verifiersFailedCount ?? 0,
    nodeCheckPassedCount: summary.nodeCheckPassedCount ?? 0,
    nodeCheckFailedCount: summary.nodeCheckFailedCount ?? 0,
    evidenceJsonPath: resolve(repoRoot, jsonPath),
    evidenceMdPath: resolve(repoRoot, mdPath),
  };

  console.log(JSON.stringify(result, null, 2));

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

function fileExists(relativePath) {
  return existsSync(resolve(repoRoot, relativePath));
}



function containsPlaintextApiKey(text) {
  return /sk-(?!test|example|placeholder|redacted|xxxx)[A-Za-z0-9_-]{20,}/i.test(text)
    || /nvapi-(?!test|example|placeholder|redacted|xxxx)[A-Za-z0-9_-]{20,}/i.test(text)
    || /Bearer\s+(?!test|example|placeholder|redacted|masked|xxxx)[A-Za-z0-9._-]{24,}/i.test(text)
    || /(Authorization|api-key)\s*[:=]\s*[A-Za-z0-9._-]{24,}/i.test(text);
}

main();
