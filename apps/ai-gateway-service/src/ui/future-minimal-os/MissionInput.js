import { renderPrimaryActionButton } from "./components/PrimaryActionButton.js";

export function renderMissionInput(copy) {
  return `
                  <section class="future-mission-command" data-future-mission-input="true" data-future-task-composer="true" aria-labelledby="future-mission-label">
                    <div class="future-command-label-row">
                      <label id="future-mission-label" for="future-os-task-input">What do you want to accomplish?</label>
                      <span>Plan first. Review the safe preview before anything continues.</span>
                    </div>
                    <div class="future-command-surface">
                      <textarea id="future-os-task-input" rows="3" placeholder="Analyze the Q2 sales data, identify top 5 products by revenue, compare with Q1, and generate a summary report with insights." aria-describedby="future-os-boundary-list future-os-preview-status"></textarea>
                      <div class="future-command-action-row">
                        <span class="future-command-count" aria-hidden="true">0 / 2000</span>
                        ${renderPrimaryActionButton({ label: copy.primaryCta })}
                        <span id="future-os-preview-status">${copy.preview.waiting}</span>
                      </div>
                    </div>
                  </section>`;
}
