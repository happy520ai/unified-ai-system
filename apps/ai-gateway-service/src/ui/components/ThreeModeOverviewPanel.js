import { threeModeCopy } from "../copy/threeModeCopy.js";
import { renderGuardedCandidateNotice } from "./GuardedCandidateNotice.js";
import { renderNormalModePanel } from "./NormalModePanel.js";
import { renderGodModePanel } from "./GodModePanel.js";
import { renderTianshuModePanel } from "./TianshuModePanel.js";

export function renderThreeModeOverviewPanel() {
  return `
                  <section class="three-mode-runtime" id="three-mode-runtime" aria-label="Three Mode Runtime">
                    <div class="row">
                      <strong>${threeModeCopy.runtimeTitle}</strong>
                      <span class="inline-status ok" id="three-mode-safety-badge">${threeModeCopy.safetyBadge}</span>
                    </div>
                    ${renderGuardedCandidateNotice({ id: "three-mode-guarded-notice", body: threeModeCopy.guardedNotice })}
                    <div class="three-mode-tabs" id="three-mode-tabs">
                      <button type="button" class="three-mode-tab is-active" data-three-mode="normal">${threeModeCopy.tabs.normal}</button>
                      <button type="button" class="three-mode-tab" data-three-mode="god">${threeModeCopy.tabs.god}</button>
                      <button type="button" class="three-mode-tab" data-three-mode="tianshu">${threeModeCopy.tabs.tianshu}</button>
                    </div>
                    <div class="three-mode-panels">
${renderNormalModePanel()}
${renderGodModePanel()}
${renderTianshuModePanel()}
                    </div>
                    <div class="three-mode-result">
                      <div class="surface-muted">
                        <strong>${threeModeCopy.result.resultTitle}</strong>
                        <pre id="three-mode-result-output">${threeModeCopy.result.resultEmpty}</pre>
                      </div>
                      <div class="surface-muted">
                        <strong>${threeModeCopy.result.auditTitle}</strong>
                        <pre id="three-mode-audit-output">${threeModeCopy.result.auditEmpty}</pre>
                      </div>
                      <div class="surface-muted">
                        <strong>${threeModeCopy.result.telemetryTitle}</strong>
                        <pre id="three-mode-telemetry-output">${threeModeCopy.result.telemetryBody}</pre>
                      </div>
                    </div>
                  </section>`;
}


