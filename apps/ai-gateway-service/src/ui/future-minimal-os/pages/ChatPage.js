import { renderStatusPill, renderKPITile } from "./components/NeonComponents.js";
import { renderToast } from "./components/NeonFeedbackComponents.js";

/**
 * Chat Page — Neon glassmorphism chat interface
 */
export function renderChatPage({ messages = [], onSend = "", model = "AI Gateway" }) {
  const messagesHtml = messages
    .map(
      (msg) => `
    <div class="chat-message chat-message--${msg.role}" role="log" aria-label="${msg.role === "user" ? "User" : "AI"} message">
      <div class="chat-message__avatar" aria-hidden="true">
        ${msg.role === "user" ? "👤" : "🤖"}
      </div>
      <div class="chat-message__content">
        <div class="chat-message__header">
          <span class="chat-message__name">${msg.role === "user" ? "You" : model}</span>
          <span class="chat-message__time">${msg.time || ""}</span>
        </div>
        <div class="chat-message__body">${msg.content}</div>
      </div>
    </div>`
    )
    .join("");

  return `
    <div class="chat-page" role="main" aria-label="Chat interface">
      <header class="chat-header">
        <div class="chat-header__info">
          <h1 class="chat-header__title neon-text-cyan">Chat</h1>
          <span class="chat-header__model">${model}</span>
        </div>
        <div class="chat-header__status">
          ${renderStatusPill({ status: "online", label: "Connected" })}
        </div>
      </header>

      <div class="chat-messages" role="log" aria-label="Chat messages" aria-live="polite">
        ${messagesHtml || `
          <div class="chat-empty" role="status">
            <div class="chat-empty__icon" aria-hidden="true">💬</div>
            <p class="chat-empty__text">Start a conversation with ${model}</p>
          </div>
        `}
      </div>

      <form class="chat-input-form" ${onSend ? `onsubmit="${onSend}"` : ""} aria-label="Send message">
        <div class="chat-input-wrapper">
          <textarea
            class="chat-input"
            placeholder="Type your message..."
            aria-label="Message input"
            rows="1"
            ${onSend ? `onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();this.form.requestSubmit()}"` : ""}
          ></textarea>
          <button type="submit" class="chat-send-btn" aria-label="Send message">
            <span aria-hidden="true">→</span>
          </button>
        </div>
        <div class="chat-input-hint" aria-hidden="true">
          Press Enter to send, Shift+Enter for new line
        </div>
      </form>
    </div>
  `;
}
