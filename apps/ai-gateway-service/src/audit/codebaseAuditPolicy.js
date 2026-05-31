export function createCodebaseAuditPolicy() {
  return {
    policyVersion: "phase279a-v1",
    mode: "local-codebase-audit-and-minimal-repair",
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
    minimalRepairAllowed: true,
    fullRepoFormatAllowed: false,
    secretScanRequired: true,
    phaseEvidenceScanRequired: true,
    packageScriptScanRequired: true,
    uiPanelScanRequired: true,
    httpEndpointBoundaryScanRequired: true,
  };
}

export const FULL_CODEBASE_AUDIT_PHASE = "279A-full-codebase-audit";
export const FULL_CODEBASE_AUDIT_MODE = "local-codebase-audit-and-minimal-repair";
export const FULL_CODEBASE_AUDIT_JSON = "apps/ai-gateway-service/evidence/phase-279a-full-codebase-audit.json";
export const FULL_CODEBASE_AUDIT_MD = "apps/ai-gateway-service/evidence/phase-279a-full-codebase-audit.md";
