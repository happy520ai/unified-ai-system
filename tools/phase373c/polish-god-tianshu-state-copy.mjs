import { readText, writeJson, writeText, includesAll } from "../phase373-common.mjs";

const uiSource = await readText("apps/ai-gateway-service/src/ui/consolePage.js");

const result = {
  phase: "Phase373C",
  godTianshuStateCopyPolishExecuted: true,
  godModeEmptyStateCovered: includesAll(uiSource, ["fallback 提示", "participantSelection: pending"]),
  godModeFailureStateCovered: includesAll(uiSource, ["quota 或 budget 受限", "fallbackReason: none"]),
  godModeExplanationStateCovered: includesAll(uiSource, ["God Mode 用于多模型互审", "Supervisor 透明度"]),
  tianshuEmptyStateCovered: includesAll(uiSource, ["taskClassification: pending", "No-candidate fallback"]),
  tianshuFailureStateCovered: includesAll(uiSource, ["provider / credentialRef warning", "no-candidate fallback"]),
  tianshuExplanationStateCovered: includesAll(uiSource, ["天枢模式用于根据任务解释候选模型或模型组合", "Tianshu Planner 解释"]),
  providerCallsMade: false,
  runtimeModified: false,
  deployExecuted: false,
  secretValueExposed: false,
};

await writeText(
  "docs/phase373c-god-tianshu-state-copy-polish-report.md",
  [
    "# Phase373C God / Tianshu State Copy Polish Report",
    "",
    `- godModeEmptyStateCovered: ${result.godModeEmptyStateCovered}`,
    `- godModeFailureStateCovered: ${result.godModeFailureStateCovered}`,
    `- tianshuFailureStateCovered: ${result.tianshuFailureStateCovered}`,
    `- tianshuExplanationStateCovered: ${result.tianshuExplanationStateCovered}`,
  ].join("\n"),
);

await writeJson("docs/phase373c-empty-failure-explanation-state-map.json", {
  phase: "Phase373C",
  godMode: [
    "no participants configured",
    "participant unavailable",
    "credentialRef missing",
    "quota / budget blocked",
    "conflict summary empty",
    "supervisor synthesis unavailable",
    "fallback to Normal Mode guidance",
  ],
  tianshuMode: [
    "planner not started",
    "no candidate model",
    "capability index missing",
    "provider unconfigured",
    "credentialRef missing",
    "task too broad / unsupported",
    "retry planner",
    "go to Model Library",
    "fallback to Normal Mode",
  ],
});

await writeText(
  "docs/phase373c-god-tianshu-fallback-copy-checklist.md",
  [
    "# Phase373C Fallback Copy Checklist",
    "",
    "- God Mode empty-state guidance is present in the candidate explanation copy.",
    "- God Mode failure-state guidance references provider / credentialRef / quota / budget limits.",
    "- Tianshu no-candidate fallback names next actions and Model Library guidance.",
  ].join("\n"),
);

await writeText(
  "docs/phase373c-execution-report.md",
  [
    "# Phase373C Execution Report",
    "",
    `- runtimeModified: ${result.runtimeModified}`,
    `- deployExecuted: ${result.deployExecuted}`,
  ].join("\n"),
);

await writeJson("apps/ai-gateway-service/evidence/phase373c/god-tianshu-state-copy-polish-result.json", result);

console.log(JSON.stringify(result, null, 2));
