import { bugIntakeGovernanceCopy } from "../copy/bugIntakeGovernanceCopy.js";

export function renderBugIntakeGovernancePanel() {
  return `
              <section class="model-routing-panel" id="bug-intake-governance-panel" data-readonly-panel="true" data-fixes-applied-this-phase="false">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase1161-1180</div>
                    <h3>${escapeHtml(bugIntakeGovernanceCopy.title)}</h3>
                  </div>
                  <span class="tour-chip">plan-only</span>
                </div>
                <p class="surface-muted">${escapeHtml(bugIntakeGovernanceCopy.subtitle)}</p>
                <div class="radar-grid">
${bugIntakeGovernanceCopy.severity.map((line) => `                  <span>${escapeHtml(line)}</span>`).join("\n")}
                </div>
                <ul class="surface-muted">
${bugIntakeGovernanceCopy.rules.map((line) => `                  <li>${escapeHtml(line)}</li>`).join("\n")}
                </ul>
              </section>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}


