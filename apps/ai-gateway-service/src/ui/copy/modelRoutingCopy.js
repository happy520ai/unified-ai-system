export const modelRoutingCopy = Object.freeze({
  title: "Model Routing",
  subtitle:
    "Task pressure and mode-based model routing preview. Recommendations are dry-run only and keep default behavior unchanged.",
  boundaryBadges: [
    "providerCallsMade=false",
    "secretRead=false",
    "dry-run only",
    "default behavior unchanged",
    "selectable unchanged",
    "real route approval required later",
  ],
  safetyLines: [
    "Runtime candidates must be smokePassed and selectable.",
    "selectable_candidate records are recommendation-only.",
    "cataloged, credential_missing, smoke_pending, failed, high_risk, blocked, and deprecated models are excluded from runtime routing.",
    "The guarded real route gate is present but default disabled.",
  ],
});
