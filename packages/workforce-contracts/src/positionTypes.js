export const POSITION_IMPORT_STATUSES = Object.freeze([
  "seeded",
  "manifest_only",
  "source_pending",
  "manual_review_required",
]);

export const POSITION_SCHEMA_FIELDS = Object.freeze([
  "positionId",
  "source",
  "sourceCode",
  "sourceTitle",
  "canonicalTitle",
  "aliases",
  "occupationGroup",
  "industryDomain",
  "skillLevel",
  "skillTags",
  "knowledgeTags",
  "taskTags",
  "seniorityApplicability",
  "sourceRef",
  "importStatus",
  "confidence",
  "version",
]);

export function validatePositionShape(position) {
  const missing = POSITION_SCHEMA_FIELDS.filter((field) => !(field in (position || {})));
  return {
    valid: missing.length === 0,
    missing,
  };
}
