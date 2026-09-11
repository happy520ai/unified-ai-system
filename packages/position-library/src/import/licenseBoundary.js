import { ONET_31_0_SOURCE } from "./officialOnetImporter.ts";

export const licenseBoundary = Object.freeze({
  commercialUseReviewRequired: true,
  attributionRequired: true,
  sourceLicenseMustBeRecorded: true,
  rawBulkRedistributionBlockedUntilReviewed: true,
  allowedCurrentAction: "pinned_onet_31_0_occupation_data_and_other_source_manifests",
});

export function assertLicenseBoundary(source) {
  const pinned = source?.sourceId === "onet" && source?.pinnedArtifact === ONET_31_0_SOURCE;
  return {
    sourceId: source?.sourceId || "unknown",
    allowedToImportNow: pinned,
    noNetworkImport: true,
    licenseReviewRequired: !pinned,
    reason: pinned
      ? "Only the pinned O*NET 31.0 occupation_data artifact is reviewed for local import and CC BY 4.0 redistribution with attribution; no network import."
      : "Other sources, datasets and versions remain blocked pending version, license and authorization review.",
  };
}
