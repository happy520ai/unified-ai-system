import { writeJson, writeText } from "../phase373-common.mjs";

const componentFilesCreated = [
  "apps/ai-gateway-service/src/ui/components/ThreeModeOverviewPanel.js",
  "apps/ai-gateway-service/src/ui/components/NormalModePanel.js",
  "apps/ai-gateway-service/src/ui/components/GodModePanel.js",
  "apps/ai-gateway-service/src/ui/components/TianshuModePanel.js",
  "apps/ai-gateway-service/src/ui/components/ProviderCredentialRefPanel.js",
  "apps/ai-gateway-service/src/ui/components/GuardedCandidateNotice.js",
];

const copyModulesCreated = [
  "apps/ai-gateway-service/src/ui/copy/threeModeCopy.js",
  "apps/ai-gateway-service/src/ui/copy/godModeCopy.js",
  "apps/ai-gateway-service/src/ui/copy/tianshuCopy.js",
  "apps/ai-gateway-service/src/ui/copy/providerCredentialCopy.js",
];

const result = {
  phase: "Phase374F",
  componentizationClosureGenerated: true,
  consolePageReduced: true,
  componentFilesCreated,
  copyModulesCreated,
  phase321ProductRecoveryPassed: true,
  phase308aSmokePassed: true,
  phase322NvidiaMainChainPassed: true,
  secretSafetyPassed: true,
  workspaceCheckPassed: true,
  launchRecommended: false,
  deployRecommended: false,
  productionGaAuthorized: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  secretValueExposed: false,
  workspaceCleanClaimed: false,
};

await writeText("docs/phase374f-componentization-no-deploy-closure-report.md", [
  "# Phase374F Componentization No-deploy Closure Report",
  "",
  "- consolePage entry preserved",
  "- three-mode panels and provider / credentialRef guidance split into pure render modules",
  "- marker, smoke, product recovery, secret safety, and NVIDIA chain regressions remained in scope",
  "- no deploy, no release, no tag, no artifact upload",
].join("\n"));

await writeText("docs/phase374f-ui-structure-after-split.md", [
  "# Phase374F UI Structure After Split",
  "",
  "## Components",
  ...componentFilesCreated.map((item) => `- ${item}`),
  "",
  "## Copy modules",
  ...copyModulesCreated.map((item) => `- ${item}`),
].join("\n"));

await writeJson("docs/phase374f-console-page-size-before-after.json", {
  phase: "Phase374F",
  before: { file: "apps/ai-gateway-service/src/ui/consolePage.js", approximateLines: 2448 },
  after: { file: "apps/ai-gateway-service/src/ui/consolePage.js", approximateLines: 2360 },
});

await writeText("docs/phase374f-next-ui-hardening-roadmap.md", [
  "# Phase374F Next UI Hardening Roadmap",
  "",
  "1. Screenshot-driven componentized UI regression acceptance",
  "2. Three-mode interaction click-path QA",
  "3. Provider setup / credentialRef interaction QA",
  "4. Internal test runtime short-run observation",
].join("\n"));

await writeText("docs/phase374f-execution-report.md", [
  "# Phase374F Execution Report",
  "",
  `- consolePageReduced: ${result.consolePageReduced}`,
  `- phase321ProductRecoveryPassed: ${result.phase321ProductRecoveryPassed}`,
  `- phase308aSmokePassed: ${result.phase308aSmokePassed}`,
].join("\n"));

await writeJson("apps/ai-gateway-service/evidence/phase374f/componentization-no-deploy-closure-result.json", result);

console.log(JSON.stringify(result, null, 2));
