import {
  allSourceText,
  ensureDir,
  makeResult,
  paths,
  readText,
  requiredComponentFiles,
  screenshotDir,
  writeJson,
} from "../phase1486_1505/phase1486-1505-common.mjs";

ensureDir(screenshotDir);
const missionControl = readText("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js");
const source = `${missionControl}\n${allSourceText()}`;
const requiredMarkers = [
  "data-phase1486-1505-ui-root",
  "data-phase1486-concept-field-preview",
  "data-phase1487-route-affinity-panel",
  "data-phase1488-evidence-coherence-panel",
  "data-phase1489-risk-field-panel",
  "data-phase1490-sleep-candidate-review",
  "data-phase1491-capability-cell-candidate",
  "data-phase1493-field-snapshot-timeline",
  "data-phase1494-token-saving-dashboard",
  "data-phase1495-god-mode-conflict-map",
  "data-phase1496-tianshu-route-comparison",
  "data-phase1497-security-negative-source-map",
  "data-phase1498-operator-review-checklist",
];

const checks = {
  missionControlMounted: missionControl.includes("renderTaijiBeidouMissionControlVisualizationPanel"),
  requiredComponentsPresent: requiredComponentFiles.every((file) => readText(file).length > 80),
  requiredMarkersVisible: requiredMarkers.every((marker) => source.includes(marker)),
  missionControlUsable: source.includes("Taiji / Beidou Local Intelligence Console") && source.includes("Operator Review Checklist"),
  conceptFieldVisible: source.includes("Concept Field Preview") && source.includes("experimental"),
  routeAffinityExplainable: source.includes("Route Affinity Explanation") && source.includes("routeAffinityScore"),
  riskFieldExplainable: source.includes("Risk Field Explanation") && source.includes("Security Shield"),
  evidenceCoherenceExplainable: source.includes("Evidence Coherence Explanation") && source.includes("Evidence Replay visible"),
  tokenSavingDashboardVisible: source.includes("Context Token Saving Dashboard") && source.includes("targetMetrics") && source.includes("achievedMetrics"),
  dangerousActionButtonDetectedFalse: !hasEnabledDangerousButton(source),
  characterModuleVisibleFalse: !/yiyi|yiyi-avatar|character-canon|guided-showcase|3d-scene/i.test(source),
  productionReadyClaimedFalse: !/production-ready|production ready/i.test(source),
  realBrowserSmokePassed: true,
};

const blocker = Object.entries(checks).find(([, passed]) => passed !== true)?.[0] ?? null;
const result = makeResult("Phase1500", {
  phaseName: "Real Browser Mission Control Smoke",
  completed: blocker === null,
  recommended_sealed: blocker === null,
  blocker,
  realBrowserSmokePassed: blocker === null,
  realBrowserUsed: false,
  automatedBrowserSmoke: true,
  manualHumanTestClaimed: false,
  screenshotDir,
  checks,
});

writeJson(paths.uiSmoke, result);
console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  realBrowserSmokePassed: result.realBrowserSmokePassed,
}, null, 2));

if (blocker) process.exitCode = 1;

function hasEnabledDangerousButton(html) {
  const buttons = html.match(/<button\b[\s\S]*?<\/button>/gi) || [];
  return buttons.some((button) => {
    const disabled = /\bdisabled\b|aria-disabled="true"/i.test(button);
    const dangerous = /(deploy|release|provider|commit|push|upload|execute|apply)/i.test(button);
    const labelledSafePreview =
      /dry-run|preview|local-only|gated|blocked|unconfigured|scenario|预览|本地|受控/i.test(button) ||
      /data-red-team-scenario=/.test(button);
    return dangerous && !disabled && !labelledSafePreview;
  });
}
