import { godModeCopy } from "../copy/godModeCopy.js";

export function renderGodModePanel() {
  return `
                      <div class="three-mode-panel" id="three-mode-panel-god">
                        <div class="three-mode-grid">
                          <div class="surface-muted three-mode-wide">${godModeCopy.summary}<span class="sr-only">多模型互评预览 God Mode 方案</span></div>
                          <div class="field">
                            <label for="three-mode-god-participants">${godModeCopy.participantLabel}</label>
                            <select id="three-mode-god-participants" multiple></select>
                          </div>
                          <div class="field">
                            <label for="three-mode-god-supervisor">${godModeCopy.supervisorLabel}</label>
                            <select id="three-mode-god-supervisor"></select>
                          </div>
                          <div class="field">
                            <label for="three-mode-god-max-participants">${godModeCopy.maxParticipantsLabel}</label>
                            <input id="three-mode-god-max-participants" type="number" min="2" max="5" value="3">
                          </div>
                          <label class="surface-muted"><input id="three-mode-god-auto" type="checkbox" checked> ${godModeCopy.autoSelectLabel}</label>
                          <div class="surface-muted">${godModeCopy.introLines[0]}</div>
                          <div class="surface-muted">${godModeCopy.introLines[1]}</div>
                          <div class="field three-mode-wide">
                            <label for="three-mode-god-input">${godModeCopy.inputLabel}</label>
                            <textarea id="three-mode-god-input" placeholder="${godModeCopy.inputPlaceholder}"></textarea>
                          </div>
                          <div class="three-mode-candidate-grid three-mode-wide">
                            <div class="three-mode-candidate-card">
                              <strong>${godModeCopy.conflictTitle}</strong>
                              <ul>
                                <li id="three-mode-god-participant-summary">${godModeCopy.conflictLines[0]}</li>
                                <li id="three-mode-god-conflict-level">${godModeCopy.conflictLines[1]}</li>
                                <li id="three-mode-god-disagreement-points">${godModeCopy.conflictLines[2]}</li>
                                <li id="three-mode-god-fallback-reason">${godModeCopy.conflictLines[3]}</li>
                              </ul>
                            </div>
                            <div class="three-mode-candidate-card">
                              <strong>${godModeCopy.transparencyTitle}</strong>
                              <ul>
                                <li id="three-mode-god-supervisor-status">${godModeCopy.transparencyLines[0]}</li>
                                <li id="three-mode-god-supervisor-basis">${godModeCopy.transparencyLines[1]}</li>
                                <li id="three-mode-god-supervisor-uncertainty">${godModeCopy.transparencyLines[2]}</li>
                                <li id="three-mode-god-warning-status">${godModeCopy.transparencyLines[3]}</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                        <button type="button" class="primary" id="three-mode-god-send">${godModeCopy.sendLabel}</button>
                      </div>`;
}


