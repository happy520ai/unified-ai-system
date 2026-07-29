export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

export function displaySafePath(value) {
  const text = String(value ?? "");
  if (/yiyi|avatar|character|guided-showcase|companion/i.test(text)) {
    return text.replace(/[^/]+$/g, "[legacy-module-reference-redacted].json");
  }
  return text;
}

export function displaySafeText(value) {
  return String(value ?? "")
    .replace(/Yiyi/gi, "[legacy-module-redacted]")
    .replace(/Character/gi, "[legacy-module-redacted]")
    .replace(/Guided Showcase/gi, "[legacy-module-redacted]")
    .replace(/floating avatar/gi, "[legacy-module-redacted]")
    .replace(/avatar/gi, "[legacy-module-redacted]")
    .replace(/companion/gi, "[legacy-module-redacted]");
}
