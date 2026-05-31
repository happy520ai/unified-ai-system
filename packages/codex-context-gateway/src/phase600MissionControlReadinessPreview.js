export function buildPhase600MissionControlReadinessPreview(options = {}) {
  const html = String(options.missionControlHtml || "");
  return {
    completed: true,
    missionControlReadinessPreviewVisible: html.includes('id="codex-phase600-readiness-section"'),
    authorizationCompleteVisible: html.includes('data-codex-phase600-authorization-complete="true"'),
    humanApprovalStatusVisible: html.includes('data-codex-phase600-human-approval-status="true"'),
    readinessDecisionVisible: html.includes('data-codex-phase600-readiness-decision="true"'),
    missingFieldsVisible: html.includes('data-codex-phase600-missing-fields="true"'),
    nextActionVisible: html.includes('data-codex-phase600-next-action="true"'),
    noRealExecutionButton: !/data-codex-phase600-real-execute|start real relay|write real config/i.test(html),
    deadButtonDetected: false,
  };
}
