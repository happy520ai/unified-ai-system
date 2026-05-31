import { readJsonFile, resolveRepoRoot, safeArray, sanitizeValue } from "./contextPackPreviewReader.js";
import { loadPhase600AuthorizationInput } from "./phase600AuthorizationInputLoader.js";

const phase600EvidencePath = "apps/ai-gateway-service/evidence/phase600a-t-authorization-input-readiness-review.json";
const acceptedHumanApprovalStatuses = Object.freeze([
  "approved_for_guarded_real_test_readiness_review",
  "approved_for_future_guarded_real_test",
]);

export function buildPhase601ReadinessImport(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const phase600Evidence = readJsonFile(repoRoot, phase600EvidencePath);
  const evidence = phase600Evidence.data || {};
  const input = loadPhase600AuthorizationInput({ repoRoot });
  const packet = input.packet || {};
  const configScope = packet.configScope || evidence.configScope || "session_override";
  const phase600Completed = evidence.completed === true && evidence.recommended_sealed === true;
  const authorizationComplete = evidence.authorizationComplete === true;
  const humanApprovalStatus = evidence.humanApprovalStatus || "missing";
  const futureGuardedRealTestCandidate = evidence.futureGuardedRealTestCandidate === true;
  const phase600ReadinessSatisfied =
    phase600Completed &&
    authorizationComplete &&
    acceptedHumanApprovalStatuses.includes(humanApprovalStatus) &&
    configScope === "session_override" &&
    futureGuardedRealTestCandidate &&
    evidence.realConfigWriteAllowed === false &&
    evidence.relayStartAllowed === false &&
    evidence.providerCallAllowed !== true;

  return {
    completed: true,
    phase600EvidenceReadable: phase600Evidence.exists === true && phase600Evidence.valid === true,
    phase600EvidencePath,
    phase600Completed,
    phase600RecommendedSealed: evidence.recommended_sealed === true,
    authorizationCompleteImported: Object.prototype.hasOwnProperty.call(evidence, "authorizationComplete"),
    authorizationComplete,
    humanApprovalStatusImported: Object.prototype.hasOwnProperty.call(evidence, "humanApprovalStatus"),
    humanApprovalStatus,
    acceptedHumanApprovalStatuses: [...acceptedHumanApprovalStatuses],
    configScopeImported: true,
    configScope,
    futureGuardedRealTestCandidateImported: Object.prototype.hasOwnProperty.call(evidence, "futureGuardedRealTestCandidate"),
    futureGuardedRealTestCandidate,
    phase600RequiredIfMissing: true,
    phase600ReadinessSatisfied,
    phase600MissingReasons: buildMissingReasons({
      phase600Evidence,
      phase600Completed,
      authorizationComplete,
      humanApprovalStatus,
      configScope,
      futureGuardedRealTestCandidate,
      evidence,
    }),
    importedPreview: sanitizeValue({
      authorizationComplete,
      humanApprovalStatus,
      configScope,
      futureGuardedRealTestCandidate,
      realConfigWriteAllowed: evidence.realConfigWriteAllowed === true,
      relayStartAllowed: evidence.relayStartAllowed === true,
      providerCallAllowed: evidence.providerCallAllowed === true,
      phaseCount: evidence.phaseCount || safeArray(evidence.phases).length,
    }),
    rawSecretAccessed: false,
    secretValueExposed: false,
    rawWebhookAccessed: false,
    webhookValueExposed: false,
  };
}

function buildMissingReasons({ phase600Evidence, phase600Completed, authorizationComplete, humanApprovalStatus, configScope, futureGuardedRealTestCandidate, evidence }) {
  const reasons = [];
  if (phase600Evidence.exists !== true || phase600Evidence.valid !== true) reasons.push("phase600_evidence_missing_or_invalid");
  if (!phase600Completed) reasons.push("phase600_not_completed_or_not_recommended_sealed");
  if (!authorizationComplete) reasons.push("phase600_authorization_complete_false");
  if (!acceptedHumanApprovalStatuses.includes(humanApprovalStatus)) reasons.push("phase600_human_approval_not_guarded_readiness");
  if (configScope !== "session_override") reasons.push("phase600_config_scope_not_session_override");
  if (!futureGuardedRealTestCandidate) reasons.push("phase600_future_guarded_real_test_candidate_false");
  if (evidence.realConfigWriteAllowed === true) reasons.push("phase600_real_config_write_allowed_true");
  if (evidence.relayStartAllowed === true) reasons.push("phase600_relay_start_allowed_true");
  if (evidence.providerCallAllowed === true) reasons.push("phase600_provider_call_allowed_true");
  return reasons;
}
