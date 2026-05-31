import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const paths = Object.freeze({
  evidence: "apps/ai-gateway-service/evidence/phase1919a/world-class-readiness-gap-review-result.json",
  gapMd: "apps/ai-gateway-service/evidence/phase1919a/world-class-readiness-gap-report.md",
  gapJson: "apps/ai-gateway-service/evidence/phase1919a/world-class-readiness-gap-report.json",
  doc: "docs/phase1919a-world-class-readiness-gap-review.md",
  p0p1: "docs/phase1919a-p0-p1-risk-ledger.md",
  nextTrack: "docs/phase1919a-next-track-recommendation.md",
  report: "docs/phase1919a-execution-report.md",
  rollback: "docs/phase1919a-rollback-guide.md",
  summaryDoc: "docs/phase1916-1919a-world-class-conversion-summary.md",
  summaryEvidence: "apps/ai-gateway-service/evidence/phase1916_1919a/world-class-conversion-summary-result.json",
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

const result = readJson(paths.evidence) ?? {};
const gap = readJson(paths.gapJson) ?? {};
const summary = readJson(paths.summaryEvidence) ?? {};
const checks = [
  check("docs_exist", existsSync(repoPath(paths.doc)) && existsSync(repoPath(paths.p0p1)) && existsSync(repoPath(paths.nextTrack)) && existsSync(repoPath(paths.report)) && existsSync(repoPath(paths.rollback))),
  check("gap_report_exists", existsSync(repoPath(paths.gapMd)) && Array.isArray(gap.dimensions) && gap.dimensions.length === 10),
  check("summary_exists", existsSync(repoPath(paths.summaryDoc)) && summary.phaseRange === "Phase1916A-1919A"),
  check("completed_true", result.completed === true),
  check("recommended_sealed_true", result.recommended_sealed === true),
  check("blocker_retained", result.blocker === "world_class_readiness_gaps_remain"),
  check("ledgers_generated", result.gapReviewGenerated === true && result.p0LedgerGenerated === true && result.p1LedgerGenerated === true),
  check("non_claims_false", result.productionReadyClaimed === false && result.publicLaunchReadyClaimed === false && result.realProviderStabilityClaimed === false && result.deployReadyClaimed === false),
  check("provider_false", result.providerCallsMade === false),
  check("secret_false", result.secretValueExposed === false && result.rawSecretRead === false && result.authJsonRead === false),
  check("deploy_release_false", result.deployExecuted === false && result.releaseExecuted === false && result.tagCreated === false && result.artifactUploaded === false),
  check("chat_gateway_execute_false", result.chatGatewayExecuteModified === false),
  check("legacy_project_context_false", result.legacyModified === false && result.projectContextModified === false),
  check("workspace_clean_false", result.workspaceCleanClaimed === false),
  check("summary_flags", summary.completed === true && summary.providerCallsMade === false && summary.productionReadyClaimed === false && summary.publicLaunchReadyClaimed === false),
];

const passed = checks.every((item) => item.passed);
const validationResult = {
  phase: "Phase1919A",
  name: "World-Class Readiness Gap Review",
  completed: passed && result.completed === true,
  recommended_sealed: passed && result.recommended_sealed === true,
  blocker: result.blocker ?? "world_class_readiness_gaps_remain",
  gapReviewGenerated: result.gapReviewGenerated === true,
  p0LedgerGenerated: result.p0LedgerGenerated === true,
  p1LedgerGenerated: result.p1LedgerGenerated === true,
  productionReadyClaimed: false,
  publicLaunchReadyClaimed: false,
  realProviderStabilityClaimed: false,
  ownerDogfoodingCompleteClaimed: false,
  deployReadyClaimed: false,
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
  nextRecommendedTrack: "Phase1920A-1930A World-Class Hardening Sprint",
  checks,
};

console.log(JSON.stringify(validationResult, null, 2));
if (!validationResult.completed || !validationResult.recommended_sealed || validationResult.blocker !== "world_class_readiness_gaps_remain") {
  process.exitCode = 1;
}
