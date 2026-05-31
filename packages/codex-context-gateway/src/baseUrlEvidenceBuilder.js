export function buildBaseUrlEvidence({ report }) {
  return {
    completed: report.completed === true,
    designOnly: report.designOnly === true,
    authorizationGateDefined: report.authorization.authorizationGateDefined === true,
    configPreviewGenerated: report.configPreview.configPreviewGenerated === true,
    rollbackPlanGenerated: report.rollback.rollbackPlanGenerated === true,
    riskReviewGenerated: report.riskReview.riskReviewGenerated === true,
    authorizationPacketTemplateGenerated: report.authorizationPacketTemplate.authorizationPacketTemplateGenerated === true,
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    rawWebhookAccessed: false,
    webhookValueExposed: false,
    codexConfigModified: false,
    codexBaseUrlModified: false,
    realCodexConnectionMade: false,
    relayStarted: false,
  };
}
