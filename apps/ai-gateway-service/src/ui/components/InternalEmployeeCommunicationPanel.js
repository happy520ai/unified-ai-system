import { internalEmployeeCommunicationCopy } from "../copy/internalEmployeeCommunicationCopy.js";

export function renderInternalEmployeeCommunicationPanel() {
  const badges = internalEmployeeCommunicationCopy.boundaryBadges.map((badge) => `<span>${badge}</span>`).join("");
  const cards = internalEmployeeCommunicationCopy.cards
    .map(([title, body]) => `
                    <article class="internal-communication-card">
                      <strong>${title}</strong>
                      <p>${body}</p>
                    </article>`)
    .join("");

  return `
              <section class="internal-employee-communication-panel" id="internal-employee-communication-panel" data-internal-employee-communication-preview="true">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">internal employee communication</div>
                    <h3>${internalEmployeeCommunicationCopy.title}</h3>
                    <p>${internalEmployeeCommunicationCopy.subtitle}</p>
                  </div>
                  <span class="tour-chip">dry-run bus only</span>
                </div>
                <div class="scenario-boundary-badges" aria-label="Internal employee communication safety boundaries">
                  ${badges}
                </div>
                <div class="internal-communication-grid" id="internal-communication-protocol-grid">
                  ${cards}
                </div>
                <div class="internal-communication-flow-strip" id="internal-communication-evidence-flow">
                  <strong>Scheduler</strong>
                  <span>active employees</span>
                  <span>thread</span>
                  <span>inbox</span>
                  <span>outbox</span>
                  <span>handoff / review</span>
                  <span>evidence timeline</span>
                </div>
                <div class="internal-communication-actions" aria-label="Internal employee communication preview actions">
                  <button type="button" data-internal-communication-action="thread">预览内部员工线程</button>
                  <button type="button" data-internal-communication-action="mention">预览员工 @ 协作</button>
                  <button type="button" data-internal-communication-action="handoff">预览 handoff</button>
                  <button type="button" data-internal-communication-action="objection">预览 objection</button>
                  <button type="button" data-internal-communication-action="summary">预览 council summary</button>
                </div>
                <div class="internal-communication-result" id="internal-communication-result-panel" hidden>
                  <strong id="internal-communication-result-title">Internal communication preview result</strong>
                  <p id="internal-communication-result-copy">${internalEmployeeCommunicationCopy.previews.thread}</p>
                  <small id="internal-communication-boundary-line">externalImConnectorUsed=false; providerCallsMade=false; rawSecretAccessed=false; secretValueExposed=false; maxActiveEmployees=3; maxBrainCalls=0</small>
                </div>
              </section>`;
}


