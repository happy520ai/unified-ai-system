import { mkdir, readFile, writeFile } from "node:fs/promises";

import { containsPlainSecret } from "../security/secretSafety.js";
import { openCodeLoopPaths } from "./opencodeLoopShared.js";

export const defaultOpenCodeReviewPaths = {
  inboxMarkdownPath: openCodeLoopPaths.inboxMarkdownPath,
  inboxJsonPath: openCodeLoopPaths.inboxJsonPath,
  taskJsonPath: openCodeLoopPaths.outboxJsonPath,
  reviewDir: openCodeLoopPaths.reviewDir,
  reviewJsonPath: openCodeLoopPaths.reviewJsonPath,
  reviewMarkdownPath: openCodeLoopPaths.reviewMarkdownPath,
  feedbackMarkdownPath: openCodeLoopPaths.feedbackMarkdownPath,
};

export async function reviewLatestOpenCodeResult(paths = defaultOpenCodeReviewPaths) {
  const resultMarkdown = await readFile(paths.inboxMarkdownPath, "utf8");
  const resultMetadata = await readJsonIfPresent(paths.inboxJsonPath);
  const task = await readJsonIfPresent(paths.taskJsonPath);
  const review = buildOpenCodeReview({ resultMarkdown, resultMetadata, task });
  await writeOpenCodeReviewOutputs({ review, paths });
  return review;
}

export async function writeOpenCodeReviewOutputs({ review, paths = defaultOpenCodeReviewPaths }) {
  await mkdir(paths.reviewDir, { recursive: true });
  await writeFile(paths.reviewJsonPath, `${JSON.stringify(review, null, 2)}\n`, "utf8");
  await writeFile(paths.reviewMarkdownPath, renderOpenCodeReviewMarkdown(review), "utf8");
  await writeFile(paths.feedbackMarkdownPath, renderOpenCodeFeedbackMarkdown(review), "utf8");
}

export function buildOpenCodeReview({ resultMarkdown, resultMetadata, task }) {
  const text = String(resultMarkdown || "");
  const noAssistantTextCaptured = hasNoAssistantTextCaptured({ text, resultMetadata });
  const boundaryFindings = [
    finding("legacy_modified", "检测到 legacy/ 被修改", hasLegacyModification(text)),
    finding("project_context_created", "检测到 PROJECT_CONTEXT.md 被创建", hasProjectContextCreated(text)),
    finding("commit_or_push", "检测到 commit / push / PR / release", hasCommitPushRelease(text)),
    finding("destructive_git", "检测到 git reset / git clean 等破坏性操作", hasDestructiveGitCommand(text)),
    finding("workflow_runner", "检测到 workflow runner 或 worktree", hasWorkflowRunnerOrWorktree(text)),
    finding("main_chain_modified", "检测到 /chat 或 /chat-gateway/execute 主链被改动", hasMainChainModification(text)),
    finding("paid_provider_called", "检测到 paid provider / MiMo / OpenAI / Claude / OpenRouter 被调用", hasPaidProviderCall(text)),
    finding("plaintext_secret", "检测到疑似明文 secret", containsPlainSecret(text)),
  ];

  const verificationFindings = [
    finding("has_command_list", "包含执行命令列表", !hasCommandList(text)),
    finding("has_modified_file_list", "包含修改文件列表", !hasModifiedFileList(text)),
    finding("has_evidence_statement", "包含 evidence 路径或说明", !hasEvidencePathOrStatement(text)),
    finding("has_verification_result", "包含验证结果", !hasVerificationResult(text)),
    finding("has_blocker_statement", "包含 blocker 或 none 说明", !hasBlockerStatement(text)),
    finding("has_structured_summary", "包含 A-W 结构化摘要", !hasStructuredSummary(text)),
  ];

  const evidenceFindings = [
    finding("assistant_text_captured", "OpenCode assistant text was captured", noAssistantTextCaptured),
    finding("has_completion_signal", "明确说明是否 completionVerified", !hasCompletionSignal(text)),
  ];

  const boundaryViolations = boundaryFindings.filter((item) => item.failed);
  const verificationGaps = verificationFindings.filter((item) => item.failed);
  const evidenceGaps = evidenceFindings.filter((item) => item.failed);
  const goNoGo = decideGoNoGo({
    boundaryViolations,
    verificationGaps,
    evidenceGaps,
  });
  const goalDirection = boundaryViolations.length > 0
    ? "off-track"
    : verificationGaps.length > 0 || evidenceGaps.length > 0
      ? "insufficient-evidence"
      : "on-track";

  return {
    reviewedAt: new Date().toISOString(),
    inputPaths: {
      resultMarkdown: ".opencode-handoff/inbox/latest-opencode-result.md",
      resultMetadata: ".opencode-handoff/inbox/latest-opencode-result.json",
      taskJson: ".opencode-handoff/outbox/latest-opencode-task.json",
    },
    outputPaths: {
      reviewJson: ".opencode-handoff/review/latest-opencode-review.json",
      reviewMarkdown: ".opencode-handoff/review/latest-opencode-review.md",
      feedbackMarkdown: ".opencode-handoff/review/latest-feedback-to-opencode.md",
    },
    task: task ? {
      taskId: task.taskId || null,
      title: task.title || null,
      mode: task.mode || null,
    } : null,
    importedResult: resultMetadata ? {
      importedAt: resultMetadata.importedAt || null,
      source: resultMetadata.source || null,
      sessionId: resultMetadata.sessionId || null,
      modelProvider: resultMetadata.modelProvider || null,
      modelId: resultMetadata.modelId || null,
      selectionSource: resultMetadata.selectionSource || null,
      sendRecordSessionCandidateId: resultMetadata.sendRecordSessionCandidateId || null,
      textPartCount: Number(resultMetadata.textPartCount || 0),
      toolPartCount: Number(resultMetadata.toolPartCount || 0),
      toolErrorCount: Number(resultMetadata.toolErrorCount || 0),
      contentLength: resultMetadata.contentLength || text.length,
    } : null,
    goNoGo,
    goalDirection,
    completionVerified: goNoGo === "go",
    boundaryViolationCount: boundaryViolations.length,
    verificationGapCount: verificationGaps.length,
    evidenceGapCount: evidenceGaps.length,
    requiresHumanReview: goNoGo !== "go",
    recommendedNextAction: buildRecommendedNextAction(goNoGo),
    boundaryFindings,
    verificationFindings,
    evidenceFindings,
    providerCalledByThisProcess: false,
    codexCliInvoked: false,
    codexExecInvoked: false,
    workflowRunnerEnabled: false,
    worktreeCreated: false,
    autoCommit: false,
    autoPush: false,
    note: "This review only evaluates the imported OpenCode result against project boundaries and evidence rules. It does not call a provider and does not approve commit/push.",
  };
}

export function renderOpenCodeReviewMarkdown(review) {
  return [
    "# OpenCode Result Review",
    "",
    `- reviewedAt: ${review.reviewedAt}`,
    `- goNoGo: ${review.goNoGo}`,
    `- goalDirection: ${review.goalDirection}`,
    `- completionVerified: ${review.completionVerified}`,
    `- boundaryViolationCount: ${review.boundaryViolationCount}`,
    `- verificationGapCount: ${review.verificationGapCount}`,
    `- evidenceGapCount: ${review.evidenceGapCount}`,
    `- requiresHumanReview: ${review.requiresHumanReview}`,
    `- recommendedNextAction: ${review.recommendedNextAction}`,
    "",
    "## Boundary Findings",
    ...review.boundaryFindings.map((item) => `- ${item.id}: ${item.failed ? "failed" : "passed"} - ${item.label}`),
    "",
    "## Verification Findings",
    ...review.verificationFindings.map((item) => `- ${item.id}: ${item.failed ? "missing" : "present"} - ${item.label}`),
    "",
    "## Evidence Findings",
    ...review.evidenceFindings.map((item) => `- ${item.id}: ${item.failed ? "missing" : "present"} - ${item.label}`),
    "",
    "## Safety",
    "- providerCalledByThisProcess=false",
    "- codexCliInvoked=false",
    "- codexExecInvoked=false",
    "- workflowRunnerEnabled=false",
    "- worktreeCreated=false",
    "- autoCommit=false",
    "- autoPush=false",
    "",
  ].join("\n");
}

export function renderOpenCodeFeedbackMarkdown(review) {
  const failedItems = [
    ...review.boundaryFindings.filter((item) => item.failed),
    ...review.verificationFindings.filter((item) => item.failed),
    ...review.evidenceFindings.filter((item) => item.failed),
  ];

  return [
    "# 反馈给 OpenCode",
    "",
    `审查结论：${review.goNoGo}`,
    `目标方向：${review.goalDirection}`,
    `completionVerified：${review.completionVerified}`,
    "",
    "## 发现的问题",
    ...(failedItems.length === 0 ? ["- 当前没有发现新的阻断项。"] : failedItems.map((item) => `- ${item.label}`)),
    "",
    "## 需要补充什么",
    review.goNoGo === "go"
      ? "- 当前结果已经满足本地闭环边界与证据要求。"
      : "- 请补齐执行命令、修改文件、验证结果、evidence 路径、blocker 说明和 A-W 摘要；如果碰到边界违规，先停止并修复违规。",
    "",
    "## 是否允许继续",
    review.goNoGo === "go"
      ? "- 可以继续下一轮任务，但仍需保持不 commit / 不 push / 不 deploy。"
      : "- 不允许自动继续；先处理上面的边界或证据问题。",
    "",
    "## 必须保持的边界",
    "- 不修改 legacy/",
    "- 不创建 PROJECT_CONTEXT.md",
    "- 不 commit / push / deploy / release",
    "- 不读、不打印 secret / token / .env / auth.json",
    "- 不修改默认 /chat 或 /chat-gateway/execute",
    "- 不把 completionVerified=false 伪装成成功",
    "",
  ].join("\n");
}

function finding(id, label, failed) {
  return { id, label, failed: Boolean(failed) };
}

function decideGoNoGo({ boundaryViolations, verificationGaps, evidenceGaps }) {
  if (boundaryViolations.length > 0) return "no-go";
  if (verificationGaps.length > 0 || evidenceGaps.length > 0) return "review-required";
  return "go";
}

function buildRecommendedNextAction(goNoGo) {
  if (goNoGo === "go") {
    return "结果结构和边界都满足要求，可以继续准备下一轮 OpenCode 任务。";
  }
  if (goNoGo === "no-go") {
    return "停止当前链路，先修复边界违规，再决定是否继续发送到 OpenCode。";
  }
  return "要求 OpenCode 补齐命令、文件、验证、evidence 和 completionVerified 说明后再继续。";
}

function hasNoAssistantTextCaptured({ text, resultMetadata }) {
  if (resultMetadata && Object.hasOwn(resultMetadata, "textPartCount") && Number(resultMetadata.textPartCount || 0) === 0) {
    return true;
  }
  return /No assistant text parts were captured/i.test(text);
}

function hasLegacyModification(text) {
  return /legacy\//i.test(text) && /(modified|changed|updated|edited|是|已修改|修改了)/i.test(text);
}

function hasProjectContextCreated(text) {
  return /PROJECT_CONTEXT\.md/i.test(text) && /(created|added|是|已创建|创建了)/i.test(text);
}

function hasCommitPushRelease(text) {
  return /(git\s+commit|git\s+push|\bPR\b|pull request|release|deploy|是否 commit \/ push \/ deploy \/ release：是|是否 commit \/ push：是)/i.test(text);
}

function hasDestructiveGitCommand(text) {
  return /(git\s+reset|git\s+clean)/i.test(text);
}

function hasWorkflowRunnerOrWorktree(text) {
  return /(workflow runner|worktree)/i.test(text) && /(enabled|created|是|接入|创建了|已启用)/i.test(text);
}

function hasMainChainModification(text) {
  return /(\/chat-gateway\/execute|default \/chat|默认 \/chat)/i.test(text) && /(modified|changed|是|已修改|改动了)/i.test(text);
}

function hasPaidProviderCall(text) {
  return /(是否调用 paid api：是|是否调用 mimo \/ openai \/ claude \/ openrouter：是|called openai|called claude|called openrouter|called mimo)/i.test(text);
}

function hasCommandList(text) {
  return /(Commands Run|执行命令|验证命令|cmd \/c pnpm run|node --check)/i.test(text);
}

function hasModifiedFileList(text) {
  return /(Changed Files|修改文件列表|实际修改文件)/i.test(text);
}

function hasEvidencePathOrStatement(text) {
  return /(Evidence Paths|evidence 路径|evidence|证据)/i.test(text);
}

function hasVerificationResult(text) {
  return /(验证命令和结果|verification result|Tests Passed|passed|failed|sealed|blocker)/i.test(text);
}

function hasBlockerStatement(text) {
  return /(blocker|Known Issues|none|当前 blocker|无 blocker|blocker none)/i.test(text);
}

function hasStructuredSummary(text) {
  return /(^|\n)\s*A\.\s/m.test(text) && /(^|\n)\s*W\.\s/m.test(text);
}

function hasCompletionSignal(text) {
  return /(completionVerified|是否 completionVerified|completion verified)/i.test(text);
}

async function readJsonIfPresent(pathValue) {
  try {
    return JSON.parse(await readFile(pathValue, "utf8"));
  } catch {
    return null;
  }
}
