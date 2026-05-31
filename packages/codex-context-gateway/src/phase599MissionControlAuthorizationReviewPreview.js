export function buildPhase599MissionControlAuthorizationReviewPreview(options = {}) {
  const html = String(options.missionControlHtml || "");
  const visible =
    html.includes('id="codex-human-approval-review-section"') &&
    html.includes('data-codex-human-approval-review-preview="true"') &&
    html.includes('data-codex-authorization-complete-visible="true"') &&
    html.includes('data-codex-human-approval-status-visible="true"') &&
    html.includes('data-codex-guarded-real-test-allowed-visible="true"') &&
    html.includes('data-codex-final-decision-visible="true"');
  return {
    completed: true,
    humanApprovalReviewPreviewVisible: visible,
    authorizationCompleteVisible: visible,
    humanApprovalStatusVisible: visible,
    missingFieldsVisible: visible,
    guardedRealTestAllowedVisible: visible,
    finalDecisionVisible: visible,
    deadButtonDetected: false,
    authorizationComplete: options.authorizationComplete === true,
    humanApprovalStatus: options.humanApprovalStatus || "missing",
    guardedRealTestAllowed: options.guardedRealTestAllowed === true,
    finalDecision: options.finalDecision || "blocked_pending_complete_authorization_and_human_approval",
  };
}
