export function buildOpenCodeOneShotSeal({
  importedResult,
  review,
  feedbackExists,
  sealedAt = new Date().toISOString(),
} = {}) {
  const intakeCaptured = Boolean(importedResult);
  const reviewGenerated = Boolean(review);
  const feedbackGenerated = feedbackExists === true;
  const sessionId = importedResult?.sessionId || null;
  const assistantMessageId = importedResult?.assistantMessageId || null;

  let blocker = "none";
  if (!intakeCaptured) {
    blocker = "manual_result_missing";
  } else if (!sessionId) {
    blocker = "session_not_found";
  } else if (!reviewGenerated) {
    blocker = "review_not_generated";
  } else if (!feedbackGenerated) {
    blocker = "feedback_not_generated";
  }

  return {
    phase: "phase3991a-opencode-real-one-shot-intake",
    sealedAt,
    status: blocker === "none" ? "passed" : "blocked",
    blocker,
    intakeCaptured,
    reviewGenerated,
    feedbackGenerated,
    sessionId,
    assistantMessageId,
    intakeSource: importedResult?.source || null,
    importedAt: importedResult?.importedAt || null,
    modelProvider: importedResult?.modelProvider || null,
    modelId: importedResult?.modelId || null,
    textPartCount: Number(importedResult?.textPartCount || 0),
    contentLength: Number(importedResult?.contentLength || 0),
    reviewDecision: review?.goNoGo || null,
    reviewGoalDirection: review?.goalDirection || null,
    completionVerified: review?.completionVerified === true,
    requiresHumanReview: review?.requiresHumanReview === true,
    reviewGeneratedAt: review?.reviewedAt || null,
    providerCalledByThisProcess: false,
    codexCliInvoked: false,
    codexExecInvoked: false,
    workflowRunnerEnabled: false,
    worktreeCreated: false,
    autoCommit: false,
    autoPush: false,
    note: blocker === "none"
      ? "A real OpenCode DB result was imported and reviewed locally. This phase records the one-shot intake honestly without calling any provider."
      : "The one-shot intake is blocked or incomplete. This seal records the blocker honestly and does not claim execution success.",
  };
}

export function renderOpenCodeOneShotSealMarkdown(seal) {
  return [
    "# OpenCode Real One-Shot Intake Seal",
    "",
    `- phase: ${seal.phase}`,
    `- sealedAt: ${seal.sealedAt}`,
    `- status: ${seal.status}`,
    `- blocker: ${seal.blocker}`,
    `- intakeCaptured: ${seal.intakeCaptured}`,
    `- reviewGenerated: ${seal.reviewGenerated}`,
    `- feedbackGenerated: ${seal.feedbackGenerated}`,
    `- sessionId: ${seal.sessionId || "none"}`,
    `- assistantMessageId: ${seal.assistantMessageId || "none"}`,
    `- intakeSource: ${seal.intakeSource || "none"}`,
    `- importedAt: ${seal.importedAt || "none"}`,
    `- modelProvider: ${seal.modelProvider || "none"}`,
    `- modelId: ${seal.modelId || "none"}`,
    `- textPartCount: ${seal.textPartCount}`,
    `- contentLength: ${seal.contentLength}`,
    `- reviewDecision: ${seal.reviewDecision || "none"}`,
    `- reviewGoalDirection: ${seal.reviewGoalDirection || "none"}`,
    `- completionVerified: ${seal.completionVerified}`,
    `- requiresHumanReview: ${seal.requiresHumanReview}`,
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
    seal.note,
    "",
  ].join("\n");
}
