import { repoRoot } from "./opencodeLoopShared.js";

function collectFailedLabels(items) {
  return (items || [])
    .filter((item) => item?.failed)
    .map((item) => String(item.label || "").trim())
    .filter(Boolean);
}

function renderTaskMarkdown(task) {
  return [
    `任务：${task.title}`,
    "",
    "项目根目录：",
    task.projectRoot,
    "",
    "当前背景：",
    `- 上一轮 reviewDecision: ${task.sourceReviewDecision}`,
    `- 上一轮 goalDirection: ${task.sourceGoalDirection}`,
    `- sessionId: ${task.sourceSessionId || "unknown"}`,
    `- modelProvider: ${task.sourceModelProvider || "unknown"}`,
    `- modelId: ${task.sourceModelId || "unknown"}`,
    "",
    "本轮目标：",
    "- 基于上一轮 feedback，输出一份完整、可审计、可复核的 A-W 结构化结果。",
    "- 必须显式列出 Commands Run、Changed Files、Evidence Paths、Known Issues / blocker、completionVerified。",
    "- 如果本轮没有实际改动，也必须明确写 `Changed Files: none`，不能省略。",
    "",
    "本轮必须补齐的缺口：",
    ...task.requiredFixes.map((item) => `- ${item}`),
    "",
    "允许做的事：",
    "- 只在当前仓库内读取与本轮任务直接相关的文件。",
    "- 允许补结构化说明、命令清单、修改文件清单、evidence 路径、blocker 说明。",
    "",
    "不要做的事：",
    "- 不修改 legacy/",
    "- 不创建 PROJECT_CONTEXT.md",
    "- 不 commit / push / deploy / release",
    "- 不读取或打印 secret / token / .env / auth.json",
    "- 不修改默认 /chat 或 /chat-gateway/execute",
    "- 不把 completionVerified=false 伪装成成功",
    "",
    "必须执行的验证命令：",
    "- node --check <本轮实际修改的 JS 文件>",
    "- 如有 verifier，列出实际执行结果",
    "- 如无代码修改，也必须说明 why no code change",
    "",
    "输出格式要求：",
    "- A. 前置条件检查结论",
    "- B. 修改文件列表",
    "- C. 每个文件最小改动",
    "- D. 新增能力说明",
    "- E. HTTP route 变化",
    "- F. UI 变化",
    "- G. Evidence 文件",
    "- H. Docs 文件",
    "- I. Package scripts",
    "- J. dry-run 结果",
    "- K. 真实 smoke 是否执行",
    "- L. 每个真实 smoke 结果",
    "- M. 是否调用 paid API",
    "- N. 是否调用 MiMo / OpenAI / Claude / OpenRouter",
    "- O. 是否做 embedding 批量训练",
    "- P. 是否暴露 API Key",
    "- Q. 是否改变默认 /chat",
    "- R. 是否修改 legacy/",
    "- S. 是否创建 PROJECT_CONTEXT.md",
    "- T. 是否 commit / push / deploy / release",
    "- U. UI 是否可打开",
    "- V. 死按钮数量",
    "- W. 验证命令和结果",
    "",
    "上一轮 feedback 摘要：",
    task.feedbackMarkdown.trim(),
    "",
  ].join("\n");
}

export function buildOpenCodeNextRoundTask({
  previousTask,
  review,
  feedbackMarkdown,
  createdAt = new Date().toISOString(),
} = {}) {
  if (review?.goNoGo !== "review-required") {
    throw new Error("OpenCode next-round task generation requires the latest review decision to be review-required.");
  }

  const requiredFixes = [
    ...collectFailedLabels(review?.verificationFindings),
    ...collectFailedLabels(review?.evidenceFindings),
  ];

  const task = {
    taskId: "phase3992a-opencode-feedback-driven-next-round",
    title: "Phase3992A OpenCode Feedback-Driven Next Round",
    createdAt,
    mode: "controlled-opencode-feedback-next-round",
    executionEnabled: false,
    providerCalledByThisPhase: false,
    codexExecInvoked: false,
    autoCommit: false,
    autoPush: false,
    approvalPreviewIsExecutionPermission: false,
    projectRoot: normalizeProjectRoot(previousTask?.projectRoot),
    previousTaskId: previousTask?.taskId || null,
    previousTaskTitle: previousTask?.title || null,
    sourceReviewDecision: review?.goNoGo || null,
    sourceGoalDirection: review?.goalDirection || null,
    sourceSessionId: review?.importedResult?.sessionId || null,
    sourceModelProvider: review?.importedResult?.modelProvider || null,
    sourceModelId: review?.importedResult?.modelId || null,
    requiredFixes: requiredFixes.length > 0 ? requiredFixes : [
      "补齐结构化结果，明确 Commands Run / Changed Files / Evidence Paths / blocker / completionVerified。",
    ],
    feedbackMarkdown: String(feedbackMarkdown || "").trim(),
  };

  return {
    task: {
      ...task,
      markdown: renderTaskMarkdown(task),
    },
  };
}

function normalizeProjectRoot(projectRoot) {
  const raw = String(projectRoot || "").replaceAll("\\", "/");
  if (!raw) {
    return repoRoot.replaceAll("\\", "/");
  }
  const marker = "/.opencode-handoff/outbox";
  if (raw.endsWith(marker)) {
    return raw.slice(0, -marker.length);
  }
  return raw;
}
