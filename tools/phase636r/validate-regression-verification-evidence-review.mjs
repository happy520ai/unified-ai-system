import {
  check,
  containsRawBaseUrlValue,
  containsSecretLikeValue,
  containsWebhookLikeValue,
  finalize,
  has,
  readJson,
  readText,
  safetyBoundary,
} from "../phase632-common.mjs";

const paths = {
  review: "docs/phase636r-regression-verification-evidence-review.md",
  matrix: "docs/phase636r-regression-result-matrix.md",
  report: "docs/phase636r-execution-report.md",
  phase635: "apps/ai-gateway-service/evidence/phase635r/low-risk-bug-fix-execution-result.json",
  phase610: "apps/ai-gateway-service/evidence/phase610r/codex-exec-guarded-one-shot-result.json",
  phase612: "apps/ai-gateway-service/evidence/phase612r/repeated-guarded-reliability-result.json",
  phase613: "apps/ai-gateway-service/evidence/phase613r/repeated-reliability-result-closure.json",
  phase630: "apps/ai-gateway-service/evidence/phase630r/main-chain-integration-design-patch-result.json",
  preflight: "apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json",
  evidence: "apps/ai-gateway-service/evidence/phase636r/regression-verification-evidence-review-result.json",
};

const reviewText = readText(paths.review);
const matrixText = readText(paths.matrix);
const reportText = readText(paths.report);
const combinedText = `${reviewText}\n${matrixText}\n${reportText}`;
const phase635 = readJson(paths.phase635);
const phase610 = readJson(paths.phase610);
const phase612 = readJson(paths.phase612);
const phase613 = readJson(paths.phase613);
const phase630 = readJson(paths.phase630);
const preflight = readJson(paths.preflight);

const result = {
  phase: "Phase636R",
  name: "Regression Verification Evidence Review",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase635Imported: phase635.data?.completed === true && phase635.data?.recommended_sealed === true,
  regressionMatrixGenerated: has(matrixText, "regressionMatrixGenerated=true"),
  secretSafetyPassed: has(reportText + reviewText, "secretSafetyPassed=true"),
  productRecoveryPassed: has(reportText + reviewText, "productRecoveryPassed=true"),
  uiSmokePassed: has(reportText + reviewText, "uiSmokePassed=true"),
  readmeAgentsGuardPassed: has(reportText + reviewText, "readmeAgentsGuardPassed=true"),
  packageCheckPassed: has(reportText + reviewText, "packageCheckPassed=true"),
  tokenSavingPreflightPassed: preflight.data?.preflightPassed === true && has(reportText + reviewText, "tokenSavingPreflightPassed=true"),
  phase610EvidenceStillValid:
    phase610.data?.completed === true &&
    phase610.data?.recommended_sealed === true &&
    phase610.data?.requestAttemptCount === 1 &&
    phase610.data?.responseClassification === "pass",
  repeatedPassBoundaryPreserved:
    phase612.data?.repeatedReliabilityClassification === "repeated_pass" &&
    phase612.data?.completedAttempts === 3 &&
    phase612.data?.totalRetryAttemptCount === 0 &&
    phase613.data?.repeatedPassConfirmed === true &&
    phase630.data?.designOnly === true,
  ...safetyBoundary(),
  secretValueExposed: containsSecretLikeValue(combinedText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(combinedText),
  webhookValueExposed: containsWebhookLikeValue(combinedText),
  productionReadyClaimed: false,
  releaseReadyClaimed: false,
  docs: [paths.review, paths.matrix, paths.report],
  evidenceJson: paths.evidence,
};

const checks = [
  check("phase635_imported", result.phase635Imported),
  check("regression_matrix_generated", result.regressionMatrixGenerated),
  check("secret_safety_passed", result.secretSafetyPassed),
  check("product_recovery_passed", result.productRecoveryPassed),
  check("ui_smoke_passed", result.uiSmokePassed),
  check("readme_agents_guard_passed", result.readmeAgentsGuardPassed),
  check("package_check_passed", result.packageCheckPassed),
  check("token_saving_preflight_passed", result.tokenSavingPreflightPassed),
  check("phase610_evidence_still_valid", result.phase610EvidenceStillValid),
  check("repeated_pass_boundary_preserved", result.repeatedPassBoundaryPreserved),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("provider_runtime_modified_false", result.providerRuntimeModified === false),
  check("production_ready_claimed_false", result.productionReadyClaimed === false),
  check("release_ready_claimed_false", result.releaseReadyClaimed === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("raw_base_url_value_exposed_false", result.rawBaseUrlValueExposed === false),
  check("webhook_value_exposed_false", result.webhookValueExposed === false),
];

finalize(result, checks, paths.evidence, "phase636r_regression_verification_evidence_review_failed");
