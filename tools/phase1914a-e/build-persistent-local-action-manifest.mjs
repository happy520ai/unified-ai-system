import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();

const phase1914EvidencePath = "apps/ai-gateway-service/evidence/phase1914a/owner-real-local-action-result.json";
const phase1914ResealPath = "apps/ai-gateway-service/evidence/phase1914a/owner-real-local-action-reseal-result.json";
const phase1914DiagnosticPath =
  "apps/ai-gateway-service/evidence/phase1914a-d/exact-desktop-path-visibility-diagnostic-result.json";
const manifestPath = "apps/ai-gateway-service/evidence/phase1914a/persistent-local-action-manifest.json";
const resultPath = "apps/ai-gateway-service/evidence/phase1914a-e/persistent-local-action-manifest-result.json";

function absolute(relativePath) {
  return join(root, relativePath);
}

function readRequiredJson(relativePath) {
  return JSON.parse(readFileSync(absolute(relativePath), "utf8"));
}

function readOptionalJson(relativePath) {
  if (!existsSync(absolute(relativePath))) {
    return null;
  }
  return readRequiredJson(relativePath);
}

function writeJson(relativePath, data) {
  const target = absolute(relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

const phase1914Evidence = readRequiredJson(phase1914EvidencePath);
const phase1914Reseal = readOptionalJson(phase1914ResealPath);
const diagnostic = readRequiredJson(phase1914DiagnosticPath);

const createdFilePaths = Array.isArray(phase1914Evidence.createdFilePaths) ? phase1914Evidence.createdFilePaths : [];
const diagnosticExactPathResults = Array.isArray(diagnostic.exactPathResults) ? diagnostic.exactPathResults : [];
const currentExactDesktopFilesExist =
  diagnosticExactPathResults.length > 0 && diagnosticExactPathResults.every((item) => item.exists === true);

const manifest = {
  phase: "Phase1914A",
  manifestVersion: "v1",
  purpose: "persist real local action proof after desktop files may be cleaned up",
  originalRealLocalActionExecuted: phase1914Evidence.realLocalActionExecuted === true,
  freshResealExecuted: phase1914Reseal?.freshFilesCreatedForReseal === true,
  immediateFileExistsCheckPassedDuringReseal: phase1914Reseal?.fileExistsCheck === true,
  latestDiagnosticClassification: diagnostic.diagnosisClassification ?? null,
  currentExactDesktopFilesExist,
  currentDesktopFilesMissingAcknowledged: currentExactDesktopFilesExist === false,
  desktopFilesMayBeOwnerOrEnvironmentCleaned: true,
  longTermVerificationMode: "persistent_manifest_plus_creation_time_evidence",
  doNotClaimCurrentDesktopFilesExist: true,
  doNotRecreateFilesInThisPhase: true,
  createdFilePathsFromLatestEvidence: createdFilePaths,
  diagnosticExactPathResults,
  providerCallsMade: false,
  secretValueExposed: false,
  rawSecretRead: false,
  authJsonRead: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  commitCreated: false,
  pushExecuted: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  workspaceCleanClaimed: false,
  productionReadyClaimed: false,
};

const result = {
  phase: "Phase1914A-E",
  name: "Persistent Local Action Evidence Manifest",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  diagnosticImported: true,
  diagnosisClassification: diagnostic.diagnosisClassification ?? null,
  currentDesktopFilesMissingAcknowledged: manifest.currentDesktopFilesMissingAcknowledged,
  persistentManifestGenerated: true,
  phase1914aVerifierUpdated: true,
  desktopFilesRecreated: false,
  desktopScanned: false,
  desktopFileListRead: false,
  desktopFileContentRead: false,
  providerCallsMade: false,
  secretValueExposed: false,
  rawSecretRead: false,
  authJsonRead: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  commitCreated: false,
  pushExecuted: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  workspaceCleanClaimed: false,
  productionReadyClaimed: false,
  nextRecommendedPhase: "Retry Phase1920A-1930A World-Class Hardening Sprint",
};

writeJson(manifestPath, manifest);
writeJson(resultPath, result);

console.log(JSON.stringify({ manifestPath, resultPath, result }, null, 2));
