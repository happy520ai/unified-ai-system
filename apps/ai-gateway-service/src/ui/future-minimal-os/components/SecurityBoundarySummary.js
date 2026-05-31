export function renderSecurityBoundarySummary(securityCopy) {
  return `
                <div class="future-boundary-grid" id="future-os-boundary-list" data-security-boundary-summary="true" aria-label="${securityCopy.title}">
                  ${securityCopy.lines.map((line) => `<span>${line}</span>`).join("")}
                </div>`;
}
