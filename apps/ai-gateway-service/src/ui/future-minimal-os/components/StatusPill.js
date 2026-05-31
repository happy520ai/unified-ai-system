export function renderStatusPill({ label, tone = "neutral", dot = false } = {}) {
  return `<span class="future-status-pill future-status-pill--${tone}">${dot ? "<i aria-hidden=\"true\"></i>" : ""}${label}</span>`;
}
