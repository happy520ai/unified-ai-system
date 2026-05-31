export const SECURITY_AUDIT_PHASE = "280A-security-hardening-audit";
export const SECURITY_AUDIT_MODE = "local-security-vulnerability-audit-and-minimal-hardening";
export const SECURITY_AUDIT_JSON = "apps/ai-gateway-service/evidence/phase-280a-security-hardening-audit.json";
export const SECURITY_AUDIT_MD = "apps/ai-gateway-service/evidence/phase-280a-security-hardening-audit.md";

export function createSecurityAuditPolicy() {
  return {
    policyVersion: "phase280a-v1",
    mode: SECURITY_AUDIT_MODE,
    paidApiAllowed: false,
    mimoAllowed: false,
    embeddingAllowed: false,
    externalApiAllowed: false,
    legacyModificationAllowed: false,
    projectContextCreationAllowed: false,
    autoCommitAllowed: false,
    autoPushAllowed: false,
    worktreeAllowed: false,
    codexCliAllowed: false,
    workflowRunnerAllowed: false,
    largeRefactorAllowed: false,
    fullRepoFormatAllowed: false,
    minimalSecurityRepairAllowed: true,
    secretScanRequired: true,
    endpointScanRequired: true,
    providerBoundaryScanRequired: true,
    ragCacheKnowledgeScanRequired: true,
    dependencyScanRequired: true,
    fullRegressionRequired: true,
  };
}
