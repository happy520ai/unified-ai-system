export function renderVisualSafetyBadges(copy) {
  return `
                  <div class="future-safety-badges" aria-label="${copy.securityCopy.title}">
                    ${copy.securityCopy.lines.map((line) => `<span>${line}</span>`).join("")}
                  </div>`;
}
