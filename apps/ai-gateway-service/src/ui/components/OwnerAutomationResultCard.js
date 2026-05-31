import { ownerAutomationFileActionResultCopy } from "../copy/ownerAutomationCopy.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderOwnerAutomationResultCard(copy = ownerAutomationFileActionResultCopy) {
  if (!copy) return "";

  return `
                  <section class="owner-daily-report-panel owner-automation-result-card" data-owner-automation-result-card="true" aria-label="本地文件动作结果">
                    <strong>${escapeHtml(copy.title)}</strong>
                    <p class="owner-automation-summary">${escapeHtml(copy.summaryLine)}</p>
                    <ul>
                      <li>${escapeHtml(copy.fileNameLine)}</li>
                      <li>${escapeHtml(copy.statusLine)}</li>
                      <li>${escapeHtml(copy.safetyLine)}</li>
                    </ul>
                    <p class="owner-report-note">下一步：${escapeHtml(copy.nextStep)}</p>
                    <details class="owner-automation-advanced-record" data-owner-automation-advanced-record="true">
                      <summary>${escapeHtml(copy.advancedRecordTitle)}</summary>
                      <ul>
                        <li><span>${escapeHtml(copy.filePathLine)}</span></li>
                        <li>动作证据�?code>${escapeHtml(copy.sourceEvidencePath)}</code></li>
                        <li>展示证据�?code>${escapeHtml(copy.integrationEvidencePath)}</code></li>
                      </ul>
                    </details>
                  </section>`;
}


