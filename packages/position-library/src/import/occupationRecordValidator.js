export const occupationRequiredFields = Object.freeze([
  "positionId",
  "source",
  "sourceCode",
  "sourceTitle",
  "canonicalTitle",
  "occupationGroup",
  "industryDomain",
  "skillTags",
  "knowledgeTags",
  "taskTags",
  "sourceRef",
  "importStatus",
  "confidence",
  "version",
]);

export function validateOccupationRecord(record) {
  const missing = occupationRequiredFields.filter((field) => record?.[field] === undefined || record?.[field] === null || record?.[field] === "");
  const arrayFieldsValid = ["skillTags", "knowledgeTags", "taskTags"].every((field) => Array.isArray(record?.[field]));
  return {
    valid: missing.length === 0 && arrayFieldsValid,
    missing,
    arrayFieldsValid,
  };
}

