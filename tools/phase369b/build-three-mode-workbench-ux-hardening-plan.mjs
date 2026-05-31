import { writeJson, writeText } from "../phase369-common.mjs";

const journeyMap = {
  phase: "Phase369B",
  normalMode: [
    "选择一个可用模型",
    "查看当前模型 / provider / credentialRef 状态",
    "直接发起对话",
    "失败时展示 provider / key / quota / selectable 问题",
  ],
  godMode: [
    "查看多模型互审逻辑说明",
    "查看 participant selection",
    "查看 reviewer / supervisor 合成状态",
    "查看冲突摘要与 fallback 原因",
    "避免误解为所有 provider 已真实启用",
  ],
  tianshuMode: [
    "只提交任务",
    "查看 planner / capability router 决策",
    "查看模型或模型组合选择理由",
    "无法选择模型时查看 next action",
    "查看是否需要配置 API Key / provider",
  ],
};

const result = {
  phase: "Phase369B",
  threeModeUxHardeningPlanGenerated: true,
  normalModeJourneyCovered: true,
  godModeJourneyCovered: true,
  tianshuModeJourneyCovered: true,
  uiGapReportGenerated: true,
  runtimeModified: false,
  frontendModified: false,
  deployExecuted: false,
  secretValueExposed: false,
};

await writeText(
  "docs/phase369b-three-mode-workbench-ux-hardening-plan.md",
  [
    "# Phase369B Three-mode Workbench UX Hardening Plan",
    "",
    "This phase produces a hardening plan only. It does not modify runtime or frontend behavior.",
    "",
    "Focus areas:",
    "- Normal Mode clarity",
    "- God Mode participant/reviewer/supervisor explainability",
    "- Tianshu Mode planner / router explainability",
  ].join("\n"),
);
await writeJson("docs/phase369b-three-mode-user-journey-map.json", journeyMap);
await writeText(
  "docs/phase369b-three-mode-ux-acceptance-checklist.md",
  [
    "# Phase369B Three-mode UX Acceptance Checklist",
    "",
    "- Normal Mode shows model, provider, credentialRef, and failure reasons clearly.",
    "- God Mode explains participant selection, conflict summary, and fallback cause.",
    "- Tianshu Mode explains planner decision, candidate failure, and next action.",
  ].join("\n"),
);
await writeText(
  "docs/phase369b-three-mode-ui-gap-report.md",
  [
    "# Phase369B Three-mode UI Gap Report",
    "",
    "- Gap: clearer participant/reviewer/supervisor states for God Mode.",
    "- Gap: clearer planner decision explanation and no-candidate next action for Tianshu Mode.",
    "- Gap: clearer provider / credentialRef / selectable visibility in Normal Mode.",
  ].join("\n"),
);
await writeText(
  "docs/phase369b-execution-report.md",
  [
    "# Phase369B Execution Report",
    "",
    "- plan generated",
    "- runtimeModified: false",
    "- frontendModified: false",
  ].join("\n"),
);
await writeJson(
  "apps/agent-console/evidence/phase369b/three-mode-workbench-ux-hardening-result.json",
  result,
);

console.log(JSON.stringify(result, null, 2));
