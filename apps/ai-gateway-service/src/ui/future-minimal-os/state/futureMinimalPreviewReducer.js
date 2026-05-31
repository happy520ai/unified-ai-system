import { createInitialFutureMinimalOsState } from "./futureMinimalOsState.js";

export function inferFutureMinimalMode(taskText = "") {
  const text = String(taskText || "").trim();
  if (!text) return { mode: "Tianshu", label: "复杂任务", whyKey: "tianshuWhy" };

  const lower = text.toLowerCase();
  const godHints = ["风险", "审查", "审核", "重要", "决定", "评估", "review", "risk"];
  const tianshuHints = ["计划", "步骤", "阶段", "复杂", "拆解", "路线", "规划", "plan"];

  if (godHints.some((hint) => lower.includes(hint))) {
    return { mode: "God", label: "重要判断", whyKey: "godWhy" };
  }
  if (tianshuHints.some((hint) => lower.includes(hint)) || text.length > 80) {
    return { mode: "Tianshu", label: "复杂任务", whyKey: "tianshuWhy" };
  }
  return { mode: "Normal", label: "普通问题", whyKey: "normalWhy" };
}

export function futureMinimalPreviewReducer(state = createInitialFutureMinimalOsState(), action = {}) {
  switch (action.type) {
    case "task_changed":
      return {
        ...state,
        taskText: String(action.taskText || ""),
        errorState: null
      };
    case "preview_requested": {
      const recommendation = inferFutureMinimalMode(state.taskText);
      return {
        ...state,
        previewGenerated: true,
        recommendedMode: recommendation.mode,
        loadingState: false,
        errorState: null
      };
    }
    case "details_opened":
      return {
        ...state,
        detailsOpen: true,
        activeDetailModule: action.activeDetailModule || state.activeDetailModule
      };
    case "details_closed":
      return {
        ...state,
        detailsOpen: false,
        activeDetailModule: null
      };
    case "preview_failed":
      return {
        ...state,
        loadingState: false,
        errorState: action.errorState || "preview_unavailable"
      };
    default:
      return state;
  }
}
