export function buildPhase603PreparationEvidenceLedger(parts = {}) {
  const sections = {
    openaiBaseUrlFailure: parts.openaiBaseUrlFailure?.negativeControlRecorded === true,
    configStructureSanitizedSummary: parts.configInspection?.configTomlStructureInspected === true,
    duplicateProviderTableResult: parts.duplicateProviderTableCheck?.duplicateProviderReportGenerated === true,
    providerPreviewSchema: parts.providerPreviewSchema?.providerPreviewSchemaValid === true,
    projectConfigPreviewArtifact: parts.projectConfigPreview?.projectConfigPreviewGenerated === true,
    negativeControlPlan: parts.negativeControlPlan?.negativeControlPlanGenerated === true,
    commandBundlePreview: parts.commandBundle?.commandBundlePreviewGenerated === true,
    rollbackPreview: parts.rollbackPreview?.rollbackPreviewGenerated === true,
    emergencyDisablePreview: parts.emergencyDisablePreview?.emergencyDisablePreviewGenerated === true,
  };
  return {
    completed: Object.values(sections).every(Boolean),
    preparationEvidenceLedgerGenerated: true,
    allSectionsPresent: Object.values(sections).every(Boolean),
    noSecretInLedger: true,
    rawBaseUrlValueExposed: false,
    authJsonRead: false,
    sections,
  };
}
