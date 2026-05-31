import {
  allSourceText,
  boundary,
  containsSecretLikeValue,
  findBlocker,
  makeResult,
  paths,
  readJson,
  readText,
  requiredComponentFiles,
  writeJson,
} from "../phase1486_1505/phase1486-1505-common.mjs";

const precondition = readJson("apps/ai-gateway-service/evidence/phase1476_1485/phase1485-concept-field-experimental-seal.json", null);
const routeGate = readJson("apps/ai-gateway-service/evidence/phase1476-1600-local-self-use-route-a/phase1486-1505aio-result.json", null);
const uiSmoke = readJson(paths.uiSmoke, null);
const responsive = readJson(paths.responsive, null);
const accessibility = readJson(paths.accessibility, null);
const packageJson = readJson("package.json", {});
const missionControl = readText("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js");
const source = `${missionControl}\n${allSourceText()}`;

const checks = {
  preconditionPhase1476To1485Sealed:
    precondition?.completed === true && precondition?.recommended_sealed === true && precondition?.blocker === null,
  routeGatePhase1486To1505Sealed:
    routeGate?.completed === true && routeGate?.recommended_sealed === true && routeGate?.blocker === null,
  uiSmokePassed: uiSmoke?.realBrowserSmokePassed === true && uiSmoke?.blocker === null,
  responsivePassed: responsive?.responsiveNarrowLayoutCheckPassed === true && responsive?.blocker === null,
  accessibilityPassed: accessibility?.accessibilityCopyClarityCheckPassed === true && accessibility?.blocker === null,
  missionControlUsable: uiSmoke?.checks?.missionControlUsable === true,
  conceptFieldVisible: uiSmoke?.checks?.conceptFieldVisible === true,
  routeAffinityExplainable: uiSmoke?.checks?.routeAffinityExplainable === true,
  riskFieldExplainable: uiSmoke?.checks?.riskFieldExplainable === true,
  evidenceCoherenceExplainable: uiSmoke?.checks?.evidenceCoherenceExplainable === true,
  tokenSavingDashboardVisible: uiSmoke?.checks?.tokenSavingDashboardVisible === true,
  dangerousActionButtonDetectedFalse: uiSmoke?.checks?.dangerousActionButtonDetectedFalse === true,
  characterModuleVisibleFalse: uiSmoke?.checks?.characterModuleVisibleFalse === true,
  productionReadyClaimedFalse: uiSmoke?.checks?.productionReadyClaimedFalse === true,
  allBoundaryHeld:
    uiSmoke?.providerCallsMade === false &&
    uiSmoke?.authJsonRead === false &&
    uiSmoke?.chatModified === false &&
    uiSmoke?.chatGatewayExecuteModified === false &&
    responsive?.providerCallsMade === false &&
    accessibility?.providerCallsMade === false,
  noSecretLikeText: !containsSecretLikeValue(source),
  componentFilesPresent: requiredComponentFiles.every((file) => readText(file).length > 80),
  packageScriptsPresent:
    packageJson?.scripts?.["smoke:phase1500-mission-control-taiji-beidou-ui"] ===
      "node tools/phase1500/run-real-browser-mission-control-smoke.mjs && node tools/phase1503/validate-responsive-layout.mjs && node tools/phase1504/validate-accessibility-copy-clarity.mjs && node tools/phase1505/validate-mission-control-ui-seal.mjs" &&
    packageJson?.scripts?.["verify:phase1505-mission-control-ui-seal"] ===
      "node tools/phase1505/validate-mission-control-ui-seal.mjs",
};

const blocker = findBlocker(checks);
const result = makeResult("Phase1505", {
  phaseName: "Mission Control Taiji / Beidou UI Seal",
  completed: blocker === null,
  recommended_sealed: blocker === null,
  blocker,
  missionControlUsable: checks.missionControlUsable,
  conceptFieldVisible: checks.conceptFieldVisible,
  routeAffinityExplainable: checks.routeAffinityExplainable,
  riskFieldExplainable: checks.riskFieldExplainable,
  evidenceCoherenceExplainable: checks.evidenceCoherenceExplainable,
  tokenSavingDashboardVisible: checks.tokenSavingDashboardVisible,
  dangerousActionButtonDetected: false,
  characterModuleVisible: false,
  realBrowserSmokePassed: checks.uiSmokePassed,
  phaseStatuses: Object.fromEntries(
    Array.from({ length: 20 }, (_, index) => {
      const phase = `Phase${1486 + index}`;
      return [phase, { completed: blocker === null, recommended_sealed: blocker === null, blocker: blocker === null ? null : "phase1505_seal_blocked" }];
    }),
  ),
  checks,
  currentSealableRange: blocker === null ? "Phase1486-1505AIO" : "none",
  currentUnsealableRange: blocker === null ? "none_in_phase1486_1505" : "Phase1486-1505AIO",
  rollback: "Remove Phase1486-1505 Mission Control visualization components, package scripts, and phase1486_1505 evidence; keep Phase1476-1485 concept-field evidence unless separately reverting the previous round.",
  nextStageSuggestion: "Proceed to Phase1506-1530AIO only after this UI seal remains completed=true, recommended_sealed=true, blocker=null.",
});

writeJson(paths.seal, result);
writeJson(paths.validation, {
  phaseRange: "Phase1486-1505AIO",
  routeChoice: "local_self_use_only",
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  checks,
  missionControlUsable: result.missionControlUsable,
  conceptFieldVisible: result.conceptFieldVisible,
  routeAffinityExplainable: result.routeAffinityExplainable,
  riskFieldExplainable: result.riskFieldExplainable,
  evidenceCoherenceExplainable: result.evidenceCoherenceExplainable,
  tokenSavingDashboardVisible: result.tokenSavingDashboardVisible,
  dangerousActionButtonDetected: false,
  characterModuleVisible: false,
  productionReadyClaimed: false,
  realBrowserSmokePassed: result.realBrowserSmokePassed,
  providerCallsMade: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  workspaceCleanClaimed: false,
});

console.log(JSON.stringify({
  phaseRange: "Phase1486-1505AIO",
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  realBrowserSmokePassed: result.realBrowserSmokePassed,
}, null, 2));

if (blocker) process.exitCode = 1;
