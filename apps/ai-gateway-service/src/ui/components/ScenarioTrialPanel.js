import { scenarioTrialCopy } from "../copy/scenarioTrialCopy.js";
import { renderScenarioDryRunResultPanel } from "./ScenarioDryRunResultPanel.js";

export function renderScenarioTrialPanel() {
  return `
              <section class="scenario-trial-panel is-prominent" id="scenario-trial-panel" data-scenario-trial-entry="true" data-scenario-state="ready">
                <div class="scenario-trial-copy">
                  <div class="eyebrow">first real trial path</div>
                  <h3>${scenarioTrialCopy.titleZh} / ${scenarioTrialCopy.title}</h3>
                  <p>${scenarioTrialCopy.subtitleZh}</p>
                  <p>${scenarioTrialCopy.subtitle}</p>
                </div>
                <article class="scenario-sample-task" id="scenario-sample-task-card">
                  <div>
                    <strong>${scenarioTrialCopy.sampleTaskTitle}</strong>
                    <p>${scenarioTrialCopy.sampleTask}</p>
                    <small>${scenarioTrialCopy.dryRunNotice}</small>
                  </div>
                  <div class="scenario-trial-actions" aria-label="Scenario trial actions">
                    <button type="button" class="scenario-action primary" id="start-sample-dry-run-button" data-scenario-action="start">${scenarioTrialCopy.actions.startZh}</button>
                    <button type="button" class="scenario-action" data-scenario-action="modes">${scenarioTrialCopy.actions.modesZh}</button>
                    <button type="button" class="scenario-action" data-scenario-action="shield">${scenarioTrialCopy.actions.shieldZh}</button>
                    <button type="button" class="scenario-action" data-scenario-action="evidence">${scenarioTrialCopy.actions.evidenceZh}</button>
                  </div>
                </article>
${renderScenarioDryRunResultPanel()}
              </section>`;
}


