export function renderPrimaryActionButton({ label, id = "future-os-preview-button" }) {
  return `<button type="button" class="primary future-primary-cta" id="${id}" data-primary-cta="true" aria-label="${label}">${label}</button>`;
}
