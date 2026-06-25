/**
 * Toast Component — Neon glassmorphism toast notification
 * Usage: renderToast({ message: "Success!", type: "success", duration: 3000 })
 */
export function renderToast({ message = "", type = "info", duration = 3000, id = "" }) {
  const typeClass = `future-toast--${type}`;
  const icons = {
    success: "✓",
    warning: "⚠",
    error: "✕",
    info: "ℹ",
  };

  return `
    <div class="future-toast ${typeClass}" ${id ? `id="${id}"` : ""} role="alert" aria-live="polite" data-duration="${duration}">
      <span class="future-toast__icon" aria-hidden="true">${icons[type] || "ℹ"}</span>
      <span class="future-toast__message">${message}</span>
      <button type="button" class="future-toast__close" aria-label="Close notification" onclick="this.parentElement.remove()">✕</button>
    </div>
  `;
}

/**
 * Tooltip Component — Neon glassmorphism tooltip
 * Usage: renderTooltip({ content: "Tooltip text", position: "top" })
 */
export function renderTooltip({ content = "", position = "top", id = "" }) {
  return `
    <div class="future-tooltip future-tooltip--${position}" ${id ? `id="${id}"` : ""} role="tooltip" aria-hidden="true">
      <div class="future-tooltip__content">${content}</div>
    </div>
  `;
}

/**
 * Dropdown Component — Neon glassmorphism dropdown
 * Usage: renderDropdown({ trigger: "Select...", items: [{ label: "Option 1", value: "1" }, ...] })
 */
export function renderDropdown({ trigger = "Select...", items = [], id = "" }) {
  const itemsHtml = items
    .map(
      (item) => `
    <button type="button" class="future-dropdown__item" role="option" data-value="${item.value}" ${item.onclick ? `onclick="${item.onclick}"` : ""}>
      ${item.label}
    </button>`
    )
    .join("");

  return `
    <div class="future-dropdown" ${id ? `id="${id}"` : ""} role="combobox" aria-expanded="false" aria-haspopup="listbox">
      <button type="button" class="future-dropdown__trigger" aria-label="Open dropdown">
        <span>${trigger}</span>
        <span class="future-dropdown__arrow" aria-hidden="true">▾</span>
      </button>
      <div class="future-dropdown__menu" role="listbox" aria-label="Options">
        ${itemsHtml}
      </div>
    </div>
  `;
}

/**
 * Progress Bar Component — Neon glassmorphism progress bar
 * Usage: renderProgressBar({ value: 75, max: 100, label: "Loading..." })
 */
export function renderProgressBar({ value = 0, max = 100, label = "", id = "" }) {
  const percent = Math.round((value / max) * 100);

  return `
    <div class="future-progress-bar" ${id ? `id="${id}"` : ""} role="progressbar" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="${max}" aria-label="${label || `Progress: ${percent}%`}">
      ${label ? `<span class="future-progress-bar__label">${label}</span>` : ""}
      <div class="future-progress-bar__track">
        <div class="future-progress-bar__fill" style="width: ${percent}%"></div>
      </div>
      <span class="future-progress-bar__value">${percent}%</span>
    </div>
  `;
}

/**
 * Badge Component — Neon glassmorphism badge
 * Usage: renderBadge({ text: "New", variant: "success" })
 */
export function renderBadge({ text = "", variant = "info", id = "" }) {
  return `
    <span class="future-badge future-badge--${variant}" ${id ? `id="${id}"` : ""} role="status">
      ${text}
    </span>
  `;
}
