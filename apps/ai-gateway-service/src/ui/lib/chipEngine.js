/**
 * v5 Chip Engine — 动态芯片生成引擎
 * 根据系统上下文动态生成建议芯片（最多5个）。
 *
 * 优先级链: 待办 > 系统异常 > 日报 > 上下文 > 最近使用 > 更多
 */

/**
 * 根据上下文生成芯片列表
 * @param {Object} context
 * @param {string} context.systemStatus - 'normal' | 'pending' | 'error' | 'offline'
 * @param {number} context.pendingCount - 待处理项数
 * @param {string|null} context.lastAction - 上一个动作 ('chat' | panelId | null)
 * @param {string[]} context.recentPanels - 最近访问的面板ID列表
 * @returns {Array<{ id: string, label: string, action: string }>}
 */
export function generateChips(context = {}) {
  const {
    systemStatus = 'normal',
    pendingCount = 0,
    lastAction = null,
    recentPanels = [],
  } = context;

  const chips = [];

  // Priority 1: 待审批项
  if (pendingCount > 0) {
    chips.push({
      id: 'approval',
      label: `审批 ${pendingCount} 项`,
      action: 'open:ApprovalPanel',
    });
  }

  // Priority 2: 系统异常
  if (systemStatus === 'error') {
    chips.push({
      id: 'error-check',
      label: '查看异常',
      action: 'open:MonitoringPanel',
    });
  }

  // Priority 3: 日报（高频日常）
  chips.push({
    id: 'daily-report',
    label: '看看日报',
    action: 'open:DailyReportPanel',
  });

  // Priority 4: 上下文感知
  if (lastAction === 'chat' || lastAction === null) {
    chips.push({
      id: 'workforce',
      label: '员工在干嘛',
      action: 'open:WorkforceStatusPanel',
    });
  }

  // Priority 5: 最近使用
  if (recentPanels.length > 0) {
    const lastPanel = recentPanels[0];
    const alreadyInChips = chips.some(c => c.action.includes(lastPanel));
    if (!alreadyInChips) {
      const panelLabel = getPanelLabel(lastPanel);
      chips.push({
        id: 'recent',
        label: `继续看${panelLabel}`,
        action: `open:${lastPanel}`,
      });
    }
  }

  // 始终存在：更多
  chips.push({
    id: 'more',
    label: '\u22ef 更多',
    action: 'toggle-drawer',
  });

  return chips.slice(0, 5);
}

const PANEL_LABELS = {
  DailyReportPanel: '日报',
  ApprovalPanel: '审批',
  WorkforceStatusPanel: '员工状态',
  MonitoringPanel: '监控',
  ModelManagementPanel: '模型',
  ProviderConfigPanel: '配置',
  EngineeringToolsPanel: '工程',
  YiyiSettingsPanel: '依依',
};

function getPanelLabel(panelId) {
  return PANEL_LABELS[panelId] || '面板';
}

/**
 * 将芯片数组渲染为 HTML 字符串
 * @param {Array<{ id: string, label: string, action: string }>} chips
 * @returns {string}
 */
export function renderChipsHtml(chips) {
  return chips
    .map(
      (c) =>
        `<button type="button" class="v5-chip" data-v5-action="${c.action}" data-v5-chip-id="${c.id}">${c.label}</button>`
    )
    .join('\n');
}
