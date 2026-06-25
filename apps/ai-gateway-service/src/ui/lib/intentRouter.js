/**
 * v5 Intent Router — 四级意图路由引擎
 * 根据用户输入文本，匹配到对应面板或直接走聊天路径。
 *
 * 级别链: EXACT_MATCHES → KEYWORD_MATCHES → CATEGORY_PATTERNS → fallback
 */

// Level 1: 精确匹配
const EXACT_MATCHES = {
  '看看日报': 'DailyReportPanel',
  '日报': 'DailyReportPanel',
  '今天做了什么': 'DailyReportPanel',
  '今天完成什么': 'DailyReportPanel',
  '审批': 'ApprovalPanel',
  '待审批': 'ApprovalPanel',
  '有哪些要审批的': 'ApprovalPanel',
  '员工': 'WorkforceStatusPanel',
  '员工状态': 'WorkforceStatusPanel',
  '员工在干嘛': 'WorkforceStatusPanel',
  '模型': 'ModelManagementPanel',
  '模型管理': 'ModelManagementPanel',
  '监控': 'MonitoringPanel',
  '系统状态': 'MonitoringPanel',
  '设置': 'ProviderConfigPanel',
  '配置': 'ProviderConfigPanel',
  '安全': 'EngineeringToolsPanel',
  '依依': 'YiyiSettingsPanel',
};

// 面板名称中文映射（供模糊搜索用）
const PANEL_LABELS = {
  DailyReportPanel: '日报',
  ApprovalPanel: '审批',
  WorkforceStatusPanel: '员工状态',
  MonitoringPanel: '系统监控',
  ModelManagementPanel: '模型管理',
  ProviderConfigPanel: '运行配置',
  WorkforceManagementPanel: '员工管理',
  EngineeringToolsPanel: '工程工具',
  AdvancedPanel: '高级面板',
  YiyiSettingsPanel: '依依设置',
};

// Level 2: 关键词匹配
const KEYWORD_MATCHES = [
  { keywords: ['日报', '完成', '今天做了', '结果'], panel: 'DailyReportPanel' },
  { keywords: ['审批', '批准', '待办', '确认'], panel: 'ApprovalPanel' },
  { keywords: ['员工', 'workforce', '谁在', '在干嘛', '状态'], panel: 'WorkforceStatusPanel' },
  { keywords: ['模型', 'model', '切换模型', '延迟'], panel: 'ModelManagementPanel' },
  { keywords: ['监控', '健康', '异常', '出错', '失败'], panel: 'MonitoringPanel' },
  { keywords: ['设置', '配置', 'provider', '连接'], panel: 'ProviderConfigPanel' },
  { keywords: ['安全', '拦截', '密钥', '风险'], panel: 'EngineeringToolsPanel' },
  { keywords: ['依依', 'yiyi', '陪伴', '性格'], panel: 'YiyiSettingsPanel' },
  { keywords: ['工程', '调试', '路由', 'god mode'], panel: 'EngineeringToolsPanel' },
];

// Level 3: 分类正则模式
const CATEGORY_PATTERNS = [
  { pattern: /看看(.+)/, handler: 'searchPanel' },
  { pattern: /打开(.+)/, handler: 'searchPanel' },
  { pattern: /查看(.+)/, handler: 'searchPanel' },
  { pattern: /(.+)在哪/, handler: 'searchPanel' },
  { pattern: /怎么(.+)/, handler: 'helpSearch' },
];

/**
 * 根据关键词搜索面板名称
 * @param {string} keyword - 用户输入的关键词
 * @returns {{ type: 'panel', panel: string } | null}
 */
export function searchPanelByName(keyword) {
  for (const [panelId, label] of Object.entries(PANEL_LABELS)) {
    if (keyword.includes(label) || label.includes(keyword)) {
      return { type: 'panel', panel: panelId };
    }
  }
  return null;
}

/**
 * 主路由函数：按四级链依次匹配
 * @param {string} userInput - 用户原始输入
 * @returns {{ type: string, panel?: string, text?: string, chips?: Array }}
 */
export function routeIntent(userInput) {
  const input = userInput.trim().toLowerCase();
  if (!input) return { type: 'chat' };

  // Level 1: 精确匹配
  if (EXACT_MATCHES[input]) {
    return { type: 'panel', panel: EXACT_MATCHES[input] };
  }

  // Level 2: 关键词匹配
  for (const rule of KEYWORD_MATCHES) {
    if (rule.keywords.some(kw => input.includes(kw))) {
      return { type: 'panel', panel: rule.panel };
    }
  }

  // Level 3: 分类模式
  for (const cat of CATEGORY_PATTERNS) {
    const match = input.match(cat.pattern);
    if (match) {
      if (cat.handler === 'searchPanel') {
        const result = searchPanelByName(match[1].trim());
        if (result) return result;
      }
      if (cat.handler === 'helpSearch') {
        return { type: 'help', query: match[1].trim() };
      }
    }
  }

  // Level 4: 兜底 → 走聊天
  return { type: 'chat' };
}
