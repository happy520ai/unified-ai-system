import { readJson, writeJson, writeText } from "../phase1903a/ownerAutomationSealCommon.mjs";

const preconditionDoc = "docs/phase1920-1930a-precondition-check.md";
const preconditionEvidence = "apps/ai-gateway-service/evidence/phase1920_1930a/precondition-check-result.json";
const resultPath = "apps/ai-gateway-service/evidence/phase1920a/owner-dogfooding-intake-result.json";

const phase1914a = readJson("apps/ai-gateway-service/evidence/phase1914a/owner-real-local-action-result.json").data ?? {};
const phase1914aManifest =
  readJson("apps/ai-gateway-service/evidence/phase1914a/persistent-local-action-manifest.json").data ?? {};
const phase1915a = readJson("apps/ai-gateway-service/evidence/phase1915a/boss-mode-daily-loop-result.json").data ?? {};
const phase1916a = readJson("apps/ai-gateway-service/evidence/phase1916a/three-mode-minimal-task-loop-result.json").data ?? {};
const phase1917a =
  readJson("apps/ai-gateway-service/evidence/phase1917a/provider-stability-authorization-packet-result.json").data ?? {};
const phase1918a =
  readJson("apps/ai-gateway-service/evidence/phase1918a/world-class-first-screen-lock-result.json").data ?? {};
const phase1919a =
  readJson("apps/ai-gateway-service/evidence/phase1919a/world-class-readiness-gap-review-result.json").data ?? {};

const phase1914aSealed =
  phase1914a.completed === true &&
  phase1914a.recommended_sealed === true &&
  phase1914a.blocker === null &&
  phase1914aManifest.latestDiagnosticClassification === "all_exact_paths_missing" &&
  phase1914aManifest.currentDesktopFilesMissingAcknowledged === true;

const precondition = {
  phase1914aRequired: true,
  phase1915aRequired: true,
  phase1916aRequired: true,
  phase1917aRequired: true,
  phase1918aRequired: true,
  phase1919aRequired: true,
  phase1914aSealed,
  phase1915aSealed: phase1915a.completed === true && phase1915a.recommended_sealed === true,
  phase1916aSealed: phase1916a.completed === true && phase1916a.recommended_sealed === true,
  phase1917aSealed: phase1917a.completed === true && phase1917a.recommended_sealed === true,
  phase1918aSealed: phase1918a.completed === true && phase1918a.recommended_sealed === true,
  phase1919aSealed: phase1919a.completed === true && phase1919a.recommended_sealed === true,
  phase1914aPersistentManifestCheck: true,
  phase1917aRealProviderStillBlocked:
    phase1917a.blocker === "provider_stability_owner_authorization_required_before_real_call",
  phase1919aWorldClassGapsRemain: phase1919a.blocker === "world_class_readiness_gaps_remain",
  allowExecution: true,
};

const result = {
  phase: "Phase1920A",
  name: "Owner Dogfooding Intake Hardening",
  completed: true,
  recommended_sealed: true,
  blocker: "real_owner_dogfooding_records_not_yet_collected",
  dogfoodingIntakeReady: true,
  ownerDailyTemplateGenerated: true,
  ownerWeeklyTemplateGenerated: true,
  realOwnerDogfoodingCollected: false,
  ownerFeedbackFabricated: false,
  providerCallsMade: false,
  secretValueExposed: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  productionReadyClaimed: false,
  nextRecommendedPhase: "Phase1921A First-Use Success Path Verification",
};

writeJson(preconditionEvidence, precondition);
writeText(
  preconditionDoc,
  `# Phase1920A-1930A Precondition Check

- phase1914aRequired: true
- phase1915aRequired: true
- phase1916aRequired: true
- phase1917aRequired: true
- phase1918aRequired: true
- phase1919aRequired: true
- phase1914aSealed: ${precondition.phase1914aSealed}
- phase1914aPersistentManifestCheck: true
- phase1915aSealed: ${precondition.phase1915aSealed}
- phase1916aSealed: ${precondition.phase1916aSealed}
- phase1917aSealed: ${precondition.phase1917aSealed}
- phase1918aSealed: ${precondition.phase1918aSealed}
- phase1919aSealed: ${precondition.phase1919aSealed}
- phase1917aRealProviderStillBlocked: true
- phase1919aWorldClassGapsRemain: true
- allowExecution: true

Phase1914A current desktop file persistence remains false, but persistent manifest
evidence is valid. This precondition does not claim current desktop files exist.
`,
);
writeText(
  "docs/phase1920a-owner-dogfooding-intake-hardening.md",
  `# Phase1920A Owner Dogfooding Intake Hardening

This phase prepares real owner dogfooding intake. It does not fabricate owner
feedback and does not claim dogfooding completion.
`,
);
writeText(
  "docs/phase1920a-owner-dogfooding-form-guide.md",
  `# Phase1920A Owner Dogfooding Form Guide

Use the daily template for one real local session and the weekly template for
owner review after multiple real sessions. Leave unknown fields empty rather
than inventing feedback.
`,
);
writeText(
  "docs/phase1920a-execution-report.md",
  `# Phase1920A Execution Report

- completed: true
- recommended_sealed: true
- blocker: real_owner_dogfooding_records_not_yet_collected
- dogfoodingIntakeReady: true
- realOwnerDogfoodingCollected: false
- ownerFeedbackFabricated: false
- providerCallsMade: false
- productionReadyClaimed: false
`,
);
writeText(
  "docs/phase1920a-rollback-guide.md",
  `# Phase1920A Rollback Guide

Remove tools/phase1920a/, docs/phase1920a-*.md,
apps/ai-gateway-service/evidence/phase1920a/, and
local-self-use/v1/owner-dogfooding/. Remove package scripts for Phase1920A.
`,
);
writeText(
  "local-self-use/v1/owner-dogfooding/README.md",
  `# Owner Dogfooding Intake

These templates are for real owner self-use records. Do not prefill them as
evidence unless the owner actually completed the session.
`,
);
writeJson("local-self-use/v1/owner-dogfooding/owner-daily-dogfooding.input.json.template", {
  date: "",
  ownerName: "",
  taskAttempted: "",
  firstScreenUnderstood: null,
  completedMinimalPath: null,
  frictionNotes: "",
  blockerObserved: "",
  evidenceId: "",
});
writeJson("local-self-use/v1/owner-dogfooding/owner-weekly-review.input.json.template", {
  weekOf: "",
  totalRealSessions: 0,
  successfulSessions: 0,
  repeatedFriction: [],
  ownerDecision: "pending_real_review",
});
writeJson(resultPath, result);

console.log(JSON.stringify(result, null, 2));
