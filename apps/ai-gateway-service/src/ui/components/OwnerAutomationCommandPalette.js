import { ownerAutomationCommandPaletteCopy } from "../copy/ownerAutomationCommandCopy.js";
import { renderOwnerAutomationCommandCard } from "./OwnerAutomationCommandCard.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderOwnerAutomationCommandPalette(copy = ownerAutomationCommandPaletteCopy) {
  if (!copy?.command) return "";

  return `
                  <section class="owner-daily-report-panel owner-automation-command-palette" data-owner-automation-command-palette="true" aria-label="本地自动化能力面板">
                    <div class="owner-automation-command-palette-heading">
                      <strong>${escapeHtml(copy.title)}</strong>
                      <p>${escapeHtml(copy.subtitle)}</p>
                    </div>
${renderOwnerAutomationCommandCard(copy.command)}
                  </section>`;
}


