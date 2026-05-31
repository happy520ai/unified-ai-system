import {
  docsPath,
  dryRunEvidencePath,
  executionBoundaryEvidencePath,
  finalEvidencePath,
  modulePath,
  phase1201Boundary,
  readJsonIfExists,
  readTextIfExists,
  runnerPath,
  validationEvidencePath,
  validatorPath,
  writeJson,
} from "./phase1201-common.mjs";

const finalEvidence = await readJsonIfExists(finalEvidencePath, null);
const dryRunEvidence = await readJsonIfExists(dryRunEvidencePath, null);
const executionBoundaryEvidence = await readJsonIfExists(executionBoundaryEvidencePath, null);
const moduleText = await readTextIfExists(modulePath, "");
const docsText = await readTextIfExists(docsPath, "");
const packageText = await readTextIfExists(new URL("../../package.json", import.meta.url), "{}");
const packageJson = JSON.parse(packageText);
const scripts = packageJson.scripts || {};

const checks = {
  moduleExists: Boolean(moduleText),
  runnerEvidenceExists: Boolean(dryRunEvidence),
  finalEvidenceExists: Boolean(finalEvidence),
  docsExists: Boolean(docsText),
  packageRunScriptExists: scripts["run:phase1201-taiji-beidou-minimal-field"] === "node tools/phase1201-physics-field/run-minimal-field-prototype.mjs",
  packageVerifyScriptExists: scripts["verify:phase1201-taiji-beidou-minimal-field"] === "node tools/phase1201-physics-field/validate-minimal-field-prototype.mjs",
  packageSmokeScriptExists: scripts["smoke:phase1201-taiji-beidou-minimal-field:dry-run"] === "node tools/phase1201-physics-field/run-minimal-field-prototype.mjs --dry-run",
  conceptSpaceBuilt: finalEvidence?.conceptSpaceBuilt === true,
  physicalSourcesBuilt: finalEvidence?.physicalSourcesBuilt === true,
  energyFunctionalDefined: finalEvidence?.energyFunctionalDefined === true,
  gradientDescentExecuted: finalEvidence?.gradientDescentExecuted === true,
  steadyStateCandidatesProduced: Array.isArray(finalEvidence?.steadyStateCandidates) && finalEvidence.steadyStateCandidates.length > 0,
  analogySampleName: finalEvidence?.sample?.expression === "king - man + woman",
  topCandidateQueen: finalEvidence?.topCandidate?.word === "queen",
  completionVerified: finalEvidence?.completionVerified === true,
  verificationModeSynthetic: finalEvidence?.verificationMode === "synthetic-dry-run",
  syntheticAnalogyOnly: finalEvidence?.syntheticAnalogyOnly === true,
  realSemanticVerificationNotClaimed: finalEvidence?.realSemanticVerificationCompleted === false,
  realGloveModelNotLoaded: finalEvidence?.realGloveModelLoaded === false,
  prototypeReferenceEngineered: finalEvidence?.prototypeReferenceImplementedAsEngineeringModule === true,
  executionBoundaryNoteExists: Boolean(executionBoundaryEvidence),
  executionBoundaryDeviationDisclosed: executionBoundaryEvidence?.operatorSideProviderCallObservedDuringHealthRecheck === true,
  executionBoundaryNotAttributedToModule: executionBoundaryEvidence?.providerCallAttributedToPhase1201Module === false,
  phaseWideNoProviderPurityNotClaimed: executionBoundaryEvidence?.cannotClaimNoProviderCallsForEntireCodexTurn === true,
  serviceStoppedAfterBoundaryObservation: executionBoundaryEvidence?.serviceStoppedAfterObservation === true,
  gloveGateDocumented: docsText.includes("ALLOW_TAIJI_GLOVE_DOWNLOAD=true") && docsText.includes("默认禁止"),
  noGensimRuntimeLoad: !moduleText.includes("gensim.downloader") && !moduleText.includes("glove-wiki-gigaword-50"),
  isolatedFromChat: finalEvidence?.chatBehaviorChanged === false && finalEvidence?.chatGatewayExecuteBehaviorChanged === false,
  noProviderCalls: finalEvidence?.providerCallsMade === false && finalEvidence?.openaiCalled === false && finalEvidence?.mimoCalled === false,
  noSecrets: finalEvidence?.secretRead === false && finalEvidence?.secretValueExposed === false && finalEvidence?.authJsonRead === false,
  noReleaseActions: finalEvidence?.deployExecuted === false && finalEvidence?.releaseExecuted === false && finalEvidence?.tagCreated === false && finalEvidence?.artifactUploaded === false && finalEvidence?.commitCreated === false && finalEvidence?.pushExecuted === false,
  noWorkspaceCleanClaim: finalEvidence?.workspaceCleanClaimed === false,
  boundaryMatches: matchesBoundary(finalEvidence),
};

const blocker = findBlocker(checks);
const validation = {
  phase: "Phase1201",
  completed: blocker === null,
  recommended_sealed: blocker === null,
  blocker,
  checks,
  files: {
    module: "packages/taiji-beidou-engine/src/minimalFieldPrototype.js",
    runner: "tools/phase1201-physics-field/run-minimal-field-prototype.mjs",
    validator: "tools/phase1201-physics-field/validate-minimal-field-prototype.mjs",
    docs: "docs/phase1201-taiji-beidou-minimal-field-prototype.md",
    dryRunEvidence: "apps/ai-gateway-service/evidence/phase1201-physics-field/taiji-beidou-minimal-field-dry-run-result.json",
    finalEvidence: "apps/ai-gateway-service/evidence/phase1201-physics-field/taiji-beidou-minimal-field-result.json",
    executionBoundaryEvidence: "apps/ai-gateway-service/evidence/phase1201-physics-field/taiji-beidou-minimal-field-execution-boundary-note.json",
  },
};

await writeJson(validationEvidencePath, validation);
console.log(JSON.stringify({
  phase: validation.phase,
  completed: validation.completed,
  recommended_sealed: validation.recommended_sealed,
  blocker: validation.blocker,
  topCandidate: finalEvidence?.topCandidate ?? null,
}, null, 2));

if (blocker) {
  process.exitCode = 1;
}

function matchesBoundary(evidence) {
  if (!evidence) return false;
  const boundary = phase1201Boundary();
  return Object.entries(boundary).every(([key, expected]) => evidence[key] === expected);
}

function findBlocker(checkObject) {
  for (const [key, value] of Object.entries(checkObject)) {
    if (value !== true) return key;
  }
  return null;
}
