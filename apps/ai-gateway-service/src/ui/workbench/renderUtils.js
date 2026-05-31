export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function toDisplayText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export function toBooleanLabel(value, trueLabel = "是", falseLabel = "否") {
  return value ? trueLabel : falseLabel;
}
