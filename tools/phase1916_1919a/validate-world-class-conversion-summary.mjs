import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const paths = Object.freeze({
  summaryDoc: "docs/phase1916-1919a-world-class-conversion-summary.md",
  summaryEvidence: "apps/ai-gateway-service/evidence/phase1916_1919a/world-class-conversion-summary-result.json",
  preconditionEvidence: "apps/ai-gateway-service/evidence/phase1916_1919a/precondition-check-result.json",
  phase1916a: "apps/ai-gateway-service/evidence/phase1916a/three-mode-minimal-task-loop-result.json",
  phase1917a: "apps/ai-gateway-service/evidence/phase1917a/provider-stability-authorization-packet-result.json",
  phase1918a: "apps/ai-gateway-service/evidence/phase1918a/world-class-first-screen-lock-result.json",
  phase1919a: "apps/ai-gateway-service/evidence/phase1919a/world-class-readiness-gap-review-result.json",
});

function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(repoPath(relativePath), "utf8"));
  } catch {
    return null;
  }
}

function check(id, passed) {
  return { id, passed: Boolean(passed) };
}

const summary = readJson(paths.summaryEvidence) ?? {};
const precondition = readJson(paths.preconditionEvidence) ?? {};
const phase1916a = readJson(paths.phase1916a) ?? {};
const phase1917a = readJson(paths.phase1917a) ?? {};
const phase1918a = readJson(paths.phase1918a) ?? {};
const phase1919a = readJson(paths.phase1919a) ?? {};

const checks = [
  check("summary_doc_exists", existsSync(repoPath(paths.summaryDoc))),
  check("precondition_allows_execution", precondition.allowExecution === true),
  check("summary_completed", summary.completed === true && summary.recommended_sealed === true),
  check("summary_blocker_retained", summary.blocker === "world_class_readiness_gaps_remain"),
  check("phase1916_completed", phase1916a.completed === true && phase1916a.blocker === null),
  check("phase1917_completed", phase1917a.completed === true && phase1917a.blocker === "provider_stability_owner_authorization_required_before_real_call"),
  check("phase1918_completed", phase1918a.completed === true && phase1918a.blocker === null),
  check("phase1919_completed", phase1919a.completed === true && phase1919a.blocker === "world_class_readiness_gaps_remain"),
  check("capabilities_ready", summary.threeModeMinimalLoopReady === true && summary.providerAuthorizationPacketReady === true && summary.firstScreenLocked === true && summary.worldClassGapReviewGenerated === true),
  check("provider_false", summary.realProviderCallExecuted === false && summary.providerCallsMade === false),
  check("secret_false", summary.secretValueExposed === false && summary.rawSecretRead === false && summary.authJsonRead === false),
  check("deploy_release_false", summary.deployExecuted === false && summary.releaseExecuted === false && summary.tagCreated === false && summary.artifactUploaded === false),
  check("chat_gateway_execute_false", summary.chatGatewayExecuteModified === false),
  check("legacy_project_context_false", summary.legacyModified === false && summary.projectContextModified === false),
  check("workspace_clean_false", summary.workspaceCleanClaimed === false),
  check("production_public_false", summary.productionReadyClaimed === false && summary.publicLaunchReadyClaimed === false),
];

const passed = checks.every((item) => item.passed);
const validationResult = {
  phaseRange: "Phase1916A-1919A",
  name: "World-Class Product Conversion Layer 3-6",
  completed: passed && summary.completed === true,
  recommended_sealed: passed && summary.recommended_sealed === true,
  blocker: summary.blocker ?? "world_class_readiness_gaps_remain",
  phase1916aCompleted: phase1916a.completed === true,
  phase1917aCompleted: phase1917a.completed === true,
  phase1918aCompleted: phase1918a.completed === true,
  phase1919aCompleted: phase1919a.completed === true,
  threeModeMinimalLoopReady: summary.threeModeMinimalLoopReady === true,
  providerAuthorizationPacketReady: summary.providerAuthorizationPacketReady === true,
  firstScreenLocked: summary.firstScreenLocked === true,
  worldClassGapReviewGenerated: summary.worldClassGapReviewGenerated === true,
  realProviderCallExecuted: false,
  providerCallsMade: false,
  secretValueExposed: false,
  rawSecretRead: false,
  authJsonRead: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  workspaceCleanClaimed: false,
  productionReadyClaimed: false,
  publicLaunchReadyClaimed: false,
  nextRecommendedTrack: "Phase1920A-1930A World-Class Hardening Sprint",
  checks,
};

console.log(JSON.stringify(validationResult, null, 2));
if (!validationResult.completed || !validationResult.recommended_sealed || validationResult.blocker !== "world_class_readiness_gaps_remain") {
  process.exitCode = 1;
}
