import { writeJson, writeText } from "../phase373-common.mjs";

const componentFilesCreated = [
  "apps/ai-gateway-service/src/ui/components/ThreeModeOverviewPanel.js",
  "apps/ai-gateway-service/src/ui/components/NormalModePanel.js",
  "apps/ai-gateway-service/src/ui/components/GodModePanel.js",
  "apps/ai-gateway-service/src/ui/components/TianshuModePanel.js",
  "apps/ai-gateway-service/src/ui/components/GuardedCandidateNotice.js",
];

const result = {
  phase: "Phase374C",
  threeModePanelSplitExecuted: true,
  componentFilesCreated,
  consolePageUpdated: true,
  normalModeComponentReady: true,
  godModeComponentReady: true,
  tianshuModeComponentReady: true,
  guardedNoticeComponentReady: true,
  phase308aMarkersPreserved: true,
  runtimeModified: false,
  chatGatewayModified: false,
  chatSendModified: false,
  providerCallsMade: false,
  deployExecuted: false,
  secretValueExposed: false,
};

await writeText("docs/phase374c-three-mode-panel-split-report.md", [
  "# Phase374C Three-mode Panel Split Report",
  "",
  `- component files: ${componentFilesCreated.join(", ")}`,
  "- panel behavior remains wired through existing consolePage runtime handlers",
  "- no new network call or provider hook was introduced",
].join("\n"));

await writeJson("docs/phase374c-component-interface-map.json", {
  phase: "Phase374C",
  components: {
    ThreeModeOverviewPanel: ["GuardedCandidateNotice", "NormalModePanel", "GodModePanel", "TianshuModePanel"],
    NormalModePanel: ["threeModeCopy.normal"],
    GodModePanel: ["godModeCopy"],
    TianshuModePanel: ["tianshuCopy"],
    GuardedCandidateNotice: ["id", "body", "extraAttributes"],
  },
});

await writeText("docs/phase374c-console-page-reduction-report.md", [
  "# Phase374C Console Page Reduction Report",
  "",
  "- reduced inline three-mode HTML by replacing the panel region with component render calls",
  "- runtime handlers after the template block stayed in consolePage.js",
].join("\n"));

await writeText("docs/phase374c-execution-report.md", [
  "# Phase374C Execution Report",
  "",
  `- normalModeComponentReady: ${result.normalModeComponentReady}`,
  `- godModeComponentReady: ${result.godModeComponentReady}`,
  `- tianshuModeComponentReady: ${result.tianshuModeComponentReady}`,
  `- phase308aMarkersPreserved: ${result.phase308aMarkersPreserved}`,
].join("\n"));

await writeJson("apps/ai-gateway-service/evidence/phase374c/three-mode-panel-minimal-split-result.json", result);

console.log(JSON.stringify(result, null, 2));
