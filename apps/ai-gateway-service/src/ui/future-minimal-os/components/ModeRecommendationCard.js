export function renderModeRecommendationCard(mode, recommendedMode = "Tianshu") {
  const recommended = mode.name === recommendedMode;
  const status = recommended ? "推荐" : "可选";
  return `
                  <article class="future-mode-card${recommended ? " is-recommended" : ""}" data-future-mode="${mode.name.toLowerCase()}" data-mode-recommendation-card="true">
                    <div class="future-mode-head">
                      <span>${mode.name}</span>
                      <small>${status}</small>
                    </div>
                    <strong>${mode.plainName}</strong>
                    <p>${mode.summary}</p>
                  </article>`;
}
