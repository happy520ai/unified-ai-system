/**
 * DailyReportCopy — 日报面板文案
 */

export const dailyReportCopy = Object.freeze({
  title: "今日日报",
  sections: {
    systemStatus: "系统状态",
    todayTasks: "今日任务",
    pending: "待处理",
    signals: "关键信号",
    summary: "今日摘要",
  },
  states: {
    normal: "一切正常",
    warning: "有异常需要关注",
    error: "存在故障",
    loading: "加载中...",
  },
  signalTypes: {
    ok: "正常",
    warn: "警告",
    error: "异常",
    info: "信息",
  },
  emptySummary: "今天还没有活动记录",
});
