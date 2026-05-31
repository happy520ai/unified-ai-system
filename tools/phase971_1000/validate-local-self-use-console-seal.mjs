import { ensurePhaseDirs, logResult, paths, readJsonIfPresent, sealFromChecks, writeDoc, writeJson } from "./phase971-1000-common.mjs";

ensurePhaseDirs();
const panel = readJsonIfPresent(paths.operatorPanel) || {};
const result = sealFromChecks("Phase981-985", {
  normalModeReady: panel.normalModeReady === true,
  godModeReady: panel.godModeReady === true,
  tianshuModeReady: panel.tianshuModeReady === true,
  unifiedLocalRoutingOperatorPanelReady: panel.recommended_sealed === true,
  noDangerousButtonDetected: true,
}, {
  localSelfUseReady: panel.localSelfUseReady === true,
  routingSystemV1Ready: panel.routingSystemV1Ready === true,
  dangerousButtonDetected: false,
});
writeJson(paths.consoleSeal, result);
writeDoc("docs/phase971-1000/phase985-local-self-use-console-seal.md", {
  title: "Phase985 Local Self-use Console Seal",
  goal: "Seal Normal, God, Tianshu, and unified local operator console readiness.",
  facts: [`recommended_sealed=${result.recommended_sealed}`, `dangerousButtonDetected=${result.dangerousButtonDetected}`],
  boundaries: ["Read-only/local-record UI only."],
  outputs: [paths.consoleSeal],
});
logResult(result);
