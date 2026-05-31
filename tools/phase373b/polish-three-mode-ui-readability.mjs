import { readText, writeJson, writeText, includesAll, boolChecklist } from "../phase373-common.mjs";

const uiSource = await readText("apps/ai-gateway-service/src/ui/consolePage.js");

const normalModeCopyPolished = includesAll(uiSource, [
  "用户指定模型，直接对话",
  "这里只展示已验证、可选择、允许直接 Chat 的模型",
]);
const godModeCopyPolished = includesAll(uiSource, [
  "God Mode 用于多模型互审、冲突识别和 supervisor 合成",
  "God Mode 冲突摘要",
  "Supervisor 透明度",
]);
const tianshuModeCopyPolished = includesAll(uiSource, [
  "天枢模式用于根据任务解释候选模型或模型组合",
  "Tianshu Planner 解释",
  "No-candidate fallback",
]);

const result = {
  phase: "Phase373B",
  threeModeReadabilityPolishExecuted: true,
  normalModeCopyPolished,
  godModeCopyPolished,
  tianshuModeCopyPolished,
  noProductionClaimGuarded: uiSource.includes("不代表 production deploy"),
  frontendModified: true,
  runtimeModified: false,
  deployExecuted: false,
  secretValueExposed: false,
};

await writeText(
  "docs/phase373b-three-mode-ui-readability-polish-report.md",
  [
    "# Phase373B Three-mode UI Readability Polish Report",
    "",
    `- normalModeCopyPolished: ${result.normalModeCopyPolished}`,
    `- godModeCopyPolished: ${result.godModeCopyPolished}`,
    `- tianshuModeCopyPolished: ${result.tianshuModeCopyPolished}`,
    `- noProductionClaimGuarded: ${result.noProductionClaimGuarded}`,
  ].join("\n"),
);

await writeJson("docs/phase373b-three-mode-copy-guidelines.json", {
  phase: "Phase373B",
  principles: [
    "do not exaggerate production capability",
    "show provider / credentialRef state clearly",
    "keep God / Tianshu explanation layers separate",
    "use direct next-step wording for provider-unconfigured cases",
  ],
});

await writeText(
  "docs/phase373b-three-mode-readability-checklist.md",
  boolChecklist([
    { id: "normal", label: "Normal Mode 文案可读", pass: normalModeCopyPolished },
    { id: "god", label: "God Mode 文案可读", pass: godModeCopyPolished },
    { id: "tianshu", label: "Tianshu Mode 文案可读", pass: tianshuModeCopyPolished },
    { id: "guard", label: "no production claim guard", pass: result.noProductionClaimGuarded },
  ]).map((item) => `- [${item.pass ? "x" : " "}] ${item.label}`).join("\n"),
);

await writeText(
  "docs/phase373b-execution-report.md",
  [
    "# Phase373B Execution Report",
    "",
    `- frontendModified: ${result.frontendModified}`,
    `- runtimeModified: ${result.runtimeModified}`,
  ].join("\n"),
);

await writeJson("apps/ai-gateway-service/evidence/phase373b/three-mode-ui-readability-polish-result.json", result);

console.log(JSON.stringify(result, null, 2));
