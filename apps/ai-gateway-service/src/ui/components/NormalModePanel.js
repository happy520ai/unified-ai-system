import { threeModeCopy } from "../copy/threeModeCopy.js";

export function renderNormalModePanel() {
  return `
                      <div class="three-mode-panel is-active" id="three-mode-panel-normal">
                        <div class="three-mode-grid">
                          <div class="surface-muted three-mode-wide">${threeModeCopy.normal.summary}<span class="sr-only">单模型直达预览普通模式结果</span></div>
                          <div class="field">
                            <label for="three-mode-normal-model">${threeModeCopy.normal.modelLabel}</label>
                            <select id="three-mode-normal-model"></select>
                          </div>
                          <div class="field">
                            <label>${threeModeCopy.normal.descriptionLabel}</label>
                            <div class="surface-muted">${threeModeCopy.normal.descriptionBody}</div>
                          </div>
                          <div class="field">
                            <label>${threeModeCopy.normal.providerLabel}</label>
                            <div class="surface-muted" id="three-mode-normal-provider">waiting</div>
                          </div>
                          <div class="field three-mode-wide">
                            <label for="three-mode-normal-input">${threeModeCopy.normal.inputLabel}</label>
                            <textarea id="three-mode-normal-input" placeholder="${threeModeCopy.normal.inputPlaceholder}"></textarea>
                          </div>
                          <div class="three-mode-candidate-card three-mode-wide" id="three-mode-normal-status-card">
                            <strong>${threeModeCopy.normal.statusTitle}</strong>
                            <ul>
                              <li id="three-mode-normal-selected-model">${threeModeCopy.normal.statusLines[0]}</li>
                              <li id="three-mode-normal-provider-status">${threeModeCopy.normal.statusLines[1]}</li>
                              <li id="three-mode-normal-credential-status">${threeModeCopy.normal.statusLines[2]}</li>
                              <li id="three-mode-normal-governance-status">${threeModeCopy.normal.statusLines[3]}</li>
                            </ul>
                          </div>
                        </div>
                        <button type="button" class="primary" id="three-mode-normal-send">${threeModeCopy.normal.sendLabel}</button>
                      </div>`;
}


