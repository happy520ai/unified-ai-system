import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

const title = "只读验证终端优先网关的真实使用体验，并给出下一步建议";
const projectRoot = repoRoot;

const currentStatus = [
  "公开产品面是 Terminal CLI、HTTP API、共享 SDK 与 MCP 服务。",
  "CLI 提供 demo、serve、status、chat、doctor、help 与 version 命令。",
  "默认运行本地 fake provider；真实 provider 调用必须显式授权。",
  "浏览器 /ui 与 /console 已退役，公开验证要求它们保持 404。",
  "当前系统不宣称生产认证、L5 自主或 AGI。",
];

const roundGoal = "只读验证终端 CLI 的安装诊断、无凭证演示、状态输出与安全边界，并给出最影响首次使用体验的 3 个问题。";

const whyNow = "公开项目已经采用 terminal-first 定位，需要持续确认真实命令、文档承诺和无凭证验证链保持一致。";

const allowedScope = [
  "读取 apps/agent-console/src/cli-core.js 与 docs/cli.md",
  "运行 CLI help、version、doctor 与 credential-free demo",
  "运行公开克隆验证，确认 fake provider、MCP 工具发现和进程清理",
  "确认 /ui 与 /console 保持退役状态，不恢复浏览器产品面",
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
  "不改变默认 /chat 路由或 provider 选择",
  "不写入真实 API key",
  "不允许真实 provider 调用",
  "不把 preview-only 写成 production-ready",
  "不把未提交工作区写成已清理状态",
];

const requiredCommands = [
  "pnpm gateway help",
  "pnpm gateway version --json",
  "pnpm gateway doctor --json",
  "pnpm gateway demo --json",
  "pnpm verify:public-clone",
];

const stopConditions = [
  "如果 demo 不是 fake-provider 执行，立即停止并报告。",
  "如果检测到真实 provider 调用或凭证读取，立即停止并报告。",
  "如果托管网关进程未清理，立即停止并报告。",
  "如果 /ui 或 /console 意外返回可用浏览器界面，立即停止并报告回归。",
  "如果发现需要修改文件，本轮不要修改，只输出建议。",
  "如果发现任务会进入真实 Codex exec、worktree、workflow runner、auto commit/push，立即停止。",
];

const outputFormat = [
  "A. CLI help 与 version 是否清楚",
  "B. doctor 是否给出可操作诊断",
  "C. demo 是否无需凭证并明确使用 fake provider",
  "D. MCP 工具发现与托管进程清理是否通过",
  "E. /ui 与 /console 是否保持 404",
  "F. 真实 provider 授权边界是否清楚",
  "G. 首次使用路径是否与 docs/cli.md 一致",
  "H. 是否存在误导性的生产、L5 或 AGI 声明",
  "I. 最影响使用体验的 3 个问题",
  "J. 建议下一条 Codex 任务",
  "K. 是否修改文件：必须为否",
  "L. 是否 commit/push：必须为否",
];

export function createNextCodexTask({ createdAt = new Date().toISOString() } = {}) {
  const task = {
    taskId: "terminal-first-gateway-readonly-usage-check",
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
