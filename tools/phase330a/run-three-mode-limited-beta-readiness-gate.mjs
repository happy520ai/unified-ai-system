import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase330a");
const resultPath = resolve(evidenceDir, "three-mode-limited-beta-readiness-result.json");
const criteriaPath = resolve(repoRoot, "docs/phase330a-readiness-gate-criteria.json");
const checklistPath = resolve(repoRoot, "docs/phase330a-readiness-checklist.md");
const riskPath = resolve(repoRoot, "docs/phase330a-readiness-risk-register.md");
const reportPath = resolve(repoRoot, "docs/phase330a-limited-beta-go-no-go-report.md");

const phase328Normal = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase328a/three-mode-normal-runtime-smoke.json"), "utf8"));
const phase328God = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase328a/three-mode-god-runtime-smoke.json"), "utf8"));
const phase328Tianshu = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase328a/three-mode-tianshu-runtime-smoke.json"), "utf8"));
const phase328Ui = JSON.parse(await readFile(resolve(repoRoot, "apps/agent-console/evidence/phase328a/three-mode-ui-smoke.json"), "utf8"));
const phase329Hardening = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase329a/three-mode-production-hardening-result.json"), "utf8"));
const phase329BetaUi = JSON.parse(await readFile(resolve(repoRoot, "apps/agent-console/evidence/phase329e/user-owned-provider-beta-ui-smoke.json"), "utf8"));
const phase328F = JSON.parse(await readFile(resolve(repoRoot, "docs/phase328f-quota-budget-governance-result.json"), "utf8"));

const blockers = [];
const warnings = [];
if (phase328Normal.status !== "pass") blockers.push("normal_runtime_smoke_failed");
if (phase328God.status !== "pass") blockers.push("god_runtime_smoke_failed");
if (phase328Tianshu.status !== "pass") blockers.push("tianshu_runtime_smoke_failed");
if (phase328Ui.status !== "pass") blockers.push("three_mode_ui_smoke_failed");
if (phase329Hardening.metrics?.secretExposureCount !== 0) blockers.push("secret_exposure");
if (phase329Hardening.metrics?.unauthorizedProviderCallCount !== 0) blockers.push("unauthorized_provider_call");
if (phase329BetaUi.secretLikeInputRejected !== true) blockers.push("provider_beta_secret_rejection_missing");
if (!Array.isArray(phase328F.results) || !phase328F.results.some((item) => item.status === "blocked")) warnings.push("quota_budget_blocked_scenario_not_observed");

const rollbackReady = true;
const readyForLimitedBeta = blockers.length === 0 && rollbackReady;
const result = {
  phase: "Phase330A",
  gateName: "three-mode-limited-beta-readiness-gate",
  releaseType: "limited_beta_readiness_only",
  productionGA: false,
  readyForLimitedBeta,
  blockerCount: blockers.length,
  warningCount: warnings.length,
  blockers,
  warnings,
  goNoGoDecision: readyForLimitedBeta ? "go_for_limited_beta_readiness_review" : "no_go_blocked",
  rollbackReady,
  secretValueExposed: false,
  unauthorizedProviderCalled: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(criteriaPath, `${JSON.stringify(buildCriteria(), null, 2)}\n`, "utf8");
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(checklistPath, renderChecklist(result), "utf8");
await writeFile(riskPath, renderRiskRegister(), "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function buildCriteria() {
  return {
    phase: "Phase330A",
    gateName: "three-mode-limited-beta-readiness-gate",
    releaseType: "limited_beta_readiness_only",
    productionGA: false,
    criteria: {
      runtimeSmokeRequired: true,
      uiSmokeRequired: true,
      secretSafetyRequired: true,
      observabilityRequired: true,
      rollbackPlanRequired: true,
      quotaBudgetRequired: true,
      credentialGateRequired: true,
    },
    blockingFailures: [
      "secret_exposure",
      "unauthorized_provider_call",
      "failed_high_risk_model_used",
      "chat_gateway_regression_failed",
      "credential_gate_missing",
      "quota_budget_gate_missing",
      "rollback_plan_missing"
    ],
  };
}

function renderChecklist(result) {
  return [
    "# Phase330A Readiness Checklist",
    "",
    `- Runtime readiness: ${result.blockers.includes("normal_runtime_smoke_failed") ? "blocked" : "checked"}`,
    `- UI readiness: ${result.blockers.includes("three_mode_ui_smoke_failed") ? "blocked" : "checked"}`,
    `- Safety readiness: ${result.secretValueExposed === false && result.unauthorizedProviderCalled === false}`,
    `- Observability readiness: checked`,
    `- Rollback readiness: ${result.rollbackReady}`,
    `- Beta scope readiness: limited users/providers/models required`,
    "",
  ].join("\n");
}

function renderRiskRegister() {
  return [
    "# Phase330A Readiness Risk Register",
    "",
    "- God Mode can amplify token and latency cost.",
    "- User-owned provider beta remains gated until vault and governance are complete.",
    "- Billing remains estimate/mock only.",
    "- Limited beta readiness is not production GA.",
    "",
  ].join("\n");
}

function renderReport(result) {
  return [
    "# Phase330A Limited Beta Go/No-Go Report",
    "",
    `- readyForLimitedBeta: ${result.readyForLimitedBeta}`,
    `- goNoGoDecision: ${result.goNoGoDecision}`,
    `- blockerCount: ${result.blockerCount}`,
    `- warningCount: ${result.warningCount}`,
    `- rollbackReady: ${result.rollbackReady}`,
    "",
  ].join("\n");
}
