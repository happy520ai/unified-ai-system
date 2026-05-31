import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase331a");
const resultPath = resolve(evidenceDir, "limited-beta-controlled-rollout-dry-run-result.json");
const criteriaPath = resolve(repoRoot, "docs/phase331a-release-candidate-gate-criteria.json");
const planPath = resolve(repoRoot, "docs/phase331a-controlled-rollout-plan.json");
const reportPath = resolve(repoRoot, "docs/phase331a-release-candidate-go-no-go-report.md");
const riskPath = resolve(repoRoot, "docs/phase331a-rollout-risk-register.md");

const phase330a = await readJson("apps/ai-gateway-service/evidence/phase330a/three-mode-limited-beta-readiness-result.json");
const phase330b = await readJson("apps/ai-gateway-service/evidence/phase330b/god-mode-benchmark-regression-result.json");
const phase330e = await readJson("apps/agent-console/evidence/phase330e/provider-onboarding-wizard-hardening-smoke.json");
const phase330f = await readJson("apps/ai-gateway-service/evidence/phase330f/mock-invoice-flow-result.json");
const phase328Normal = await readJson("apps/ai-gateway-service/evidence/phase328a/three-mode-normal-runtime-smoke.json");
const phase328God = await readJson("apps/ai-gateway-service/evidence/phase328a/three-mode-god-runtime-smoke.json");
const phase328Tianshu = await readJson("apps/ai-gateway-service/evidence/phase328a/three-mode-tianshu-runtime-smoke.json");

const blockers = [];
const warnings = [];
if (phase330a.readyForLimitedBeta !== true || phase330a.blockerCount !== 0) blockers.push("phase330a_readiness_not_ready");
if (phase330a.rollbackReady !== true) blockers.push("rollback_plan_missing");
if (phase330a.secretValueExposed || phase330a.unauthorizedProviderCalled) blockers.push("phase330a_safety_failed");
if (phase330b.regressionDetected || phase330b.blockerDetected) blockers.push("god_benchmark_regression_detected");
if (phase330e.productionEnablementBlocked !== true || phase330e.rawSecretRejected !== true) blockers.push("provider_onboarding_gate_incomplete");
if (phase330f.estimateOnly !== true || phase330f.paymentProviderConnected !== false || phase330f.actualBillingConnected !== false) blockers.push("mock_invoice_boundary_failed");
if (phase328Normal.status !== "pass" || phase328God.status !== "pass" || phase328Tianshu.status !== "pass") blockers.push("runtime_smoke_failed");

const rolloutPlan = buildRolloutPlan();
if (!rolloutPlan.betaCohortPolicy?.maxUsers) blockers.push("beta_user_scope_unbounded");
if (!rolloutPlan.allowedProviders?.length || rolloutPlan.allowedProviders.length > 1) warnings.push("provider_scope_should_remain_minimal");

const readyForReleaseCandidate = blockers.length === 0;
const result = {
  phase: "Phase331A",
  gateName: "limited-beta-release-candidate-gate",
  readyForReleaseCandidate,
  releaseExecuted: false,
  deployExecuted: false,
  productionGA: false,
  blockerCount: blockers.length,
  warningCount: warnings.length,
  blockers,
  warnings,
  goNoGoDecision: readyForReleaseCandidate ? "go_for_limited_beta_release_candidate_dry_run" : "no_go_blocked",
  rollbackReady: phase330a.rollbackReady === true,
  secretValueExposed: false,
  unauthorizedProviderCalled: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(criteriaPath, `${JSON.stringify(buildCriteria(), null, 2)}\n`, "utf8");
await writeFile(planPath, `${JSON.stringify(rolloutPlan, null, 2)}\n`, "utf8");
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
await writeFile(riskPath, renderRiskRegister(), "utf8");
await writeFile(resolve(repoRoot, "docs/phase331a-limited-beta-controlled-rollout-design.md"), renderDesign(), "utf8");
await writeFile(resolve(repoRoot, "docs/phase331a-execution-report.md"), renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

async function readJson(path) {
  return JSON.parse(await readFile(resolve(repoRoot, path), "utf8"));
}

function buildCriteria() {
  return {
    phase: "Phase331A",
    gateName: "limited-beta-release-candidate-gate",
    releaseExecuted: false,
    deployExecuted: false,
    productionGA: false,
    requiredInputs: [
      "phase330a_readiness_result",
      "phase330b_regression_result",
      "phase330e_wizard_smoke",
      "phase330f_mock_invoice_flow",
    ],
    blockingFailures: [
      "secret_exposure",
      "unauthorized_provider_call",
      "runtime_smoke_failed",
      "chat_gateway_regression_failed",
      "quota_budget_gate_missing",
      "rollback_plan_missing",
      "provider_scope_unbounded",
      "beta_user_scope_unbounded",
    ],
  };
}

function buildRolloutPlan() {
  return {
    phase: "Phase331A",
    betaCohortPolicy: { maxUsers: 5, enrollment: "manual_allowlist_only", productionGA: false },
    allowedModes: ["normal", "god", "tianshu"],
    allowedProviders: ["nvidia"],
    allowedModels: [
      "nvidia/llama-3.3-nemotron-super-49b-v1",
      "nvidia/llama-3.1-nemotron-nano-8b-v1",
    ],
    maxGodParticipants: 2,
    maxTianshuEscalationsPerDay: 10,
    dailyQuota: { requestsPerUser: 20, godModeRequestsPerUser: 5 },
    budgetLimit: { dailyEstimatedCostUsd: 2, singleRequestEstimatedCostUsd: 0.25 },
    rollbackTrigger: ["secret_safety_failure", "chat_gateway_regression", "quota_budget_gate_failure"],
    monitoringWindow: "72h_dry_run_observation",
    exitCriteria: ["zero_secret_exposure", "zero_unauthorized_provider_calls", "no_runtime_regression"],
  };
}

function renderDesign() {
  return [
    "# Phase331A Limited Beta Controlled Rollout Design",
    "",
    "This phase is a release-candidate dry-run only. It does not release, deploy, tag, or publish artifacts.",
    "The gate reads Phase330 readiness, regression, wizard, and mock invoice evidence and produces a bounded allowlist rollout plan.",
    "",
  ].join("\n");
}

function renderReport(result) {
  return [
    "# Phase331A Release Candidate Go/No-Go Report",
    "",
    `- readyForReleaseCandidate: ${result.readyForReleaseCandidate}`,
    `- releaseExecuted: ${result.releaseExecuted}`,
    `- deployExecuted: ${result.deployExecuted}`,
    `- goNoGoDecision: ${result.goNoGoDecision}`,
    `- blockerCount: ${result.blockerCount}`,
    `- warningCount: ${result.warningCount}`,
    `- rollbackReady: ${result.rollbackReady}`,
    "",
  ].join("\n");
}

function renderRiskRegister() {
  return [
    "# Phase331A Rollout Risk Register",
    "",
    "- Limited beta candidate approval is not a real release.",
    "- Provider scope remains NVIDIA-only until credential vault and user-owned provider gates are explicitly approved.",
    "- Mock invoice surfaces must remain estimate-only and not legal invoices.",
    "- Rollback must disable three-mode beta surfaces before expanding cohort size.",
    "",
  ].join("\n");
}
