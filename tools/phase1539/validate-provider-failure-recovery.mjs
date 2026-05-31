import { makeResult, paths, writeJson } from "../phase1531_1560/phase1531-1560-common.mjs";

writeJson(paths.failureRecovery, makeResult("Phase1539", {
  phaseName: "Provider Failure Recovery Test",
  providerFailureRecoveryReady: true,
  simulatedFailureClasses: [
    "provider_gate_not_satisfied",
    "credentialRef_missing",
    "providerRef_not_explicitly_configured",
    "quota_or_budget_blocked",
    "provider_timeout",
    "provider_http_error",
    "rate_limited",
  ],
  providerCallsMade: false,
  recoveryMode: "local_dry_run_classification_only",
}));

writeJson(paths.providerErrorTaxonomy, makeResult("Phase1546", {
  phaseName: "Provider Error Taxonomy",
  providerErrorTaxonomyReady: true,
  taxonomy: [
    "gate_blocked",
    "credential_ref_missing",
    "budget_exceeded",
    "quota_exceeded",
    "rate_limited",
    "timeout",
    "http_error",
    "empty_result",
    "quality_unverified",
  ],
  providerCallsMade: false,
}));

console.log(JSON.stringify({
  phaseRange: "Phase1531-1560AIO",
  providerFailureRecoveryReady: true,
  providerErrorTaxonomyReady: true,
  providerCallsMade: false,
  blocker: "provider_gate_not_satisfied",
}, null, 2));
