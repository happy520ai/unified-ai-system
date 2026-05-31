import { renderModeSelectorCards } from "./ModeSelectorCards.js";
import { renderOsNavigationRail } from "./OsNavigationRail.js";

export function renderMissionHomePanel(copy, state) {
  const recommendedMode = state?.recommendedMode || copy.modeCopy.defaultRecommendedMode;
  return `
                  <section class="future-home-panel" aria-label="Mission Control home">
${renderOsNavigationRail()}
                    <div class="future-home-body">
                      <div class="future-home-head">
                        <div>
                          <strong>Mission Control</strong>
                          <span>Your AI OS Command Center</span>
                        </div>
                        <div class="future-system-secure">
                          <i aria-hidden="true"></i>
                          <span>System Secure</span>
                        </div>
                      </div>
                      <div class="future-home-center">
                        <h3>Good morning,<br>Commander.</h3>
                        <p>Describe your mission in natural language. The system will handle the rest.</p>
                      </div>
                      <div class="future-home-spacer" aria-hidden="true"></div>
                      <div class="future-home-mini-input">
                        <span>What do you want to accomplish?</span>
                        <button type="button" aria-label="Preview mission">&rarr;</button>
                      </div>
                      <div class="future-example-row" aria-label="Mission examples">
                        <span>Examples:</span>
                        <button type="button">Analyze financial data</button>
                        <button type="button">Research market trends</button>
                        <button type="button">Generate business report</button>
                      </div>
                      <div class="future-recommended-label">Recommended Mode</div>
${renderModeSelectorCards(copy.modeCopy, recommendedMode)}
                      <div class="future-home-footer">All operations are sandboxed and verifiable. You stay in control.</div>
                    </div>
                  </section>`;
}
