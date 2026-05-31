import { openCodeLoopPaths, printJson, readJsonIfPresent, relativeFromRoot, repoRoot, resolveRepoPath, safeStat } from "./opencodeLoopShared.js";
import { previewLatestRepoSession } from "./opencodeDbSafeReader.js";

const relativePaths = {
  outboxTaskMarkdown: ".opencode-handoff/outbox/latest-opencode-task.md",
  outboxTaskJson: ".opencode-handoff/outbox/latest-opencode-task.json",
  inboxResultMarkdown: ".opencode-handoff/inbox/latest-opencode-result.md",
  inboxResultJson: ".opencode-handoff/inbox/latest-opencode-result.json",
  reviewJson: ".opencode-handoff/review/latest-opencode-review.json",
  reviewMarkdown: ".opencode-handoff/review/latest-opencode-review.md",
  feedbackMarkdown: ".opencode-handoff/review/latest-feedback-to-opencode.md",
  sendRecordJson: ".opencode-handoff/runs/latest-opencode-send-record.json",
};

export async function readOpenCodeDesktopStatus() {
  const files = {};
  for (const [key, relativePath] of Object.entries(relativePaths)) {
    files[key] = await safeStat(resolveRepoPath(relativePath));
    files[key].relativePath = relativePath;
  }

  const outboxTask = await readJsonIfPresent(openCodeLoopPaths.outboxJsonPath);
  const inboxResult = await readJsonIfPresent(openCodeLoopPaths.inboxJsonPath);
  const review = await readJsonIfPresent(openCodeLoopPaths.reviewJsonPath);
  const sendRecord = await readJsonIfPresent(openCodeLoopPaths.sendRecordJsonPath);
  const oneShotSeal = await readJsonIfPresent(openCodeLoopPaths.oneShotSealJsonPath);
  const dbPreview = await previewLatestRepoSession({
    repoRoot,
    dbPath: openCodeLoopPaths.defaultDbPath,
    sentAfterMs: Number(sendRecord?.sentAtMs || 0) || null,
  }).catch((error) => ({
    dbExists: false,
    error: error?.message || String(error),
    candidateSession: null,
    sessions: [],
  }));

  const outboxTaskExists = files.outboxTaskMarkdown.exists && files.outboxTaskJson.exists;
  const inboxResultExists = files.inboxResultMarkdown.exists || files.inboxResultJson.exists;
  const reviewExists = files.reviewJson.exists;
  const feedbackExists = files.feedbackMarkdown.exists;
  const sendRecordExists = files.sendRecordJson.exists;
  const latestGoNoGo = review?.goNoGo || (inboxResultExists ? "review-required" : (outboxTaskExists ? "send-ready" : "standby"));
  const currentBlocker = !outboxTaskExists
    ? "no_outbox_task"
    : inboxResult && Number(inboxResult.textPartCount || 0) === 0
      ? "no_assistant_text"
    : review?.goNoGo === "no-go"
      ? "review_failed"
      : review?.goNoGo === "review-required"
        ? "review_required"
        : "none";

  return {
    status: "ready",
    mode: "read-only-opencode-desktop-status",
    generatedAt: new Date().toISOString(),
    outboxTaskExists,
    inboxResultExists,
    reviewExists,
    feedbackExists,
    sendRecordExists,
    latestGoNoGo,
    currentBlocker,
    recommendedNextAction: deriveNextAction({ outboxTaskExists, inboxResultExists, inboxResult, review }),
    latestTask: outboxTask ? {
      taskId: outboxTask.taskId || null,
      title: outboxTask.title || null,
      mode: outboxTask.mode || null,
    } : null,
    latestSendRecord: sendRecord ? {
      sentAt: sendRecord.sentAt || null,
      sentAtMs: sendRecord.sentAtMs || null,
      pastedToDesktop: Boolean(sendRecord.pastedToDesktop),
      sent: Boolean(sendRecord.sent),
      sessionCandidateId: sendRecord.sessionCandidateId || null,
    } : null,
    latestInboxResult: inboxResult ? {
      importedAt: inboxResult.importedAt || null,
      source: inboxResult.source || null,
      sessionId: inboxResult.sessionId || null,
      modelProvider: inboxResult.modelProvider || null,
      modelId: inboxResult.modelId || null,
      selectionSource: inboxResult.selectionSource || null,
      sendRecordSessionCandidateId: inboxResult.sendRecordSessionCandidateId || null,
      textPartCount: Number(inboxResult.textPartCount || 0),
      toolPartCount: Number(inboxResult.toolPartCount || 0),
      toolErrorCount: Number(inboxResult.toolErrorCount || 0),
    } : null,
    latestReview: review ? {
      reviewedAt: review.reviewedAt || null,
      goNoGo: review.goNoGo || null,
      goalDirection: review.goalDirection || null,
      completionVerified: review.completionVerified === true,
      boundaryViolationCount: Number(review.boundaryViolationCount || 0),
      verificationGapCount: Number(review.verificationGapCount || 0),
      evidenceGapCount: Number(review.evidenceGapCount || 0),
    } : null,
    latestOneShotSeal: oneShotSeal ? {
      sealedAt: oneShotSeal.sealedAt || null,
      status: oneShotSeal.status || null,
      blocker: oneShotSeal.blocker || null,
      sessionId: oneShotSeal.sessionId || null,
      reviewDecision: oneShotSeal.reviewDecision || null,
    } : null,
    openCodeDbPreview: {
      dbExists: dbPreview.dbExists === true,
      dbPath: relativeOrAbsoluteDbPath(),
      candidateSessionId: dbPreview.candidateSession?.id || null,
      candidateSessionTitle: dbPreview.candidateSession?.title || null,
      candidateSessionAgent: dbPreview.candidateSession?.agent || null,
      candidateSessionUpdatedMs: Number(dbPreview.candidateSession?.timeUpdatedMs || 0) || null,
      totalSessionCount: dbPreview.totalSessionCount || 0,
      previewError: dbPreview.error || null,
    },
    files,
    executionEnabled: false,
    providerCalledByThisProcess: false,
    codexCliInvoked: false,
    codexExecInvoked: false,
    workflowRunnerEnabled: false,
    worktreeCreated: false,
    autoCommit: false,
    autoPush: false,
  };
}

function deriveNextAction({ outboxTaskExists, inboxResultExists, inboxResult, review }) {
  if (!outboxTaskExists) {
    return "没有 OpenCode outbox 任务；先运行 opencode:desktop:seed-task 生成任务。";
  }
  if (inboxResult && Number(inboxResult.textPartCount || 0) === 0) {
    return "OpenCode DB import captured no assistant text; keep completionVerified=false and ask OpenCode to produce a visible A-W result before continuing.";
  }
  if (review?.goNoGo === "no-go") {
    return "当前 review=no-go；先处理边界违规，再决定是否继续。";
  }
  if (review?.goNoGo === "review-required") {
    return "当前 review 需要补证据；先让 OpenCode 补齐结构化结果。";
  }
  if (!inboxResultExists) {
    return "任务已就绪；可以先 dry-run/send，然后等待 DB 自动摄取结果。";
  }
  return "结果已入箱；可以运行 opencode:desktop:review 生成 go/no-go。";
}

function relativeOrAbsoluteDbPath() {
  return openCodeLoopPaths.defaultDbPath.startsWith(openCodeLoopPaths.outboxDir.slice(0, 1))
    ? relativeFromRoot(openCodeLoopPaths.defaultDbPath)
    : openCodeLoopPaths.defaultDbPath;
}

async function main() {
  printJson(await readOpenCodeDesktopStatus());
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
