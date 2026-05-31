import { scenarioTrialCopy } from "../copy/scenarioTrialCopy.js";

export function renderScenarioDryRunResultPanel() {
  const steps = scenarioTrialCopy.steps
    .map(
      (step) => `
                    <article class="scenario-step">
                      <strong>${step.title}</strong>
                      <p>${step.body}</p>
                    </article>`,
    )
    .join("");

  const badges = scenarioTrialCopy.boundaryBadges
    .map((badge) => `<span>${badge}</span>`)
    .join("");

  return `
                  <section class="scenario-dry-run-result" id="scenario-dry-run-result-panel" data-scenario-dry-run-result="true" hidden>
                    <div class="drilldown-head">
                      <div>
                        <div class="eyebrow">dry-run result</div>
                        <h3>${scenarioTrialCopy.resultTitle}</h3>
                      </div>
                      <span class="tour-chip">recommended mode: Tianshu</span>
                    </div>
                    <div class="scenario-boundary-badges" aria-label="Scenario dry-run boundaries">
                      ${badges}
                    </div>
                    <div class="scenario-step-grid">
${steps}
                    </div>
                    <div class="scenario-mode-explainer" id="scenario-mode-explainer">
                      <article>
                        <strong>Normal Mode</strong>
                        <p>${scenarioTrialCopy.modeExplainers.normal}</p>
                      </article>
                      <article>
                        <strong>God Mode</strong>
                        <p>${scenarioTrialCopy.modeExplainers.god}</p>
                      </article>
                      <article class="is-recommended">
                        <strong>Tianshu Mode</strong>
                        <p>${scenarioTrialCopy.modeExplainers.tianshu}</p>
                      </article>
                    </div>
                    <div class="scenario-replay-preview" id="scenario-evidence-replay-preview">
                      <strong>Evidence Replay preview</strong>
                      <p>${scenarioTrialCopy.evidencePreview}</p>
                      <small>providerCallsMade=false · secretValueExposed=false · deployExecuted=false · billingExecuted=false · invoiceGenerated=false</small>
                    </div>
                  </section>`;
}


