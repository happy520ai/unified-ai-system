/**
 * ApprovalCopy — 审批面板文案
 */

export const approvalCopy = Object.freeze({
  title: "待审批",
  sections: {
    pending: "等你确认",
    recent: "最近处理",
  },
  states: {
    empty: "当前没有待审批事项",
    loading: "加载中...",
    approved: "已通过",
    rejected: "已拒绝",
    pending: "等待中",
  },
  actions: {
    approve: "通过",
    reject: "拒绝",
    viewDetail: "查看详情",
  },
});
