import {
  boundaryHeld,
  containsSecretLikeValue,
  expectedPackageScripts,
  findBlocker,
  makePhaseStatuses,
  makeResult,
  pathExists,
  paths,
  phaseRange,
  providerGateHeld,
  readJson,
  readText,
  requiredDocFiles,
  requiredEvidenceFiles,
  requiredToolFiles,
  routeChoice,
  summarize,
  writeJson,
} from "../phase1531_1560/phase1531-1560-common.mjs";

const previousSeal = readJson(paths.previousDogfoodingSeal, null);
const packageJson = readJson("package.json", {});
const evidenceRecords = requiredEvidenceFiles
  .filter((file) => file !== paths.seal)
  .map((file) => readJson(file, null))
  .filter(Boolean);
const docsText = requiredDocFiles.map((file) => readText(file, "")).join("\n");
const evidenceText = requiredEvidenceFiles.map((file) => readText(file, "")).join("\n");
const allPhaseSources = [
  readText("tools/phase1531_1560/phase1531-1560-common.mjs", ""),
  readText("tools/phase1532/validate-credentialref-readiness.mjs", ""),
  readText("tools/phase1533/validate-provider-budget-rate-gate.mjs", ""),
  readText("tools/phase1534/run-nvidia-small-request-test.mjs", ""),
  readText("tools/phase1539/validate-provider-failure-recovery.mjs", ""),
  readText("tools/phase1540/validate-secret-safety-regression.mjs", ""),
  readText("tools/phase1550/validate-provider-emergency-disable.mjs", ""),
  readText("tools/phase1560/validate-guarded-real-provider-local-test-seal.mjs", ""),
].join("\n");

const checks = {
  previousPhase1506To1530Sealed:
    previousSeal?.completed === true &&
    previousSeal?.recommended_sealed === true &&
    previousSeal?.blocker === null,
  docsPresent: requiredDocFiles.every(pathExists),
  toolsPresent: requiredToolFiles.every(pathExists),
  evidencePresent: requiredEvidenceFiles.filter((file) => file !== paths.seal).every(pathExists),
  packageScriptsPresent: Object.entries(expectedPackageScripts).every(
    ([name, command]) => packageJson?.scripts?.[name] === command,
  ),
  approvalPacketGenerated: readJson(paths.approvalPacketEvidence, null)?.approvalPacketGenerated === true,
  credentialRefReadinessGated:
    readJson(paths.credentialRefReadiness, null)?.credentialRefReadinessChecked === true &&
    readJson(paths.credentialRefReadiness, null)?.credentialRefExists === false,
  budgetGateReady:
    readJson(paths.budgetRateGate, null)?.budgetGateReady === true &&
    readJson(paths.budgetRateGate, null)?.maxRequests <= 20 &&
    readJson(paths.budgetRateGate, null)?.maxEstimatedCostUsd <= 1,
  nvidiaSmallTestsGated:
    readJson(paths.nvidiaTenRequestTest, null)?.testStatus === "gated_skipped" &&
    readJson(paths.nvidiaTwentyRequestTest, null)?.testStatus === "gated_skipped" &&
    readJson(paths.nvidiaTenRequestTest, null)?.providerCallsMade === false &&
    readJson(paths.nvidiaTwentyRequestTest, null)?.providerCallsMade === false,
  evidenceReplayTraceReady: readJson(paths.evidenceReplayTrace, null)?.evidenceReplayTraceReady === true,
  failureRecoveryReady: readJson(paths.failureRecovery, null)?.providerFailureRecoveryReady === true,
  secretSafetyRegressionReady:
    readJson(paths.secretSafetyRegression, null)?.secretSafetyRegressionReady === true &&
    readJson(paths.secretSafetyRegression, null)?.secretLikeDetected === false,
  emergencyDisableReady: readJson(paths.emergencyDisable, null)?.providerEmergencyDisableReady === true,
  uiStatusHardened:
    readJson(paths.providerUiStatusHardening, null)?.providerUiStatusHardeningReady === true &&
    readJson(paths.providerUiStatusHardening, null)?.dangerousActionButtonDetected === false,
  knownLimitsReady: readJson(paths.providerKnownLimits, null)?.providerKnownLimitsReady === true,
  boundaryHeld: evidenceRecords.every(boundaryHeld),
  providerGateHeld: evidenceRecords.every(providerGateHeld),
  noProviderCallsMade: evidenceRecords.every((record) => record.providerCallsMade === false && record.requestCount === 0),
  noForbiddenProviderCalls: evidenceRecords.every(
    (record) =>
      record.openAiCalled === false &&
      record.claudeCalled === false &&
      record.openRouterCalled === false &&
      record.mimoCalled === false &&
      record.paidProviderCalled === false,
  ),
  noSecretLikeText: !containsSecretLikeValue(`${docsText}\n${evidenceText}`),
  noNetworkExecutionCode: !hasNetworkExecutionCode(allPhaseSources),
  chatDefaultsUnchanged:
    evidenceRecords.every((record) => record.chatModified === false && record.chatGatewayExecuteModified === false) &&
    evidenceRecords.every((record) => record.mainChainDefaultEnabled === false),
  noDeployPushCommit:
    evidenceRecords.every(
      (record) =>
        record.deployExecuted === false &&
        record.releaseExecuted === false &&
        record.tagCreated === false &&
        record.artifactUploaded === false &&
        record.pushExecuted === false &&
        record.commitCreated === false,
    ),
  noProductionProviderReadyClaim: evidenceRecords.every((record) => record.productionProviderReadyClaimed === false),
};

const validationBlocker = findBlocker(checks);
const seal = makeResult("Phase1560", {
  phaseName: "Guarded Real Provider Local Test Seal",
  completed: validationBlocker === null,
  recommended_sealed: validationBlocker === null,
  blocker: validationBlocker === null ? "provider_gate_not_satisfied" : validationBlocker,
  sealType: "provider_gate_ready_real_provider_test_gated",
  providerGateReady: validationBlocker === null,
  realProviderTestCompleted: false,
  evidenceReplayTraceReady: checks.evidenceReplayTraceReady,
  mainChainDefaultEnabled: false,
  requestCount: 0,
  estimatedCostUsd: 0,
  phaseStatuses: makePhaseStatuses(validationBlocker === null ? "provider_gate_not_satisfied" : validationBlocker),
  currentSealableRange:
    validationBlocker === null
      ? "Phase1531-1560AIO provider gate framework, approval packet, budget/rate guard, gated skip evidence, emergency disable, and redaction checks"
      : "none",
  currentUnsealableRange:
    "realProviderTestCompleted, production provider readiness, public service exposure, default main-chain enablement",
  rollback:
    "Remove tools/phase1531_1560, tools/phase1532, tools/phase1533, tools/phase1534, tools/phase1539, tools/phase1540, tools/phase1550, tools/phase1560, docs/phase1531/1545/1555 approval docs, package scripts, sync wording, and apps/ai-gateway-service/evidence/phase1531_1560. Do not use destructive git reset without explicit approval.",
  nextStageSuggestion:
    "Do not proceed to a real provider completion or Phase1561-1600 closure until providerRef and credentialRef readiness are explicitly approved without recording raw secret or raw CredentialRef values.",
});

writeJson(paths.seal, seal);

const validation = makeResult("Phase1560", {
  phaseName: "Guarded Real Provider Local Test Seal Validation",
  completed: validationBlocker === null,
  recommended_sealed: validationBlocker === null,
  blocker: validationBlocker === null ? "provider_gate_not_satisfied" : validationBlocker,
  gateFrameworkValidationPassed: validationBlocker === null,
  providerGateReady: validationBlocker === null,
  realProviderTestCompleted: false,
  checks,
  summary: summarize(evidenceRecords),
});

writeJson(paths.validation, validation);

console.log(JSON.stringify({
  phaseRange,
  routeChoice,
  completed: validation.completed,
  recommended_sealed: validation.recommended_sealed,
  blocker: validation.blocker,
  providerGateReady: validation.providerGateReady,
  realProviderTestCompleted: validation.realProviderTestCompleted,
  providerCallsMade: false,
}, null, 2));

if (validationBlocker) process.exitCode = 1;

function hasNetworkExecutionCode(source) {
  const callTokens = [
    String.fromCharCode(102, 101, 116, 99, 104),
    String.fromCharCode(97, 120, 105, 111, 115),
    String.fromCharCode(117, 110, 100, 105, 99, 105),
    String.fromCharCode(103, 111, 116),
  ];
  const moduleTokens = [
    `node:${String.fromCharCode(104, 116, 116, 112)}`,
    `node:${String.fromCharCode(104, 116, 116, 112, 115)}`,
  ];
  const memberPattern = new RegExp(`\\b${String.fromCharCode(104, 116, 116, 112)}s?\\.`, "i");
  return String(source)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//") && !line.startsWith("*"))
    .some((line) => {
      if (moduleTokens.some((token) => line.includes(token))) return true;
      if (memberPattern.test(line)) return true;
      return callTokens.some((token) => new RegExp(`(?:^|\\s)${token}\\s*\\(`, "i").test(line));
    });
}
