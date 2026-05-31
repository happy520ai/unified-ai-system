import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

const title = "只读检查 Personal Operator Console 的真实使用体验，并给出下一步建议";
const projectRoot = "E:\\AI-Data\\AI网关系统\\unified-ai-system";

const currentStatus = [
  "Phase 237A-245A 自用操作台价值线已封板。",
  "Phase 246A-255A 自用 Knowledge/RAG 价值线已封板。",
  "Phase 256A-265A Controlled Codex One-shot Readiness 已封板。",
  "当前系统是 preview-only 的个人项目操作台、项目知识查询助手、Codex 单次执行前安全门。",
  "当前不是自动执行系统。",
];

const roundGoal = "只读检查当前 /ui Personal Operator Console 是否真的方便日常使用，并给出最影响使用体验的 3 个问题和下一步建议。";

const whyNow = "当前系统已经完成自用价值线、知识库价值线和 one-shot readiness，但还需要通过真实使用观察确认 UI 是否容易看懂、任务队列是否能指导下一步、边界是否清楚。";

const allowedScope = [
  "读取 apps/ai-gateway-service/src/ui/consolePage.js",
  "检查 http://127.0.0.1:3100/ui 是否可访问",
  "检查 Personal Operator Console、当前状态、决策面板、任务队列、审查与证据、知识库价值、单次执行准备是否清楚",
];

const blockedScope = [
  "不修改任何文件",
  "不刷新 evidence",
  "不修改 legacy/",
  "不创建 PROJECT_CONTEXT.md",
  "不 commit/push",
  "不自动 commit/push",
  "不创建 worktree",
  "不接真实 Codex exec",
  "不调用 codex CLI",
  "不接 workflow runner",
  "不改变默认 NVIDIA /chat 主链",
  "不写入真实 API key",
  "不把 preview-only 写成 production-ready",
  "不把未提交工作区写成已清理状态",
];

const requiredCommands = [
  "cmd /c pnpm run status:phase10a",
  "cmd /c pnpm run health:phase12a",
  "cmd /c pnpm run doctor:phase13a",
];

const stopConditions = [
  "如果 /ui 不可访问，立即停止并报告。",
  "如果 Personal Operator Console 找不到，立即停止并报告。",
  "如果发现需要修改文件，本轮不要修改，只输出建议。",
  "如果发现任务会进入真实 Codex exec、worktree、workflow runner、auto commit/push，立即停止。",
];

const outputFormat = [
  "A. /ui 是否可访问",
  "B. Personal Operator Console 是否存在",
  "C. 当前状态是否容易看懂",
  "D. 决策面板是否容易看懂",
  "E. 任务队列是否能指导我生成下一条 Codex 任务",
  "F. 审查与证据是否能指导我审查 Codex 返回结果",
  "G. 知识库价值边界是否清楚",
  "H. 单次执行准备是否明确不是执行",
  "I. 最影响使用体验的 3 个问题",
  "J. 建议下一条 Codex 任务",
  "K. 是否修改文件：必须为否",
  "L. 是否 commit/push：必须为否",
];

export function createNextCodexTask({ createdAt = new Date().toISOString() } = {}) {
  const task = {
    taskId: "personal-operator-console-readonly-usage-check",
    title,
    createdAt,
    mode: "manual-handoff-only",
    executionEnabled: false,
    codexExecInvoked: false,
    approvalPreviewIsExecutionPermission: false,
    projectRoot,
    currentStatus,
    roundGoal,
    whyNow,
    allowedScope,
    blockedScope,
    requiredCommands,
    stopConditions,
    outputFormat,
  };

  return {
    ...task,
    markdown: renderNextCodexTaskMarkdown(task),
  };
}

export async function writeNextCodexTaskOutbox({ root = repoRoot, createdAt } = {}) {
  const task = createNextCodexTask({ createdAt });
  const outboxDir = resolve(root, ".codex-handoff/outbox");
  const markdownPath = resolve(outboxDir, "latest-codex-task.md");
  const jsonPath = resolve(outboxDir, "latest-codex-task.json");
  const payload = {
    ...task,
    outboxFiles: {
      markdown: markdownPath,
      json: jsonPath,
    },
    safety: {
      previewOnly: true,
      executionEnabled: false,
      codexExecInvoked: false,
      codexCliInvoked: false,
      workflowRunnerConnected: false,
      worktreeCreated: false,
      autoCommitPush: false,
      defaultNvidiaChatLaneChanged: false,
      approvalPreviewIsExecutionPermission: false,
    },
  };

  await mkdir(outboxDir, { recursive: true });
  await writeFile(markdownPath, task.markdown, "utf8");
  await writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  return payload;
}

function renderNextCodexTaskMarkdown(task) {
  return [
    `任务：${task.title}`,
    "",
    "项目根目录：",
    task.projectRoot,
    "",
    "当前状态：",
    ...task.currentStatus,
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
    ...task.requiredCommands,
    "",
    "停止条件：",
    ...task.stopConditions,
    "",
    "输出格式：",
    ...task.outputFormat,
  ].join("\n");
}

function isDirectRun() {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  writeNextCodexTaskOutbox()
    .then((result) => {
      console.log(JSON.stringify({
        status: "generated",
        taskId: result.taskId,
        title: result.title,
        createdAt: result.createdAt,
        mode: result.mode,
        executionEnabled: result.executionEnabled,
        codexExecInvoked: result.codexExecInvoked,
        outboxFiles: result.outboxFiles,
      }, null, 2));
    })
    .catch((error) => {
      console.error(error?.message || error);
      process.exitCode = 1;
    });
}
