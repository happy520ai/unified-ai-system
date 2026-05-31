import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readCodexDesktopStatus } from "./codexDesktopStatus.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

const relativePaths = {
  nextTaskMarkdown: ".codex-handoff/outbox/latest-codex-task.md",
  nextTaskJson: ".codex-handoff/outbox/latest-codex-task.json",
  inboxResultMarkdown: ".codex-handoff/inbox/latest-codex-result.md",
  inboxResultJson: ".codex-handoff/inbox/latest-codex-result.json",
  reviewSummaryJson: ".codex-handoff/review/latest-review-summary.json",
  desktopReviewJson: ".codex-handoff/review/latest-desktop-review.json",
  reviewMarkdown: ".codex-handoff/review/latest-system-review.md",
  desktopReviewMarkdown: ".codex-handoff/review/latest-desktop-review.md",
  feedbackMarkdown: ".codex-handoff/review/latest-feedback-to-codex.md",
  outboxFeedbackMarkdown: ".codex-handoff/outbox/feedback-to-codex.md",
  latestRunSummaryJson: ".codex-handoff/runs/latest-run-summary.json",
  safetyGateSummaryJson: ".codex-handoff/runs/safety-gate-summary.json",
  desktopSendRecordJson: ".codex-handoff/runs/latest-desktop-send-record.json",
  readyStateResetJson: ".codex-handoff/runs/latest-ready-state-reset.json",
};

export async function readCodexLoopStatus({ root = repoRoot } = {}) {
  const files = {};
  for (const [key, relativePath] of Object.entries(relativePaths)) {
    files[key] = await inspectFile(root, relativePath);
  }

  const nextTask = await readJsonIfPresent(root, relativePaths.nextTaskJson);
  const reviewSummary = await readJsonIfPresent(root, relativePaths.reviewSummaryJson);
  const desktopReview = await readJsonIfPresent(root, relativePaths.desktopReviewJson);
  const latestRunSummary = await readJsonIfPresent(root, relativePaths.latestRunSummaryJson);
  const safetyGateSummary = await readJsonIfPresent(root, relativePaths.safetyGateSummaryJson);
  const desktopAutomation = await readCodexDesktopStatus({ root });
  const readyStateResetActive = Boolean(desktopAutomation.readyStateResetActive);

  const nextTaskExists = files.nextTaskMarkdown.exists || files.nextTaskJson.exists;
  const outboxTaskExists = files.nextTaskMarkdown.exists;
  const inboxResultExists = readyStateResetActive ? false : files.inboxResultMarkdown.exists || files.inboxResultJson.exists;
  const reviewExists = readyStateResetActive ? false : files.desktopReviewJson.exists || files.reviewSummaryJson.exists || files.reviewMarkdown.exists;
  const feedbackExists = readyStateResetActive ? false : files.feedbackMarkdown.exists || files.outboxFeedbackMarkdown.exists;
  const reviewDecision = readyStateResetActive ? "standby-ready" : desktopReview?.goNoGo || reviewSummary?.decision || reviewSummary?.status || "unknown";
  const latestGoNoGo = desktopAutomation.latestGoNoGo || desktopReview?.goNoGo || deriveGoNoGo({
    nextTaskExists,
    inboxResultExists,
    reviewExists,
    reviewDecision,
  });
  const currentBlocker = desktopAutomation.currentBlocker || deriveBlocker({
    nextTaskExists,
    inboxResultExists,
    reviewExists,
    latestGoNoGo,
  });
  const recommendedNextAction = desktopAutomation.recommendedNextAction || deriveNextAction({
    nextTaskExists,
    inboxResultExists,
    reviewExists,
    feedbackExists,
    latestGoNoGo,
  });

  return {
    status: "ready",
    mode: "read-only-status",
    generatedAt: new Date().toISOString(),
    root,
    nextTaskExists,
    outboxTaskExists,
    inboxResultExists,
    reviewExists,
    feedbackExists,
    latestGoNoGo,
    currentBlocker,
    recommendedNextAction,
    reviewDecision,
    files,
    desktopAutomation,
    parsed: {
      nextTask: nextTask ? {
        taskId: nextTask.taskId,
        title: nextTask.title,
        mode: nextTask.mode,
        executionEnabled: nextTask.executionEnabled,
        codexExecInvoked: nextTask.codexExecInvoked,
      } : null,
      desktopReview: desktopReview ? {
        reviewedAt: desktopReview.reviewedAt,
        goNoGo: desktopReview.goNoGo,
        boundaryViolationCount: desktopReview.boundaryViolationCount,
        verificationGapCount: desktopReview.verificationGapCount,
        evidenceGapCount: desktopReview.evidenceGapCount,
        requiresHumanReview: desktopReview.requiresHumanReview,
      } : null,
      latestRunSummary: latestRunSummary ? {
        status: latestRunSummary.status,
        dryRun: latestRunSummary.dryRun,
        codexCliInvoked: latestRunSummary.codexCliInvoked,
        codexExecInvoked: latestRunSummary.codexExecInvoked,
        worktreeCreated: latestRunSummary.worktreeCreated,
        workflowRun: latestRunSummary.workflowRun,
      } : null,
      safetyGate: safetyGateSummary ? {
        dryRun: safetyGateSummary.dryRun,
        executionAllowed: safetyGateSummary.executionAllowed,
        codexExecEnabled: safetyGateSummary.codexExecEnabled,
        cleanGitWorkspace: safetyGateSummary.cleanGitWorkspace,
      } : null,
    },
    safety: {
      statusReadOnly: true,
      executionEnabled: false,
      codexExecInvoked: false,
      codexCliInvoked: false,
      workflowRunnerConnected: false,
      workflowRunnerEnabled: false,
      worktreeCreated: false,
      autoCommitPush: false,
      autoCommit: false,
      autoPush: false,
      approvalPreviewIsExecutionPermission: false,
      defaultNvidiaChatLaneChanged: false,
    },
    guidance: {
      noTask: "没有任务：请先生成下一条 Codex 任务",
      hasOutbox: "有 outbox：请复制任务给 Codex",
      hasInbox: "有 inbox：请审查 Codex 返回结果",
      reviewPassed: "review passed：可以生成下一步建议",
      reviewFailed: "review failed：停止并处理 blocker",
      feedbackReady: "feedback ready：可以复制反馈给 Codex",
      noBlocker: "无 blocker：可以继续观察或生成下一步任务",
    },
  };
}

async function inspectFile(root, relativePath) {
  const absolutePath = resolve(root, relativePath);
  try {
    const result = await stat(absolutePath);
    return {
      exists: result.isFile(),
      relativePath,
      absolutePath,
      sizeBytes: result.size,
      modifiedAt: result.mtime.toISOString(),
    };
  } catch {
    return {
      exists: false,
      relativePath,
      absolutePath,
      sizeBytes: 0,
      modifiedAt: null,
    };
  }
}

async function readJsonIfPresent(root, relativePath) {
  try {
    return JSON.parse(await readFile(resolve(root, relativePath), "utf8"));
  } catch {
    return null;
  }
}

function deriveGoNoGo({ nextTaskExists, inboxResultExists, reviewExists, reviewDecision }) {
  const normalized = String(reviewDecision || "").toLowerCase();
  if (["no-go", "failed", "blocked", "rejected", "rejected-preview"].includes(normalized)) return "no-go";
  if (["go", "passed", "reviewed", "accepted-preview", "approved-preview"].includes(normalized)) return "go";
  if (inboxResultExists && !reviewExists) return "review-required";
  if (nextTaskExists) return "manual-handoff-ready";
  return "no-go";
}

function deriveBlocker({ nextTaskExists, inboxResultExists, reviewExists, latestGoNoGo }) {
  if (!nextTaskExists) return "没有任务：请先生成下一条 Codex 任务";
  if (latestGoNoGo === "no-go") return "review failed：停止并处理 blocker";
  if (inboxResultExists && !reviewExists) return "有 inbox：请审查 Codex 返回结果";
  return "none";
}

function deriveNextAction({ nextTaskExists, inboxResultExists, reviewExists, feedbackExists, latestGoNoGo }) {
  if (!nextTaskExists) return "请先在 Action Queue 生成下一条 Codex 任务。";
  if (latestGoNoGo === "no-go") return "停止并处理 review blocker，不要继续扩线。";
  if (inboxResultExists && !reviewExists) return "先审查 Codex 返回结果，生成 review 和 feedback。";
  if (feedbackExists && latestGoNoGo !== "go") return "可以复制 feedback 给 Codex，但必须保持 manual handoff。";
  if (latestGoNoGo === "go") return "可以生成下一步建议，或者把反馈复制给 Codex 继续人工闭环。";
  return "请复制 outbox 任务给 Codex，等待人工返回结果到 inbox。";
}

function isDirectRun() {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  readCodexLoopStatus()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error?.message || error);
      process.exitCode = 1;
    });
}
