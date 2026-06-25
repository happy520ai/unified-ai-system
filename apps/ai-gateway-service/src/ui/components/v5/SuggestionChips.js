/**
 * v5 SuggestionChips — 动态建议芯片组件（服务端渲染）
 * 客户端 JS 会根据系统状态动态更新建议内容和数量。
 */

import { conversationShellCopy } from "../../copy/conversationShellCopy.js";

export function renderSuggestionChips() {
  const s = conversationShellCopy.suggestions;
  return `
    <div class="v5-suggestion-chips" id="v5-suggestions">
      <button type="button" class="v5-chip" data-v5-action="daily-report">${s.dailyReport}</button>
      <button type="button" class="v5-chip" data-v5-action="pending-approvals">${s.pendingApprovals}</button>
      <button type="button" class="v5-chip" data-v5-action="workforce-status">${s.workforceStatus}</button>
    </div>`;
}
