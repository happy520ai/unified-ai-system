export function renderOwnerHeroCommand(copy) {
  return `
                <div class="owner-os-hero" data-owner-hero-command="true">
                  <div>
                    <span class="owner-os-mark">${copy.osMark}</span>
                    <h2>${copy.heroQuestion}</h2>
                    <p>${copy.heroSubtitle}</p>
                  </div>
                  <aside class="owner-os-boundary" aria-label="本地保护状�?>
                    <span>${copy.localOnlyBoundary}</span>
                    <small>${copy.localOnlyDetail}</small>
                  </aside>
                </div>`;
}



