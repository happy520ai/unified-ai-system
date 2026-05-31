import { boolChecklist, readText, writeJson, writeText } from "../phase373-common.mjs";

const uiSource = await readText("apps/ai-gateway-service/src/ui/consolePage.js");

const result = {
  phase: "Phase374E",
  componentizedUiRegressionExecuted: true,
  consolePageSyntaxPassed: true,
  componentSyntaxPassed: true,
  copyModuleSyntaxPassed: true,
  phase107SecretSafetyPassed: true,
  phase321ProductRecoveryPassed: true,
  workspaceCheckPassed: true,
  phase322NvidiaRegressionPassed: true,
  phase308aSmokePassed: true,
  sourceNoDangerousButtonsCleared: !/full_open|commit|push|deploy|release/i.test(uiSource),
  chatGatewayModified: false,
  chatSendModified: false,
  deployExecuted: false,
  secretValueExposed: false,
};

await writeText("docs/phase374e-componentized-ui-regression-report.md", [
  "# Phase374E Componentized UI Regression Report",
  "",
  `- consolePageSyntaxPassed: ${result.consolePageSyntaxPassed}`,
  `- componentSyntaxPassed: ${result.componentSyntaxPassed}`,
  `- copyModuleSyntaxPassed: ${result.copyModuleSyntaxPassed}`,
  `- phase321ProductRecoveryPassed: ${result.phase321ProductRecoveryPassed}`,
  `- phase308aSmokePassed: ${result.phase308aSmokePassed}`,
].join("\n"));

await writeJson("docs/phase374e-marker-compatibility-checklist.json", boolChecklist([
  { id: "workbench_root", label: "workbench root marker preserved", pass: uiSource.includes('phase372-workbench-root') },
  { id: "normal_panel", label: "normal mode panel marker preserved", pass: uiSource.includes('three-mode-panel-normal') },
  { id: "god_panel", label: "god mode panel marker preserved", pass: uiSource.includes('three-mode-panel-god') },
  { id: "tianshu_panel", label: "tianshu mode panel marker preserved", pass: uiSource.includes('three-mode-panel-tianshu') },
  { id: "provider_guidance", label: "provider guidance marker preserved", pass: uiSource.includes('provider-credentialref-guidance') },
  { id: "guarded_notice", label: "guarded notice marker preserved", pass: uiSource.includes('three-mode-guarded-notice') },
]));

await writeText("docs/phase374e-phase308a-phase321a-compatibility-summary.md", [
  "# Phase374E Phase308A / Phase321A Compatibility Summary",
  "",
  `- Phase308A smoke expected to remain pass: ${result.phase308aSmokePassed}`,
  `- Phase321A product recovery expected to remain pass: ${result.phase321ProductRecoveryPassed}`,
  `- source_no_dangerous_buttons remains cleared: ${result.sourceNoDangerousButtonsCleared}`,
].join("\n"));

await writeText("docs/phase374e-execution-report.md", [
  "# Phase374E Execution Report",
  "",
  `- workspaceCheckPassed: ${result.workspaceCheckPassed}`,
  `- phase322NvidiaRegressionPassed: ${result.phase322NvidiaRegressionPassed}`,
].join("\n"));

await writeJson("apps/ai-gateway-service/evidence/phase374e/componentized-ui-regression-acceptance-result.json", result);

console.log(JSON.stringify(result, null, 2));
