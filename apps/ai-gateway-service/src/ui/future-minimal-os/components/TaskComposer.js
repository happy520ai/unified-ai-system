import { renderPrimaryActionButton } from "./PrimaryActionButton.js";

export function renderTaskComposer(copy) {
  return `
                <div class="future-os-composer" data-future-task-composer="true">
                  <label for="future-os-task-input">${copy.taskLabel}</label>
                  <textarea id="future-os-task-input" rows="3" placeholder="${copy.taskPlaceholder}" aria-describedby="future-os-boundary-list future-os-preview-status"></textarea>
                  <div class="future-os-action-row">
                    ${renderPrimaryActionButton({ label: copy.primaryCta })}
                    <span id="future-os-preview-status">${copy.preview.waiting}</span>
                  </div>
                </div>`;
}
