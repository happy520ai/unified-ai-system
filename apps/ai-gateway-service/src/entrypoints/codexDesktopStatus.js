import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

const relativePaths = {
  outboxTaskMarkdown: ".codex-handoff/outbox/latest-codex-task.md",
  outboxTaskJson: ".codex-handoff/outbox/latest-codex-task.json",
  inboxResultMarkdown: ".codex-handoff/inbox/latest-codex-result.md",
  inboxResultJson: ".codex-handoff/inbox/latest-codex-result.json",
  sendRecordJson: ".codex-handoff/runs/latest-desktop-send-record.json",
  desktopReviewJson: ".codex-handoff/review/latest-desktop-review.json",
  feedbackMarkdown: ".codex-handoff/review/latest-feedback-to-codex.md",
  readyStateResetJson: ".codex-handoff/runs/latest-ready-state-reset.json",
};

export async function readCodexDesktopStatus({ root = repoRoot } = {}) {
  const files = {};
  for (const [key, relativePath] of Object.entries(relativePaths)) {
    files[key] = await inspectFile(root, relativePath);
  }

  const outboxTask = await readJsonIfPresent(root, relativePaths.outboxTaskJson);
  const sendRecord = await readJsonIfPresent(root, relativePaths.sendRecordJson);
  const review = await readJsonIfPresent(root, relativePaths.desktopReviewJson);
  const readyStateReset = await readJsonIfPresent(root, relativePaths.readyStateResetJson);

  const outboxTaskExists = files.outboxTaskMarkdown.exists;
  const outboxTaskJsonExists = files.outboxTaskJson.exists;
  const actualInboxResultExists = files.inboxResultMarkdown.exists || files.inboxResultJson.exists;
  const sendRecordExists = files.sendRecordJson.exists;
  const actualReviewExists = files.desktopReviewJson.exists;
  const actualFeedbackExists = files.feedbackMarkdown.exists;
  const readyStateResetActive = isReadyStateResetActive({ files, readyStateReset });
  const inboxResultExists = readyStateResetActive ? false : actualInboxResultExists;
  const reviewExists = readyStateResetActive ? false : actualReviewExists;
  const feedbackExists = readyStateResetActive ? false : actualFeedbackExists;
  const latestGoNoGo = readyStateResetActive ? "standby-ready" : review?.goNoGo || deriveGoNoGo({
    outboxTaskExists,
    inboxResultExists,
    reviewExists,
    sendRecordExists,
  });
  const currentBlocker = readyStateResetActive ? "none" : deriveBlocker({
    outboxTaskExists,
    inboxResultExists,
    reviewExists,
    review,
  });

  return {
    status: "ready",
    mode: "read-only-desktop-automation-status",
    generatedAt: new Date().toISOString(),
    outboxTaskExists,
    outboxTaskJsonExists,
    inboxResultExists,
    sendRecordExists,
    reviewExists,
    feedbackExists,
    latestGoNoGo,
    currentBlocker,
    recommendedNextAction: readyStateResetActive
      ? "待命状态：上一轮 inbox/review 已归档为 reset snapshot；可以生成或复制下一条任务，或等待新的 Codex result inbox。"
      : deriveNextAction({
      outboxTaskExists,
      inboxResultExists,
      reviewExists,
      feedbackExists,
      review,
    }),
    currentMode: "dry-run / copy-only / paste-only / send-with-approval / inbox review",
    executionEnabled: false,
    codexExecInvoked: false,
    codexCliInvoked: false,
    workflowRunnerEnabled: false,
    worktreeCreated: false,
    autoCommit: false,
    autoPush: false,
    readyStateResetActive,
    archivedInboxResultExists: readyStateResetActive && actualInboxResultExists,
    archivedReviewExists: readyStateResetActive && actualReviewExists,
    archivedFeedbackExists: readyStateResetActive && actualFeedbackExists,
    files,
    latestReadyStateReset: readyStateReset ? {
      resetAt: readyStateReset.resetAt || null,
      mode: readyStateReset.mode || null,
      previousGoNoGo: readyStateReset.previous?.goNoGo || null,
      currentBlocker: readyStateReset.activeState?.currentBlocker || null,
      recommendedNextAction: readyStateReset.activeState?.recommendedNextAction || null,
      resetDir: readyStateReset.resetDir || null,
      doesNotDeleteEvidence: Boolean(readyStateReset.doesNotDeleteEvidence),
      doesNotMarkFailedEvidencePassed: Boolean(readyStateReset.doesNotMarkFailedEvidencePassed),
      codexCliInvoked: Boolean(readyStateReset.codexCliInvoked),
      codexExecInvoked: Boolean(readyStateReset.codexExecInvoked),
      realSendExecuted: Boolean(readyStateReset.realSendExecuted),
    } : null,
    latestTask: outboxTask ? {
      taskId: outboxTask.taskId || null,
      title: outboxTask.title || null,
      mode: outboxTask.mode || null,
      executionEnabled: outboxTask.executionEnabled === false ? false : outboxTask.executionEnabled,
      codexExecInvoked: outboxTask.codexExecInvoked === false ? false : outboxTask.codexExecInvoked,
    } : null,
    latestSendRecord: sendRecord ? {
      sentAt: sendRecord.sentAt || null,
      mode: sendRecord.mode || null,
      copiedToClipboard: Boolean(sendRecord.copiedToClipboard),
      pastedToDesktop: Boolean(sendRecord.pastedToDesktop),
      sendRequested: Boolean(sendRecord.sendRequested),
      confirmSend: Boolean(sendRecord.confirmSend),
      codexCliInvoked: Boolean(sendRecord.codexCliInvoked),
      codexExecInvoked: Boolean(sendRecord.codexExecInvoked),
    } : null,
    latestReview: review ? {
      reviewedAt: review.reviewedAt || null,
      goNoGo: review.goNoGo || null,
      boundaryViolationCount: Number(review.boundaryViolationCount || 0),
      verificationGapCount: Number(review.verificationGapCount || 0),
      evidenceGapCount: Number(review.evidenceGapCount || 0),
      requiresHumanReview: Boolean(review.requiresHumanReview),
      recommendedNextAction: review.recommendedNextAction || null,
      ignoredByReadyStateReset: readyStateResetActive,
    } : null,
    safety: {
      statusReadOnly: true,
      executionEnabled: false,
      codexExecInvoked: false,
      codexCliInvoked: false,
      noRealCodexExec: true,
      workflowRunnerEnabled: false,
      worktreeCreated: false,
      autoCommit: false,
      autoPush: false,
      approvalPreviewIsExecutionPermission: false,
      defaultNvidiaChatLaneChanged: false,
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

function isReadyStateResetActive({ files, readyStateReset }) {
  if (!readyStateReset?.resetAt) return false;
  const resetAt = Date.parse(readyStateReset.resetAt);
  if (!Number.isFinite(resetAt)) return false;
  const activeFileTimes = [
    files.inboxResultMarkdown.modifiedAt,
    files.inboxResultJson.modifiedAt,
    files.desktopReviewJson.modifiedAt,
    files.feedbackMarkdown.modifiedAt,
  ].filter(Boolean).map((value) => Date.parse(value)).filter(Number.isFinite);
  if (activeFileTimes.length === 0) return true;
  return resetAt >= Math.max(...activeFileTimes);
}

function deriveGoNoGo({ outboxTaskExists, inboxResultExists, reviewExists }) {
  if (reviewExists) return "reviewed";
  if (inboxResultExists) return "review-required";
  if (outboxTaskExists) return "manual-handoff-ready";
  return "no-go";
}

function deriveBlocker({ outboxTaskExists, inboxResultExists, reviewExists, review }) {
  if (!outboxTaskExists) return "no_outbox_task";
  if (review?.goNoGo === "no-go") return "review_failed";
  if (review?.goNoGo === "review-required") return "review_required";
  if (review?.goNoGo === "human-review-required") return "human_review_required";
  if (inboxResultExists && !reviewExists) return "review_missing";
  return "none";
}

function deriveNextAction({ outboxTaskExists, inboxResultExists, reviewExists, feedbackExists, review }) {
  if (!outboxTaskExists) return "没有任务：请先生成下一条 Codex 任务。";
  if (review?.goNoGo === "no-go") return "review failed：停止并处理 blocker。";
  if (review?.goNoGo === "review-required" || review?.goNoGo === "human-review-required") {
    return "审查未放行：请补齐验证、evidence 或人工判断。";
  }
  if (review?.goNoGo === "go") return "review passed：可以生成下一步建议，但仍需人工决定。";
  if (inboxResultExists && !reviewExists) return "有 inbox：请审查 Codex 返回结果。";
  if (feedbackExists) return "feedback ready：可以复制反馈给 Codex。";
  return "有 outbox：请复制任务给 Codex，或仅做 dry-run/copy-only。";
}

function isDirectRun() {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  readCodexDesktopStatus()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error?.message || error);
      process.exitCode = 1;
    });
}
