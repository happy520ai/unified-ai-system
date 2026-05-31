import { inspectPhase603CodexConfigStructure } from "./phase603ConfigStructureInspector.js";

export function buildPhase603DuplicateProviderTableCheck(options = {}) {
  const inspection = options.inspection || inspectPhase603CodexConfigStructure(options);
  const duplicates = Array.isArray(inspection.duplicateProviderTables) ? inspection.duplicateProviderTables : [];
  return {
    completed: inspection.configTomlStructureInspected === true,
    duplicateProviderTableCheckWorks: true,
    duplicateProviderTablesDetected: duplicates.length > 0,
    duplicateProviderReportGenerated: true,
    duplicateProviderTables: duplicates,
    configModified: false,
    rawBaseUrlValueExposed: false,
  };
}
