import { mkdir } from "node:fs/promises";

import { openCodeLoopPaths, printJson, repoRoot, writeJson, writeText } from "./opencodeLoopShared.js";

export function createOpenCodeSeedTask({ createdAt = new Date().toISOString() } = {}) {
  const task = {
    taskId: "phase3990a-opencode-controlled-loop-bridge",
    title: "Phase3990A OpenCode Controlled Loop Bridge 单轮执行与回传审查",
    createdAt,
    mode: "controlled-opencode-desktop-send",
    executionEnabled: false,
    providerCalledByThisPhase: false,
    codexExecInvoked: false,
    approvalPreviewIsExecutionPermission: false,
    projectRoot: repoRoot,
    currentStatus: [
      "目标是让 OpenCode 自动执行仓内任务，并把结果自动回传给本地审核器。",
      "本轮只允许 OpenCode Desktop UI 发送 + 本地 DB 自动摄取 + 本地 review。",
      "不允许 commit / push / deploy / release / paid provider / secret 输出。",
    ],
    roundGoal: "围绕 unified-ai-system 当前仓库状态，执行一个受控单轮任务，并按 A-W 结构返回结果。",
    whyNow: "当前仓库已经有 Codex Desktop 闭环、OpenCode 治理链和本地 OpenCode DB；现在需要把它们接成真实回传闭环。",
    allowedScope: [
      "只在当前仓库内读取与 Phase3990A 相关文件。",
      "允许修改 .opencode-handoff、docs、apps/ai-gateway-service/src/entrypoints、package.json、apps/ai-gateway-service/package.json。",
      "允许运行 node --check、本阶段 verify、health:phase12a、doctor:phase13a、safe-regression-matrix。",
    ],
    blockedScope: [
      "不修改 legacy/",
      "不创建 PROJECT_CONTEXT.md",
      "不 commit / push / deploy / release",
      "不读取 / 不打印 auth.json、.env、API Key、token、secret",
      "不调用 MiMo / OpenAI / Claude / OpenRouter paid provider",
      "不改默认 /chat 或 /chat-gateway/execute",
    ],
    requiredCommands: [
      "node --check apps/ai-gateway-service/src/entrypoints/*.js (仅本阶段新增/修改文件)",
      "pnpm --filter @unified-ai-system/ai-gateway-service opencode:desktop:test:internal",
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase3990a-opencode-controlled-loop-bridge",
      "pnpm verify:phase107a-secret-safety",
      "pnpm health:phase12a",
      "pnpm doctor:phase13a",
      "pnpm verify:safe-regression-matrix",
    ],
    stopConditions: [
      "发现任何明文 secret / token / auth.json 内容时立刻停止。",
      "如果需要改动 /chat 或 paid provider 配置，立刻停止。",
      "如果 OpenCode 只返回非结构化描述且无法判断执行结果，按 review-required 返回，不伪装成功。",
    ],
    outputFormat: [
      "A. 前置条件检查结论",
      "B. 修改文件列表",
      "C. 每个文件最小改动",
      "D. 新增能力说明",
      "E. HTTP route 变化",
      "F. UI 变化",
      "G. Evidence 文件",
      "H. Docs 文件",
      "I. Package scripts",
      "J. dry-run 结果",
      "K. 真实 smoke 是否执行",
      "L. 每个真实 smoke 结果",
      "M. 是否调用 paid API",
      "N. 是否调用 MiMo / OpenAI / Claude / OpenRouter",
      "O. 是否做 embedding 批量训练",
      "P. 是否暴露 API Key",
      "Q. 是否改变默认 /chat",
      "R. 是否修改 legacy/",
      "S. 是否创建 PROJECT_CONTEXT.md",
      "T. 是否 commit / push / deploy / release",
      "U. UI 是否可打开",
      "V. 死按钮数量",
      "W. 验证命令和结果",
    ],
  };

  return {
    ...task,
    markdown: renderTaskMarkdown(task),
  };
}

function renderTaskMarkdown(task) {
  return [
    `任务：${task.title}`,
    "",
    "项目根目录：",
    task.projectRoot,
    "",
    "当前状态：",
    ...task.currentStatus.map((item) => `- ${item}`),
    "",
    "本轮目标：",
    task.roundGoal,
    "",
    "为什么现在做：",
    task.whyNow,
    "",
    "允许范围：",
    ...task.allowedScope.map((item) => `- ${item}`),
    "",
    "禁止范围：",
    ...task.blockedScope.map((item) => `- ${item}`),
    "",
    "必须执行命令：",
    ...task.requiredCommands.map((item) => `- ${item}`),
    "",
    "停止条件：",
    ...task.stopConditions.map((item) => `- ${item}`),
    "",
    "输出格式：",
    ...task.outputFormat.map((item) => `- ${item}`),
    "",
  ].join("\n");
}

async function main() {
  const task = createOpenCodeSeedTask();
  await mkdir(openCodeLoopPaths.outboxDir, { recursive: true });
  await writeText(openCodeLoopPaths.outboxMarkdownPath, task.markdown);
  await writeJson(openCodeLoopPaths.outboxJsonPath, task);
  printJson({
    status: "generated",
    taskId: task.taskId,
    title: task.title,
    outboxMarkdownPath: ".opencode-handoff/outbox/latest-opencode-task.md",
    outboxJsonPath: ".opencode-handoff/outbox/latest-opencode-task.json",
    providerCalledByThisProcess: false,
    codexCliInvoked: false,
    codexExecInvoked: false,
  });
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
