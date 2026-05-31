export function renderOwnerPrimaryAction(copy) {
  return `
                <div class="owner-primary-action" aria-label="老板模式主操�?>
                  <button type="button" class="primary owner-primary-cta" data-owner-boss-action="run-today-check" aria-describedby="owner-boss-view-feedback">
                    <span>${copy.primaryAction}</span>
                    <small>${copy.primaryActionHint}</small>
                  </button>
                </div>`;
}


