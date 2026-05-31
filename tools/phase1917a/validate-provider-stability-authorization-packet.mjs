import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const paths = Object.freeze({
  doc: "docs/phase1917a-guarded-real-provider-stability-authorization-packet.md",
  riskLedger: "docs/phase1917a-provider-test-risk-ledger.md",
  rollbackPlan: "docs/phase1917a-provider-test-rollback-plan.md",
  report: "docs/phase1917a-execution-report.md",
  template: "docs/approvals/phase1917a/provider-stability-test-authorization.input.json.template",
  result: "apps/ai-gateway-service/evidence/phase1917a/provider-stability-authorization-packet-result.json",
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

const template = readJson(paths.template) ?? {};
const result = readJson(paths.result) ?? {};
const checks = [
  check("docs_exist", existsSync(repoPath(paths.doc)) && existsSync(repoPath(paths.riskLedger)) && existsSync(repoPath(paths.rollbackPlan)) && existsSync(repoPath(paths.report))),
  check("template_exists", existsSync(repoPath(paths.template))),
  check("template_pending", template.approved === false && template.decision === "pending_owner_approval"),
  check("template_no_real_call", template.allowRealProviderCall === false && template.allowSecretRead === false && template.allowRawKeyOutput === false),
  check("template_bounded", template.maxRequests === 3 && template.maxCostUsd === 0 && template.timeoutMs === 30000),
  check("completed_true", result.completed === true),
  check("recommended_sealed_true", result.recommended_sealed === true),
  check("blocker_required", result.blocker === "provider_stability_owner_authorization_required_before_real_call"),
  check("packet_generated", result.authorizationPacketGenerated === true && result.authorizationTemplateGenerated === true),
  check("risk_rollback_generated", result.riskLedgerGenerated === true && result.rollbackPlanGenerated === true),
  check("provider_not_executed", result.realProviderStabilityTestExecuted === false && result.providerCallsMade === false && result.nonNvidiaProviderCallsMade === false),
  check("secret_false", result.secretValueExposed === false && result.rawSecretRead === false && result.authJsonRead === false),
  check("deploy_release_false", result.deployExecuted === false && result.releaseExecuted === false && result.tagCreated === false && result.artifactUploaded === false),
  check("chat_gateway_execute_false", result.chatGatewayExecuteModified === false),
  check("legacy_project_context_false", result.legacyModified === false && result.projectContextModified === false),
  check("workspace_clean_false", result.workspaceCleanClaimed === false),
  check("production_ready_false", result.productionReadyClaimed === false),
];

const passed = checks.every((item) => item.passed);
const validationResult = {
  phase: "Phase1917A",
  name: "Guarded Real Provider Stability Authorization Packet",
  completed: passed && result.completed === true,
  recommended_sealed: passed && result.recommended_sealed === true,
  blocker: result.blocker ?? "provider_stability_owner_authorization_required_before_real_call",
  authorizationPacketGenerated: result.authorizationPacketGenerated === true,
  authorizationTemplateGenerated: result.authorizationTemplateGenerated === true,
  riskLedgerGenerated: result.riskLedgerGenerated === true,
  rollbackPlanGenerated: result.rollbackPlanGenerated === true,
  realProviderStabilityTestExecuted: false,
  providerCallsMade: false,
  nonNvidiaProviderCallsMade: false,
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
  nextRecommendedPhase: "Phase1918A World-Class First Screen Lock",
  checks,
};

console.log(JSON.stringify(validationResult, null, 2));
if (!validationResult.completed || !validationResult.recommended_sealed || validationResult.blocker !== "provider_stability_owner_authorization_required_before_real_call") {
  process.exitCode = 1;
}
