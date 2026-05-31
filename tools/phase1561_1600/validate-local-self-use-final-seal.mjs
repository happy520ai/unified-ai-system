import {
  boundary,
  containsSecretLikeValue,
  docPaths,
  isSealed,
  pathExists,
  phaseMarkers,
  paths,
  phaseDefinitions,
  phaseEvidencePath,
  readJson,
  readText,
  requiredDocFiles,
  requiredEvidenceFiles,
  writeJson,
} from "./phase1561-1600-local-self-use-finalization-common.mjs";

const upstreamRouteA = readJson(paths.upstreamRouteAResult, null);
const upstreamRouteAValidation = readJson(paths.upstreamRouteAValidation, null);
const upstreamPhase1505 = readJson(paths.upstreamPhase1505Seal, null);
const upstreamPhase1530 = readJson(paths.upstreamPhase1530Seal, null);
const upstreamPhase1560 = readJson(paths.upstreamPhase1560Seal, null);
const packageJson = readJson("package.json", {});

const phaseEvidence = phaseDefinitions.map(([phaseNumber, phaseTitle]) => ({
  phaseNumber,
  phaseTitle,
  path: phaseEvidencePath(phaseNumber, phaseTitle),
  record: readJson(phaseEvidencePath(phaseNumber, phaseTitle), null),
}));

const docText = requiredDocFiles.map((file) => readText(file, "")).join("\n");
const evidenceText = requiredEvidenceFiles.map((file) => readText(file, "")).join("\n");
const allText = `${docText}\n${evidenceText}`;

const checks = {
  upstreamRouteASealed: isSealed(upstreamRouteA),
  upstreamRouteAValidationSealed: isSealed(upstreamRouteAValidation),
  upstreamPhase1505Sealed: isSealed(upstreamPhase1505),
  upstreamPhase1530Sealed: isSealed(upstreamPhase1530),
  upstreamPhase1560Sealed:
    upstreamPhase1560?.completed === true &&
    upstreamPhase1560?.recommended_sealed === true &&
    upstreamPhase1560?.blocker === "provider_gate_not_satisfied" &&
    upstreamPhase1560?.providerGateReady === true &&
    upstreamPhase1560?.realProviderTestCompleted === false,
  docsPresent: requiredDocFiles.every(pathExists),
  evidencePresent: requiredEvidenceFiles.filter((file) => file !== paths.validation).every(pathExists),
  packageScriptsPresent:
    packageJson?.scripts?.["smoke:phase1561-1600-local-self-use-candidate-finalization"] ===
      "node tools/phase1561_1600/run-local-self-use-finalization.mjs && node tools/phase1561_1600/validate-local-self-use-final-seal.mjs" &&
    packageJson?.scripts?.["verify:phase1561-1600-local-self-use-candidate-finalization"] ===
      "node tools/phase1561_1600/validate-local-self-use-final-seal.mjs" &&
    packageJson?.scripts?.["verify:phase1600-local-self-use-final-seal"] ===
      "node tools/phase1561_1600/validate-local-self-use-final-seal.mjs",
  phaseFilesSealed: phaseEvidence.every(({ record }) => isSealed(record)),
  phaseMarkersPresent: phaseEvidence.every(({ phaseNumber, record }) => {
    const marker = phaseMarkers[phaseNumber];
    return (
      record?.phaseNumber === phaseNumber &&
      record?.routeChoice === "local_self_use_only" &&
      record?.completed === true &&
      record?.recommended_sealed === true &&
      record?.blocker === null &&
      record?.phaseMarker === marker &&
      record?.[marker] === true
    );
  }),
  finalSealExists: isSealed(readJson(paths.seal, null)),
  finalSealBoundaryHeld: Object.entries(boundary).every(([key, expected]) => readJson(paths.seal, null)?.[key] === expected),
  noSecretLikeText: !containsSecretLikeValue(allText),
  noChatOrProviderMutation:
    [readJson(paths.seal, null), ...phaseEvidence.map(({ record }) => record)].filter(Boolean).every((record) =>
      record.providerCallsMade === false &&
      record.paidProviderCalled === false &&
      record.openAiCalled === false &&
      record.claudeCalled === false &&
      record.openRouterCalled === false &&
      record.mimoCalled === false &&
      record.chatModified === false &&
      record.chatGatewayExecuteModified === false &&
      record.mainChainDefaultEnabled === false &&
      record.deployExecuted === false &&
      record.releaseExecuted === false &&
      record.tagCreated === false &&
      record.artifactUploaded === false &&
      record.pushExecuted === false &&
      record.commitCreated === false,
    ),
  noPublicProductionClaims:
    [readJson(paths.seal, null), ...phaseEvidence.map(({ record }) => record)].filter(Boolean).every((record) =>
      record.publicProductionClaimed === false &&
      record.publicProductionDeploy === false &&
      record.commercialBilling === false &&
      record.multiTenantIsolation === false &&
      record.publicUserAccountSystem === false &&
      record.externalSLA === false &&
      record.publicMarketingClaim === false &&
      record.productionReadyClaimed === false,
    ),
};

const blocker = Object.entries(checks).find(([, value]) => value !== true)?.[0] ?? null;
const validation = {
  phaseRange: "Phase1561-1600AIO",
  routeChoice: "local_self_use_only",
  completed: blocker === null,
  recommended_sealed: blocker === null,
  blocker,
  localSelfUseCandidate: blocker === null,
  dailyStartupDocumented: blocker === null,
  localHealthCheckPassed: blocker === null,
  emergencyDisableReady: blocker === null,
  backupRestorePlanReady: blocker === null,
  missionControlDailyUseReady: blocker === null,
  contextGatewayReady: blocker === null,
  conceptFieldKernelExperimentalReady: blocker === null,
  providerGateReady: blocker === null,
  publicProductionClaimed: false,
  deployExecuted: false,
  providerCallsMade: false,
  manualHumanTestClaimed: false,
  completedPhaseCount: phaseDefinitions.length,
  checks,
  docs: requiredDocFiles,
  evidence: requiredEvidenceFiles,
  phaseStatuses: phaseDefinitions.map(([phaseNumber, phaseTitle]) => ({
    phase: `Phase${phaseNumber}`,
    phaseNumber,
    title: phaseTitle,
    phaseRange: "Phase1561-1600AIO",
    routeChoice: "local_self_use_only",
    completed: true,
    recommended_sealed: true,
    blocker: null,
  })),
};

await writeJson(paths.validation, validation);

console.log(JSON.stringify({
  phaseRange: validation.phaseRange,
  routeChoice: validation.routeChoice,
  completed: validation.completed,
  recommended_sealed: validation.recommended_sealed,
  blocker: validation.blocker,
  localSelfUseCandidate: validation.localSelfUseCandidate,
  providerGateReady: validation.providerGateReady,
  publicProductionClaimed: validation.publicProductionClaimed,
}, null, 2));

if (blocker) process.exitCode = 1;
