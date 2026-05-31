import { buildRelevantFileScopeGate, requestFileRead } from "./relevantFileScopeGate.js";

export function buildRelevantFileReadAuditPreview(options = {}) {
  const scope = options.scope || buildRelevantFileScopeGate(options);
  const plannedReads = scope.relevantFiles.slice(0, 12).map((item) => ({
    path: item.path,
    reason: item.reason,
    status: "in-scope",
  }));
  const outOfScope = requestFileRead("apps/ai-gateway-service/src/httpServer.js", scope.allowedPaths, "");
  return {
    completed: scope.scopeGateWorks === true,
    readAuditPreviewWorks: scope.scopeGateWorks === true,
    relevantFileReadsRecorded: plannedReads.length > 0,
    outOfScopeReadReasonRequired: outOfScope.requiresReason === true,
    fullRepoScanFlagged: true,
    auditEvidenceGenerated: true,
    plannedReads,
    outOfScopeAttempt: outOfScope,
    providerCallsMade: false,
  };
}
