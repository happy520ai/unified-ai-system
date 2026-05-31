import { ensurePhaseDirs, logResult, paths, readJsonIfPresent, sealFromChecks, writeDoc, writeJson } from "./phase971-1000-common.mjs";

ensurePhaseDirs();
const disabled = readJsonIfPresent(paths.disabledPolicy) || {};
const tuning = readJsonIfPresent(paths.tuningCandidates) || {};
const preview = readJsonIfPresent(paths.guardedPreview) || {};
const rollback = readJsonIfPresent(paths.rollbackSafeMode) || {};
const result = sealFromChecks("Phase976-980", {
  routePolicyTuningCandidatePackReady: tuning.routePolicyTuningCandidatePackReady === true,
  disabledByDefaultPolicyConfigReady: disabled.defaultEnabled === false,
  guardedRuntimePolicyPreviewReady: preview.guardedRuntimePolicyPreviewReady === true,
  policyRollbackSafeModeReady: rollback.policyRollbackSafeModeReady === true,
  requiresFutureApprovalForRuntimePolicyChange: true,
}, {
  rollbackReady: rollback.rollbackReady === true,
  safeModeReady: rollback.safeModeReady === true,
  routePolicyAppliedToRuntime: false,
});
writeJson(paths.policySeal, result);
writeDoc("docs/phase971-1000/phase980-route-policy-design-seal.md", {
  title: "Phase980 Route Policy Design Seal",
  goal: "Seal disabled-by-default policy design and safe rollback pack.",
  facts: [`recommended_sealed=${result.recommended_sealed}`, `routePolicyAppliedToRuntime=${result.routePolicyAppliedToRuntime}`],
  boundaries: ["No runtime policy application."],
  outputs: [paths.policySeal],
});
logResult(result);
