import { readJsonFile, resolveRepoRoot, safeArray, sanitizeValue } from "./contextPackPreviewReader.js";

const phase600Path = "apps/ai-gateway-service/evidence/phase600a-t-authorization-input-readiness-review.json";
const phase601Path = "apps/ai-gateway-service/evidence/phase601a-t-guarded-real-base-url-test-preparation.json";

export function buildPhase602ReadinessImport(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const phase600File = readJsonFile(repoRoot, phase600Path);
  const phase601File = readJsonFile(repoRoot, phase601Path);
  const phase600 = phase600File.data || {};
  const phase601 = phase601File.data || {};
  const phase600Ready =
    phase600.completed === true &&
    phase600.recommended_sealed === true &&
    phase600.authorizationComplete === true &&
    phase600.futureGuardedRealTestCandidate === true;
  const phase601Ready =
    phase601.completed === true &&
    phase601.recommended_sealed === true &&
    phase601.finalCommandBundlePreviewGenerated === true &&
    phase601.finalUserConfirmationRequired === true;

  return {
    completed: true,
    phase600ReadinessImported: phase600File.exists === true && phase600File.valid === true,
    phase601CommandBundleImported: phase601File.exists === true && phase601File.valid === true,
    phase600EvidencePath: phase600Path,
    phase601EvidencePath: phase601Path,
    authorizationComplete: phase600.authorizationComplete === true,
    futureGuardedRealTestCandidate: phase600.futureGuardedRealTestCandidate === true,
    phase600ReadinessSatisfied: phase600Ready,
    phase601PreparationSatisfied: phase601Ready && phase600Ready,
    finalCommandBundlePreviewExists: phase601.finalCommandBundlePreviewGenerated === true || phase601.finalCommandBundlePreview?.finalCommandBundlePreviewGenerated === true,
    rollbackPreviewExists: phase601.rollbackCommandPreviewGenerated === true || phase601.rollbackCommandPreview?.rollbackCommandPreviewGenerated === true,
    emergencyDisablePreviewExists: phase601.emergencyDisablePreviewGenerated === true || phase601.emergencyDisablePreview?.emergencyDisablePreviewGenerated === true,
    phase601RequiredIfMissing: true,
    missingReasons: buildMissingReasons({ phase600File, phase601File, phase600, phase601, phase600Ready, phase601Ready }),
    importedPreview: sanitizeValue({
      phase600Blocker: phase600.blocker || null,
      phase601Blocker: phase601.blocker || null,
      authorizationComplete: phase600.authorizationComplete === true,
      futureGuardedRealTestCandidate: phase600.futureGuardedRealTestCandidate === true,
      phase601PhaseCount: phase601.phaseCount || safeArray(phase601.phases).length,
      finalCommandBundlePreviewGenerated: phase601.finalCommandBundlePreviewGenerated === true,
    }),
  };
}

function buildMissingReasons({ phase600File, phase601File, phase600, phase601, phase600Ready, phase601Ready }) {
  const reasons = [];
  if (phase600File.exists !== true || phase600File.valid !== true) reasons.push("phase600_evidence_missing_or_invalid");
  if (phase601File.exists !== true || phase601File.valid !== true) reasons.push("phase601_evidence_missing_or_invalid");
  if (phase600.completed !== true || phase600.recommended_sealed !== true) reasons.push("phase600_not_completed_or_not_recommended_sealed");
  if (phase600.authorizationComplete !== true) reasons.push("phase600_authorization_complete_false");
  if (phase600.futureGuardedRealTestCandidate !== true) reasons.push("phase600_future_guarded_real_test_candidate_false");
  if (phase601.completed !== true || phase601.recommended_sealed !== true) reasons.push("phase601_not_completed_or_not_recommended_sealed");
  if (phase601.finalCommandBundlePreviewGenerated !== true && phase601.finalCommandBundlePreview?.finalCommandBundlePreviewGenerated !== true) reasons.push("phase601_final_command_bundle_missing");
  if (!phase600Ready || !phase601Ready) reasons.push("phase601_required");
  return reasons;
}
