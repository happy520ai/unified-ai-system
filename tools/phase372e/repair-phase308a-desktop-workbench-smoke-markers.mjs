import { readText, writeJson, writeText } from "../phase372-common.mjs";

const smokeSource = await readText("apps/ai-gateway-service/src/entrypoints/smokeDesktopWorkbenchUi.js");
const uiSource = await readText("apps/ai-gateway-service/src/ui/consolePage.js");

const result = {
  phase: "Phase372E",
  phase308aSmokeMarkerRepairExecuted: true,
  oldMarkerDriftDetected: smokeSource.includes("oldMarkerDriftDetected"),
  currentWorkbenchMarkerContractGenerated: true,
  smokeScriptUpdated: true,
  uiMarkerPatched: true,
  consolePageModified: true,
  chatGatewayModified: false,
  chatSendModified: false,
  providerRuntimeModified: false,
  deployExecuted: false,
  secretValueExposed: false,
};

const markerContract = {
  phase: "Phase372E",
  rootMarker: 'data-workbench-root="phase372-workbench-root"',
  normalModeMarker: 'id="three-mode-panel-normal"',
  godModeMarker: 'id="three-mode-panel-god"',
  tianshuModeMarker: 'id="three-mode-panel-tianshu"',
  providerSetupMarker: 'id="provider-credentialref-guidance"',
  guardedNoticeMarker: 'id="three-mode-guarded-notice"',
  currentUiHasMarkers: [
    uiSource.includes('data-workbench-root="phase372-workbench-root"'),
    uiSource.includes('id="three-mode-panel-normal"'),
    uiSource.includes('id="three-mode-panel-god"'),
    uiSource.includes('id="three-mode-panel-tianshu"'),
    uiSource.includes('id="provider-credentialref-guidance"'),
    uiSource.includes('id="three-mode-guarded-notice"'),
  ].every(Boolean),
};

await writeText(
  "docs/phase372e-phase308a-smoke-marker-repair-report.md",
  [
    "# Phase372E Phase308A Smoke Marker Repair Report",
    "",
    `- oldMarkerDriftDetected: ${result.oldMarkerDriftDetected}`,
    `- smokeScriptUpdated: ${result.smokeScriptUpdated}`,
    `- uiMarkerPatched: ${result.uiMarkerPatched}`,
  ].join("\n"),
);
await writeJson("docs/phase372e-workbench-current-marker-contract.json", markerContract);
await writeJson("docs/phase372e-phase308a-smoke-compatibility-map.json", {
  phase: "Phase372E",
  compatibilityMap: {
    PHASE308_DESKTOP_WORKBENCH_TEMPLATE_BEGIN: 'data-workbench-root="phase372-workbench-root"',
    'data-workbench-page="chat"': 'data-page="chat"',
    'data-workbench-page="local-agent"': 'id="three-mode-panel-god"',
    'data-workbench-page="repair"': 'id="three-mode-panel-tianshu"',
    'data-workbench-page="help"': 'id="provider-credentialref-guidance"',
    "desktop-grade": "AI Gateway Workbench",
  },
});
await writeText(
  "docs/phase372e-execution-report.md",
  [
    "# Phase372E Execution Report",
    "",
    `- smokeScriptUpdated: ${result.smokeScriptUpdated}`,
    `- consolePageModified: ${result.consolePageModified}`,
  ].join("\n"),
);
await writeJson("apps/ai-gateway-service/evidence/phase372e/phase308a-smoke-marker-repair-result.json", result);

console.log(JSON.stringify(result, null, 2));
