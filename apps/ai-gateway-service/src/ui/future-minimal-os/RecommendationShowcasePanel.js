export function renderRecommendationShowcasePanel() {
  return `
                  <section class="future-recommendation-showcase" aria-label="Recommended mode detail">
                    <div class="future-section-head">
                      <strong>Recommended Mode</strong>
                      <button type="button">Why this recommendation?</button>
                    </div>
                    <article class="future-god-feature-card" aria-label="God Mode recommendation">
                      <div class="future-god-icon" aria-hidden="true">◇</div>
                      <div class="future-god-copy">
                        <h3>God Mode</h3>
                        <p>Handles complex analysis with multiple steps and high accuracy.</p>
                        <div class="future-chip-row" aria-label="God Mode strengths">
                          <span>High Capability</span>
                          <span>Multi-step</span>
                          <span>Deep Analysis</span>
                        </div>
                      </div>
                      <em>Best match for your mission</em>
                    </article>
                    <div class="future-mini-mode-grid" aria-label="Other mode options">
                      <article>
                        <i class="future-zap" aria-hidden="true">⌁</i>
                        <strong>Normal Mode</strong>
                        <span>Good for simple tasks</span>
                      </article>
                      <article>
                        <i class="future-sun" aria-hidden="true">✦</i>
                        <strong>Tianshu Mode</strong>
                        <span>Best for extremely hard problems</span>
                      </article>
                    </div>
                    <p class="future-panel-note">ⓘ You can change the mode anytime.</p>
                  </section>`;
}
