/**
 * v5 ReplyField — 回话处组件（服务端渲染）
 * 纯对话气泡形态，非传统输入框。
 * 对话气泡由客户端 JS 动态插入 #v5-conversation。
 */

import { conversationShellCopy } from "../../copy/conversationShellCopy.js";

export function renderReplyField() {
  const c = conversationShellCopy;
  return `
    <div class="v5-reply-field" id="v5-reply-field">
      <div class="v5-conversation" id="v5-conversation" role="log" aria-live="polite">
        <!-- 对话气泡由客户端 JS 动态插入 -->
      </div>
      <div class="v5-input-bar">
        <input
          type="text"
          class="v5-input"
          id="v5-input"
          placeholder="${c.placeholder}"
          autocomplete="off"
          aria-label="${c.placeholder}"
        />
        <button type="button" class="v5-send-btn" id="v5-send" aria-label="${c.sendLabel}">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 16V4"/>
            <path d="M4 10l6-6 6 6"/>
          </svg>
        </button>
      </div>
    </div>`;
}
