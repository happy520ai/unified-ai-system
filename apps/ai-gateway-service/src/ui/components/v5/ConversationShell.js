/**
 * v5 ConversationShell — 对话壳主组装组件（服务端渲染）
 * 取代 OwnerOSShell 成为第一屏。
 * 结构：SystemFirstLine + ReplyField + SuggestionChips + MoreButton + MoreDrawer
 */

import { renderSystemFirstLine } from "./SystemFirstLine.js";
import { renderReplyField } from "./ReplyField.js";
import { renderSuggestionChips } from "./SuggestionChips.js";
import { conversationShellCopy } from "../../copy/conversationShellCopy.js";

// 10 panel imports
import { renderDailyReportPanel } from "../panels/DailyReportPanel.js";
import { renderApprovalPanel } from "../panels/ApprovalPanel.js";
import { renderWorkforceStatusPanel } from "../panels/WorkforceStatusPanel.js";
import { renderMonitoringPanel } from "../panels/MonitoringPanel.js";
import { renderModelManagementPanel } from "../panels/ModelManagementPanel.js";
import { renderProviderConfigPanel } from "../panels/ProviderConfigPanel.js";
import { renderWorkforceManagementPanel } from "../panels/WorkforceManagementPanel.js";
import { renderEngineeringToolsPanel } from "../panels/EngineeringToolsPanel.js";
import { renderAdvancedPanel } from "../panels/AdvancedPanel.js";
import { renderYiyiSettingsPanel } from "../panels/YiyiSettingsPanel.js";

const drawerCards = [
  { icon: "📊", label: "系统监控", desc: "健康、指标、日报", action: "monitoring" },
  { icon: "🤖", label: "模型管理", desc: "模型库、路由、质量", action: "model-management" },
  { icon: "⚙️", label: "运行配置", desc: "Provider、密钥、适配", action: "provider-config" },
  { icon: "👥", label: "员工管理", desc: "能力、岗位、金字塔", action: "workforce-management" },
  { icon: "🛠", label: "工程工具", desc: "审计、限速、安全加固", action: "engineering-tools" },
  { icon: "💬", label: "依依设置", desc: "人格、话术、交互偏好", action: "yiyi-settings" },
];

function renderDrawerCardGrid() {
  return `<div class="v5-drawer-card-grid">
${drawerCards.map((card) => `    <div class="v5-drawer-card" data-panel-action="${card.action}">
      <div class="v5-drawer-card-icon">${card.icon}</div>
      <div class="v5-drawer-card-label">${card.label}</div>
      <div class="v5-drawer-card-desc">${card.desc}</div>
    </div>`).join("\n")}
  </div>`;
}

function renderPanelStore() {
  const panels = [
    { id: "daily-report", render: renderDailyReportPanel },
    { id: "approval", render: renderApprovalPanel },
    { id: "workforce-status", render: renderWorkforceStatusPanel },
    { id: "monitoring", render: renderMonitoringPanel },
    { id: "model-management", render: renderModelManagementPanel },
    { id: "provider-config", render: renderProviderConfigPanel },
    { id: "workforce-management", render: renderWorkforceManagementPanel },
    { id: "engineering-tools", render: renderEngineeringToolsPanel },
    { id: "advanced", render: renderAdvancedPanel },
    { id: "yiyi-settings", render: renderYiyiSettingsPanel },
  ];
  return `<div class="v5-panel-store" id="v5-panel-store" hidden>
${panels.map((p) => `    <div data-v5-panel-id="${p.id}">\n${p.render()}\n    </div>`).join("\n")}
  </div>`;
}

export function renderConversationShell() {
  const c = conversationShellCopy;
  return `
    <section class="v5-conversation-shell" id="v5-conversation-shell" aria-label="对话总控">
      ${renderSystemFirstLine()}
      ${renderReplyField()}
      ${renderSuggestionChips()}
      <button type="button" class="v5-more-button" id="v5-more-button" aria-label="${c.moreLabel}">
        ${c.moreLabel}
      </button>
      <div class="v5-more-drawer" id="v5-more-drawer" hidden aria-label="更多功能">
        <div class="v5-drawer-header">
          <span>更多功能</span>
          <button type="button" class="v5-drawer-close" id="v5-drawer-close" aria-label="${c.closeDrawerLabel}">
            ${c.closeDrawerLabel}
          </button>
        </div>
        <div class="v5-drawer-body" id="v5-drawer-body">
${renderDrawerCardGrid()}
${renderPanelStore()}
        </div>
      </div>
    </section>`;
}
