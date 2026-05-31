function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderList(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderPreviewGrid(items = []) {
  return items
    .map(
      (item) => `
                          <div>
                            <span>${escapeHtml(item.label)}</span>
                            <strong>${escapeHtml(item.value)}</strong>
                          </div>`,
    )
    .join("");
}

export function renderOwnerAutomationCommandCard(command) {
  if (!command) return "";
  const realRunEnabled = true;

  return `
                    <article class="owner-automation-command-card" data-owner-automation-command-card="true" data-owner-automation-action-id="${escapeHtml(command.actionId)}">
                      <div class="owner-automation-command-card-main">
                        <span class="owner-card-kicker">${escapeHtml(command.displayName)}</span>
                        <strong>${escapeHtml(command.name)}</strong>
                        <p>${escapeHtml(command.description)}</p>
                        <p class="owner-automation-command-status">${escapeHtml(command.status)}</p>
                      </div>
                      <div class="owner-automation-command-actions" aria-label="命令可用操作">
                        <button type="button" class="owner-command-secondary" data-owner-command-dry-run-preview="true">${escapeHtml(command.dryRunPreviewLabel)}</button>
                        <button type="button" class="owner-command-secondary" data-owner-command-safety="true">${escapeHtml(command.safetyLabel)}</button>
                        <button type="button" class="${realRunEnabled ? "owner-command-enabled-real-run" : "owner-command-enabled-real-run"}" data-owner-command-real-run-gated="true"${realRunEnabled ? " data-owner-command-real-run-enabled=\"true\"" : " enabled"}>${escapeHtml(realRunEnabled ? "????????????????" : command.enabledRealRunLabel)}</button>
                      </div>
                      <div class="owner-command-real-run-lock" data-owner-command-real-run-lock="true">
                        <strong>????????????????????????????????????????????</strong>
                        <span>???????? dry-run????????? owner approval????? 3 ????? 5 ??</span>
                      </div>
                      <details class="owner-automation-command-details owner-command-preview-drawer" data-owner-command-dry-run-entry="true" data-owner-command-dry-run-preview-drawer="true">
                        <summary>${escapeHtml(command.dryRunPreviewLabel)}</summary>
                        <div class="owner-command-preview-drawer-body">
                          <p class="owner-command-preview-primary">${escapeHtml(command.previewIntro)}</p>
                          <p>${escapeHtml(command.previewPrimary)}</p>
                          <div class="owner-command-preview-grid">
${renderPreviewGrid(command.previewGridItems)}
                          </div>
                          <ul>${renderList(command.previewItems)}</ul>
                          <p class="owner-command-preview-muted">${escapeHtml(command.previewMutedLine)}</p>
                          <ul>${renderList(command.previewEvidenceItems)}</ul>
                        </div>
                      </details>
                      <details class="owner-automation-command-details" data-owner-command-safety-boundary="true">
                        <summary>${escapeHtml(command.safetyLabel)}</summary>
                        <ul>${renderList(command.safetyItems)}</ul>
                      </details>
                      <details class="owner-automation-command-details" data-owner-command-evidence-drawer="true">
                        <summary>${escapeHtml(command.advancedRecordLabel)}</summary>
                        <p>${escapeHtml(command.approvalRequiredLine)}</p>
                        <ul>${renderList(command.advancedRecordItems)}</ul>
                      </details>
                    </article>`;
}


