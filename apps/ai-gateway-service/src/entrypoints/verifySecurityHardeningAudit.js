import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const jsonPath = "apps/ai-gateway-service/evidence/phase-280a-security-hardening-audit.json";
const mdPath = "apps/ai-gateway-service/evidence/phase-280a-security-hardening-audit.md";

const requiredFiles = [
  "apps/ai-gateway-service/src/security/securityAuditPolicy.js",
  "apps/ai-gateway-service/src/security/securityVulnerabilityScanner.js",
  "apps/ai-gateway-service/src/security/securitySecretScanner.js",
  "apps/ai-gateway-service/src/security/securityEndpointScanner.js",
  "apps/ai-gateway-service/src/security/securityProviderBoundaryScanner.js",
  "apps/ai-gateway-service/src/security/securityRagCacheKnowledgeScanner.js",
  "apps/ai-gateway-service/src/security/securityDependencyScanner.js",
  "apps/ai-gateway-service/src/security/securityRepairPlan.js",
  "apps/ai-gateway-service/src/security/securityRegressionRunner.js",
  "apps/ai-gateway-service/src/entrypoints/runSecurityHardeningAudit.js",
  "apps/ai-gateway-service/src/entrypoints/verifySecurityHardeningAudit.js",
  "docs/SECURITY_VULNERABILITY_AUDIT_AND_HARDENING.md",
  jsonPath,
  mdPath,
];

const requiredDocSections = [
  "Purpose",
  "Current status",
  "Audit scope",
  "Hard boundaries",
  "Vulnerability categories",
  "Secret safety",
  "Provider boundary",
  "HTTP endpoint security",
  "Path traversal / unsafe write",
  "Command injection",
  "RAG / knowledge injection",
  "Cache poisoning / stale cache",
  "Token / cost abuse",
  "UI injection / evidence rendering",
  "Dependency / script risk",
  "Minimal hardening policy",
  "Repairs applied",
  "Repairs skipped",
  "Full functional regression",
  "Remaining risks",
  "What this audit does not prove",
  "Verification commands",
  "Next phase options",
];

const requiredDimensions = [
  "Secret Safety",
  "Provider Boundary",
  "HTTP Endpoint Security",
  "Path Traversal / Unsafe Write",
  "Command Injection",
  "RAG / Knowledge Injection",
  "Cache Poisoning / Stale Cache",
  "Token / Cost Abuse",
  "UI Injection / Evidence Rendering",
  "Dependency / Script Risk",
];

function main() {
  const evidence = readJson(jsonPath);
  const docsText = readText("docs/SECURITY_VULNERABILITY_AUDIT_AND_HARDENING.md");
  const uiText = readText("apps/ai-gateway-service/src/ui/consolePage.js");
  const rootPackage = readJson("package.json");
  const servicePackage = readJson("apps/ai-gateway-service/package.json");
  const combinedText = [docsText, readText(jsonPath), readText(mdPath), uiText].join("\n");
  const summary = evidence.summary ?? {};
  const safety = evidence.safety ?? {};
  const dimensions = Array.isArray(evidence.dimensions) ? evidence.dimensions : [];
  const dimensionNames = new Set(dimensions.map((dimension) => dimension.name));

  const criticalBlocksPass = !(summary.criticalFindings > 0 && evidence.status === "passed");
  const highBlocksPass = !(summary.highFindings > 0 && evidence.status === "passed");

  const checks = {
    requiredFilesExist: requiredFiles.every(fileExists),
    packageScriptsExist: Boolean(rootPackage.scripts?.["security:audit-hardening"])
      && Boolean(rootPackage.scripts?.["verify:phase280a-security-hardening-audit"])
      && Boolean(servicePackage.scripts?.["security:audit-hardening"])
      && Boolean(servicePackage.scripts?.["verify:phase280a-security-hardening-audit"]),
    uiMarkerExists: uiText.includes("Security Vulnerability Audit /"),
    requiredDocsSectionsPresent: requiredDocSections.every((section) => docsText.includes(`## ${section}`)),
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
    fullFunctionalRegressionExists: Boolean(evidence.fullFunctionalRegression),
    healthDoctorRecorded: evidence.fullFunctionalRegression?.healthPassed === true && evidence.fullFunctionalRegression?.doctorPassed === true,
    pnpmCheckRecorded: evidence.fullFunctionalRegression?.pnpmCheckPassed === true,
    criticalIssueStatusRule: criticalBlocksPass,
    highIssueStatusRule: highBlocksPass,
    allDimensionsPresent: requiredDimensions.every((name) => dimensionNames.has(name)) && dimensions.length >= 10,
  };

  const failures = Object.entries(checks).filter(([, value]) => value !== true).map(([key]) => key);
  const result = {
    phase: "280A-security-hardening-audit",
    status: failures.length === 0 ? "passed" : "failed",
    checks: Object.keys(checks).length,
    failures,
    auditStatus: evidence.status,
    filesScanned: summary.filesScanned ?? 0,
    securityFindingsCount: summary.securityFindingsCount ?? 0,
    criticalFindings: summary.criticalFindings ?? 0,
    highFindings: summary.highFindings ?? 0,
    mediumFindings: summary.mediumFindings ?? 0,
    lowFindings: summary.lowFindings ?? 0,
    infoFindings: summary.infoFindings ?? 0,
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

function readText(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
}

function containsPlaintextApiKey(text) {
  return /sk-(?!test|example|placeholder|redacted|xxxx)[A-Za-z0-9_-]{20,}/i.test(text)
    || /nvapi-(?!test|example|placeholder|redacted|xxxx)[A-Za-z0-9_-]{20,}/i.test(text)
    || /Bearer\s+(?!test|example|placeholder|redacted|masked|xxxx)[A-Za-z0-9._-]{24,}/i.test(text)
    || /(Authorization|api-key)\s*[:=]\s*[A-Za-z0-9._-]{24,}/i.test(text);
}

main();
