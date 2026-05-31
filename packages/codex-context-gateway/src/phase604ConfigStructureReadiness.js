import { inspectPhase603CodexConfigStructure } from "./phase603ConfigStructureInspector.js";

export function buildPhase604ConfigStructureReadiness(options = {}) {
  const inspection = inspectPhase603CodexConfigStructure(options);
  return {
    completed: inspection.completed === true,
    configStructureReadinessChecked: true,
    configTomlStructureInspected: inspection.configTomlStructureInspected === true,
    configTomlExists: inspection.configTomlExists === true,
    authJsonRead: false,
    authJsonTouched: false,
    rawBaseUrlValueExposed: false,
    secretValueExposed: false,
    providerNamesDetected: inspection.providerNamesDetected === true,
    providers: inspection.providers || [],
    providerNames: (inspection.providers || []).map((provider) => provider.providerId),
    defaultModelProvider: inspection.defaultModelProvider || null,
    crsProvider: inspection.crsProvider || null,
    duplicateProviderTables: inspection.duplicateProviderTables || [],
    tableCount: inspection.tableCount || 0,
    warnings: inspection.warnings || [],
  };
}
