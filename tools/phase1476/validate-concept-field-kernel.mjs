import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const paths = {
  audit: "docs/phase1476a-concept-field-critical-audit.md",
  riskLedger: "docs/phase1476a-concept-field-risk-ledger.md",
  contractDoc: "docs/phase1476b-concept-field-kernel-contract.md",
  benchmarkPlan: "docs/phase1476d-concept-field-benchmark-plan.md",
  closureReport: "docs/phase1476f-concept-field-kernel-closure-report.md",
  contract: "packages/taiji-beidou-engine/src/conceptFieldKernelContract.js",
  syntheticSpace: "packages/taiji-beidou-engine/src/conceptFieldSyntheticSpace.js",
  kernel: "packages/taiji-beidou-engine/src/conceptFieldKernel.js",
  benchmark: "packages/taiji-beidou-engine/src/conceptFieldBenchmark.js",
  index: "packages/taiji-beidou-engine/src/index.js",
  runner: "tools/phase1476/run-concept-field-dry-run.mjs",
  evidence: "apps/ai-gateway-service/evidence/phase1476-concept-field-kernel/concept-field-dry-run-result.json",
  validation: "apps/ai-gateway-service/evidence/phase1476-concept-field-kernel/concept-field-validation-result.json",
  packageJson: "package.json",
  readme: "README.md",
  agents: "AGENTS.md",
};

const auditText = readText(paths.audit);
const riskLedgerText = readText(paths.riskLedger);
const contractDocText = readText(paths.contractDoc);
const benchmarkPlanText = readText(paths.benchmarkPlan);
const closureReportText = readText(paths.closureReport);
const contractText = readText(paths.contract);
const syntheticSpaceText = readText(paths.syntheticSpace);
const kernelText = readText(paths.kernel);
const benchmarkText = readText(paths.benchmark);
const indexText = readText(paths.index);
const runnerText = readText(paths.runner);
const readmeText = readText(paths.readme);
const agentsText = readText(paths.agents);
const packageJson = readJson(paths.packageJson);
const evidence = readJson(paths.evidence);

const forbiddenCombinedText = [
  auditText,
  riskLedgerText,
  contractDocText,
  benchmarkPlanText,
  closureReportText,
  contractText,
  syntheticSpaceText,
  kernelText,
  benchmarkText,
  runnerText,
  readmeText,
  agentsText,
  JSON.stringify(evidence.data ?? {}),
].join("\n");

const checks = {
  auditDocExists: exists(paths.audit),
  riskLedgerExists: exists(paths.riskLedger),
  contractDocExists: exists(paths.contractDoc),
  benchmarkPlanExists: exists(paths.benchmarkPlan),
  closureReportExists: exists(paths.closureReport),
  contractFileExists: exists(paths.contract),
  syntheticSpaceFileExists: exists(paths.syntheticSpace),
  kernelFileExists: exists(paths.kernel),
  benchmarkFileExists: exists(paths.benchmark),
  runnerExists: exists(paths.runner),
  evidenceExists: evidence.exists === true,
  conceptFieldKernelImplemented: Boolean(kernelText) && kernelText.includes("runConceptFieldKernel"),
  contractExportsPresent:
    contractText.includes("CONCEPT_FIELD_KERNEL_SCHEMA_VERSION") &&
    contractText.includes("validateConceptFieldKernelInput") &&
    contractText.includes("createConceptFieldKernelContract"),
  contractFieldsPresent:
    ["inputConcepts", "positiveSources", "negativeSources", "neutralSources", "routeContext", "evidenceRefs", "riskSignals"].every((field) =>
      contractDocText.includes(field) && contractText.includes(field),
    ),
  outputFieldsPresent:
    [
      "routeAffinityScore",
      "evidenceCoherenceScore",
      "surpriseScore",
      "riskFieldScore",
      "topActivatedConcepts",
      "topSuppressedConcepts",
      "unstableConcepts",
      "sleepConsolidationCandidates",
      "pruneCandidates",
    ].every((field) => contractDocText.includes(field) && kernelText.includes(field)),
  strategicInspirationTrue: auditText.includes("strategicInspiration=true"),
  crossEraEmpiricalProofFalse: auditText.includes("crossEraEmpiricalProof=false"),
  llmReplacementFalse: auditText.includes("llmReplacement=false"),
  agiClaimAllowedFalse: auditText.includes("agiClaimAllowed=false"),
  trillionClaimAllowedFalse: auditText.includes("trillionModelSurpassClaimAllowed=false"),
  experimentalSubKernelOnlyTrue: auditText.includes("experimentalSubKernelOnly=true"),
  syntheticDryRunOnly: evidence.data?.syntheticDryRunOnly === true,
  syntheticVectorsOnly: evidence.data?.syntheticVectorsOnly === true,
  gloveDownloadExecutedFalse: evidence.data?.gloveDownloadExecuted === false,
  externalDatasetLoadedFalse: evidence.data?.externalDatasetLoaded === false,
  externalNetworkUsedFalse: evidence.data?.externalNetworkUsed === false,
  providerCallsMadeFalse: evidence.data?.providerCallsMade === false,
  secretValueExposedFalse: evidence.data?.secretValueExposed === false,
  authJsonReadFalse: evidence.data?.authJsonRead === false,
  rawCredentialRefReadFalse: evidence.data?.rawCredentialRefRead === false,
  chatModifiedFalse: evidence.data?.chatModified === false,
  chatGatewayExecuteModifiedFalse: evidence.data?.chatGatewayExecuteModified === false,
  deployExecutedFalse: evidence.data?.deployExecuted === false,
  agiClaimedFalse: evidence.data?.agiClaimed === false,
  trillionModelSurpassClaimedFalse: evidence.data?.trillionModelSurpassClaimed === false,
  realSemanticValidationClaimedFalse: evidence.data?.realSemanticValidationClaimed === false,
  productionReadinessClaimedFalse: evidence.data?.productionReadinessClaimed === false,
  routeAffinityScoreGenerated: evidence.data?.scoreCoverage?.routeAffinityScoreGenerated === true,
  evidenceCoherenceScoreGenerated: evidence.data?.scoreCoverage?.evidenceCoherenceScoreGenerated === true,
  surpriseScoreGenerated: evidence.data?.scoreCoverage?.surpriseScoreGenerated === true,
  riskFieldScoreGenerated: evidence.data?.scoreCoverage?.riskFieldScoreGenerated === true,
  dryRunCasesPresent: Array.isArray(evidence.data?.dryRunCases) && evidence.data.dryRunCases.length >= 5,
  dryRunCaseNamesPresent: [
    "tianshu-route-scoring",
    "god-mode-answer-coherence",
    "evidence-compression",
    "capability-cell-candidate",
    "security-shield-negative-source",
  ].every((id) => evidence.data?.dryRunCases?.some((entry) => entry.caseId === id)),
  benchmarkBaselinesPresent: [
    "directSyntheticNearestNeighbor",
    "simpleKeywordAffinity",
    "randomBaseline",
    "conceptFieldKernelDryRun",
  ].every((id) => benchmarkPlanText.includes(id) && benchmarkText.includes(id)),
  benchmarkModeSyntheticOnly: evidence.data?.benchmark?.benchmarkMode === "synthetic_only",
  noNetworkCode:
    !/https?:\/\//i.test(runnerText + syntheticSpaceText + kernelText + benchmarkText) &&
    !/(?:^|\s)(?:fetch|axios|undici|got)\s*\(|node:https|node:http|\bhttps?\./i.test(
      runnerText + syntheticSpaceText + kernelText + benchmarkText,
    ),
  noProviderImport:
    !/openai|claude|openrouter|mimo|nvidia/i.test(runnerText + syntheticSpaceText + kernelText + benchmarkText),
  indexExportsPresent:
    indexText.includes("conceptFieldKernelContract.js") &&
    indexText.includes("conceptFieldKernel.js") &&
    indexText.includes("conceptFieldBenchmark.js"),
  packageSmokeScript:
    packageJson.data?.scripts?.["smoke:phase1476-concept-field-kernel"] ===
    "node tools/phase1476/run-concept-field-dry-run.mjs && node tools/phase1476/validate-concept-field-kernel.mjs",
  packageVerifyScript:
    packageJson.data?.scripts?.["verify:phase1476-concept-field-kernel"] ===
    "node tools/phase1476/validate-concept-field-kernel.mjs",
  managedBlocksUpdated:
    readmeText.includes("Phase1476") &&
    agentsText.includes("Phase1476") &&
    readmeText.includes("synthetic concept-field sub-kernel") &&
    agentsText.includes("synthetic concept-field sub-kernel"),
  noSecretLikeText: !containsSecretLikeValue(forbiddenCombinedText),
};

const blocker = Object.entries(checks).find(([, passed]) => passed !== true)?.[0] ?? null;
const result = {
  phase: "Phase1476",
  completed: blocker === null,
  recommended_sealed: blocker === null,
  blocker,
  checks,
};

writeJson(paths.validation, result);
console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
}, null, 2));

if (blocker) process.exitCode = 1;

function exists(relativePath) {
  return existsSync(resolve(repoRoot, relativePath));
}

function readText(relativePath) {
  const absolutePath = resolve(repoRoot, relativePath);
  if (!existsSync(absolutePath)) return "";
  return readFileSync(absolutePath, "utf8");
}

function readJson(relativePath) {
  const text = readText(relativePath);
  if (!text.trim()) return { exists: false, data: null };
  try {
    return { exists: true, data: JSON.parse(text) };
  } catch {
    return { exists: true, data: null, parseError: true };
  }
}

function writeJson(relativePath, value) {
  const absolutePath = resolve(repoRoot, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function containsSecretLikeValue(text) {
  return [
    /sk-[A-Za-z0-9_-]{20,}/,
    /nvapi-[A-Za-z0-9_-]{20,}/i,
    /AKIA[0-9A-Z]{16}/,
    /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/,
  ].some((pattern) => pattern.test(text));
}
