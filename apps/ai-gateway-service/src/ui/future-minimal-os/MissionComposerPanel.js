import { renderMissionInput } from "./MissionInput.js";

export function renderMissionComposerPanel(copy) {
  return `
                  <section class="future-composer-panel" aria-label="Mission composer">
                    <div class="future-composer-frame">
                      <button type="button" class="future-close-dot" aria-label="Close preview">&times;</button>
                      <div class="future-command-progress future-command-progress-local" aria-label="Mission progress preview">
                        <span class="is-active"><strong>1</strong>Mission</span>
                        <span><strong>2</strong>Plan</span>
                        <span><strong>3</strong>Execute</span>
                        <span><strong>4</strong>Complete</span>
                      </div>
${renderMissionInput(copy)}
                      <div class="future-composer-controls">
                        <div class="future-composer-control">
                          <span>Recommended Mode</span>
                          <strong>God Mode</strong>
                        </div>
                        <div class="future-composer-control has-action">
                          <span>Files (Optional)</span>
                          <strong>sales_q2.csv</strong>
                          <button type="button">+ Add</button>
                        </div>
                        <div class="future-composer-control has-action">
                          <span>Constraints (Optional)</span>
                          <strong>Deadline: 30 min</strong>
                          <button type="button">+ Add</button>
                        </div>
                      </div>
                    </div>
                  </section>`;
}
