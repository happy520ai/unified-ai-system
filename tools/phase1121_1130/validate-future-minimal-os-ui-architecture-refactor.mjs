import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { renderFutureMinimalOsPanel } from "../../apps/ai-gateway-service/src/ui/components/FutureMinimalOsPanel.js";

const repoRoot = process.cwd();
const resultPath = resolve(
  repoRoot,
  "apps/ai-gateway-service/evidence/phase1121_1130/future-minimal-os-ui-architecture-refactor-result.json"
);

const requiredFiles = [
  "apps/ai-gateway-service/src/ui/future-minimal-os/index.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/FutureMinimalOsApp.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/layout/FutureMinimalShell.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/layout/SystemTopBar.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/layout/MainWorkspace.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/layout/ProgressiveDetailsDrawer.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/layout/ResponsiveFrame.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/components/TaskComposer.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/components/PrimaryActionButton.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/components/ModeRecommendationCard.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/components/SecurityBoundarySummary.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/components/ModuleCard.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/components/StatusPill.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/components/EmptyState.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/components/ErrorState.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/modules/mission/MissionPreviewModule.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/modules/mission/missionModuleDescriptor.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/modules/modes/ModeRecommendationModule.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/modules/modes/modeModuleDescriptor.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/modules/security/SecurityBoundaryModule.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/modules/security/securityModuleDescriptor.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/modules/provider/ProviderCredentialModule.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/modules/provider/providerModuleDescriptor.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/modules/evidence/EvidenceReplayModule.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/modules/evidence/evidenceModuleDescriptor.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/modules/diagnostics/DiagnosticsModule.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/modules/diagnostics/diagnosticsModuleDescriptor.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/registry/futureMinimalModuleRegistry.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/registry/futureMinimalZones.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/registry/futureMinimalVisibilityRules.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/state/futureMinimalOsState.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/state/futureMinimalPreviewReducer.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/copy/futureMinimalOsCopy.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/copy/modeCopy.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/copy/securityCopy.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/copy/drawerCopy.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/styles/futureMinimalTokens.css",
  "apps/ai-gateway-service/src/ui/future-minimal-os/styles/futureMinimalLayout.css",
  "apps/ai-gateway-service/src/ui/future-minimal-os/styles/futureMinimalComponents.css",
  "apps/ai-gateway-service/src/ui/future-minimal-os/styles/futureMinimalResponsive.css",
  "apps/ai-gateway-service/src/ui/styles/futureMinimalTokens.css",
  "apps/ai-gateway-service/src/ui/styles/futureMinimalLayout.css",
  "apps/ai-gateway-service/src/ui/styles/futureMinimalComponents.css",
  "apps/ai-gateway-service/src/ui/styles/futureMinimalResponsive.css",
  "tools/phase1121_1130/run-future-minimal-os-ui-architecture-refactor-smoke.mjs",
  "docs/phase1121-1130-future-minimal-os-ui-architecture-refactor.md",
  "docs/phase1121-1130-execution-report.md",
  "docs/phase1121-ui-architecture-inventory.md",
  "docs/phase1121-ui-migration-plan.md",
  "docs/phase1130-ui-architecture-refactor-seal-candidate.md"
];

const screenshotFiles = [
  "initial-screen.png",
  "after-preview.png",
  "details-collapsed.png",
  "details-expanded.png",
  "responsive-1024.png",
  "responsive-768.png"
].map((name) => `apps/ai-gateway-service/evidence/phase1121_1130/${name}`);

const readText = (path) => {
  const abs = resolve(repoRoot, path);
  return existsSync(abs) ? readFileSync(abs, "utf8") : "";
};

const countMatches = (text, pattern) => (text.match(pattern) || []).length;
const fileExists = (path) => existsSync(resolve(repoRoot, path));
const importIfExists = async (path) => {
  const abs = resolve(repoRoot, path);
  if (!existsSync(abs)) return {};
  return import(pathToFileURL(abs).href);
};

const result = existsSync(resultPath)
  ? JSON.parse(readFileSync(resultPath, "utf8"))
  : {
      completed: false,
      recommended_sealed: false,
      blocker: "phase1121_1130_result_missing",
      phaseRange: "1121-1130",
      architectureRefactorMode: true,
      partialCompletionAccepted: true
    };

const renderedFuturePanel = renderFutureMinimalOsPanel();
const renderedFuturePanelWithoutStyle = renderedFuturePanel.replace(/<style[\s\S]*?<\/style>/gi, "");
const appSource = readText("apps/ai-gateway-service/src/ui/future-minimal-os/FutureMinimalOsApp.js");
const shellSource = readText("apps/ai-gateway-service/src/ui/future-minimal-os/layout/FutureMinimalShell.js");
const registrySource = readText("apps/ai-gateway-service/src/ui/future-minimal-os/registry/futureMinimalModuleRegistry.js");
const visibilitySource = readText("apps/ai-gateway-service/src/ui/future-minimal-os/registry/futureMinimalVisibilityRules.js");
const stateSource = readText("apps/ai-gateway-service/src/ui/future-minimal-os/state/futureMinimalOsState.js");
const copySource = [
  "apps/ai-gateway-service/src/ui/future-minimal-os/copy/futureMinimalOsCopy.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/copy/modeCopy.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/copy/securityCopy.js",
  "apps/ai-gateway-service/src/ui/future-minimal-os/copy/drawerCopy.js"
].map(readText).join("\n");
const styleSource = [
  "apps/ai-gateway-service/src/ui/future-minimal-os/styles/futureMinimalTokens.css",
  "apps/ai-gateway-service/src/ui/future-minimal-os/styles/futureMinimalLayout.css",
  "apps/ai-gateway-service/src/ui/future-minimal-os/styles/futureMinimalComponents.css",
  "apps/ai-gateway-service/src/ui/future-minimal-os/styles/futureMinimalResponsive.css"
].map(readText).join("\n");
const consoleSource = readText("apps/ai-gateway-service/src/ui/consolePage.js");
const missionControlSource = readText("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js");

const requiredModuleIds = [
  "mission-preview",
  "mode-recommendation",
  "security-boundary",
  "provider-credential",
  "evidence-replay",
  "diagnostics"
];

const registryModule = await importIfExists("apps/ai-gateway-service/src/ui/future-minimal-os/registry/futureMinimalModuleRegistry.js");

const descriptorKeys = [
  "id",
  "title",
  "zone",
  "priority",
  "defaultCollapsed",
  "userVisible",
  "riskLevel",
  "requiresProvider",
  "requiresSecret",
  "renderKey"
];

const descriptors = Array.isArray(registryModule.futureMinimalModuleRegistry) ? registryModule.futureMinimalModuleRegistry : [];
const descriptorContractPresent = descriptors.every((descriptor) =>
  descriptorKeys.every((key) => Object.hasOwn(descriptor, key)) &&
  ["primary", "secondary", "details", "diagnostics"].includes(descriptor.zone) &&
  ["safe-preview-only", "advanced-info", "blocked"].includes(descriptor.riskLevel) &&
  descriptor.requiresProvider === false &&
  descriptor.requiresSecret === false
);

const checks = {
  completed: result.completed === true,
  phaseRange: result.phaseRange === "1121-1130",
  architectureRefactorMode: result.architectureRefactorMode === true,
  futureMinimalOsDirectoryPresent: requiredFiles.every(fileExists),
  shellExtracted: fileExists("apps/ai-gateway-service/src/ui/future-minimal-os/layout/FutureMinimalShell.js") &&
    shellSource.includes("renderFutureMinimalShell") &&
    !/requestJson|fetch\(|provider|secret|chat-gateway\/execute/.test(shellSource),
  layoutExtracted: [
    "layout/SystemTopBar.js",
    "layout/MainWorkspace.js",
    "layout/ProgressiveDetailsDrawer.js",
    "layout/ResponsiveFrame.js"
  ].every((suffix) => fileExists(`apps/ai-gateway-service/src/ui/future-minimal-os/${suffix}`)),
  taskComposerExtracted: fileExists("apps/ai-gateway-service/src/ui/future-minimal-os/components/TaskComposer.js") &&
    renderedFuturePanel.includes("data-future-task-composer=\"true\""),
  primaryActionButtonExtracted: fileExists("apps/ai-gateway-service/src/ui/future-minimal-os/components/PrimaryActionButton.js") &&
    renderedFuturePanel.includes("data-primary-cta=\"true\""),
  modeRecommendationExtracted: fileExists("apps/ai-gateway-service/src/ui/future-minimal-os/components/ModeRecommendationCard.js") &&
    renderedFuturePanel.includes("data-mode-recommendation-card=\"true\""),
  securityBoundaryExtracted: fileExists("apps/ai-gateway-service/src/ui/future-minimal-os/components/SecurityBoundarySummary.js") &&
    renderedFuturePanel.includes("data-security-boundary-summary=\"true\""),
  progressiveDrawerExtracted: fileExists("apps/ai-gateway-service/src/ui/future-minimal-os/layout/ProgressiveDetailsDrawer.js") &&
    renderedFuturePanel.includes("future-os-details-panel"),
  moduleRegistryPresent: fileExists("apps/ai-gateway-service/src/ui/future-minimal-os/registry/futureMinimalModuleRegistry.js") &&
    registrySource.includes("futureMinimalModuleRegistry"),
  moduleDescriptorContractPresent: descriptorContractPresent,
  defaultModulesRegistered: requiredModuleIds.every((id) => descriptors.some((descriptor) => descriptor.id === id)),
  stateLayerExtracted: stateSource.includes("createInitialFutureMinimalOsState") &&
    stateSource.includes("taskText") &&
    stateSource.includes("previewGenerated") &&
    stateSource.includes("recommendedMode") &&
    stateSource.includes("detailsOpen") &&
    stateSource.includes("activeDetailModule") &&
    stateSource.includes("errorState") &&
    stateSource.includes("loadingState") &&
    !/provider request|secret|deployment|chat runtime/i.test(stateSource),
  copyLayerExtracted: copySource.includes("预览执行方案") &&
    copySource.includes("安全预览模式") &&
    copySource.includes("不会读取密钥") &&
    copySource.includes("不会调用真实模型"),
  styleTokensPresent: styleSource.includes("--future-bg") &&
    styleSource.includes("--future-surface") &&
    styleSource.includes("--future-border") &&
    styleSource.includes("--future-text") &&
    styleSource.includes("--future-muted") &&
    styleSource.includes("--future-accent") &&
    styleSource.includes("--future-success") &&
    styleSource.includes("--future-warning") &&
    styleSource.includes("--future-radius") &&
    styleSource.includes("--future-shadow") &&
    styleSource.includes("--future-space") &&
    styleSource.includes("--future-transition"),
  responsiveStylesPresent: styleSource.includes("@media") &&
    styleSource.includes("max-width: 1024px") &&
    styleSource.includes("max-width: 768px"),
  firstScreenPrimaryCtaCount: countMatches(renderedFuturePanel, /data-primary-cta="true"/g) === 1,
  singlePrimaryCtaLocked: renderedFuturePanel.includes(">预览执行方案<") &&
    countMatches(renderedFuturePanel, /class="[^"]*\bfuture-primary-cta\b/g) === 1,
  advancedDetailsDefaultCollapsed: renderedFuturePanel.includes('id="future-os-details-panel"') &&
    renderedFuturePanel.includes('data-details-open="false"') &&
    renderedFuturePanel.includes("hidden"),
  providerDetailsDefaultCollapsed: descriptors.some((descriptor) =>
    descriptor.id === "provider-credential" && descriptor.zone === "details" && descriptor.defaultCollapsed === true
  ),
  evidenceDetailsDefaultCollapsed: descriptors.some((descriptor) =>
    descriptor.id === "evidence-replay" && descriptor.zone === "details" && descriptor.defaultCollapsed === true
  ),
  diagnosticsDefaultHidden: visibilitySource.includes("diagnostics") &&
    descriptors.some((descriptor) => descriptor.id === "diagnostics" && descriptor.zone === "diagnostics" && descriptor.defaultCollapsed === true),
  engineeringNoiseReduced: renderedFuturePanelWithoutStyle.includes("routeDecision") === false &&
    !/>[^<]*raw[^<]*</i.test(renderedFuturePanelWithoutStyle),
  userReadableModeCopyPresent: copySource.includes("普通问题") &&
    copySource.includes("重要问题") &&
    copySource.includes("复杂任务") &&
    renderedFuturePanel.includes("系统建议"),
  securityBoundaryPlainLanguagePresent: copySource.includes("不会读取密钥") &&
    copySource.includes("不会调用真实模型") &&
    copySource.includes("不会部署") &&
    copySource.includes("不会改变默认聊天链路"),
  futureModulesCanRegisterWithoutEditingMainShell: appSource.includes("renderModuleByKey") &&
    appSource.includes("getFutureMinimalModulesForZone") &&
    !shellSource.includes("mission-preview") &&
    !shellSource.includes("provider-credential"),
  providerCallsMade: result.providerCallsMade === false,
  secretValueExposed: result.secretValueExposed === false,
  chatModified: result.chatModified === false,
  chatGatewayExecuteModified: result.chatGatewayExecuteModified === false,
  deployExecuted: result.deployExecuted === false,
  releaseExecuted: result.releaseExecuted === false,
  tagCreated: result.tagCreated === false,
  artifactUploaded: result.artifactUploaded === false,
  yiyiVisible: result.yiyiVisible === false && !/依依|Yiyi|companion|avatar|角色/.test(renderedFuturePanel),
  characterModuleVisible: result.characterModuleVisible === false && !/Character|avatar|companion|角色/.test(renderedFuturePanel),
  realBrowserSmokePassed: result.realBrowserSmokePassed === true,
  screenshotEvidenceGenerated: result.screenshotEvidenceGenerated === true &&
    screenshotFiles.every(fileExists),
  consoleMountsNewApp: missionControlSource.includes("renderFutureMinimalOsPanel") &&
    readText("apps/ai-gateway-service/src/ui/components/FutureMinimalOsPanel.js").includes("renderFutureMinimalOsApp"),
  docsGenerated: [
    "docs/phase1121-1130-future-minimal-os-ui-architecture-refactor.md",
    "docs/phase1121-1130-execution-report.md",
    "docs/phase1121-ui-architecture-inventory.md",
    "docs/phase1121-ui-migration-plan.md",
    "docs/phase1130-ui-architecture-refactor-seal-candidate.md"
  ].every(fileExists),
  packageScriptPresent: readText("package.json").includes("verify:phase1121-1130-future-minimal-os-ui-architecture-refactor")
};

const failedChecks = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
const ok = failedChecks.length === 0 && result.recommended_sealed === true && result.blocker === null;

const verified = {
  ...result,
  completed: result.completed === true,
  recommended_sealed: ok,
  blocker: ok ? null : `phase1121_1130_failed_checks:${failedChecks.join(",")}`,
  partialCompletionAccepted: !ok,
  verifier: {
    ok,
    failedChecks,
    checks,
    checkedAt: new Date().toISOString()
  }
};

mkdirSync(dirname(resultPath), { recursive: true });
writeFileSync(resultPath, `${JSON.stringify(verified, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  ok,
  completed: verified.completed,
  recommended_sealed: verified.recommended_sealed,
  blocker: verified.blocker,
  failedChecks
}, null, 2));

if (!ok) {
  process.exitCode = 1;
}
