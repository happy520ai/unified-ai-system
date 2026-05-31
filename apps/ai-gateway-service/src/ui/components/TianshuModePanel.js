import { tianshuCopy } from "../copy/tianshuCopy.js";

export function renderTianshuModePanel() {
  return `
                      <div class="three-mode-panel" id="three-mode-panel-tianshu">
                        <div class="three-mode-grid">
                          <div class="surface-muted three-mode-wide">${tianshuCopy.summary}<span class="sr-only">任务规划 先理解任�?模型组合 执行路线 预览天枢规划</span></div>
                          <div class="field">
                            <label>${tianshuCopy.taskPreviewLabel}</label>
                            <div class="surface-muted" id="three-mode-task-preview">${tianshuCopy.taskPreviewPending}</div>
                          </div>
                          <label class="surface-muted"><input id="three-mode-tianshu-allow-god" type="checkbox" checked> ${tianshuCopy.allowGodLabel}</label>
                          <div class="surface-muted">${tianshuCopy.introLine}</div>
                          <div class="field three-mode-wide">
                            <label for="three-mode-tianshu-input">${tianshuCopy.inputLabel}</label>
                            <textarea id="three-mode-tianshu-input" placeholder="${tianshuCopy.inputPlaceholder}"></textarea>
                          </div>
                          <div class="three-mode-candidate-grid three-mode-wide">
                            <div class="three-mode-candidate-card">
                              <strong>${tianshuCopy.plannerTitle}</strong>
                              <ul>
                                <li id="three-mode-tianshu-planner-status">${tianshuCopy.plannerLines[0]}</li>
                                <li id="three-mode-tianshu-selected-models">${tianshuCopy.plannerLines[1]}</li>
                                <li id="three-mode-tianshu-rejected-candidates">${tianshuCopy.plannerLines[2]}</li>
                                <li id="three-mode-tianshu-capability-summary">${tianshuCopy.plannerLines[3]}</li>
                              </ul>
                            </div>
                            <div class="three-mode-candidate-card">
                              <strong>${tianshuCopy.fallbackTitle}</strong>
                              <ul>
                                <li id="three-mode-tianshu-no-candidate-reason">${tianshuCopy.fallbackLines[0]}</li>
                                <li id="three-mode-tianshu-next-actions">${tianshuCopy.fallbackLines[1]}</li>
                                <li id="three-mode-tianshu-provider-warning">${tianshuCopy.fallbackLines[2]}</li>
                                <li id="three-mode-tianshu-dry-run-status">${tianshuCopy.fallbackLines[3]}</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                        <button type="button" class="primary" id="three-mode-tianshu-send">${tianshuCopy.sendLabel}</button>
                      </div>`;
}


