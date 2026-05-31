export const licenseBoundary = Object.freeze({
  commercialUseReviewRequired: true,
  attributionRequired: true,
  sourceLicenseMustBeRecorded: true,
  rawBulkRedistributionBlockedUntilReviewed: true,
  allowedCurrentAction: "local_manifest_plan_only",
});

export function assertLicenseBoundary(source) {
  return {
    sourceId: source?.sourceId || "unknown",
    allowedToImportNow: false,
    noNetworkImport: true,
    licenseReviewRequired: true,
    reason: "Phase577 records official source governance only; no bulk import or redistribution is allowed.",
  };
}

