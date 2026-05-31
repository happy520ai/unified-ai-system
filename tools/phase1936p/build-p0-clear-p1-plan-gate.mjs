import { readJson, writeJson } from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase1932Path = "apps/ai-gateway-service/evidence/phase1932p/guarded-real-provider-stability-test-result.json";
const phase1933Path = "apps/ai-gateway-service/evidence/phase1933p/single-provider-stability-boundary-seal-result.json";
const phase1934Path = "apps/ai-gateway-service/evidence/phase1934p/three-mode-real-task-closure-result.json";
const phase1935Path = "apps/ai-gateway-service/evidence/phase1935p/boss-mode-owner-pilot-intake-result.json";
const resultPath = "apps/ai-gateway-service/evidence/phase1936p/p0-clear-p1-plan-gate-result.json";

const phase1932 = readJson(phase1932Path).data ?? {};
const phase1933 = readJson(phase1933Path).data ?? {};
const phase1934 = readJson(phase1934Path).data ?? {};
const phase1935 = readJson(phase1935Path).data ?? {};

const p0Blockers = [];
if (phase1932.recommended_sealed !== true) {
  p0Blockers.push({
    id: "provider_stability_not_verified",
    source: "Phase1932P",
    blocker: phase1932.blocker ?? "provider_stability_not_verified",
    treatment: "Provide an authorized safe internal provider executor, then retry guarded Phase1932P.",
  });
}
if (phase1933.recommended_sealed !== true) {
  p0Blockers.push({
    id: "single_provider_boundary_not_sealed",
    source: "Phase1933P",
    blocker: phase1933.blocker ?? "single_provider_boundary_not_sealed",
    treatment: "Seal Phase1933P only after Phase1932P passes 3 of 3 guarded requests.",
  });
}
if (phase1934.recommended_sealed !== true) {
  p0Blockers.push({
    id: "three_mode_closure_not_passed",
    source: "Phase1934P",
    blocker: phase1934.blocker ?? "three_mode_closure_not_passed",
    treatment: "Repair deterministic three-mode closure and rerun verifier.",
  });
}

const p1Items = [];
if (phase1935.ownerPilotPassed !== true) {
  p1Items.push({
    id: "owner_pilot_records_missing",
    source: "Phase1935P",
    blocker: phase1935.blocker ?? "real_owner_pilot_records_missing",
    plan: "Owner must add real daily pilot records for seven consecutive days; templates are not counted.",
  });
}
p1Items.push({
  id: "rollback_real_drill_authorization_pending",
  source: "Phase1937P",
  plan: "Keep rollback dry-run until owner explicitly authorizes real rollback drill.",
});

const result = {
  phase: "Phase1936P",
  name: "P0 Clear / P1 Plan Gate",
  completed: true,
  recommended_sealed: p0Blockers.length === 0,
  blocker: p0Blockers.length === 0 ? null : "p0_blockers_remain",
  p0BlockerCount: p0Blockers.length,
  p0Blockers,
  p1TreatmentPlanGenerated: true,
  p1ItemCount: p1Items.length,
  p1Items,
  providerCallsMadeThisPhase: false,
  rawSecretRead: false,
  secretValueExposed: false,
  authJsonRead: false,
  envDumped: false,
  rawKeyOutput: false,
  authHeaderLogged: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  commitCreated: false,
  pushExecuted: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  workspaceCleanClaimed: false,
  productionReadyClaimed: false,
  publicLaunchReadyClaimed: false,
  commercialReadyClaimed: false,
};

writeJson(resultPath, result);
console.log(JSON.stringify(result, null, 2));

if (result.recommended_sealed !== true || result.blocker !== null) {
  process.exitCode = 1;
}
