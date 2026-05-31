export const sourceVersionPolicy = Object.freeze({
  requiredFields: ["sourceId", "sourceVersion", "retrievedAt", "sourceRef", "licenseBoundary"],
  versionPinRequired: true,
  mutableLatestAliasAllowed: false,
  importEvidenceRequired: true,
  rollbackRecordRequired: true,
});

export function validateSourceVersionRecord(record) {
  const missing = sourceVersionPolicy.requiredFields.filter((field) => !record?.[field]);
  return {
    valid: missing.length === 0,
    missing,
    versionPinRequired: sourceVersionPolicy.versionPinRequired,
  };
}

