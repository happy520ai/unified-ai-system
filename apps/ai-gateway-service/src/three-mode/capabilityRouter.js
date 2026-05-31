import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function classifyThreeModeTask(input) {
  const text = String(input ?? "").toLowerCase();
  if (/code|代码|审查|review|bug|refactor/.test(text)) return "coding";
  if (/translate|翻译/.test(text)) return "translation";
  if (/data|数据|table|csv/.test(text)) return "data_analysis";
  if (/long|长上下文|文档/.test(text)) return "long_context";
  if (/plan|规划|方案/.test(text)) return "planning";
  if (/risk|安全|冲突|评估/.test(text)) return "reasoning";
  return "general_chat";
}

export function selectModelsForTask({ taskType, gate, allowGodEscalation = true } = {}) {
  const report = readRoutingReport();
  const key = recommendationKeyForTask(taskType);
  const preferred = (report?.recommendations?.[key] ?? []).map((item) => item.modelId);
  const selectableIds = new Set(gate.selectableRecords().map((item) => item.modelId));
  const selected = preferred.filter((id) => selectableIds.has(id)).slice(0, allowGodEscalation && taskType === "reasoning" ? 3 : 1);
  const fallback = gate.selectableRecords().slice(0, 1).map((item) => item.modelId);
  return {
    candidateModels: preferred,
    selectedModels: selected.length ? selected : fallback,
    selectionReason: selected.length ? `phase324i_${key}` : "fallback_first_selectable_model",
    executionMode: allowGodEscalation && taskType === "reasoning" && (selected.length >= 2 || selectableIds.size >= 2)
      ? "escalate_to_god_mode"
      : "single_model",
    rejectedModels: [],
    fallbackPlan: "fallback to first selectable NVIDIA model if preferred pool is unavailable",
  };
}

function recommendationKeyForTask(taskType) {
  if (taskType === "coding") return "coding";
  if (taskType === "long_context") return "longContext";
  if (taskType === "reasoning" || taskType === "planning") return "reasoning";
  return "defaultGeneralChat";
}

function readRoutingReport() {
  try {
    return JSON.parse(readFileSync(resolve("docs/phase324i-model-library-routing-preference-report.json"), "utf8"));
  } catch {
    return null;
  }
}
