const DESKTOP_TABLE_PATTERNS = [
  /桌面.*(表格|表|csv|xlsx)/u,
  /(建|创建|新建).*(表格|表|csv|xlsx)/u,
  /desktop.*(spreadsheet|csv|xlsx|table)/iu,
  /(创建|新建|建).*桌面.*(csv|表格)/u,
  /桌面.*csv/iu,
  /(csv|表格).*创建/u,
  /任务表/u,
  /桌面.*(创建|建|新建)文件/u,
  /帮.*(我|俺).*(桌面|desktop).*(创建|建|新建)/iu,
];

export function parseLocalActionIntent(prompt = "") {
  const text = String(prompt ?? "").trim();
  if (!text) {
    return { matched: false, actionId: null, confidence: 0, reason: "empty_prompt" };
  }
  const matched = DESKTOP_TABLE_PATTERNS.some((pattern) => pattern.test(text));
  if (!matched) {
    return { matched: false, actionId: null, confidence: 0.12, reason: "no_local_desktop_table_intent" };
  }
  return {
    matched: true,
    actionId: "create_desktop_spreadsheet",
    confidence: 0.92,
    reason: "desktop_spreadsheet_intent_detected",
    input: {
      actionId: "create_desktop_spreadsheet",
      filenamePrefix: "小天聊天触发测试",
      fileType: "csv",
      headers: inferHeaders(text),
      rows: [["示例任务", "待处理", "由 /chat proposal 生成"]],
    },
  };
}

function inferHeaders(text) {
  const match = text.match(/列(?:是|为)?([^，。,.]+)/u);
  if (!match) return ["任务", "状态", "备注"];
  const headers = match[1]
    .split(/[、,，\s]+/u)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
  return headers.length > 0 ? headers : ["任务", "状态", "备注"];
}
