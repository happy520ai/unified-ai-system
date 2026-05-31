export function renderOwnerTaskInput(copy) {
  return `
                <div class="owner-task-input-panel" data-owner-task-input-panel="true" aria-label="老板任务输入入口">
                  <label for="owner-task-input">${copy.taskInputLabel}</label>
                  <textarea
                    id="owner-task-input"
                    data-owner-task-input="true"
                    rows="3"
                    placeholder="${copy.taskInputPlaceholder}"
                    aria-describedby="owner-task-input-help owner-boss-view-feedback"
                  ></textarea>
                  <small id="owner-task-input-help">${copy.taskInputHelp}</small>
                </div>`;
}


