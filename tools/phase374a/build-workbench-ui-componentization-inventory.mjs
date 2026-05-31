import { readText, writeJson, writeText } from "../phase373-common.mjs";

const uiPath = "apps/ai-gateway-service/src/ui/consolePage.js";
const uiSource = await readText(uiPath);
const lineCount = uiSource.split("\n").length;

const recommendedComponents = [
  "ThreeModeOverviewPanel",
  "NormalModePanel",
  "GodModePanel",
  "TianshuModePanel",
  "ProviderCredentialRefPanel",
  "GuardedCandidateNotice",
];

const result = {
  phase: "Phase374A",
  componentizationInventoryGenerated: true,
  consolePageAnalyzed: true,
  safeSplitPlanGenerated: true,
  recommendedComponents,
  sourceDangerKeywordRiskReviewed: true,
  runtimeSplitRequired: false,
  chatGatewayModified: false,
  chatSendModified: false,
  deployExecuted: false,
  secretValueExposed: false,
};

await writeText("docs/phase374a-workbench-ui-componentization-inventory.md", [
  "# Phase374A Workbench UI Componentization Inventory",
  "",
  `- target file: ${uiPath}`,
  `- lineCount: ${lineCount}`,
  "- split scope: three-mode runtime panels, guarded notice, provider / credentialRef guidance",
  "- excluded scope: event handlers, fetch calls, runtime route logic, chat send flow",
].join("\n"));

await writeJson("docs/phase374a-console-page-section-map.json", {
  phase: "Phase374A",
  uiPath,
  lineCount,
  sections: {
    threeModeRuntime: "chat page embedded panel block",
    normalModePanel: "three-mode-panel-normal",
    godModePanel: "three-mode-panel-god",
    tianshuModePanel: "three-mode-panel-tianshu",
    providerCredentialRef: "provider-credentialref-guarded-notice / provider-credentialref-guidance",
    smokeMarkers: [
      'data-workbench-root="phase372-workbench-root"',
      'id="three-mode-runtime"',
      'id="three-mode-panel-normal"',
      'id="three-mode-panel-god"',
      'id="three-mode-panel-tianshu"',
      'id="provider-credentialref-guidance"',
      'id="three-mode-guarded-notice"',
    ],
  },
});

await writeText("docs/phase374a-minimal-split-plan.md", [
  "# Phase374A Minimal Split Plan",
  "",
  "1. Extract user-visible three-mode copy into `src/ui/copy/` modules.",
  "2. Extract three-mode panels into pure render helpers under `src/ui/components/`.",
  "3. Extract provider / credentialRef guidance into a pure render helper.",
  "4. Keep `consolePage.js` as page entry and retain existing runtime handlers and markers.",
].join("\n"));

await writeText("docs/phase374a-risk-and-rollback-plan.md", [
  "# Phase374A Risk And Rollback Plan",
  "",
  "- risk: marker drift can break Phase308A smoke",
  "- risk: visible wording drift can re-trigger Phase321A source_no_dangerous_buttons",
  "- rollback: restore `consolePage.js` render block and remove extracted pure view modules",
].join("\n"));

await writeText("docs/phase374a-execution-report.md", [
  "# Phase374A Execution Report",
  "",
  `- consolePage analyzed: ${result.consolePageAnalyzed}`,
  `- recommendedComponents: ${recommendedComponents.join(", ")}`,
  `- runtimeSplitRequired: ${result.runtimeSplitRequired}`,
].join("\n"));

await writeJson("apps/ai-gateway-service/evidence/phase374a/workbench-ui-componentization-inventory-result.json", result);

console.log(JSON.stringify(result, null, 2));
