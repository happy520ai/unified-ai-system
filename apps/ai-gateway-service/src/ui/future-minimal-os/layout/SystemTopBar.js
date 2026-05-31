import { renderVisualSafetyBadges } from "../VisualSafetyBadges.js";

export function renderSystemTopBar(copy) {
  return `
                <div class="future-command-progress" aria-label="Mission progress preview">
                  <span class="is-active"><strong>1</strong>Mission</span>
                  <span><strong>2</strong>Plan</span>
                  <span><strong>3</strong>Review</span>
                  <span><strong>4</strong>Authorize</span>
                </div>
                <header class="future-os-hero">
                  <div class="future-os-title-block">
                    <div class="eyebrow">${copy.eyebrow}</div>
                    <h2 id="future-os-title">${copy.productName} ${copy.title}</h2>
                    <p>${copy.subtitle}</p>
                  </div>
                  ${renderVisualSafetyBadges(copy)}
                </header>`;
}
