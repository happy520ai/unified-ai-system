import { officialOccupationSources } from "./officialSourceRegistry.js";
import { licenseBoundary, assertLicenseBoundary } from "./licenseBoundary.js";
import { sourceVersionPolicy } from "./sourceVersionPolicy.js";
import { buildSourceRef } from "./sourceRefBuilder.js";

export function buildOfficialImportPlan() {
  const sourcePlans = officialOccupationSources.map((source) => ({
    ...source,
    sourceRefPreview: buildSourceRef({
      sourceId: source.sourceId,
      sourceVersion: source.pinnedArtifact?.sourceVersion || "to-be-pinned-before-import",
      sourceUrl: source.pinnedArtifact?.sourceUrl || null,
      retrievedAt: source.pinnedArtifact?.retrievedAt || null,
    }),
    licenseCheck: assertLicenseBoundary(source),
    dedupePolicy: source.pinnedArtifact ? "unique onetsoc_code; stable ID independent of title" : "canonicalTitle + sourceCode + sourceRef",
    aliasMergePolicy: "merge aliases only when source lineage is retained",
    importGate: source.pinnedArtifact ? "explicit_pinned_local_import_only" : "blocked_until_version_license_and_user_authorization",
  }));

  return {
    phase: "Phase577",
    noNetworkImport: true,
    allWorldJobsClaimed: false,
    sourceBackedPositionLibrary: true,
    providerCallsMade: false,
    secretValueExposed: false,
    sourceVersionPolicy,
    licenseBoundary,
    sourcePlans,
  };
}
