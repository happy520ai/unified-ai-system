/**
 * v5 ToneByStatus — 状态→语气映射器
 * 根据系统健康状态和待处理任务数，决定"系统第一句话"的语气和内容。
 */

export const STATUS_TONE_MAP = {
  normal: {
    greeting: "早上好",
    status: "一切正常",
    cta: "想做点什么？",
    tone: "calm",
  },
  pending: {
    greeting: "早上好",
    status: "有 {n} 件事等你确认",
    cta: "先看看？",
    tone: "nudge",
  },
  error: {
    greeting: "早",
    status: "刚才有个任务没跑成",
    cta: "要看看怎么回事吗？",
    tone: "alert",
  },
  offline: {
    greeting: "",
    status: "系统暂时连不上",
    cta: "你可以先告诉我待会儿要做什么。",
    tone: "quiet",
  },
};

const TIME_GREETINGS = [
  { before: 6, text: "夜深了" },
  { before: 9, text: "早上好" },
  { before: 12, text: "上午好" },
  { before: 14, text: "中午好" },
  { before: 18, text: "下午好" },
  { before: 22, text: "晚上好" },
  { before: 24, text: "夜深了" },
];

function getTimeGreeting() {
  const h = new Date().getHours();
  for (const slot of TIME_GREETINGS) {
    if (h < slot.before) return slot.text;
  }
  return "你好";
}

/**
 * 根据系统状态和待处理数量，返回完整的语气对象。
 * @param {string} systemStatus - "ok" | "warn" | "error" | "offline"
 * @param {number} pendingCount - 待处理审批/任务数
 * @returns {{ greeting: string, status: string, cta: string, tone: string, fullText: string }}
 */
export function resolveTone(systemStatus, pendingCount) {
  let key = "normal";
  if (systemStatus === "error" || systemStatus === "warn") key = "error";
  else if (systemStatus === "offline") key = "offline";
  else if (pendingCount > 0) key = "pending";

  const entry = { ...STATUS_TONE_MAP[key] };

  // 替换 {n} 占位符
  if (entry.status.includes("{n}")) {
    entry.status = entry.status.replace("{n}", String(pendingCount));
  }

  // 组合完整文本
  const timeGreet = getTimeGreeting();
  const parts = [];
  if (entry.greeting) {
    parts.push(timeGreet + "。");
  }
  parts.push(entry.status);
  if (entry.cta) {
    parts.push(entry.cta);
  }

  entry.fullText = parts.join("");
  entry.timeGreeting = timeGreet;

  return entry;
}
