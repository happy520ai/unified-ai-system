import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderBugIntakeGovernancePanel } from "../components/BugIntakeGovernancePanel.js";
import { renderLocalSelfUseRoutingV1Panel } from "../components/LocalSelfUseRoutingV1Panel.js";
import { renderOwnerTrialFeedbackPanel } from "../components/OwnerTrialFeedbackPanel.js";
import { renderScenarioDryRunResultPanel } from "../components/ScenarioDryRunResultPanel.js";
import { futureMinimalOsCopy } from "./copy/futureMinimalOsCopy.js";
import { renderErrorState } from "./components/ErrorState.js";
import { renderFutureMinimalShell } from "./layout/FutureMinimalShell.js";
import { renderDiagnosticsModule } from "./modules/diagnostics/DiagnosticsModule.js";
import { renderEvidenceReplayModule } from "./modules/evidence/EvidenceReplayModule.js";
import { renderMissionPreviewModule } from "./modules/mission/MissionPreviewModule.js";
import { renderModeRecommendationModule } from "./modules/modes/ModeRecommendationModule.js";
import { renderProviderCredentialModule } from "./modules/provider/ProviderCredentialModule.js";
import { renderSecurityBoundaryModule } from "./modules/security/SecurityBoundaryModule.js";
import { renderPreviewPlanPanel } from "./PreviewPlanPanel.js";
import { getFutureMinimalModulesForZone } from "./registry/futureMinimalModuleRegistry.js";
import { createInitialFutureMinimalOsState } from "./state/futureMinimalOsState.js";

const moduleDir = dirname(fileURLToPath(import.meta.url));

const renderers = {
  missionPreview: renderMissionPreviewModule,
  modeRecommendation: renderModeRecommendationModule,
  securityBoundary: renderSecurityBoundaryModule,
  providerCredential: renderProviderCredentialModule,
  evidenceReplay: renderEvidenceReplayModule,
  diagnostics: renderDiagnosticsModule
};

function readStyle(name) {
  return readFileSync(resolve(moduleDir, "styles", name), "utf8");
}

function renderFutureMinimalStyles() {
  const css = [
    "futureMinimalTokens.css",
    "futureMinimalLayout.css",
    "futureMinimalComponents.css",
    "futureMinimalResponsive.css",
    "futureMinimalOsStyles.css"
  ].map(readStyle).join("\n");
  return `<style id="future-minimal-os-styles">${css}</style>`;
}

export function renderModuleByKey(descriptor, context) {
  const renderer = renderers[descriptor.renderKey];
  if (!renderer) {
    return renderErrorState(`模块不可用：${descriptor.title}`);
  }
  return renderer(context);
}

function renderZone(zone, context) {
  return getFutureMinimalModulesForZone(zone)
    .map((descriptor) => renderModuleByKey(descriptor, context));
}

function renderSampleBridge(copy) {
  return `
                <section class="future-sample-bridge" id="scenario-trial-panel" data-scenario-trial-entry="true" data-scenario-state="ready" aria-label="Local self-use entries">
                  <div>
                    <div class="eyebrow">${copy.sample.eyebrow}</div>
                    <h3>${copy.sample.title}</h3>
                    <p>${copy.sample.body}</p>
                  </div>
                  <button type="button" class="ghost future-sample-button" id="start-sample-dry-run-button" data-scenario-action="start">${copy.sample.action}</button>
${renderScenarioDryRunResultPanel()}
                </section>
${renderLocalSelfUseRoutingV1Panel()}
${renderOwnerTrialFeedbackPanel()}
${renderBugIntakeGovernancePanel()}`;
}

export function renderFutureMinimalOsApp(options = {}) {
  const copy = options.copy || futureMinimalOsCopy;
  const state = createInitialFutureMinimalOsState(options.state);
  const context = { copy, state };

  return renderFutureMinimalShell({
    copy,
    primaryModules: renderZone("primary", context),
    secondaryModules: renderZone("secondary", context),
    detailModules: renderZone("details", context),
    diagnosticsModules: renderZone("diagnostics", context),
    previewCard: renderPreviewPlanPanel(copy),
    sampleBridge: renderSampleBridge(copy),
    state,
    styleTag: renderFutureMinimalStyles()
  });
}
